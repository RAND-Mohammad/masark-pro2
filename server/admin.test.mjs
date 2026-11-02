import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createAdminRouter } from './admin.mjs';

const adminId = '9449c1c9-6e9a-40b6-b976-79652455c61f';
const otherId = '1688af2e-40b4-4368-bf9a-4ff3aa2dc300';
const sampleResource = {
  id: 'safe-course', title: 'Safe Course', provider: 'Learning Provider', url: 'https://learn.example.org/course',
  skillIds: ['T0217'], level: 'Beginner', duration: '2 hours', access: 'Free', language: 'English',
};

async function withAdminServer(t, { actorId = adminId, now = () => Date.now(), checkResourceLink, store, jobs, scheduler } = {}) {
  const previous = process.env.MASARAK_ADMIN_USER_IDS;
  process.env.MASARAK_ADMIN_USER_IDS = adminId;
  t.after(() => {
    if (previous === undefined) delete process.env.MASARAK_ADMIN_USER_IDS;
    else process.env.MASARAK_ADMIN_USER_IDS = previous;
  });
  const app = express();
  app.use('/admin', createAdminRouter({
    authenticate: (_req, res, next) => { res.locals.cvUser = { id: actorId }; next(); },
    store: store ?? { saveResource: async resource => resource },
    jobs: jobs ?? { status: () => ({ configured: true, categories: {} }) },
    scheduler,
    checkResourceLink: checkResourceLink ?? (async () => ({ checkedAt: '2026-11-01T00:00:00.000Z', statusCode: 200 })),
    now,
  }));
  const server = app.listen(0);
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  t.after(() => new Promise(resolve => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}/admin`;
}

async function post(base, path, body) {
  const response = await fetch(`${base}/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { response, body: await response.json() };
}

test('publishing is refused until the signed-in admin checks the same exact resource URL', async t => {
  let saved;
  const base = await withAdminServer(t, { store: { saveResource: async (resource, options) => { saved = { resource, options }; return resource; } } });
  const noCheck = await post(base, 'resources', { resource: sampleResource, visible: true, reviewed: true });
  assert.equal(noCheck.response.status, 400);
  assert.equal(saved, undefined);

  const checked = await post(base, 'resources/check-link', { url: sampleResource.url });
  assert.equal(checked.response.status, 200);
  assert.match(checked.body.token, /^[0-9a-f-]{36}$/);
  assert.equal(checked.body.statusCode, 200);

  const altered = await post(base, 'resources', { resource: { ...sampleResource, url: 'https://other.example.org/course' }, visible: true, reviewed: true, linkCheckToken: checked.body.token });
  assert.equal(altered.response.status, 400);
  assert.equal(saved, undefined);

  const published = await post(base, 'resources', { resource: sampleResource, visible: true, reviewed: true, linkCheckToken: checked.body.token });
  assert.equal(published.response.status, 200);
  assert.equal(saved.options.linkCheckStatus, 'reachable');
  assert.equal(saved.options.linkCheckedAt, '2026-11-01T00:00:00.000Z');

  const replay = await post(base, 'resources', { resource: sampleResource, visible: true, reviewed: true, linkCheckToken: checked.body.token });
  assert.equal(replay.response.status, 400);
});

test('link-check proof expires and a non-admin cannot use the link checker', async t => {
  let currentTime = 0;
  let checks = 0;
  const base = await withAdminServer(t, { now: () => currentTime, checkResourceLink: async () => { checks += 1; return { checkedAt: '2026-11-01T00:00:00.000Z', statusCode: 200 }; } });
  const checked = await post(base, 'resources/check-link', { url: sampleResource.url });
  assert.equal(checked.response.status, 200);
  currentTime = 10 * 60 * 1000 + 1;
  const expired = await post(base, 'resources', { resource: sampleResource, visible: true, reviewed: true, linkCheckToken: checked.body.token });
  assert.equal(expired.response.status, 400);

  const deniedBase = await withAdminServer(t, { actorId: otherId, checkResourceLink: async () => { checks += 1; return { checkedAt: '2026-11-01T00:00:00.000Z', statusCode: 200 }; } });
  const denied = await post(deniedBase, 'resources/check-link', { url: sampleResource.url });
  assert.equal(denied.response.status, 403);
  assert.equal(checks, 1);
});

test('unreachable links cannot be approved by the admin UI', async t => {
  const base = await withAdminServer(t, { checkResourceLink: async () => { throw Object.assign(new Error('upstream failure'), { statusCode: 404 }); } });
  const result = await post(base, 'resources/check-link', { url: sampleResource.url });
  assert.equal(result.response.status, 422);
  assert.match(result.body.error, /HTTP 404/);
});

test('redirects return a canonical destination but do not issue a publish token', async t => {
  const base = await withAdminServer(t, {
    checkResourceLink: async () => ({ checkedAt: '2026-11-01T00:00:00.000Z', statusCode: 200, redirected: true, destination: 'https://canonical.example.org/course' }),
  });
  const result = await post(base, 'resources/check-link', { url: sampleResource.url });
  assert.equal(result.response.status, 200);
  assert.equal(result.body.redirected, true);
  assert.equal(result.body.destination, 'https://canonical.example.org/course');
  assert.equal(result.body.token, undefined);
});

test('schedule can only be changed by an admin and is applied after persistent storage succeeds', async t => {
  let saved;
  let applied;
  const base = await withAdminServer(t, {
    store: {
      getJobsSchedule: async () => ({ enabled: true, intervalHours: 6, persisted: true, storageAvailable: true, updatedAt: null }),
      saveJobsSchedule: async (schedule, actorId) => { saved = { schedule, actorId }; return { ...schedule, persisted: true, storageAvailable: true, updatedAt: '2026-11-01T00:00:00.000Z' }; },
    },
    scheduler: { status: () => ({ enabled: true, intervalHours: 6 }), updateSchedule: schedule => { applied = schedule; return { ...schedule, nextRunAt: null }; } },
  });
  const initial = await fetch(`${base}/schedule`).then(response => response.json());
  assert.equal(initial.schedule.intervalHours, 6);

  const invalid = await fetch(`${base}/schedule`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: true, intervalHours: 1 }) });
  assert.equal(invalid.status, 400);
  assert.equal(saved, undefined);

  const response = await fetch(`${base}/schedule`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: false, intervalHours: 12 }) });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(saved, { schedule: { enabled: false, intervalHours: 12 }, actorId: adminId });
  assert.deepEqual(applied, { enabled: false, intervalHours: 12 });
  assert.equal(body.schedule.persisted, true);
});

test('failed sync retry respects provider backoff and only retries failed categories', async t => {
  const retryAt = new Date(Date.now() + 60000).toISOString();
  const calls = [];
  const categories = {
    software: { lastErrorAt: '2026-11-01T00:00:00.000Z', retryAt },
    data: { lastErrorAt: '2026-11-01T00:00:00.000Z', retryAt: null },
    security: { lastErrorAt: null, retryAt: null },
  };
  const base = await withAdminServer(t, {
    jobs: {
      status: () => ({ configured: true, categories }),
      refresh: async category => { calls.push(category); categories[category] = { lastErrorAt: null, retryAt: null }; return { jobs: [{ id: 'job' }], fetchedAt: '2026-11-01T00:00:00.000Z' }; },
    },
    store: { saveResource: async resource => resource, auditRefresh: async () => {} },
  });
  const result = await post(base, 'sources/retry-failed', {});
  assert.equal(result.response.status, 200);
  assert.deepEqual(calls, ['data']);
  assert.deepEqual(result.body.results.map(item => item.status), ['backoff', 'success']);
});
