import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Webhook } from 'standardwebhooks';
import { createAuthEmailHandler, edgeEmailConfig } from '../supabase/functions/send-auth-email/handler.ts';
import { buildAuthEmails } from '../supabase/functions/_shared/auth-email-templates.ts';

// Never print environment values, signed payloads, provider bodies or OTPs.
const names = ['BREVO_API_KEY', 'SEND_EMAIL_HOOK_SECRET', 'EMAIL_HOOK_SENDER_ID', 'EMAIL_HOOK_REDIRECT_URLS'];
const env = { ...process.env, SUPABASE_URL: process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL };
let missing = false;
for (const name of names) {
  const present = Boolean(env[name]?.trim());
  console.log(`${name}: ${present ? 'present' : 'missing; add in Replit Secrets'}`);
  missing ||= !present;
}
const remote = process.argv.includes('--remote');
const sendIndex = process.argv.indexOf('--send');
const recipient = sendIndex < 0 ? undefined : process.argv[sendIndex + 1];

async function main() {
  let endpoint;
  if (remote) {
    endpoint = new URL('/functions/v1/send-auth-email', env.SUPABASE_URL);
    const get = await fetch(endpoint, { signal: AbortSignal.timeout(10000) });
    assert.equal(get.status, 405, 'Remote function must reject GET with 405');
    const unsigned = await fetch(endpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(10000),
    });
    const body = await unsigned.json();
    assert.equal(unsigned.status, 401, 'Remote configuration incomplete or JWT gateway enabled');
    assert.equal(body?.error?.message, 'Invalid webhook signature.', 'Expected function signature rejection');
    console.log('Remote unsigned request rejected by function: PASS');
  }
  // A fixture API key permits offline signature/callback checks while Brevo is unconfigured.
  const offlineEnv = { ...env, BREVO_API_KEY: env.BREVO_API_KEY || 'offline-fixture-not-a-provider-key' };
  const config = edgeEmailConfig(name => offlineEnv[name], Webhook);
  assert.ok(config, 'Invalid email hook configuration; values withheld');
  for (const redirect of config.redirectUrls) {
    const [message] = buildAuthEmails({ user: { email: 'fixture@example.test' }, email_data: {
      email_action_type: 'recovery', token_hash: 'a'.repeat(64), redirect_to: redirect,
    } }, config);
    assert.equal(new URL(message.textContent.split('\n')[1]).searchParams.get('redirect_to'), redirect);
  }
  console.log(`Configured callback URLs: ${config.redirectUrls.length} PASS`);
  const secret = env.SEND_EMAIL_HOOK_SECRET.trim().replace(/^v1,/, '');
  const payload = JSON.stringify({ user: { email: recipient || 'fixture@example.test' }, email_data: {
    email_action_type: 'signup', token: String(Math.floor(Math.random() * 1000000)).padStart(6, '0'),
  } });
  const id = randomUUID();
  const date = new Date();
  const headers = {
    'Content-Type': 'application/json', 'webhook-id': id,
    'webhook-timestamp': String(Math.floor(date.getTime() / 1000)),
    'webhook-signature': new Webhook(secret).sign(id, date, payload),
  };
  let calls = 0;
  const local = createAuthEmailHandler({ Webhook, getEnv: name => offlineEnv[name], fetchImpl: async () => {
    calls++; return Response.json({}, { status: 201 });
  } });
  assert.equal((await local(new Request('https://fixture.test', { method: 'POST', headers, body: payload }))).status, 200);
  assert.equal(calls, 1);
  assert.equal((await local(new Request('https://fixture.test', { method: 'POST', headers, body: '{}' }))).status, 401);
  assert.equal(calls, 1);
  console.log('Current signing secret: valid signature PASS; tampered body rejected PASS');
  if (missing) { process.exitCode = 1; return; }
  if (remote) {
    // Signed invalid schema verifies the cloud secret without triggering a send.
    const body = '{}';
    const response = await fetch(endpoint, {
      method: 'POST', headers: { ...headers, 'webhook-signature': new Webhook(secret).sign(id, date, body) },
      body, signal: AbortSignal.timeout(10000),
    });
    assert.equal(response.status, 400, 'Cloud signing secret did not pass verification');
    const rejection = await response.json();
    assert.equal(rejection?.error?.message, 'Email payload is invalid or unsupported.');
    console.log('Cloud and local signing secrets match: PASS');
  }
  if (recipient) {
    assert.match(recipient, /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/, 'Provide an owned test recipient after --send');
    const senders = await fetch('https://api.brevo.com/v3/senders', {
      headers: { 'api-key': config.apiKey }, redirect: 'error', signal: AbortSignal.timeout(10000),
    });
    assert.equal(senders.status, 200, 'Brevo credential could not be verified');
    const senderData = await senders.json();
    assert.ok(senderData.senders?.some(sender => sender.id === config.senderId && sender.active === true), 'Configured Brevo sender is not active');
    console.log('Brevo credential and configured active sender: PASS');
    // Explicit --send authorizes one real provider submission. This OTP has no associated account.
    const response = remote
      ? await fetch(endpoint, { method: 'POST', headers, body: payload, signal: AbortSignal.timeout(10000) })
      : await createAuthEmailHandler({ Webhook, getEnv: name => env[name] })(new Request('https://fixture.test', { method: 'POST', headers, body: payload }));
    assert.equal(response.status, 200, 'Signed delivery was not confirmed; response body withheld');
    console.log('Signed test email accepted: PASS. Confirm receipt in the owned inbox or Brevo delivery logs.');
  } else console.log('Real email not sent; use --send with an owned recipient to test delivery.');
}
main().catch(error => { console.error(`Email hook check failed: ${error instanceof assert.AssertionError ? error.message.split('\n')[0] : 'network or configuration error; details withheld'}`); process.exitCode = 1; });
