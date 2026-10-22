import { Webhook } from 'npm:standardwebhooks@1.0.0';
import { createAuthEmailHandler } from './handler.ts';

// These credentials are test fixtures, never read from the real environment.
const secret = `whsec_${btoa(String.fromCharCode(...new Uint8Array(32).fill(11)))}`;
const env: Record<string, string> = {
  SEND_EMAIL_HOOK_SECRET: `v1,${secret}`,
  BREVO_API_KEY: 'deno-test-key-not-a-real-credential',
  SUPABASE_URL: 'https://unit-test-project.supabase.co',
  EMAIL_HOOK_SENDER_ID: '1',
  EMAIL_HOOK_REDIRECT_URLS: '["masarak://auth-callback"]',
};
function request(raw?: string): Request {
  const body = JSON.stringify({ user: { email: 'owned-test@example.test' }, email_data: { email_action_type: 'signup', token: '123456' } });
  const date = new Date();
  const id = 'deno-test-event';
  return new Request('https://edge.example.test/send-auth-email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'webhook-id': id,
      'webhook-timestamp': String(Math.floor(date.getTime() / 1000)),
      'webhook-signature': new Webhook(secret).sign(id, date, body),
    },
    body: raw ?? body,
  });
}

Deno.test('Deno runtime verifies standardwebhooks and sends the six-digit code', async () => {
  let sent = false;
  const handler = createAuthEmailHandler({
    Webhook,
    getEnv: name => env[name],
    fetchImpl: async (url, init) => {
      if (url !== 'https://api.brevo.com/v3/smtp/email') throw new Error('Unexpected destination');
      const message = JSON.parse(String(init && 'body' in init ? init.body : undefined));
      if (!message.textContent.includes('123456') || !/^[a-f0-9]{8}-[a-f0-9]{4}-8[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(message.headers.idempotencyKey)) throw new Error('Invalid email');
      sent = true;
      return Response.json({}, { status: 201 });
    },
  });
  const response = await handler(request());
  if (response.status !== 200 || !sent) throw new Error('Signed delivery failed');
});

Deno.test('Deno rejects a tampered raw payload without sending', async () => {
  let calls = 0;
  const handler = createAuthEmailHandler({
    Webhook, getEnv: name => env[name],
    fetchImpl: async () => { calls++; return Response.json({}, { status: 201 }); },
  });
  if ((await handler(request('{}'))).status !== 401 || calls) throw new Error('Tampered body accepted');
});

Deno.test('Deno returns 503 when cloud secrets are missing', async () => {
  const handler = createAuthEmailHandler({ Webhook, getEnv: () => undefined });
  if ((await handler(request())).status !== 503) throw new Error('Missing secrets were accepted');
});
