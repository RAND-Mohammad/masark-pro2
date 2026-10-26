import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { once } from 'node:events';
import { createJobsRouter, createJobsService, normalizeJob } from './jobs.mjs';

const time = Date.parse('2026-10-26T10:00:00Z');
function job(id = 'test-job') {
  return { job_id: id, currentness: 'current', stale: false,
    title: { value: 'Database Administrator Trainee' }, employer_name: { value: 'Test employer' },
    description: { value: 'SQL required. Python preferred. This is test data, not a real vacancy.' },
    locations: [{ value: { country: 'SA', city: 'Riyadh' } }], postings: [{
      posting_status: 'listed', source: 'test-only', posting_url: { value: 'https://example.com/jobs/1' },
      application_url: { value: 'https://example.com/jobs/1/apply' }, source_posted_at: '2026-10-20',
      last_completed_fetch_at: '2026-10-21', attribution: { required: false },
    }] };
}
const response = (data = [job()]) => new Response(JSON.stringify({ data, snapshot_watermark: '2026-10-21T22:10:37.414Z', next_cursor: 'test-next' }));
test('job normalization rejects non-Saudi, stale, closed and unsafe links', () => {
  const other = job(); other.locations[0].value.country = 'US';
  assert.equal(normalizeJob(other), null);
  const stale = job(); stale.stale = true; assert.equal(normalizeJob(stale), null);
  const closed = job(); closed.postings[0].posting_status = 'closed'; assert.equal(normalizeJob(closed), null);
  const unsafe = job(); unsafe.postings[0].posting_url.value = 'javascript:alert(1)'; assert.equal(normalizeJob(unsafe), null);
  assert.equal(normalizeJob(job()).postedAt, '2026-10-20T00:00:00.000Z');
});
test('required attribution is preserved; incomplete attribution is not published', () => {
  const record = job(); record.postings[0].attribution = { required: true, text: 'Test attribution', link: 'https://example.com/source' };
  assert.deepEqual(normalizeJob(record).attribution, { text: 'Test attribution', url: 'https://example.com/source' });
  delete record.postings[0].attribution.link;
  assert.equal(normalizeJob(record), null);
});
test('fixed Saudi query, private bearer header, deduplication and honest dates', async () => {
  let calls = 0;
  const service = createJobsService({ getKey: () => 'test-only-secret', now: () => time, fetchImpl: async (url, options) => {
    calls++;
    const target = new URL(url);
    assert.equal(target.origin, 'https://api.headcountlabs.com');
    assert.equal(target.searchParams.get('country'), 'SA');
    assert.equal(target.searchParams.get('posted_since'), '2026-09-26');
    assert.equal(options.headers.Authorization, 'Bearer test-only-secret');
    assert.equal(options.redirect, 'error');
    return response([job(), job()]);
  } });
  const result = await service('software');
  assert.equal(result.jobs.length, 1);
  assert.equal(result.hasMore, true);
  assert.equal(result.sourceSnapshotAt, '2026-10-21T22:10:37.414Z');
  assert.notEqual(result.sourceSnapshotAt, result.fetchedAt);
  assert.equal(JSON.stringify(result).includes('test-only-secret'), false);
  await service('software'); assert.equal(calls, 1);
});
test('concurrent users share a fetch, and expired cache fetches again', async () => {
  let clock = time; let calls = 0;
  const service = createJobsService({ getKey: () => 'test', now: () => clock, fetchImpl: async () => { calls++; return response(); } });
  await Promise.all([service('data'), service('data'), service('data')]);
  assert.equal(calls, 1);
  clock += 6 * 3600000;
  await service('data'); assert.equal(calls, 2);
});
test('provider failures redact credentials and apply cooldown; no stale success', async () => {
  let calls = 0;
  const service = createJobsService({ getKey: () => 'test-only-secret', now: () => time, fetchImpl: async () => {
    calls++; throw new Error('upstream leaked test-only-secret');
  } });
  for (let i = 0; i < 2; i++) await assert.rejects(service('software'), error => error.status === 503 && !error.message.includes('secret'));
  assert.equal(calls, 1);
});
test('missing configuration, invalid search and invalid response fail closed', async () => {
  let called = false;
  await assert.rejects(createJobsService({ getKey: () => '', fetchImpl: () => { called = true; } })('software'), { status: 503 });
  assert.equal(called, false);
  await assert.rejects(createJobsService({ getKey: () => 'test' })('bad'), { status: 400 });
  await assert.rejects(createJobsService({ getKey: () => 'test', fetchImpl: async () => new Response('{}') })('software'), { status: 503 });
});
test('route authenticates first and disallows arbitrary upstream parameters', async t => {
  let called = 0;
  const app = express();
  app.use('/jobs', createJobsRouter({ authenticate: (req, res, next) => req.headers.authorization === 'Bearer test-session' ? next() : res.sendStatus(401),
    getJobs: async () => { called++; return { jobs: [] }; } }));
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/jobs`;
  assert.equal((await fetch(`${url}?category=software`)).status, 401);
  assert.equal(called, 0);
  const headers = { Authorization: 'Bearer test-session' };
  assert.equal((await fetch(`${url}?category=software&url=https://example.com`, { headers })).status, 400);
  assert.equal(called, 0);
  assert.equal((await fetch(`${url}?category=software`, { headers })).status, 200);
  assert.equal(called, 1);
});
