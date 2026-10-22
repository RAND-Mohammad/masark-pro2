const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const harness = require('./helpers/auth-screen-harness.cjs');

async function waitFor(h, condition) {
  const deadline = Date.now() + 8000;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error(`Timed out waiting for resume flow. UI: ${h.text().slice(-800)}`);
    await new Promise(resolve => setTimeout(resolve, 10));
    await h.flush();
  }
}
const plain = value => JSON.parse(JSON.stringify(value));
const click = (h, label) => h.act(nodes => {
  const node = nodes.find(n => n.type === 'Pressable' && n.props.accessibilityLabel === label);
  assert.ok(node && !node.props.disabled, label);
  node.props.onPress();
});
const count = (h, label) => h.nodes().find(n => n.type === 'Text' && n.props.accessibilityLabel === `عدد ${label} المعتمدة`)?.props.children;

for (const language of ['en', 'ar', 'wrapped-skills']) {
  test(`FR3 ${language}: real PDF → multipart/auth → local parser → client validation → UI correction → actual storage → reopen`, async t => {
    const { resumePdf } = await import('../server/fixtures/fr3-resumes.mjs');
    const { createCvApp } = await import('../server/cv-app.mjs');
    const { createCvSessionGuard } = await import('../server/cv-session.mjs');
    const { analyzeText, analyzeLocalText } = await import('../server/analysis.mjs');
    const { wrappedSkillsPdf, expectedSkills, incompleteSkills } = await import('../server/fixtures/wrapped-skills.mjs');
    const { providerResult } = await import('../server/fixtures/provider-result.mjs');
    const pdf = language === 'wrapped-skills' ? wrappedSkillsPdf() : resumePdf(language);
    const statuses = [], authRequests = [];
    let providerCalls = 0;
    const app = createCvApp({
      authenticate: createCvSessionGuard({ url: 'https://synthetic-project.supabase.co', key: 'sb_publishable_test-only',
        fetchImpl: async (_url, options) => { authRequests.push(options.headers.Authorization); return new Response(JSON.stringify({ id: 'synthetic-owner' })); } }),
      // Local parser fixtures remain unit/integration tests, not a production fallback.
      analyzeCvText: (text, { pdf }) => language !== 'wrapped-skills' ? analyzeLocalText(text) : analyzeText(text, {
        key: 'synthetic-test-key', pdf, client: { models: { generateContent: async () => {
          providerCalls++;
          const payload = providerResult({ skills: incompleteSkills(text) });
          for (const row of payload.skills) row.field_sources = [{ field: 'name', quote: row.name, page: 1 }];
          return { text: JSON.stringify(payload), candidates: [{ finishReason: 'STOP' }] };
        } } },
      }),
    });
    const server = http.createServer(app);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(() => new Promise(resolve => server.close(resolve)));
    const address = `http://127.0.0.1:${server.address().port}`;
    const disk = new Map([['cache/fictional.pdf', pdf]]), memory = new Map();
    const storage = { getItem: async key => memory.get(key) ?? null, setItem: async (key, value) => memory.set(key, value), removeItem: async key => memory.delete(key) };
    class Directory { constructor(parent, name) { this.uri = `${parent}/${name}`; } create() {} }
    class File extends Blob {
      constructor(parent, name) {
        const uri = name ? `${parent.uri}/${name}` : parent;
        super([disk.get(uri) ?? Buffer.alloc(0)], { type: 'application/pdf' });
        this.uri = uri;
      }
      get exists() { return disk.has(this.uri); }
      async copy(destination) { assert.ok(this.exists); disk.set(destination.uri, disk.get(this.uri)); }
      delete() { disk.delete(this.uri); }
    }
    const overrides = {
      'expo-constants': { __esModule: true, default: {} },
      'expo/fetch': { fetch: async (url, options) => {
        assert.equal(url, 'https://app.example.test/api/cv/analyze-cv');
        const response = await fetch(address + '/analyze-cv', options); // Only loopback; never the configured fake HTTPS URL.
        statuses.push(response.status);
        return response;
      } },
      'expo-document-picker': { getDocumentAsync: async () => ({ canceled: false, assets: [{ uri: 'cache/fictional.pdf', name: 'fictional.pdf', mimeType: 'application/pdf', size: pdf.length }] }) },
      'expo-file-system': { File, Directory, Paths: { document: 'documents' } },
      '../utils/scoped-storage': { __esModule: true, default: storage, captureDataScope: () => ({ suffix: '-synthetic-owner', assertCurrent() {} }) },
      '../utils/supabase': { supabase: { auth: { getSession: async () => ({ error: null, data: { session: { access_token: 'test-only-session' } } }) } } },
    };
    const options = { platform: 'android', renderComponents: true, moduleOverrides: overrides };
    const h = harness('src/app/upload-cv.tsx', options);
    t.after(h.dispose);
    await h.flush();
    await h.press('اختيار السيرة من الملفات');
    assert.ok(h.text().includes('fictional.pdf'), h.text());
    await h.press('أوافق على إرسال ملف PDF ونص السيرة إلى Google Gemini لتحليله، ثم مراجعة النتائج قبل اعتمادها.');
    await h.press('تحليل السيرة الذاتية');
    await waitFor(h, () => count(h, 'المهارات') !== undefined);
    assert.deepEqual(statuses, [200]);
    assert.deepEqual(authRequests, ['Bearer test-only-session']);
    if (language === 'wrapped-skills') {
      const actualNames = ui => ui.nodes().filter(node => node.type === 'TextInput'
        && node.props.accessibilityLabel === 'اسم المهارة').map(node => node.props.value);
      assert.equal(providerCalls, 1);
      assert.equal(count(h, 'المهارات'), 15);
      assert.deepEqual([...actualNames(h)].sort(), [...expectedSkills].sort());
      await h.press('اعتماد المعلومات وحفظها');
      const approved = JSON.parse(memory.get('masarak-skills-v1')).cv;
      assert.deepEqual(approved.skills.map(item => item.name).sort(), [...expectedSkills].sort());
      assert.equal(approved.skills.length, 15);
      assert.ok(approved.skills.every(item => item.evidence));
      const storedReview = JSON.parse(memory.get('masarak-saved-cv-v1')).review;
      assert.equal(storedReview.skills.length, 15);
      h.dispose();
      const reopened = harness('src/app/upload-cv.tsx', options);
      t.after(reopened.dispose);
      await reopened.flush();
      assert.equal(count(reopened, 'المهارات'), 15);
      assert.deepEqual([...actualNames(reopened)].sort(), [...expectedSkills].sort());
      assert.deepEqual(statuses, [200]);
      assert.equal(providerCalls, 1, 'reopen must not re-analyze or contact a provider');
      return;
    }
    for (const [label, total] of [['المهارات', 9], ['المشاريع', 3], ['الدورات', 5], ['الشهادات', 2], ['التعليم', 1], ['الخبرات', 2]]) assert.equal(count(h, label), total, label);
    assert.ok(h.text().includes('مستنتج'));
    assert.ok(h.text().includes('سنة و2 شهر'));
    assert.ok(h.text().includes('تقريبًا'));
    assert.ok(h.text().includes('المصدر الأصلي لهذا الحقل:'));
    const universityQuote = language === 'en' ? 'University: Demo University' : 'الجامعة: جامعة تجريبية';
    assert.ok(h.text().includes(universityQuote), 'the education source quote must be visible in the actual review UI');

    const projectTitle = language === 'en' ? 'Campus Portal' : 'بوابة الحرم';
    const corrected = language === 'en' ? 'Corrected Portal' : 'بوابة معدلة';
    assert.equal(h.input('اسم المشروع').props.value, projectTitle);
    await h.fill('اسم المشروع', corrected);
    await click(h, `نقل ${corrected} إلى الدورات`);
    assert.equal(count(h, 'المشاريع'), 2);
    assert.equal(count(h, 'الدورات'), 6);
    await click(h, `نقل ${corrected} إلى المشاريع`);
    assert.equal(count(h, 'المشاريع'), 3);
    assert.equal(count(h, 'الدورات'), 5);
    await click(h, 'استبعاد Python');
    assert.equal(count(h, 'المهارات'), 8);
    await click(h, 'اعتماد Python');
    assert.equal(count(h, 'المهارات'), 9);
    await click(h, 'استبعاد Python');

    await click(h, 'إضافة إلى المشاريع');
    assert.equal(count(h, 'المشاريع'), 3); // Empty manual items are not facts.
    await h.act(nodes => nodes.filter(n => n.type === 'TextInput' && n.props.accessibilityLabel === 'اسم المشروع').at(-1).props.onChangeText('Manual Example'));
    assert.equal(count(h, 'المشاريع'), 4);
    assert.ok(h.text().includes('ليست مستخرجة'));
    await click(h, 'استبعاد Manual Example');
    assert.equal(count(h, 'المشاريع'), 3);
    await h.press('اعتماد المعلومات وحفظها');
    await waitFor(h, () => h.routes.includes('/home'));
    const approved = JSON.parse(memory.get('masarak-skills-v1')).cv;
    assert.equal(approved.skills.length, 8);
    assert.equal(approved.courses.length, 5);
    assert.equal(approved.projects.length, 3);
    const movedProject = approved.projects.find(item => item.name === corrected);
    assert.deepEqual(movedProject.technologies, ['HTML', 'CSS', 'JavaScript']);
    assert.ok(movedProject.role);
    assert.ok(movedProject.evidence.includes(projectTitle)); // Moving/editing did not erase source evidence.
    assert.ok(movedProject.field_evidence.name.includes(projectTitle));
    assert.ok(approved.education[0].field_evidence.organization.includes(language === 'en' ? 'Demo University' : 'جامعة تجريبية'));
    const draft = JSON.parse(memory.get('masarak-saved-cv-v1')).review;
    assert.equal(h.module('../utils/saved-cv.types').validReview(draft), true);
    assert.equal(h.module('../utils/skill-profile').isCvAnalysis(approved), true);
    const profileApi = h.module('../utils/skill-profile');
    assert.equal(profileApi.isCvAnalysis({ ...approved, courses: 'invalid' }), false);
    assert.equal(profileApi.isCvAnalysis({ ...approved, projects: [{ ...approved.projects[0], technologies: [123] }] }), false);
    assert.equal(h.module('../utils/saved-cv.types').validReview({ ...draft, courses: [999] }), false);
    const legacyCv = { skills: [], certificates: [], experiences: [], warnings: [], reviewed_at: '2024-01-01T00:00:00Z' };
    assert.equal(profileApi.isCvAnalysis(legacyCv), true);
    assert.deepEqual(plain(profileApi.parseSkillProfile({ version: 3, cv: legacyCv, skill_ids: [], manual_skill_ids: [], excluded_cv_skill_ids: [] }).cv), legacyCv);
    const savedCopy = JSON.stringify(draft);
    h.dispose();
    const reopened = harness('src/app/upload-cv.tsx', options);
    t.after(reopened.dispose);
    await reopened.flush();
    assert.equal(count(reopened, 'المهارات'), 8);
    assert.equal(count(reopened, 'المشاريع'), 3);
    assert.equal(count(reopened, 'الدورات'), 5);
    assert.ok(reopened.nodes().some(n => n.type === 'TextInput' && n.props.value === corrected));
    assert.equal(JSON.stringify(JSON.parse(memory.get('masarak-saved-cv-v1')).review), savedCopy);
    assert.deepEqual(statuses, [200]); // Reopening never re-uploads or re-analyzes.
  });
}

test('old reviews remain readable; unique counts react to edits and unresolved facts are not counted', () => {
  const h = harness('src/app/upload-cv.tsx', { moduleOverrides: {
    'expo-document-picker': {}, '../utils/cv-api': {}, '../utils/cv-upload-file': {},
    '../utils/skill-profile': { readSkillProfile: async () => null }, '../utils/saved-cv': { loadSavedCv: async () => null },
  } });
  const helpers = h.module('../utils/cv-review');
  const analysis = { skills: [], certificates: [], experiences: [], education: [], projects: [
    { name: 'One', organization: '', dates: '', description: 'Original description', evidence: 'Original quote' },
    { name: 'Two', organization: '', dates: '', description: 'Second', evidence: 'Second quote' },
  ], warnings: [] };
  let review = helpers.createCvReview(analysis);
  review = helpers.updateCvReviewItem(review, 'projects', 1, 'name', 'One');
  assert.equal(helpers.cvReviewCounts(review).projects, 1);
  review = helpers.moveCvReviewItem(review, 'projects', 0, 'unclassified');
  assert.equal(helpers.cvReviewCounts(review).projects, 1);
  assert.equal(review.analysis.unclassified[0].evidence, 'Original quote');
  const old = { analysis: { skills: [], certificates: [], experiences: [], warnings: [] }, skills: [], certificates: [], experiences: [] };
  assert.deepEqual(plain(helpers.normalizeCvReview(old).courses), []);
  h.dispose();
});
