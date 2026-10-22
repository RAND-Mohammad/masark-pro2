const test = require('node:test');
const assert = require('node:assert/strict');
const harness = require('./helpers/auth-screen-harness.cjs');
const projectModule = require('./helpers/project-module.cjs');
const plain = value => JSON.parse(JSON.stringify(value));
const consent = 'أوافق على إرسال ملف PDF ونص السيرة إلى Google Gemini لتحليله، ثم مراجعة النتائج قبل اعتمادها.';
const source = 'EDUCATION\n[University Name], Bachelor of Science in Computer Science\nExpected Graduation: 2027\nACADEMIC PROJECTS\nAircraft Runway Scheduling System\n• Designed an optimized Priority Scheduling Algorithm using Priority Queue';

async function setup(platform, { fail = false, fileAvailable = true } = {}) {
  const { analyzeLocalText } = await import('../server/analysis.mjs');
  const fresh = analyzeLocalText(source);
  const legacy = plain(fresh);
  delete legacy.parser_version;
  legacy.projects[0].name = 'عنوان صححه المستخدم';
  legacy.projects[0].source = 'user_corrected';
  const modules = projectModule({ 'src/utils/scoped-storage.ts': { default: {} } });
  const oldReview = modules('src/utils/cv-review.ts').createCvReview(legacy);
  const approved = { ...legacy, reviewed_at: '2026-10-19T12:00:00Z' };
  const calls = { analyze: 0, reviews: [], profiles: [] };
  let stored = plain(oldReview);
  const h = harness('src/app/upload-cv.tsx', { platform, renderComponents: true, moduleOverrides: {
    'expo-document-picker': { getDocumentAsync: async () => { throw Error('Unexpected file picker'); } },
    '../utils/cv-upload-file': { getValidatedCvFile: async () => { throw Error('Unexpected upload'); } },
    '../utils/cv-api': { analyzeCv: async () => { calls.analyze++; if (fail) throw Error('فشل تحليل تجريبي'); return plain(fresh); } },
    '../utils/skill-profile': { readSkillProfile: async () => ({ cv: approved }), saveReviewedCv: async value => { calls.profiles.push(plain(value)); } },
    '../utils/saved-cv': {
      loadSavedCv: async () => fileAvailable ? { asset: { uri: 'test://synthetic.pdf', name: 'synthetic.pdf', mimeType: 'application/pdf' }, review: stored } : null,
      storeCvReview: async (_uri, value) => { stored = plain(value); calls.reviews.push(stored); },
    },
    '../utils/scoped-storage': { captureDataScope: () => ({ assertCurrent() {} }) },
    '../utils/career-matches': { careerTitles: {} },
  } });
  await h.flush();
  return { h, calls, fresh, approved, latest: () => stored };
}
for (const platform of ['web', 'android', 'ios']) test(`${platform}: stale results require consent and confirmation, protect manual edits, restore and approve explicitly`, async t => {
  const { h, calls, approved, latest } = await setup(platform);
  t.after(h.dispose);
  assert.ok(h.text().includes('نتيجة من إصدار سابق تحتاج مراجعة'));
  assert.equal(calls.analyze, 0);
  assert.equal(h.button('إعادة التحليل').props.disabled, true);
  await h.press(consent);
  await h.press('إعادة التحليل');
  assert.equal(calls.analyze, 0, 'confirmation must not send a request');
  await h.press('إلغاء إعادة التحليل');
  assert.equal(h.input('اسم المشروع').props.value, 'عنوان صححه المستخدم');
  await h.press('إعادة التحليل');
  await h.press('إعادة التحليل مع الحفاظ على تعديلاتي');
  assert.equal(calls.analyze, 1);
  assert.equal(calls.profiles.length, 0, 'reanalysis must not overwrite the approved profile');
  assert.equal(h.input('اسم المشروع').props.value, 'عنوان صححه المستخدم');
  assert.ok(h.text().includes('احتُفظ بهذا البند من مراجعتك السابقة'));
  assert.equal(latest().previous_review.analysis.parser_version, undefined);
  assert.equal(latest().analysis.parser_version, h.module('../utils/cv-parser-version.mjs').CV_PARSER_VERSION);
  await h.press('عرض المراجعة السابقة');
  assert.ok(h.text().includes('نسخة سابقة للقراءة فقط'));
  await h.press('استعادة هذه المراجعة');
  assert.equal(latest().analysis.parser_version, undefined);
  await h.press('عرض المراجعة السابقة');
  await h.press('استعادة هذه المراجعة');
  assert.equal(latest().analysis.parser_version, h.module('../utils/cv-parser-version.mjs').CV_PARSER_VERSION);
  await h.press('اعتماد المعلومات وحفظها');
  assert.equal(calls.profiles.length, 1);
  assert.equal(calls.profiles[0].projects[0].name, 'عنوان صححه المستخدم');
  assert.equal(calls.profiles[0].projects[0].field_evidence.name, approved.projects[0].field_evidence.name);
  assert.equal(approved.projects[0].name, 'عنوان صححه المستخدم');
});
test('failed reanalysis leaves the previous draft and approved profile untouched', async t => {
  const { h, calls, latest } = await setup('web', { fail: true });
  t.after(h.dispose);
  const original = JSON.stringify(latest());
  await h.press(consent); await h.press('إعادة التحليل'); await h.press('إعادة التحليل مع الحفاظ على تعديلاتي');
  assert.equal(calls.analyze, 1);
  assert.equal(calls.profiles.length, 0);
  assert.equal(JSON.stringify(latest()), original);
  assert.ok(h.text().includes('فشل تحليل تجريبي'));
});
test('an old approved result without a local PDF remains visible, never triggers automatic reanalysis', async t => {
  const { h, calls } = await setup('web', { fileAvailable: false });
  t.after(h.dispose);
  assert.ok(h.text().includes('ملف PDF غير متوفر على هذا الجهاز'));
  assert.equal(h.button('إعادة التحليل'), undefined);
  assert.equal(calls.analyze, 0);
  assert.equal(calls.profiles.length, 0);
});
