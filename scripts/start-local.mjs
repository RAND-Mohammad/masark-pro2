import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { request } from 'node:http';

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('../', import.meta.url));
const apiPort = 3001;
const children = [];
let stopping = false;

function apiIsReady() {
  return new Promise(resolve => {
    const req = request({ hostname: '127.0.0.1', port: apiPort, path: '/health', method: 'GET' }, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { if (body.length < 2048) body += chunk; });
      response.on('end', () => {
        try { resolve(response.statusCode === 200 && JSON.parse(body)?.status === 'ok'); }
        catch { resolve(false); }
      });
    });
    req.setTimeout(900, () => req.destroy());
    req.on('error', () => resolve(false));
    req.end();
  });
}

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of children) if (child.exitCode === null) child.kill();
  const forceStop = setTimeout(() => {
    for (const child of children) if (child.exitCode === null) child.kill();
  }, 4000);
  forceStop.unref();
}

function startChild(label, args, env = process.env) {
  const child = spawn(process.execPath, args, { cwd: root, env, stdio: 'inherit' });
  children.push(child);
  child.on('error', error => {
    console.error(`${label} could not start: ${error.message}`);
    stop(1);
  });
  child.on('exit', (code, signal) => {
    if (stopping) return;
    console.error(`${label} stopped${signal ? ` (${signal})` : ''}; stopping the other process.`);
    stop(code ?? (signal === 'SIGINT' ? 0 : 1));
  });
  return child;
}

process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));

let apiReady = await apiIsReady();
if (apiReady) console.log('Masarak API is already running on port 3001.');
else {
  console.log('Starting the Masarak API on port 3001…');
  startChild('Masarak API', ['server/index.mjs'], {
    ...process.env,
    PORT: String(apiPort),
    CV_HOST: '0.0.0.0',
    CV_DEV_SOCKET: '',
  });
  for (let attempt = 0; attempt < 80 && !stopping; attempt++) {
    if (await apiIsReady()) { apiReady = true; break; }
    await delay(250);
  }
}

if (!apiReady) {
  console.error('Masarak API did not become ready. Check server/.env and port 3001.');
  stop(1);
} else if (!stopping) {
  const extraArgs = process.argv.slice(2);
  const hasHostFlag = extraArgs.some(arg => arg === '--host' || arg.startsWith('--host='));
  const expoEnv = { ...process.env, EXPO_PUBLIC_CV_API_URL: '' };
  startChild('Expo', [require.resolve('expo/bin/cli'), 'start', ...(hasHostFlag ? [] : ['--host', 'lan']), ...extraArgs], expoEnv);
}