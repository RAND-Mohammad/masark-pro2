import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdminStore } from './admin-store.mjs';

const resource = {
  id: 'test-course', title: 'Test Course', provider: 'Test Provider', url: 'https://learn.example.org/course',
  skillIds: ['T0217'], level: 'Beginner', duration: '2 hours', access: 'Free', language: 'English',
};
const serviceKey = `header.${Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url')}.signature`;
const env = { EXPO_PUBLIC_SUPABASE_URL: 'https://project.supabase.co', SUPABASE_SERVICE_ROLE_KEY: serviceKey };

test('admin resource saves use the checked-link RPC and refuse visible unchecked resources', async () => {
  const requests = [];
  const store = createAdminStore({ env, fetchImpl: async (url, init) => {
    requests.push({ url, init });
    return { ok: true, status: 204 };
  } });
  await assert.rejects(store.saveResource(resource, {
    visible: true, reviewed: true, actorId: '9449c1c9-6e9a-40b6-b976-79652455c61f',
    linkCheckStatus: 'not_checked', linkCheckedAt: null,
  }), /must be reachable/);
  assert.equal(requests.length, 0);

  await store.saveResource(resource, {
    visible: true, reviewed: true, actorId: '9449c1c9-6e9a-40b6-b976-79652455c61f',
    linkCheckStatus: 'reachable', linkCheckedAt: '2026-11-01T00:00:00.000Z',
  });
  assert.match(requests[0].url, /rpc\/masarak_admin_save_learning_resource_v2$/);
  const payload = JSON.parse(requests[0].init.body);
  assert.equal(payload.p_link_check_status, 'reachable');
  assert.equal(payload.p_link_checked_at, '2026-11-01T00:00:00.000Z');
});

test('public catalog omits old, unchecked visible overrides until an admin rechecks them', async () => {
  const calls = [];
  const row = {
    resource_id: resource.id, payload: resource, is_visible: true, link_status: 'reviewed', reviewed_at: '2026-10-01T00:00:00.000Z',
    link_check_status: 'not_checked', link_checked_at: null, updated_at: '2026-10-01T00:00:00.000Z',
  };
  const store = createAdminStore({ env, fetchImpl: async (url) => {
    calls.push(url);
    return { ok: true, status: 200, json: async () => [row] };
  } });
  const publicResources = await store.getPublicResources();
  assert.equal(publicResources.some(item => item.id === resource.id), false);
  const adminResources = await store.getAdminResources();
  const adminItem = adminResources.find(item => item.id === resource.id);
  assert.equal(adminItem.isVisible, true);
  assert.equal(adminItem.linkCheckStatus, 'not_checked');
  assert.ok(calls.every(url => /link_check_status,link_checked_at/.test(url)));
});

test('refresh schedule uses a safe default when absent and saves changes with an admin audit event', async () => {
  const requests = [];
  const store = createAdminStore({ env, fetchImpl: async (url, init) => {
    requests.push({ url, init });
    if (!init.method || init.method === 'GET') return { ok: true, status: 200, json: async () => [] };
    if (url.includes('masarak_admin_job_schedules')) return { ok: true, status: 201, json: async () => [{ updated_at: '2026-11-01T00:00:00.000Z' }] };
    return { ok: true, status: 204 };
  } });
  const fallback = await store.getJobsSchedule();
  assert.deepEqual(fallback, { enabled: true, intervalHours: 6, persisted: false, storageAvailable: true, updatedAt: null });
  const saved = await store.saveJobsSchedule({ enabled: false, intervalHours: 12 }, '9449c1c9-6e9a-40b6-b976-79652455c61f');
  assert.equal(saved.persisted, true);
  assert.match(requests[1].url, /masarak_admin_job_schedules\?on_conflict=id$/);
  assert.match(requests[1].init.headers.Prefer, /resolution=merge-duplicates/);
  assert.deepEqual(JSON.parse(requests[1].init.body), {
    id: 1, enabled: false, interval_hours: 12, updated_by: '9449c1c9-6e9a-40b6-b976-79652455c61f', updated_at: JSON.parse(requests[1].init.body).updated_at,
  });
  assert.match(requests[2].url, /masarak_admin_audit_events$/);
  assert.equal(JSON.parse(requests[2].init.body).action, 'jobs_schedule_updated');
});

test('schedule changes reject unsupported intervals before making a database request', async () => {
  let calls = 0;
  const store = createAdminStore({ env, fetchImpl: async () => { calls += 1; return { ok: true, status: 204 }; } });
  await assert.rejects(store.saveJobsSchedule({ enabled: true, intervalHours: 1 }, '9449c1c9-6e9a-40b6-b976-79652455c61f'), /Invalid admin job schedule/);
  assert.equal(calls, 0);
});
