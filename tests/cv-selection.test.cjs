const test = require('node:test');
const assert = require('node:assert/strict');
const harness = require('./helpers/auth-screen-harness.cjs');

for (const platform of ['web', 'android', 'ios']) {
  test(`${platform}: rejected selection shows the exact PDF-only alert and a later PDF can still be picked`, async t => {
    const calls = { pick: [], stored: [], analyze: 0 };
    const bytes = { 'test://bad': 'not a PDF', 'test://good': '%PDF-1.4 synthetic content' };
    const invalidAssets = [
      { name: 'cv.png', uri: 'test://bad', mimeType: 'image/png', file: new Blob(['PNG'], { type: 'image/png' }) },
      { name: 'cv.jpg', uri: 'test://bad', mimeType: 'image/jpeg', file: new Blob(['JPEG'], { type: 'image/jpeg' }) },
      { name: 'cv.docx', uri: 'test://bad', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', file: new Blob(['PK']) },
      { name: 'renamed.pdf', uri: 'test://bad', mimeType: 'application/pdf', file: new Blob([bytes['test://bad']], { type: 'application/pdf' }) },
    ];
    const assets = [
      ...invalidAssets,
      { name: 'valid.pdf', uri: 'test://good', mimeType: 'application/pdf', file: new Blob([bytes['test://good']], { type: 'application/pdf' }) },
    ];
    const h = harness('src/app/upload-cv.tsx', { platform, moduleOverrides: {
      'expo-document-picker': { getDocumentAsync: async options => { calls.pick.push(options); return { canceled: false, assets: [assets.shift()] }; } },
      'expo-file-system': { File: class extends Blob { constructor(uri) { super([bytes[uri]], { type: 'application/pdf' }); } } },
      '../utils/cv-api': { analyzeCv: async () => { calls.analyze++; throw new Error('Must not analyze on file selection'); } },
      '../utils/skill-profile': { readSkillProfile: async () => null },
      '../utils/saved-cv': { loadSavedCv: async () => null, storeCvFile: async asset => { calls.stored.push(asset); return { asset }; } },
      '../utils/scoped-storage': { captureDataScope: () => ({ assertCurrent() {} }) },
      '../utils/skill-matching.mjs': { createSkillMatcher: () => () => null },
      '../masarak_dataset.json': { skills: [], career_skills: [] },
      '../utils/career-matches': { careerTitles: {} },
    } });
    t.after(h.dispose);
    await h.flush();
    for (let index = 0; index < invalidAssets.length; index++) {
      await h.press('اختيار السيرة من الملفات');
      assert.ok(h.text().includes('يرجى رفع السيرة الذاتية بصيغة PDF فقط'));
      assert.equal(calls.stored.length, 0);
      assert.equal(calls.analyze, 0);
    }
    await h.press('اختيار السيرة من الملفات');
    assert.equal(calls.stored.length, 1);
    assert.ok(h.text().includes('valid.pdf'));
    assert.ok(!h.text().includes('يرجى رفع السيرة الذاتية بصيغة PDF فقط'));
    assert.equal(calls.analyze, 0);
    for (const options of calls.pick) assert.deepEqual(Array.from(options.type), ['application/pdf']);
  });
}
