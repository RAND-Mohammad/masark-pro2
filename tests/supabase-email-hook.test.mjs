import test from 'node:test';
import assert from 'node:assert/strict';
import { Webhook } from 'standardwebhooks';
import { createAuthEmailHandler, edgeEmailConfig } from '../supabase/functions/send-auth-email/handler.ts';

// Test-only credentials and addresses. No real provider calls or OTPs.
const SECRET = `whsec_${Buffer.alloc(32, 11).toString('base64')}`;
const API_KEY = 'unit-test-brevo-key-not-a-real-credential';
const REDIRECT = 'https://app.example.test/auth-callback';
const ENV = {
  SEND_EMAIL_HOOK_SECRET: `v1,${SECRET}`,
  BREVO_API_KEY: API_KEY,
  SUPABASE_URL: 'https://unit-test-project.supabase.co',
  EMAIL_HOOK_SENDER_ID: '1',
  EMAIL_HOOK_REDIRECT_URLS: JSON.stringify([REDIRECT, 'masarak://auth-callback']),
};
const signup = () => ({
  user: { email: 'owned-test@example.test' },
  email_data: { email_action_type: 'signup', token: '123456', redirect_to: REDIRECT },
});
const getEnv = env => name => env[name];
function signedRequest(payload = signup(), { id = 'test-event-1', date = new Date(), raw, headers = {} } = {}) {
  const signedBody = JSON.stringify(payload);
  return new Request('https://edge.example.test/send-auth-email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'webhook-id': id,
      'webhook-timestamp': String(Math.floor(date.getTime() / 1000)),
      'webhook-signature': new Webhook(SECRET).sign(id, date, signedBody),
      ...headers,
    },
    body: raw ?? signedBody,
  });
}
function setup({ env = ENV, fetchImpl, timeoutMs } = {}) {
  const calls = [];
  const handler = createAuthEmailHandler({
    Webhook,
    getEnv: getEnv(env),
    timeoutMs,
    fetchImpl: fetchImpl ?? (async (url, init) => {
      calls.push({ url, init, payload: JSON.parse(init.body) });
      return Response.json({ messageId: 'fake-id' }, { status: 201 });
    }),
  });
  return { handler, calls };
}

test('Edge configuration requires secrets and exact safe callback URLs', () => {
  assert.ok(edgeEmailConfig(getEnv(ENV), Webhook));
  for (const key of Object.keys(ENV)) {
    assert.equal(edgeEmailConfig(getEnv({ ...ENV, [key]: '' }), Webhook), null, key);
  }
  for (const value of ['*', 'javascript:alert(1)', 'https://app.example.test/other', 'https://a:b@app.example.test/auth-callback', 'https://app.example.test/auth-callback?next=evil']) {
    assert.equal(edgeEmailConfig(getEnv({ ...ENV, EMAIL_HOOK_REDIRECT_URLS: JSON.stringify([value]) }), Webhook), null);
  }
  assert.equal(edgeEmailConfig(getEnv({ ...ENV, BREVO_API_KEY: 'injected\r\nheader' }), Webhook), null);
});

test('Supabase Edge sends a signed signup code only through the fixed Brevo endpoint', async () => {
  const { handler, calls } = setup();
  const response = await handler(signedRequest());
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {});
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.brevo.com/v3/smtp/email');
  assert.equal(calls[0].init.headers['api-key'], API_KEY);
  assert.equal(calls[0].init.redirect, 'error');
  assert.equal(calls[0].payload.sender.id, 1);
  assert.match(calls[0].payload.textContent, /123456/);
  assert.doesNotMatch(calls[0].payload.subject, /123456/);
  assert.doesNotMatch(calls[0].payload.htmlContent, /href=/);
  assert.match(calls[0].payload.headers.idempotencyKey, /^[a-f0-9]{8}-[a-f0-9]{4}-8[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
  assert.ok(calls[0].init.signal instanceof AbortSignal);
});

test('Missing Edge configuration fails closed before sending', async () => {
  const { handler, calls } = setup({ env: {} });
  const response = await handler(signedRequest());
  assert.equal(response.status, 503);
  assert.equal(calls.length, 0);
  assert.doesNotMatch(await response.text(), new RegExp(API_KEY));
});

test('Tampered, missing, old and future signatures never call Brevo', async () => {
  const { handler, calls } = setup();
  const cases = [
    signedRequest(signup(), { raw: JSON.stringify({ ...signup(), user: { email: 'attacker@example.test' } }) }),
    signedRequest(signup(), { headers: { 'webhook-signature': '' } }),
    signedRequest(signup(), { headers: { 'webhook-id': '' } }),
    signedRequest(signup(), { date: new Date(Date.now() - 601000) }),
    signedRequest(signup(), { date: new Date(Date.now() + 601000) }),
  ];
  for (const request of cases) assert.equal((await handler(request)).status, 401);
  assert.equal(calls.length, 0);
});

test('Methods, compressed data, content types and body limits are enforced', async () => {
  const { handler, calls } = setup();
  const get = await handler(new Request('https://edge.example.test/send-auth-email'));
  assert.equal(get.status, 405);
  assert.equal(get.headers.get('Allow'), 'POST');
  assert.equal((await handler(signedRequest(signup(), { headers: { 'Content-Type': 'text/plain' } }))).status, 415);
  assert.equal((await handler(signedRequest(signup(), { headers: { 'Content-Encoding': 'gzip' } }))).status, 415);
  assert.equal((await handler(signedRequest({ ...signup(), oversized: 'x'.repeat(65536) }))).status, 413);
  assert.equal((await handler(signedRequest(signup(), { headers: { 'Content-Length': '65537' } }))).status, 413);
  assert.equal(calls.length, 0);
});

test('Invalid recipients, non-six-digit codes and unsupported actions do not send', async () => {
  const { handler, calls } = setup();
  const payloads = [
    null,
    { user: [], email_data: {} },
    { ...signup(), user: { email: 'bad\r\nheader@example.test' } },
    { ...signup(), email_data: { email_action_type: 'signup', token: '12345' } },
    { ...signup(), email_data: { email_action_type: 'signup', token: '<script>' } },
    { ...signup(), email_data: { email_action_type: 'unknown' } },
  ];
  for (const payload of payloads) assert.equal((await handler(signedRequest(payload))).status, 400);
  assert.equal(calls.length, 0);
});

test('Password recovery retains its trusted Supabase link and exact callback', async () => {
  const { handler, calls } = setup();
  const recovery = { ...signup(), email_data: { email_action_type: 'recovery', token_hash: 'a'.repeat(32), redirect_to: REDIRECT, site_url: 'https://attacker.example.test' } };
  assert.equal((await handler(signedRequest(recovery))).status, 200);
  const link = new URL(calls[0].payload.textContent.split('\n')[1]);
  assert.equal(link.origin, ENV.SUPABASE_URL);
  assert.equal(link.pathname, '/auth/v1/verify');
  assert.equal(link.searchParams.get('type'), 'recovery');
  assert.equal(link.searchParams.get('redirect_to'), REDIRECT);
  const rejected = structuredClone(recovery);
  rejected.email_data.redirect_to = 'https://attacker.example.test/auth-callback';
  assert.equal((await handler(signedRequest(rejected))).status, 400);
  assert.equal(calls.length, 1);
});

test('Native callbacks, invitations, magic links and reauthentication remain supported', async () => {
  const { handler, calls } = setup();
  for (const action of ['invite', 'magiclink']) {
    const payload = { ...signup(), email_data: { email_action_type: action, token_hash: 'b'.repeat(32), redirect_to: 'masarak://auth-callback' } };
    assert.equal((await handler(signedRequest(payload))).status, 200);
    const link = new URL(calls.at(-1).payload.textContent.split('\n')[1]);
    assert.equal(link.searchParams.get('type'), action);
    assert.equal(link.searchParams.get('redirect_to'), 'masarak://auth-callback');
  }
  const reauth = signup();
  reauth.email_data.email_action_type = 'reauthentication';
  assert.equal((await handler(signedRequest(reauth))).status, 200);
});

test('Secure email-change sends reversed hashes to the correct two recipients', async () => {
  const { handler, calls } = setup();
  const payload = {
    user: { email: 'old@example.test', new_email: 'new@example.test' },
    email_data: { email_action_type: 'email_change', token_hash: 'a'.repeat(32), token_hash_new: 'b'.repeat(32), token_new: '654321', redirect_to: REDIRECT },
  };
  assert.equal((await handler(signedRequest(payload))).status, 200);
  const old = calls.find(call => call.payload.to[0].email === 'old@example.test');
  const next = calls.find(call => call.payload.to[0].email === 'new@example.test');
  assert.equal(new URL(old.payload.textContent.split('\n')[1]).searchParams.get('token'), 'b'.repeat(32));
  assert.equal(new URL(next.payload.textContent.split('\n')[1]).searchParams.get('token'), 'a'.repeat(32));
  assert.notEqual(old.payload.headers.idempotencyKey, next.payload.headers.idempotencyKey);
});

test('Idempotency is stable across retries and distinct for different events', async () => {
  const { handler, calls } = setup();
  assert.equal((await handler(signedRequest())).status, 200);
  assert.equal((await handler(signedRequest())).status, 200);
  assert.equal((await handler(signedRequest(signup(), { id: 'different-event' }))).status, 200);
  assert.equal(calls[0].payload.headers.idempotencyKey, calls[1].payload.headers.idempotencyKey);
  assert.notEqual(calls[0].payload.headers.idempotencyKey, calls[2].payload.headers.idempotencyKey);
});

test('Brevo errors are not acknowledged or disclosed to the caller', async () => {
  for (const status of [400, 401, 402, 403, 429, 500]) {
    const { handler } = setup({ fetchImpl: async () => Response.json({ code: 'provider_error', message: `${API_KEY} owned-test@example.test 123456` }, { status }) });
    const response = await handler(signedRequest());
    assert.equal(response.status, 503);
    const body = await response.text();
    assert.doesNotMatch(body, /unit-test-brevo-key|owned-test@|123456/);
  }
});

test('Only Brevo idempotency duplicates are accepted as already sent', async () => {
  const valid = setup({ fetchImpl: async () => Response.json({ code: 'duplicate_parameter', message: 'Idempotency key already used' }, { status: 400 }) });
  assert.equal((await valid.handler(signedRequest())).status, 200);
  const invalid = setup({ fetchImpl: async () => Response.json({ code: 'duplicate_parameter', message: 'Duplicate recipient' }, { status: 400 }) });
  assert.equal((await invalid.handler(signedRequest())).status, 503);
});

test('A provider timeout aborts the fetch and returns an explicit error', async () => {
  let aborted = false;
  const { handler } = setup({
    timeoutMs: 20,
    fetchImpl: async (_url, { signal }) => new Promise((_, reject) => {
      signal.addEventListener('abort', () => { aborted = true; reject(new Error('aborted')); }, { once: true });
    }),
  });
  assert.equal((await handler(signedRequest())).status, 503);
  assert.equal(aborted, true);
});
