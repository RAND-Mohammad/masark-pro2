import test from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { createCvApp } from './cv-app.mjs';
import { createCvSessionGuard } from './cv-session.mjs';
import { extractText, analyzeLocalText } from './analysis.mjs';

// Only loopback HTTP is used. Supabase and Groq are always mocked.
const url = 'https://test-project.supabase.co';
const key = 'sb_publishable_test-only';
async function harness(t, { status = 200, user = { id: 'verified-owner' }, fail = false, configured = true, localAnalysis = false } = {}) {
  const calls = { auth: [], extract: 0, groq: 0, identities: [] };
  const guard = createCvSessionGuard({
    url: configured ? url : '', key,
    fetchImpl: async (target, options) => {
      calls.auth.push({ target, options });
      if (fail) throw new Error('test-only upstream failure');
      return new Response(JSON.stringify(user), { status });
    },
  });
  const app = createCvApp({
    authenticate: (req, res, next) => guard(req, res, () => {
      calls.identities.push(res.locals.cvUser.id);
      next();
    }),
    extractCvText: async file => { calls.extract++; return extractText(file); },
    analyzeCvText: async text => {
      if (localAnalysis) return analyzeLocalText(text); // Explicit test injection, never the production fallback.
      calls.groq++;
      assert.ok(text.length >= 40);
      return { skills: [], certificates: [], experiences: [], education: [], projects: [], activities: [], warnings: [] };
    },
  });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  function send({ authorization, body = 'invalid multipart; must not be parsed before auth', contentType = 'multipart/form-data', method = 'POST', extraHeaders = {} } = {}) {
    return new Promise((resolve, reject) => {
      const payload = method === 'OPTIONS' ? '' : body;
      const headers = { 'Content-Type': contentType, 'Content-Length': Buffer.byteLength(payload), Connection: 'close', ...extraHeaders };
      if (authorization !== undefined) headers.Authorization = authorization;
      const req = request({ host: '127.0.0.1', port: server.address().port, path: '/analyze-cv', method, headers, agent: false }, res => {
        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString() }));
      });
      req.on('error', reject);
      req.end(payload);
    });
  }
  return { calls, send };
}

for (const authorization of [undefined, 'Basic test-only', 'Bearer', 'Bearer a b', 'Bearer a,Bearer b']) {
  test(`rejects missing/malformed Authorization (${authorization ?? 'absent'}) before multipart parsing`, async t => {
    const h = await harness(t);
    const response = await h.send({ authorization });
    assert.equal(response.status, 401);
    assert.equal(h.calls.auth.length, 0);
    assert.equal(h.calls.extract, 0);
    assert.equal(h.calls.groq, 0);
  });
}

for (const token of ['test-only-corrupt-token', 'test-only-expired-token', 'test-only-forged-token']) {
  test(`Supabase rejection (${token}) returns 401 before parsing or Groq`, async t => {
    const h = await harness(t, { status: 401, user: { message: 'test-only rejected' } });
    const response = await h.send({ authorization: `Bearer ${token}` });
    assert.equal(response.status, 401);
    assert.equal(h.calls.auth.length, 1);
    assert.equal(h.calls.auth[0].target, `${url}/auth/v1/user`);
    assert.equal(h.calls.auth[0].options.headers.Authorization, `Bearer ${token}`);
    assert.equal(h.calls.auth[0].options.headers.apikey, key);
    assert.equal(h.calls.auth[0].options.redirect, 'error');
    assert.equal(h.calls.extract, 0);
    assert.equal(h.calls.groq, 0);
    assert.ok(!response.body.includes(token));
  });
}

test('Supabase 403 also rejects the token with 401', async t => {
  const h = await harness(t, { status: 403 });
  assert.equal((await h.send({ authorization: 'Bearer test-only-token' })).status, 401);
  assert.equal(h.calls.extract + h.calls.groq, 0);
});

test('a verified session reaches multipart parser, but a broken upload never reaches extraction or Groq', async t => {
  const h = await harness(t);
  // The existing generic error handler maps missing-boundary parser errors to 500.
  // Without authentication the identical body gets 401 instead (tests above).
  assert.equal((await h.send({ authorization: 'Bearer test-only-token' })).status, 500);
  assert.equal(h.calls.auth.length, 1);
  assert.equal(h.calls.extract + h.calls.groq, 0);
});

test('verified session accepts an existing PDF fixture and ignores client user_id', async t => {
  const h = await harness(t);
  const boundary = 'test-only-cv-boundary';
  const pdf = await readFile(new URL('./fixtures/demo.pdf', import.meta.url));
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="consent"\r\n\r\ntrue\r\n--${boundary}\r\nContent-Disposition: form-data; name="user_id"\r\n\r\nuntrusted-other-user\r\n--${boundary}\r\nContent-Disposition: form-data; name="cv"; filename="demo.pdf"\r\nContent-Type: application/pdf\r\n\r\n`),
    pdf, Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  const response = await h.send({ authorization: 'Bearer test-only-valid-session', body, contentType: `multipart/form-data; boundary=${boundary}` });
  assert.equal(response.status, 200);
  assert.deepEqual(h.calls.identities, ['verified-owner']);
  assert.equal(h.calls.extract, 1);
  assert.equal(h.calls.groq, 1); // Local mock only, never the provider.
});

test('authenticated PDF upload reaches real extraction and local skills/experience analysis without Groq', async t => {
  const h = await harness(t, { localAnalysis: true });
  const lines = [
    'Demo Candidate - synthetic CV',
    'Skills: Python, SQL',
    'Work Experience:',
    'Software Engineer at Sample Labs, 2021 - 2023',
  ];
  const stream = 'BT /F1 12 Tf 50 750 Td ' + lines.map((line, index) =>
    `${index ? '0 -24 Td ' : ''}(${line.replace(/[\\()]/g, '\\$&')}) Tj`).join('\n') + ' ET';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  ];
  let document = '%PDF-1.4\n';
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(document));
    document += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xref = Buffer.byteLength(document);
  document += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Root 1 0 R /Size 6 >>\nstartxref\n${xref}\n%%EOF\n`;
  const boundary = 'test-only-local-fr3-boundary';
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="consent"\r\n\r\ntrue\r\n--${boundary}\r\nContent-Disposition: form-data; name="cv"; filename="synthetic.pdf"\r\nContent-Type: application/pdf\r\n\r\n`),
    Buffer.from(document), Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  const response = await h.send({ authorization: 'Bearer test-only-valid-session', body, contentType: `multipart/form-data; boundary=${boundary}` });
  assert.equal(response.status, 200);
  const result = JSON.parse(response.body);
  assert.deepEqual(result.skills.map(item => item.name), ['Python', 'SQL']);
  assert.equal(result.experiences.length, 1);
  assert.equal(result.experiences[0].role, 'Software Engineer');
  assert.equal(result.experiences[0].organization, 'Sample Labs');
  assert.equal(result.experiences[0].dates, '2021 - 2023');
  assert.equal(result.experiences[0].evidence, lines[3]);
  assert.equal(h.calls.extract, 1);
  assert.equal(h.calls.groq, 0);
  assert.deepEqual(h.calls.identities, ['verified-owner']);
});

test('authenticated upload rejects images, DOCX and images renamed to PDF before analysis', async t => {
  for (const [name, mime, bytes] of [
    ['cv.png', 'image/png', '\x89PNG\r\n\x1a\n'],
    ['cv.jpg', 'image/jpeg', '\xff\xd8\xff'],
    ['cv.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'PK\x03\x04'],
    ['renamed.pdf', 'application/pdf', '\x89PNG\r\n\x1a\n'],
    ['renamed.pdf', 'application/pdf', '\xff\xd8\xff'],
  ]) {
    const h = await harness(t);
    const boundary = 'test-only-rejected-cv';
    const body = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="consent"\r\n\r\ntrue\r\n--${boundary}\r\nContent-Disposition: form-data; name="cv"; filename="${name}"\r\nContent-Type: ${mime}\r\n\r\n${bytes}\r\n--${boundary}--\r\n`);
    const response = await h.send({ authorization: 'Bearer test-only-valid-session', body, contentType: `multipart/form-data; boundary=${boundary}` });
    assert.equal(response.status, 400);
    assert.equal(JSON.parse(response.body).error, 'يرجى رفع السيرة الذاتية بصيغة PDF فقط');
    assert.equal(h.calls.extract, 1);
    assert.equal(h.calls.groq, 0);
  }
});

for (const options of [{ fail: true }, { status: 500 }, { user: {} }, { configured: false }]) {
  test(`auth failure fails closed without extraction/Groq: ${JSON.stringify(options)}`, async t => {
    const h = await harness(t, options);
    assert.equal((await h.send({ authorization: 'Bearer test-only-token' })).status, 503);
    assert.equal(h.calls.extract + h.calls.groq, 0);
    assert.deepEqual(h.calls.identities, []);
  });
}

test('preflight allows Bearer headers only for existing allowed origins and does not analyze', async t => {
  const h = await harness(t);
  const response = await h.send({ method: 'OPTIONS', extraHeaders: { Origin: 'http://localhost:5000', 'Access-Control-Request-Headers': 'authorization' } });
  assert.equal(response.status, 204);
  assert.equal(response.headers['access-control-allow-origin'], 'http://localhost:5000');
  assert.match(response.headers['access-control-allow-headers'], /Authorization/);
  assert.equal(h.calls.auth.length + h.calls.extract + h.calls.groq, 0);
  const external = await h.send({ method: 'OPTIONS', extraHeaders: { Origin: 'https://untrusted.invalid' } });
  assert.equal(external.headers['access-control-allow-origin'], undefined);
});
