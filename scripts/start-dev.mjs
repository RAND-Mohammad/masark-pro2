import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { request } from 'node:http';
import { unlinkSync } from 'node:fs';

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('../', import.meta.url));
const socketPath = `/tmp/masarak-cv-${process.pid}.sock`;
const origin = new URL(process.env.EXPO_PACKAGER_PROXY_URL || `https://${process.env.REPLIT_DEV_DOMAIN}`);
if (origin.protocol !== 'https:' || !process.env.REPLIT_DEV_DOMAIN || origin.pathname !== '/') {
  throw new Error('A valid Replit HTTPS development origin is required.');
}
const env = {
  ...process.env,
  EXPO_PACKAGER_PROXY_URL: origin.origin,
  EXPO_PUBLIC_CV_API_URL: `${origin.origin}/api/cv`,
  EXPO_UNSTABLE_HEADLESS: '1',
  CV_DEV_SOCKET: socketPath,
};
const children = [];
let stopping = false;
function stop(code) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of children) if (child.exitCode === null) child.kill('SIGTERM');
  const timeout = setTimeout(() => {
    for (const child of children) if (child.exitCode === null) child.kill('SIGKILL');
  }, 5000);
  timeout.unref();
}
function start(args, childEnv) {
  const child = spawn(process.execPath, args, { cwd: root, env: childEnv, stdio: 'inherit' });
  children.push(child);
  child.on('error', () => stop(1));
  child.on('exit', code => { if (!stopping) stop(code || 1); });
  return child;
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => stop(0));
process.on('exit', () => { try { unlinkSync(socketPath); } catch { /* Already removed or never created. */ } });

// No TCP listener: Replit must not automatically expose an internal backend port.
start(['server/index.mjs'], env);
function localHealth() {
  return new Promise(resolve => {
    const req = request({ socketPath, path: '/health', agent: false }, res => {
      res.resume();
      res.on('end', () => resolve(res.statusCode === 200));
    });
    req.setTimeout(1000, () => req.destroy());
    req.on('error', () => resolve(false));
    req.end();
  });
}
let ready = false;
for (let attempt = 0; attempt < 60 && !stopping; attempt++) {
  try {
    ready = await localHealth();
    if (ready) break;
  } catch { /* Wait for the local child; never call an external analysis service. */ }
  await delay(250);
}
if (!ready) {
  console.error('CV development service did not start.');
  stop(1);
} else if (!stopping) {
  console.log('CV development API ready on private Unix socket; HTTPS bridge: /api/cv (Supabase auth required).');
  start([require.resolve('expo/bin/cli'), 'start', '--web', '--host', 'lan', '--port', '5000'], env);
}
