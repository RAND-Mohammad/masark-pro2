import express from 'express';
import { createHash } from 'node:crypto';
import { Webhook } from 'standardwebhooks';
import { ReplitConnectors } from '@replit/connectors-sdk';
import { buildAuthEmails, EmailPayloadError } from './auth-email-templates.mjs';
import { emailIdempotencyKey } from '../supabase/functions/_shared/email-idempotency.ts';

const connectors = new ReplitConnectors();
const safeError = (res, status, message) => res.status(status).json({ error: { http_code: status, message } });

export function emailHookConfig(env = process.env) {
  const secret = env.SEND_EMAIL_HOOK_SECRET?.trim().replace(/^v1,/, '');
  const supabaseUrl = env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const senderId = Number(env.EMAIL_HOOK_SENDER_ID);
  let redirectUrls;
  try { redirectUrls = JSON.parse(env.EMAIL_HOOK_REDIRECT_URLS || '[]'); } catch { return null; }
  if (!secret || !/^whsec_[A-Za-z0-9+/=]+$/.test(secret) || !/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(supabaseUrl || '') || !Number.isSafeInteger(senderId) || senderId < 1) return null;
  if (!Array.isArray(redirectUrls) || !redirectUrls.length || redirectUrls.some(value => {
    if (typeof value !== 'string' || value.length > 2048) return true;
    try {
      const url = new URL(value);
      return !['https:', 'masarak:', 'exp:', 'exps:'].includes(url.protocol) || Boolean(url.username || url.password || url.hash || url.search) ||
        !(url.pathname.replace(/\/$/, '').endsWith('/auth-callback') || (url.protocol === 'masarak:' && url.hostname === 'auth-callback'));
    } catch { return true; }
  })) return null;
  try { new Webhook(secret); } catch { return null; }
  return { secret, supabaseUrl, senderId, redirectUrls };
}

export function createEmailHookRouter({
  getConfig = () => emailHookConfig(),
  proxy = (path, options) => connectors.proxy('brevo', path, options),
  timeoutMs = 4000,
} = {}) {
  const router = express.Router();
  router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  router.post('/', express.raw({ type: 'application/json', limit: '64kb', inflate: false }), async (req, res) => {
    const config = getConfig();
    if (!config) return safeError(res, 503, 'Email hook is not configured.');
    if (!Buffer.isBuffer(req.body)) return safeError(res, 400, 'Expected JSON.');
    const id = req.get('webhook-id');
    if (!id || id.length > 200 || !/^[a-zA-Z0-9_.:-]+$/.test(id)) return safeError(res, 401, 'Invalid webhook signature.');
    let payload;
    try {
      payload = new Webhook(config.secret).verify(req.body, {
        'webhook-id': id,
        'webhook-timestamp': req.get('webhook-timestamp') || '',
        'webhook-signature': req.get('webhook-signature') || '',
      });
    } catch { return safeError(res, 401, 'Invalid webhook signature.'); }
    let emails;
    try { emails = buildAuthEmails(payload, config); }
    catch (error) {
      return safeError(res, error instanceof EmailPayloadError ? 400 : 503, 'Email payload is invalid or unsupported.');
    }
    let timer;
    try {
      // Stable per recipient: retries and multiple instances use the same provider key.
      const sends = emails.map(async email => {
        const key = emailIdempotencyKey(createHash('sha256').update(`${id}:${payload.email_data.email_action_type}:${email.to[0].email}`).digest());
        const response = await proxy('/smtp/email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...email, sender: { id: config.senderId }, headers: { idempotencyKey: key } }),
        });
        if (response.status === 201) return;
        // Brevo rejects retries for an already used idempotency key.
        // Other duplicate/validation errors must still fail explicitly.
        if (response.status === 400) {
          const error = await response.json();
          if (error.code === 'duplicate_parameter' && /idempotency/i.test(error.message || '')) return;
        }
        throw new Error('Email provider rejected the request');
      });
      await Promise.race([
        Promise.all(sends),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Email provider timed out')), timeoutMs); }),
      ]);
      return res.status(200).json({});
    } catch {
      // Do not return provider responses, recipient addresses, tokens or secrets.
      return safeError(res, 503, 'Email delivery could not be confirmed. Try again later.');
    } finally { clearTimeout(timer); }
  });
  router.all('/', (_req, res) => { res.setHeader('Allow', 'POST'); safeError(res, 405, 'Method not allowed.'); });
  router.use((error, _req, res, _next) => safeError(res, error?.type === 'entity.too.large' ? 413 : 400, 'Invalid webhook request.'));
  return router;
}
