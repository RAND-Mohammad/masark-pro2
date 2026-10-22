const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function harness({ configured = true, sessionError = null, tokens = ['test-only-current-token'], status = 200, apiUrl = 'https://test-only.invalid', platform = 'web', nativeBytes = '%PDF-1.4 synthetic', nativeMime = 'application/pdf', nativeFiles = {} } = {}) {
  const calls = { requests: [], forms: 0, sessions: 0, timers: 0 };
  const output = ts.transpileModule(fs.readFileSync('src/utils/cv-api.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const exports = {};
  const auth = { getSession: async () => {
    const token = tokens[Math.min(calls.sessions++, tokens.length - 1)];
    return { data: { session: token ? { access_token: token } : null }, error: sessionError };
  } };
  const modules = {
    'expo-constants': {},
    'expo-file-system': { File: class extends Blob { constructor(uri) { const item = nativeFiles[uri] ?? { bytes: nativeBytes, mime: nativeMime }; super([item.bytes], { type: item.mime }); this.uri = uri; } } },
    'expo/fetch': { fetch: async (url, init) => {
      calls.requests.push({ url, init });
      return { ok: status === 200, json: async () => status === 200 ? { skills: [] } : { error: 'سجّل الدخول مجددًا لتحليل السيرة.' } };
    } },
    'react-native': { Platform: { OS: platform } },
    './skill-profile': { isCvAnalysis: () => true },
    './supabase': { supabase: configured ? { auth } : null },
  };
  for (const name of ['cv-file', 'cv-upload-file']) {
    const moduleExports = {};
    const compiled = ts.transpileModule(fs.readFileSync(`src/utils/${name}.ts`, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText;
    vm.runInNewContext(compiled, { exports: moduleExports, require: name => modules[name] });
    modules[`./${name}`] = moduleExports;
  }
  vm.runInNewContext(output, {
    exports, require: name => { if (!(name in modules)) throw Error(`Unexpected import ${name}`); return modules[name]; },
    process: { env: { EXPO_PUBLIC_CV_API_URL: apiUrl } },
    window: { location: { origin: 'https://test-web.invalid' } },
    FormData: class {
      constructor() { calls.forms++; this.fields = []; }
      append(...args) { this.fields.push(args); }
    },
    AbortController,
    setTimeout: () => { calls.timers++; return 1; },
    clearTimeout: () => { calls.timers--; },
  });
  return { analyzeCv: exports.analyzeCv, validateSelection: modules['./cv-upload-file'].getValidatedCvFile, metadata: modules['./cv-file'], calls,
    file: { name: 'unused-test-upload.pdf', file: new Blob(['%PDF-1.4 synthetic'], { type: 'application/pdf' }) } };
}

test('client sends the current access token in Authorization, never in form fields', async () => {
  const h = harness({ tokens: ['test-only-first-token', 'test-only-refreshed-token'] });
  await h.analyzeCv(h.file);
  await h.analyzeCv(h.file);
  assert.equal(h.calls.sessions, 2);
  for (const [index, token] of ['test-only-first-token', 'test-only-refreshed-token'].entries()) {
    const { url, init } = h.calls.requests[index];
    assert.equal(url, 'https://test-only.invalid/analyze-cv');
    assert.equal(init.headers.Authorization, `Bearer ${token}`);
    assert.equal(init.headers['Content-Type'], undefined); // Fetch supplies multipart boundary.
    assert.deepEqual(Array.from(init.body.fields, field => field[0]), ['cv', 'consent']);
    assert.ok(!JSON.stringify(init.body.fields).includes(token));
  }
  assert.equal(h.calls.timers, 0);
});

for (const options of [{ configured: false }, { tokens: [null] }, { sessionError: { message: 'test-only auth error' } }]) {
  test(`client refuses missing/unavailable session before constructing upload: ${JSON.stringify(options)}`, async () => {
    const h = harness(options);
    await assert.rejects(h.analyzeCv(h.file), /تسجيل الدخول|سجّل الدخول/);
    assert.equal(h.calls.forms, 0);
    assert.equal(h.calls.requests.length, 0);
  });
}

test('client reports server 401 rather than returning analysis and clears its timer', async () => {
  const h = harness({ status: 401 });
  await assert.rejects(h.analyzeCv(h.file), /سجّل الدخول مجددًا/);
  assert.equal(h.calls.requests.length, 1);
  assert.equal(h.calls.timers, 0);
});

test('web uses a relative same-origin HTTPS bridge without changing Bearer auth', async () => {
  const h = harness({ apiUrl: 'https://test-web.invalid/api/cv' });
  await h.analyzeCv(h.file);
  assert.equal(h.calls.requests[0].url, '/api/cv/analyze-cv');
  assert.equal(h.calls.requests[0].init.headers.Authorization, 'Bearer test-only-current-token');
});

for (const platform of ['android', 'ios']) {
  test(`${platform} uses the absolute HTTPS bridge with the current token`, async () => {
    const h = harness({ apiUrl: 'https://test-web.invalid/api/cv', platform });
    await h.analyzeCv({ name: 'unused-upload.pdf', uri: 'test-only://unused' });
    assert.equal(h.calls.requests[0].url, 'https://test-web.invalid/api/cv/analyze-cv');
    assert.equal(h.calls.requests[0].init.headers.Authorization, 'Bearer test-only-current-token');
  });
}

test('picker advertises PDF only and metadata rejects other extensions and types', () => {
  const h = harness();
  assert.deepEqual(Array.from(h.metadata.CV_MIME_TYPES), ['application/pdf']);
  for (const file of [{ name: 'cv.png' }, { name: 'cv.jpg' }, { name: 'cv.docx' }, { name: 'cv.pdf', mimeType: 'image/png' }]) {
    assert.equal(h.metadata.validateCvFile(file), 'يرجى رفع السيرة الذاتية بصيغة PDF فقط');
  }
  assert.match(h.metadata.validateCvFile({ name: 'cv.pdf', size: 0 }), /فارغ/);
  assert.match(h.metadata.validateCvFile({ name: 'cv.pdf', size: 10 * 1024 * 1024 + 1 }), /10 ميجابايت/);
});

for (const platform of ['web', 'android', 'ios']) {
  test(`${platform} rejects non-PDF selection and uploads, then still accepts a PDF`, async () => {
    for (const fixture of [
      { name: 'cv.png', mimeType: 'image/png', bytes: '\x89PNG\r\n\x1a\n' },
      { name: 'cv.jpg', mimeType: 'image/jpeg', bytes: '\xff\xd8\xff' },
      { name: 'cv.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', bytes: 'PK\x03\x04' },
      { name: 'disguised.pdf', mimeType: 'application/pdf', bytes: '\x89PNG\r\n\x1a\n' },
    ]) {
      const h = harness({ platform, nativeBytes: fixture.bytes, nativeMime: fixture.mimeType });
      const invalid = { name: fixture.name, uri: 'test-only://invalid', mimeType: fixture.mimeType, file: new Blob([fixture.bytes], { type: fixture.mimeType }) };
      await assert.rejects(h.validateSelection(invalid), { message: 'يرجى رفع السيرة الذاتية بصيغة PDF فقط' });
      await assert.rejects(h.analyzeCv(invalid), { message: 'يرجى رفع السيرة الذاتية بصيغة PDF فقط' });
      assert.equal(h.calls.forms, 0);
      assert.equal(h.calls.requests.length, 0);
    }
    const h = harness({ platform, nativeFiles: { 'test-only://bad': { bytes: 'not PDF', mime: 'application/pdf' } } });
    await assert.rejects(h.validateSelection({ name: 'bad.pdf', uri: 'test-only://bad', file: new Blob(['not PDF'], { type: 'application/pdf' }) }));
    const valid = { ...h.file, uri: 'test-only://valid', name: 'valid.PDF' };
    await h.validateSelection(valid);
    await h.analyzeCv(valid);
    assert.equal(h.calls.requests.length, 1);
  });
}
