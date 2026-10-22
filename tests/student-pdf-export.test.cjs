const test = require('node:test');
const assert = require('node:assert/strict');
const projectModule = require('./helpers/project-module.cjs');
const harness = require('./helpers/auth-screen-harness.cjs');
const data = () => ({
  personal: { version: 1, name: 'طالب اختبار', institution: 'Synthetic University', education: 'Bachelor',
    major: 'Computer Science', studyStatus: 'تخرج متوقع', studyDates: '2027', interests: ['Data analysis'], traits: [],
    gpa: null, gpaScale: null, careerGoal: null },
  skills: { version: 3, skill_ids: [], manual_skill_ids: [], excluded_cv_skill_ids: [],
    cv: { entry_method: 'answers', skills: [{ name: 'Python', evidence: 'Python', mapped_skill_id: null }],
      projects: [{ name: 'Synthetic Dashboard', description: 'Analyzed synthetic data', technologies: ['Python'], organization: '', dates: '', evidence: '' }],
      certificates: [], courses: [], experiences: [], warnings: [], reviewed_at: '2026-10-20T00:00:00Z' } },
});
function setup(options = {}) {
  const calls = { print: [], share: [], deleted: [] };
  let current = true, exists = true;
  const scope = { assertCurrent() { if (!current) throw Error('تغيّر الحساب'); } };
  class File {
    constructor(uri) { this.uri = uri; }
    get exists() { return options.missing ? false : exists; }
    get size() { return options.empty ? 0 : 1200; }
    delete() { exists = false; calls.deleted.push(this.uri); }
  }
  const load = projectModule({
    'expo-print': { printToFileAsync: async value => {
      calls.print.push(value);
      if (options.printFailure) throw Error('synthetic render failure');
      if (options.changeAfterPrint) current = false;
      return { uri: options.remote ? 'https://example.test/not-local.pdf' : 'file:///cache/synthetic.pdf',
        numberOfPages: options.noPages ? 0 : 1 };
    } },
    'expo-sharing': {
      isAvailableAsync: async () => {
        if (options.availabilityFailure) throw Error('synthetic availability error');
        if (options.changeAfterAvailable) current = false;
        return options.available !== false;
      },
      shareAsync: async (uri, opts) => { calls.share.push({ uri, opts }); if (options.shareFailure) throw Error('synthetic sharing failure'); },
    },
    'expo-file-system': { File },
    'src/utils/scoped-storage.ts': { captureDataScope: () => scope },
  });
  return { calls, run: () => { const d = data(); return load('src/utils/print-student-resume.ts').printStudentResume(d.personal, d.skills); } };
}
test('native export uses local A4 PDF, same user data, PDF MIME/UTI and no permanent-storage or delivery claim', async () => {
  const { run, calls } = setup();
  assert.equal(await run(), 'native-share');
  assert.equal(calls.print.length, 1); assert.equal(calls.share.length, 1);
  assert.equal(calls.print[0].width, 595); assert.equal(calls.print[0].height, 842);
  assert.equal(calls.print[0].base64, false);
  assert.ok(calls.print[0].html.includes('Synthetic University'));
  assert.ok(calls.print[0].html.includes('Synthetic Dashboard'));
  assert.equal(calls.print[0].html.includes('<h2>الخبرة</h2>'), false, 'no invented experience');
  assert.equal(calls.share[0].uri, 'file:///cache/synthetic.pdf');
  assert.equal(calls.share[0].opts.mimeType, 'application/pdf');
  assert.equal(calls.share[0].opts.UTI, 'com.adobe.pdf');
  assert.equal(calls.deleted.length, 0, 'recipient may still be reading the granted cache URI');
});
test('unavailable sharing fails before rendering or writing a PDF', async () => {
  for (const options of [{ available: false }, { availabilityFailure: true }]) {
    const h = setup(options);
    await assert.rejects(h.run(), /المشاركة/);
    assert.equal(h.calls.print.length, 0); assert.equal(h.calls.share.length, 0);
  }
});
test('renderer failure, empty or invalid results never reach sharing and leave useful retry messages', async () => {
  for (const options of [{ printFailure: true }, { empty: true }, { missing: true }, { remote: true }, { noPages: true }]) {
    const h = setup(options);
    await assert.rejects(h.run(), /تعذر إنشاء PDF/);
    assert.equal(h.calls.share.length, 0);
    if (options.empty || options.noPages) assert.equal(h.calls.deleted.length, 1);
  }
});
test('sharing failure cleans temporary PDF and does not expose raw native error', async () => {
  const h = setup({ shareFailure: true });
  await assert.rejects(h.run(), error => error.message === 'تعذرت مشاركة PDF. حاول مجددًا؛ ملفك محفوظ.');
  assert.equal(h.calls.deleted.length, 1);
});
test('a scope change before or after rendering prevents cross-account sharing and cleans output', async () => {
  for (const options of [{ changeAfterAvailable: true }, { changeAfterPrint: true }]) {
    const h = setup(options);
    await assert.rejects(h.run(), /تغيّر الحساب/);
    assert.equal(h.calls.share.length, 0);
    if (options.changeAfterAvailable) assert.equal(h.calls.print.length, 0);
    if (options.changeAfterPrint) assert.equal(h.calls.deleted.length, 1);
  }
});
for (const platform of ['ios', 'android']) {
  test(`${platform}: saved preview opens export, blocks double taps, shows honest success and retries after failure`, async t => {
    const d = data();
    let resolve, reject, mode = 'pending', exports = 0, writes = 0;
    const base = { personal: d.personal, skills: d.skills, scope: { assertCurrent() {} } };
    const h = harness('src/app/resume-preview.tsx', { platform, renderComponents: true, moduleOverrides: {
      '../utils/student-profile': { loadStudentBase: async () => base, saveStudentProfile: async () => { writes++; } },
      '../utils/print-student-resume': { printStudentResume: () => {
        exports++;
        if (mode === 'pending') return new Promise((ok, fail) => { resolve = ok; reject = fail; });
        return Promise.resolve('native-share');
      } },
    } });
    t.after(h.dispose); await h.flush();
    const originalButton = h.button('تصدير ومشاركة PDF');
    assert.ok(originalButton);
    await h.press('تصدير ومشاركة PDF');
    assert.equal(exports, 1);
    assert.equal(h.button('جارٍ تجهيز PDF…').props.disabled, true);
    await h.act(() => originalButton.props.onPress());
    assert.equal(exports, 1);
    await h.act(() => reject(Error('تعذرت مشاركة PDF. حاول مجددًا؛ ملفك محفوظ.')));
    assert.ok(h.text().includes('تعذرت مشاركة PDF'));
    assert.ok(h.button('تصدير ومشاركة PDF'));
    mode = 'success';
    await h.press('تصدير ومشاركة PDF');
    assert.ok(h.text().includes('تم تجهيز PDF وفتح المشاركة'));
    assert.equal(h.text().includes('تعذرت مشاركة PDF'), false);
    assert.equal(h.text().includes('تم إرسال'), false);
    assert.equal(writes, 0, 'export is read-only, never rewrites the profile');
  });
}
test('web keeps browser printing, catches blocked popups and uses escaped self-contained HTML', async () => {
  const d = data(), writes = [], printed = [];
  let allowed = false;
  const popup = { opener: {}, document: { open() {}, write: html => writes.push(html), close() {} }, focus() {}, print: () => printed.push(true) };
  const load = projectModule({ 'src/utils/scoped-storage.ts': { captureDataScope: () => ({ assertCurrent() {} }) } },
    { window: { open: () => allowed ? popup : null } });
  const run = () => load('src/utils/print-student-resume.web.ts').printStudentResume(d.personal, d.skills);
  await assert.rejects(run(), /اسمح بفتح نافذة/);
  allowed = true;
  assert.equal(await run(), 'web-print');
  assert.equal(popup.opener, null);
  assert.equal(printed.length, 1);
  assert.ok(writes[0].includes("default-src 'none'"));
});
