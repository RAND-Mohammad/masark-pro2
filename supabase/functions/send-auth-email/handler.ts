import { buildAuthEmails, EmailPayloadError, type EmailConfig } from '../_shared/auth-email-templates.ts';
import { emailIdempotencyKey } from '../_shared/email-idempotency.ts';

interface SignatureVerifier {
  verify(body: string, headers: Record<string, string>): unknown;
}
type WebhookConstructor = new (secret: string) => SignatureVerifier;
type GetEnv = (name: string) => string | undefined;
interface HookConfig extends EmailConfig {
  apiKey: string;
  senderId: number;
  verifier: SignatureVerifier;
}

const MAX_BODY_BYTES = 64 * 1024;
const BREVO_SEND_URL = 'https://api.brevo.com/v3/smtp/email';
const requestError = (status: number, message: string, extraHeaders: Record<string, string> = {}) =>
  Response.json({ error: { http_code: status, message } }, {
    status,
    headers: { 'Cache-Control': 'no-store', ...extraHeaders },
  });

export function edgeEmailConfig(getEnv: GetEnv, Webhook: WebhookConstructor): HookConfig | null {
  const secret = getEnv('SEND_EMAIL_HOOK_SECRET')?.trim().replace(/^v1,/, '');
  const apiKey = getEnv('BREVO_API_KEY')?.trim();
  const supabaseUrl = getEnv('SUPABASE_URL')?.trim();
  const senderId = Number(getEnv('EMAIL_HOOK_SENDER_ID'));
  let redirectUrls: unknown;
  try { redirectUrls = JSON.parse(getEnv('EMAIL_HOOK_REDIRECT_URLS') || '[]'); } catch { return null; }
  if (!secret || !/^whsec_[A-Za-z0-9+/=]+$/.test(secret) ||
    !apiKey || !/^[\x21-\x7E]{16,2048}$/.test(apiKey) ||
    !/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(supabaseUrl || '') ||
    !Number.isSafeInteger(senderId) || senderId < 1) return null;
  if (!Array.isArray(redirectUrls) || !redirectUrls.length || redirectUrls.some((value: unknown) => {
    if (typeof value !== 'string' || value.length > 2048) return true;
    try {
      const url = new URL(value);
      return !['https:', 'masarak:', 'exp:', 'exps:'].includes(url.protocol) ||
        Boolean(url.username || url.password || url.hash || url.search) ||
        !(url.pathname.replace(/\/$/, '').endsWith('/auth-callback') ||
          (url.protocol === 'masarak:' && url.hostname === 'auth-callback'));
    } catch { return true; }
  })) return null;
  try {
    return { apiKey, supabaseUrl: supabaseUrl!, senderId, redirectUrls, verifier: new Webhook(secret) };
  } catch { return null; }
}

class BodyError extends Error {
  readonly status: number;
  constructor(status: number) {
    super('Invalid request body');
    this.status = status;
  }
}

async function readRawBody(request: Request): Promise<string> {
  if (Number(request.headers.get('Content-Length')) > MAX_BODY_BYTES) throw new BodyError(413);
  if (!request.body) throw new BodyError(400);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      (async () => {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > MAX_BODY_BYTES) throw new BodyError(413);
          chunks.push(value);
        }
      })(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new BodyError(408)), 1000);
      }),
    ]);
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error instanceof BodyError ? error : new BodyError(400);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    reader.releaseLock();
  }
}

export function createAuthEmailHandler({
  Webhook, getEnv, fetchImpl = fetch, timeoutMs = 3500,
}: {
  Webhook: WebhookConstructor;
  getEnv: GetEnv;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): (request: Request) => Promise<Response> {
  return async (request: Request): Promise<Response> => {
    if (request.method !== 'POST') return requestError(405, 'Method not allowed.', { Allow: 'POST' });
    const config = edgeEmailConfig(getEnv, Webhook);
    if (!config) return requestError(503, 'Email hook is not configured.');
    const id = request.headers.get('webhook-id');
    if (!id || id.length > 200 || !/^[a-zA-Z0-9_.:-]+$/.test(id)) return requestError(401, 'Invalid webhook signature.');
    if (!/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type') || '') ||
      !['', 'identity'].includes(request.headers.get('Content-Encoding') || '')) {
      return requestError(415, 'Expected an uncompressed JSON body.');
    }
    let raw: string;
    try { raw = await readRawBody(request); }
    catch (error) { return requestError(error instanceof BodyError ? error.status : 400, 'Invalid webhook body.'); }
    let payload: unknown;
    try {
      payload = config.verifier.verify(raw, {
        'webhook-id': id,
        'webhook-timestamp': request.headers.get('webhook-timestamp') || '',
        'webhook-signature': request.headers.get('webhook-signature') || '',
      });
    } catch { return requestError(401, 'Invalid webhook signature.'); }
    let emails;
    try { emails = buildAuthEmails(payload, config); }
    catch (error) {
      return requestError(error instanceof EmailPayloadError ? 400 : 503, 'Email payload is invalid or unsupported.');
    }
    const action = (payload as { email_data: { email_action_type: string } }).email_data.email_action_type;
    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const sends = emails.map(async email => {
        const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${id}:${action}:${email.to[0].email}`));
        const key = emailIdempotencyKey(new Uint8Array(bytes));
        const response = await fetchImpl(BREVO_SEND_URL, {
          method: 'POST',
          redirect: 'error',
          signal: abort.signal,
          headers: { 'Content-Type': 'application/json', 'api-key': config.apiKey },
          body: JSON.stringify({ ...email, sender: { id: config.senderId }, headers: { idempotencyKey: key } }),
        });
        if (response.status === 201) {
          await response.body?.cancel();
          return;
        }
        if (response.status === 400) {
          const error = await response.json();
          if (error?.code === 'duplicate_parameter' && /idempotency/i.test(error.message || '')) return;
        }
        throw new Error('Email delivery not confirmed');
      });
      await Promise.race([
        Promise.all(sends),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('Email provider timed out')), timeoutMs);
        }),
      ]);
      return Response.json({}, { headers: { 'Cache-Control': 'no-store' } });
    } catch {
      return requestError(503, 'Email delivery could not be confirmed. Try again later.');
    } finally {
      if (timer !== undefined) clearTimeout(timer);
      abort.abort();
    }
  };
}
