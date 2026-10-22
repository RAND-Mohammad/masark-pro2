const test = require('node:test');
const assert = require('node:assert/strict');
const projectModule = require('./helpers/project-module.cjs');
const harness = require('./helpers/auth-screen-harness.cjs');
const plain = x => JSON.parse(JSON.stringify(x));
function setup(platform, fail = false) {
  const data = new Map(), calls = { save: [], print: [], changes: [] };
  let accountActive = true;
  const scope = { owner: null, assertCurrent() { if (!accountActive) throw Error('تغيّر الحساب'); } };
  const load = projectModule({ 'src/utils/scoped-storage.ts': {
    captureDataScope: () => scope,
    readScopedRaw: async key => data.get(key) ?? null,
    replaceScopedItems: async pairs => { scope.assertCurrent(); if (fail) throw Error('تعذر الحفظ التجريبي'); for (const [k, v] of pairs) data.set(k, v); calls.save.push(plain(pairs)); },
    reportDataChange: async () => calls.changes.push('dirty'),
  } });
  const util = load('src/utils/student-profile.ts');
  const h = harness('src/app/create-profile.tsx', { platform, renderComponents: true, moduleOverrides: {
    '../utils/student-profile': util,
    '../utils/print-student-resume': { printStudentResume: async (p, s) => { calls.print.push(plain({ p, s })); return platform === 'web' ? 'web-print' : 'native-share'; } },
  } });
  return { h, data, util, calls, changeAccount() { accountActive = false; } };
}
async function fillGraduate(h) {
  await h.fill('الاسم (اختياري)', 'طالب اختبار');
  await h.fill('الجامعة أو جهة التعليم', 'Test University');
  await h.fill('المؤهل الدراسي', 'Bachelor of Science');
  await h.fill('التخصص', 'Computer Science');
  await h.fill('سنة التخرج المتوقعة', '2027');
  await h.press('متابعة');
  await h.fill('ما المهارات التي لديك؟', 'Python, SQL');
  await h.fill('ما المجالات التي تهمك؟ (اختياري)', 'تحليل البيانات');
  await h.press('متابعة');
  await h.press('إضافة مشروع');
  await h.fill('اسم المشروع 1', 'Data Dashboard');
  await h.fill('ماذا نفذت في المشروع 1؟', 'Analyzed synthetic data using Python and SQL');
  await h.fill('تقنيات المشروع 1 (اختياري)', 'Python, SQL');
  await h.press('متابعة');
  await h.press('إضافة دورة');
  await h.fill('اسم الدورة 1', 'Intro to Python');
  await h.press('متابعة');
  assert.ok(h.text().includes('الخبرة اختيارية تمامًا'));
  await h.press('متابعة');
}
for (const platform of ['web', 'android', 'ios']) {
  test(`${platform}: graduate reviews, edits, saves with no experience or upload and can navigate to recommendations`, async t => {
    const { h, calls, data } = setup(platform);
    t.after(h.dispose); await h.flush();
    await h.press('متابعة');
    assert.ok(h.text().includes('أكمل جهة التعليم'));
    await fillGraduate(h);
    assert.ok(h.text().includes('المراجعة النهائية'));
    assert.ok(h.text().includes('Data Dashboard'));
    assert.ok(h.text().includes('Intro to Python'));
    assert.equal(data.size, 0, 'review is not an implicit save');
    await h.press('السابق وتعديل الإجابات');
    await h.press('السابق وتعديل الإجابات');
    await h.fill('اسم الدورة 1', 'Introduction to Python');
    await h.press('متابعة'); await h.press('متابعة');
    assert.ok(h.text().includes('Introduction to Python'));
    await h.press('اعتماد وحفظ الملف');
    assert.equal(calls.save.length, 1);
    const skills = JSON.parse(data.get('masarak-skills-v1'));
    assert.equal(skills.cv.experiences.length, 0);
    assert.equal(skills.cv.courses[0].name, 'Introduction to Python');
    assert.ok(h.text().includes('تم حفظ ملفك على هذا الجهاز'));
    if (platform === 'web') { await h.press('طباعة / حفظ PDF من المتصفح'); assert.equal(calls.print.length, 1); }
    else {
      assert.equal(h.button('طباعة / حفظ PDF من المتصفح'), undefined);
      await h.press('تصدير ومشاركة PDF');
      assert.equal(calls.print.length, 1);
      assert.ok(h.text().includes('تم تجهيز PDF وفتح المشاركة'));
      assert.equal(h.text().includes('تم إرسال'), false);
    }
    await h.press('استكشاف توصياتي وفجوات المهارات');
    assert.equal(h.routes.at(-1), '/careers');
  });
}
test('save failure remains visible and cannot claim success or navigate away automatically', async t => {
  const { h, calls } = setup('web', true); t.after(h.dispose); await h.flush(); await fillGraduate(h);
  await h.press('اعتماد وحفظ الملف');
  assert.equal(calls.save.length, 0);
  assert.ok(h.text().includes('تعذر الحفظ التجريبي'));
  assert.equal(h.text().includes('تم حفظ ملفك على هذا الجهاز'), false);
  assert.equal(h.routes.length, 0);
  assert.ok(h.button('السابق وتعديل الإجابات'));
});
test('account change during questionnaire blocks save', async t => {
  const { h, calls, changeAccount } = setup('web'); t.after(h.dispose); await h.flush(); await fillGraduate(h);
  changeAccount(); await h.press('اعتماد وحفظ الملف');
  assert.equal(calls.save.length, 0);
  assert.ok(h.text().includes('تغيّر الحساب'));
});
test('student can skip projects, courses, interests and experience entirely', async t => {
  const { h, calls, data } = setup('web'); t.after(h.dispose); await h.flush();
  await h.fill('الجامعة أو جهة التعليم', 'Synthetic College');
  await h.fill('المؤهل الدراسي', 'Bachelor');
  await h.fill('التخصص', 'Computer Science');
  await h.fill('سنة التخرج المتوقعة', '٢٠٢٧');
  await h.press('متابعة');
  await h.fill('ما المهارات التي لديك؟', 'Python');
  for (let i = 0; i < 4; i++) await h.press('متابعة');
  assert.ok(h.text().includes('المراجعة النهائية'));
  assert.equal(calls.save.length, 0);
  await h.press('اعتماد وحفظ الملف');
  const skills = JSON.parse(data.get('masarak-skills-v1'));
  for (const section of ['projects', 'courses', 'experiences']) assert.equal(skills.cv[section].length, 0);
  assert.equal(skills.cv.education[0].dates, '2027');
});
test('saved resume can be reopened read-only, printed from web and never writes during preview', async t => {
  const { h, util, calls } = setup('web'); t.after(h.dispose);
  const base = await util.loadStudentBase();
  await util.saveStudentProfile({ ...util.emptyStudentAnswers(), institution: 'Test University', degree: 'Bachelor',
    major: 'Computer Science', graduation: '2027', skills: 'Python' }, base);
  const count = calls.save.length;
  const preview = harness('src/app/resume-preview.tsx', { platform: 'web', renderComponents: true, moduleOverrides: {
    '../utils/student-profile': util,
    '../utils/print-student-resume': { printStudentResume: (p, s) => calls.print.push(plain({ p, s })) },
  } });
  t.after(preview.dispose); await preview.flush();
  assert.ok(preview.text().includes('Test University'));
  assert.equal(calls.save.length, count);
  await preview.press('طباعة / حفظ PDF من المتصفح');
  assert.equal(calls.print.length, 1);
  assert.equal(calls.save.length, count);
});
