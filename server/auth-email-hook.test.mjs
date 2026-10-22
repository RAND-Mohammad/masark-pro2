import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { Webhook } from 'standardwebhooks';
import { createEmailHookRouter, emailHookConfig } from './auth-email-hook.mjs';
import { buildAuthEmails } from './auth-email-templates.mjs';

// Synthetic fixture only; never use this signing key in a hosted environment.
const secret = `whsec_${Buffer.alloc(32, 7).toString('base64')}`;
const redirect = 'https://app.example.test/auth-callback';
const env = {
  SEND_EMAIL_HOOK_SECRET: `v1,${secret}`,
  EXPO_PUBLIC_SUPABASE_URL: 'https://fixtureproject.supabase.co',
  EMAIL_HOOK_SENDER_ID: '1',
  EMAIL_HOOK_REDIRECT_URLS: JSON.stringify([redirect, 'masarak://auth-callback']),
};
const config = emailHookConfig(env);
const fixture = (action = 'signup') => ({
  user: { email: 'fixture@example.test', new_email: 'new@example.test' },
  email_data: { email_action_type: action, token: '012345', token_hash: 'a'.repeat(64), redirect_to: redirect },
});
function signed(body, id = 'fixture-event', when = new Date()) {
  return {
    'content-type': 'application/json',
    'webhook-id': id,
    'webhook-timestamp': String(Math.floor(when.getTime() / 1000)),
    'webhook-signature': new Webhook(secret).sign(id, when, body),
  };
}
async function harness(t, { proxy, getConfig, timeoutMs } = {}) {
  const sent = [];
  const app = express();
  app.use('/hook', createEmailHookRouter({
    getConfig: getConfig || (() => config),
    proxy: proxy || (async (path, options) => { sent.push({ path, body: JSON.parse(options.body) }); return new Response('{}', { status: 201 }); }),
    timeoutMs,
  }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  return {
    sent,
    post: (body = JSON.stringify(fixture()), headers = signed(body)) => fetch(`http://127.0.0.1:${server.address().port}/hook`, { method: 'POST', headers, body }),
    get: () => fetch(`http://127.0.0.1:${server.address().port}/hook`),
  };
}

test('missing or invalid configuration fails closed', async t => {
  assert.equal(config.secret, secret);
  for (const override of [
    { SEND_EMAIL_HOOK_SECRET: '' }, { EMAIL_HOOK_SENDER_ID: '0' },
    { EMAIL_HOOK_REDIRECT_URLS: '[]' }, { EMAIL_HOOK_REDIRECT_URLS: 'not json' },
    { EMAIL_HOOK_REDIRECT_URLS: '["javascript:alert(1)"]' },
    { EXPO_PUBLIC_SUPABASE_URL: 'http://not-supabase.example' },
  ]) assert.equal(emailHookConfig({ ...env, ...override }), null);
  const h = await harness(t, { getConfig: () => null });
  assert.equal((await h.post()).status, 503);
  assert.equal(h.sent.length, 0);
});

test('valid signed signup sends a six-digit message using the managed Brevo proxy', async t => {
  const h = await harness(t);
  assert.equal((await h.post()).status, 200);
  assert.equal(h.sent.length, 1);
  const { path, body } = h.sent[0];
  assert.equal(path, '/smtp/email');
  assert.deepEqual(body.sender, { id: 1 });
  assert.deepEqual(body.to, [{ email: 'fixture@example.test' }]);
  assert.match(body.textContent, /012345/);
  assert.doesNotMatch(body.htmlContent, /href=|token_hash|ConfirmationURL/);
  assert.doesNotMatch(body.subject, /012345/);
});

test('missing, altered, stale and future signatures cannot send emails', async t => {
  const h = await harness(t);
  const body = JSON.stringify(fixture());
  assert.equal((await h.post(body, { 'content-type': 'application/json' })).status, 401);
  assert.equal((await h.post(body.replace('012345', '654321'), signed(body))).status, 401);
  assert.equal((await h.post(body, { ...signed(body), 'webhook-id': 'another-event' })).status, 401);
  assert.equal((await h.post(body, signed(body, 'old-event', new Date(Date.now() - 600000)))).status, 401);
  assert.equal((await h.post(body, signed(body, 'future-event', new Date(Date.now() + 600000)))).status, 401);
  assert.equal(h.sent.length, 0);
});

test('invalid JSON, recipient, token length and unsupported action fail without delivery', async t => {
  const h = await harness(t);
  const payloads = [
    '{"malformed":',
    JSON.stringify({ ...fixture(), user: { email: 'bad\r\n@example.test' } }),
    JSON.stringify({ ...fixture(), email_data: { ...fixture().email_data, token: '12345' } }),
    JSON.stringify({ ...fixture(), email_data: { ...fixture().email_data, token: '1234567' } }),
    JSON.stringify(fixture('unknown-action')),
  ];
  for (const body of payloads) assert.equal((await h.post(body)).status, body === '{"malformed":' ? 401 : 400);
  assert.equal(h.sent.length, 0);
});

test('non-POST requests and oversized or non-JSON bodies are rejected', async t => {
  const h = await harness(t);
  assert.equal((await h.get()).status, 405);
  assert.equal((await h.post('x'.repeat(70000))).status, 413);
  assert.equal((await h.post('{}', { 'content-type': 'text/plain' })).status, 400);
  assert.equal(h.sent.length, 0);
});

test('password recovery preserves a safe Supabase link, with exact allowed redirects', async t => {
  const h = await harness(t);
  assert.equal((await h.post(JSON.stringify(fixture('recovery')))).status, 200);
  const link = h.sent[0].body.textContent.split('\n')[1];
  const url = new URL(link);
  assert.equal(url.origin, env.EXPO_PUBLIC_SUPABASE_URL);
  assert.equal(url.searchParams.get('type'), 'recovery');
  assert.equal(url.searchParams.get('token'), 'a'.repeat(64));
  assert.equal(url.searchParams.get('redirect_to'), redirect);
  const rejected = fixture('recovery');
  rejected.email_data.redirect_to = 'https://attacker.example/auth-callback';
  assert.equal((await h.post(JSON.stringify(rejected))).status, 400);
  assert.equal(h.sent.length, 1);
});

test('native recovery callbacks, invitation links and reauthentication codes are handled', () => {
  for (const action of ['recovery', 'magiclink', 'invite']) {
    const payload = fixture(action);
    payload.email_data.redirect_to = 'masarak://auth-callback';
    const [email] = buildAuthEmails(payload, config);
    const link = new URL(email.textContent.split('\n')[1]);
    assert.equal(link.searchParams.get('redirect_to'), 'masarak://auth-callback');
    assert.equal(link.searchParams.get('type'), action);
  }
  assert.match(buildAuthEmails(fixture('reauthentication'), config)[0].textContent, /012345/);
});

test('secure email changes map Supabase token hashes to the correct recipients', () => {
  const payload = fixture('email_change');
  payload.email_data.token_hash_new = 'b'.repeat(64);
  payload.email_data.token_new = '654321';
  const emails = buildAuthEmails(payload, config);
  assert.equal(emails.length, 2);
  assert.equal(emails[0].to[0].email, payload.user.email);
  assert.equal(new URL(emails[0].textContent.split('\n')[1]).searchParams.get('token'), 'b'.repeat(64));
  assert.equal(emails[1].to[0].email, payload.user.new_email);
  assert.equal(new URL(emails[1].textContent.split('\n')[1]).searchParams.get('token'), 'a'.repeat(64));
  assert.equal(buildAuthEmails(fixture('email_change'), config).length, 1);
});

test('repeated events have stable provider idempotency keys, separate per recipient', async t => {
  const h = await harness(t);
  await h.post(); await h.post();
  assert.equal(h.sent[0].body.headers.idempotencyKey, h.sent[1].body.headers.idempotencyKey);
  const payload = fixture('email_change');
  payload.email_data.token_hash_new = 'b'.repeat(64);
  payload.email_data.token_new = '654321';
  await h.post(JSON.stringify(payload));
  assert.notEqual(h.sent[2].body.headers.idempotencyKey, h.sent[3].body.headers.idempotencyKey);
});

test('provider failures and timeouts are not reported as success or leaked', async t => {
  for (const status of [401, 402, 429, 500]) {
    const h = await harness(t, { proxy: async () => new Response('SENSITIVE_PROVIDER_RESPONSE', { status }) });
    const response = await h.post();
    assert.equal(response.status, 503);
    assert.doesNotMatch(await response.text(), /SENSITIVE|fixture@example|012345|whsec/);
  }
  const h = await harness(t, { proxy: () => new Promise(() => {}), timeoutMs: 10 });
  assert.equal((await h.post()).status, 503);
});

test('only a documented idempotency duplicate is acknowledged', async t => {
  const duplicate = await harness(t, { proxy: async () => new Response(JSON.stringify({ code: 'duplicate_parameter', message: 'Idempotency key has already been used' }), { status: 400 }) });
  assert.equal((await duplicate.post()).status, 200);
  const other = await harness(t, { proxy: async () => new Response(JSON.stringify({ code: 'duplicate_parameter', message: 'Another parameter is duplicated' }), { status: 400 }) });
  assert.equal((await other.post()).status, 503);
});
