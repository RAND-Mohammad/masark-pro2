import express from 'express';
import { fileURLToPath } from 'node:url';
import { createEmailHookRouter, emailHookConfig } from './auth-email-hook.mjs';

try { process.loadEnvFile(fileURLToPath(new URL('.env', import.meta.url))); } catch { /* Replit Secrets are available in the process environment. */ }
const app = express();
app.disable('x-powered-by');
app.get(['/', '/health'], (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ service: 'Masarak authentication email hook', status: 'ok', configured: Boolean(emailHookConfig()) });
});
app.use('/api/auth/send-email', createEmailHookRouter());
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
const port = Number(process.env.PORT || 5000);
app.listen(port, '0.0.0.0', () => console.log(`Masarak email hook server listening on port ${port}. Configuration: ${emailHookConfig() ? 'ready' : 'incomplete'}`));
