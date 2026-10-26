import { fileURLToPath } from 'node:url';
import { networkInterfaces } from 'node:os';
import { chmodSync } from 'node:fs';
import { createCvApp } from './cv-app.mjs';
import { startJobsRefresh } from './jobs.mjs';

// نقرأ إعدادات التطبيق، والمفاتيح الخاصة تبقى في ملف السيرفر.
try { process.loadEnvFile(fileURLToPath(new URL('../.env', import.meta.url))); } catch { /* Optional local configuration. */ }
try { process.loadEnvFile(fileURLToPath(new URL('.env', import.meta.url))); } catch { /* Existing process environment is also supported. */ }
const app = createCvApp();
const stopJobsRefresh = startJobsRefresh();
process.on('exit', stopJobsRefresh);
const port = Number(process.env.PORT || 3001);
const host = process.env.CV_HOST || '0.0.0.0';
const socketPath = process.env.CV_DEV_SOCKET;
if (socketPath) app.listen(socketPath, () => {
  chmodSync(socketPath, 0o600);
  console.log(`Masarak CV server ready on private Unix socket. Groq key: ${process.env.GROQ_API_KEY?.trim() ? 'configured' : 'missing'}`);
});
else app.listen(port, host, () => {
  console.log(`Masarak CV server running on port ${port}. Groq key: ${process.env.GROQ_API_KEY?.trim() ? 'configured' : 'missing'}`);
  if (host === '127.0.0.1') console.log('CV listener restricted to loopback.');
  else for (const entries of Object.values(networkInterfaces())) for (const entry of entries || []) if (entry.family === 'IPv4' && !entry.internal) console.log(`Local network: http://${entry.address}:${port}`);
});
