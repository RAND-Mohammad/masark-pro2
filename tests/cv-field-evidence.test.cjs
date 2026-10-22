const test = require('node:test');
const assert = require('node:assert/strict');
const projectModule = require('./helpers/project-module.cjs');
test('field quotes and review flags survive actual client validation, correction, approval and profile parsing', async () => {
  const { analyzeLocalText } = await import('../server/analysis.mjs');
  const source = 'Education:\nDemo University\nBachelor of Science in Computer Science\nGraduation Project:\nDesigned an optimized Priority Schedule';
  const analysis = analyzeLocalText(source);
  const modules = projectModule({ 'src/utils/scoped-storage.ts': { default: {} } });
  const types = modules('src/utils/skill-profile.ts'), review = modules('src/utils/cv-review.ts');
  assert.equal(types.isCvAnalysis(analysis), true);
  const initial = review.createCvReview(analysis);
  assert.equal(review.approvedCvAnalysis(initial).projects.length, 0, 'an unnamed descriptive record is not approved as a named project');
  const changed = review.updateCvReviewItem(initial, 'projects', 0, 'name', 'User confirmed title');
  assert.equal(changed.analysis.projects[0].source, 'user_corrected');
  assert.equal(changed.analysis.projects[0].field_evidence.name, undefined, 'manual correction cannot acquire a fabricated source quote');
  assert.equal(changed.analysis.projects[0].field_evidence.description, 'Designed an optimized Priority Schedule');
  const approved = review.approvedCvAnalysis(changed);
  assert.equal(approved.projects[0].name, 'User confirmed title');
  const profile = types.parseSkillProfile({ version: 3, skill_ids: [], manual_skill_ids: [], excluded_cv_skill_ids: [],
    cv: { ...approved, reviewed_at: '2026-10-19T12:00:00Z' } });
  assert.equal(profile.cv.education[0].field_evidence.organization, 'Demo University');
  assert.equal(profile.cv.projects[0].field_evidence.description, 'Designed an optimized Priority Schedule');
  const tampered = JSON.parse(JSON.stringify(analysis));
  tampered.education[0].field_evidence = { name: 42 };
  assert.equal(types.isCvAnalysis(tampered), false);
  const paged = JSON.parse(JSON.stringify(analysis));
  paged.education[0].field_pages = { name: [1, 2] };
  assert.equal(types.isCvAnalysis(paged), true);
  assert.deepEqual(review.approvedCvAnalysis(review.createCvReview(paged)).education[0].field_pages, { name: [1, 2] });
  paged.education[0].field_pages = { name: [-1] };
  assert.equal(types.isCvAnalysis(paged), false);
});
test('combined education fields and their original quotes survive review, approval and profile loading', async () => {
  const { analyzeLocalText } = await import('../server/analysis.mjs');
  const line = '[University Name], Bachelor of Science in Computer Science';
  const analysis = analyzeLocalText(`EDUCATION\n${line}\nExpected Graduation: 2027\nACADEMIC PROJECTS\nAircraft Runway Scheduling System\n• Designed an optimized Priority Scheduling Algorithm using Priority Queue`,
    { key: '', fetchImpl: () => { throw Error('No external requests'); } });
  const modules = projectModule({ 'src/utils/scoped-storage.ts': { default: {} } });
  const types = modules('src/utils/skill-profile.ts'), review = modules('src/utils/cv-review.ts');
  assert.equal(types.isCvAnalysis(analysis), true);
  const approved = review.approvedCvAnalysis(review.createCvReview(analysis));
  const profile = types.parseSkillProfile({ version: 3, skill_ids: [], manual_skill_ids: [], excluded_cv_skill_ids: [],
    cv: { ...approved, reviewed_at: '2026-10-19T12:00:00Z' } });
  assert.equal(profile.cv.education[0].organization, '[University Name]');
  assert.equal(profile.cv.education[0].name, 'Bachelor of Science in Computer Science');
  assert.equal(profile.cv.education[0].dates, '2027');
  assert.equal(profile.cv.education[0].study_status, 'Expected Graduation');
  assert.equal(profile.cv.education[0].field_evidence.organization, line);
  assert.equal(profile.cv.education[0].field_evidence.name, line);
  assert.equal(profile.cv.education[0].field_evidence.dates, 'Expected Graduation: 2027');
  assert.equal(profile.cv.projects[0].name, 'Aircraft Runway Scheduling System');
});
