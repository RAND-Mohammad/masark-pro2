const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { once } = require('node:events');
const { createCvDevProxy } = require('../server/cv-dev-proxy.cjs');

let socketNumber = 0;
async function setup(t, { offline = false, useSocket = false } = {}) {
  const forwarded = [];
  const upstream = http.createServer((req, res) => {
    forwarded.push({ path: req.url, authorization: req.headers.authorization, origin: req.headers.origin });
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/analyze-cv' && req.headers.authorization !== 'Bearer test-only-session') {
      res.writeHead(401);
      return res.end('{"error":"unauthorized"}');
    }
    // Test-only stub, no file processing or external provider.
    res.end('{"status":"test-only-ok"}');
  });
  const socketPath = useSocket ? `/tmp/masarak-proxy-test-${process.pid}-${++socketNumber}.sock` : undefined;
  upstream.listen(socketPath ? { path: socketPath } : { port: 0, host: '127.0.0.1' });
  await once(upstream, 'listening');
  const port = useSocket ? undefined : upstream.address().port;
  if (offline) await new Promise(resolve => upstream.close(resolve));
  const bridge = createCvDevProxy({ port, socketPath });
  const server = http.createServer((req, res) => bridge(req, res, () => {
    res.setHeader('Content-Type', 'text/plain');
    res.end(`expo:${req.url}`);
  }));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    if (upstream.listening) await new Promise(resolve => upstream.close(resolve));
  });
  const send = (path, { method = 'GET', headers = {}, body = '' } = {}) => new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: server.address().port, path, method, agent: false,
      headers: { Connection: 'close', 'Content-Length': Buffer.byteLength(body), ...headers },
    }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString(), headers: res.headers }));
    });
    req.on('error', reject);
    req.end(body);
  });
  return { send, forwarded };
}

test('HTTPS bridge paths map only to fixed local CV endpoints, preserving Bearer and Origin', async t => {
  const h = await setup(t);
  assert.equal((await h.send('/api/cv/health')).status, 200);
  const response = await h.send('/api/cv/analyze-cv', {
    method: 'POST', headers: { Authorization: 'Bearer test-only-session', Origin: 'https://preview.invalid' },
  });
  assert.equal(response.status, 200);
  assert.deepEqual(h.forwarded, [
    { path: '/health', authorization: undefined, origin: undefined },
    { path: '/analyze-cv', authorization: 'Bearer test-only-session', origin: 'https://preview.invalid' },
  ]);
  assert.equal(response.headers['access-control-allow-origin'], undefined);
});

test('the bridge preserves backend 401 for requests without a session', async t => {
  const h = await setup(t);
  const response = await h.send('/api/cv/analyze-cv', { method: 'POST', headers: { 'Content-Type': 'multipart/form-data' }, body: 'invalid multipart' });
  assert.equal(response.status, 401);
  assert.equal(h.forwarded[0].authorization, undefined);
});

test('email hooks, arbitrary proxy targets and unknown API routes cannot be forwarded', async t => {
  const h = await setup(t);
  for (const path of ['/api/cv', '/api/cv/api/auth/send-email', '/api/cv/https://example.invalid', '/api/cv/other']) {
    assert.equal((await h.send(path)).status, 404);
  }
  assert.equal(h.forwarded.length, 0);
});

test('web, Expo manifests and native bundle URLs pass through unchanged', async t => {
  const h = await setup(t);
  for (const path of ['/', '/_expo/open?platform=ios&runtime=expo', '/node_modules/expo-router/entry.bundle?platform=android']) {
    assert.equal((await h.send(path)).body, `expo:${path}`);
  }
  assert.equal(h.forwarded.length, 0);
});

test('unavailable internal service returns a generic 502 without leaking its address', async t => {
  const h = await setup(t, { offline: true });
  const response = await h.send('/api/cv/health');
  assert.equal(response.status, 502);
  assert.ok(!response.body.includes('127.0.0.1'));
  assert.equal(response.headers['cache-control'], 'no-store');
});

test('private Unix-socket upstream supports the bridge without any backend TCP port', async t => {
  const h = await setup(t, { useSocket: true });
  assert.equal((await h.send('/api/cv/health')).status, 200);
  assert.equal((await h.send('/api/cv/analyze-cv', { method: 'POST' })).status, 401);
  assert.equal((await h.send('/api/cv/analyze-cv', { method: 'POST', headers: { Authorization: 'Bearer test-only-session' } })).status, 200);
});
