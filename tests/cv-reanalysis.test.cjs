const test = require('node:test');
const assert = require('node:assert/strict');
const projectModule = require('./helpers/project-module.cjs');
const modules = () => projectModule({ 'src/utils/scoped-storage.ts': { default: {} } });
const plain = value => JSON.parse(JSON.stringify(value));
const base = () => ({ skills: [], projects: [], courses: [], certificates: [], experiences: [], education: [], activities: [], unclassified: [], warnings: [] });
const project = (name, extra = {}) => ({ name, organization: '', dates: '', description: '', evidence: 'Aircraft Runway Scheduling System\nDesigned an optimized Priority Scheduling Algorithm using Priority Queue', ...extra });

test('missing, changed and current parser versions survive validation with correct stale flags', () => {
  const load = modules(), { CV_PARSER_VERSION, needsCvReanalysis } = load('src/utils/cv-parser-version.mjs');
  const { isCvAnalysis } = load('src/utils/skill-profile.ts');
  assert.equal(needsCvReanalysis(base()), true);
  assert.equal(needsCvReanalysis({ ...base(), parser_version: 'older-release' }), true);
  assert.equal(needsCvReanalysis({ ...base(), parser_version: CV_PARSER_VERSION }), false);
  assert.equal(needsCvReanalysis(null), false);
  assert.equal(isCvAnalysis(base()), true, 'legacy records must not disappear');
  assert.equal(isCvAnalysis({ ...base(), parser_version: CV_PARSER_VERSION }), true);
  assert.equal(isCvAnalysis({ ...base(), parser_version: 42 }), false);
});
test('reanalysis retains manual corrections, quotes and explicit exclusions without mutating either input', () => {
  const load = modules(), review = load('src/utils/cv-review.ts'), { createReanalysisReview } = load('src/utils/cv-reanalysis.ts');
  const prior = review.createCvReview({ ...base(), projects: [project('Old name'), project('Excluded', { evidence: 'Explicit excluded project' })] });
  const edited = review.updateCvReviewItem(prior, 'projects', 0, 'name', 'Manually corrected');
  edited.projects = [0];
  edited.analysis.projects[0].field_evidence = { name: 'Old name' };
  const fresh = { ...base(), parser_version: 'current', projects: [project('New name'), project('Excluded', { evidence: 'Explicit excluded project' })] };
  const before = JSON.stringify({ edited, fresh });
  const merged = createReanalysisReview(fresh, edited, null);
  assert.equal(merged.analysis.projects[0].name, 'Manually corrected');
  assert.equal(merged.analysis.projects[0].field_evidence.name, 'Old name');
  assert.equal(merged.analysis.projects[0].retained_from_previous, true);
  assert.deepEqual(plain(merged.projects), [0]);
  assert.equal(JSON.stringify({ edited, fresh }), before);
  assert.ok(merged.previous_review);
});
test('manual additions and moved items survive, while automatic unclassified suggestions do not veto new extraction', () => {
  const load = modules(), helpers = load('src/utils/cv-review.ts'), { createReanalysisReview } = load('src/utils/cv-reanalysis.ts');
  let prior = helpers.createCvReview({ ...base(), projects: [project('Moved')], unclassified: [project('New credential')] });
  prior = helpers.moveCvReviewItem(prior, 'projects', 0, 'activities');
  prior = helpers.addCvReviewItem(prior, 'education');
  prior = helpers.updateCvReviewItem(prior, 'education', 0, 'name', 'Manual qualification');
  const fresh = { ...base(), projects: [project('Moved')], courses: [{ name: 'New credential', issuer: '', date: '', evidence: 'New credential' }] };
  const result = createReanalysisReview(fresh, prior, null);
  assert.equal(result.analysis.projects.length, 0);
  assert.equal(result.analysis.activities[0].name, 'Moved');
  assert.equal(result.analysis.education[0].name, 'Manual qualification');
  assert.equal(result.analysis.courses.length, 1);
});
test('ambiguous evidence does not guess which new row should receive a manual correction', () => {
  const load = modules(), { createCvReview, updateCvReviewItem } = load('src/utils/cv-review.ts');
  const { createReanalysisReview } = load('src/utils/cv-reanalysis.ts');
  const prior = updateCvReviewItem(createCvReview({ ...base(), projects: [project('Old')] }), 'projects', 0, 'name', 'Manual');
  const result = createReanalysisReview({ ...base(), projects: [project('Candidate A'), project('Candidate B')] }, prior, null);
  assert.deepEqual(plain(result.analysis.projects.map(row => row.name)), ['Candidate A', 'Candidate B', 'Manual']);
});
test('different manual records sharing a source quote are never collapsed into one', () => {
  const load = modules(), { createCvReview } = load('src/utils/cv-review.ts');
  const { createReanalysisReview } = load('src/utils/cv-reanalysis.ts');
  const prior = createCvReview({ ...base(), projects: [
    project('Manual A', { source: 'user_corrected' }), project('Manual B', { source: 'user_corrected' }),
  ] });
  const result = createReanalysisReview({ ...base(), projects: [project('New candidate')] }, prior, null);
  assert.deepEqual(plain(result.analysis.projects.map(row => row.name)), ['New candidate', 'Manual A', 'Manual B']);
  assert.equal(result.analysis.projects.filter(row => row.retained_from_previous).length, 2);
});
test('draft exclusions outrank older approved manual data, and history persists with bounded validation and restoration', () => {
  const load = modules(), h = load('src/utils/cv-review.ts'), { validReview } = load('src/utils/saved-cv.types.ts');
  const { createReanalysisReview, restoreCvReview } = load('src/utils/cv-reanalysis.ts');
  const approved = { ...base(), projects: [project('Approved manual', { source: 'user_corrected' })] };
  const prior = h.createCvReview(approved); prior.projects = [];
  const next = createReanalysisReview({ ...base(), parser_version: 'new', projects: [project('New extract')] }, prior, approved);
  assert.deepEqual(plain(next.projects), []);
  const reopened = plain(next);
  assert.equal(validReview(reopened), true);
  const restored = restoreCvReview(reopened, 'draft');
  assert.equal(validReview(restored), true);
  assert.equal(restored.analysis.projects[0].name, 'Approved manual');
  assert.deepEqual(plain(restored.projects), []);
  assert.equal(restored.previous_review.analysis.parser_version, 'new');
  reopened.previous_review.previous_review = plain(prior);
  assert.equal(validReview(reopened), false, 'reject arbitrarily nested snapshots');
});
test('oversized retention fails explicitly rather than dropping manual items or mutating the previous review', () => {
  const load = modules(), h = load('src/utils/cv-review.ts'), { createReanalysisReview } = load('src/utils/cv-reanalysis.ts');
  const prior = h.createCvReview({ ...base(), projects: [project('Manual', { evidence: '', source: 'user_supplied' })] });
  const next = { ...base(), projects: Array.from({ length: 80 }, (_, i) => project(`New ${i}`, { evidence: `Different ${i}` })) };
  assert.throws(() => createReanalysisReview(next, prior, null), /لم تُستبدل مراجعتك/u);
  assert.equal(prior.analysis.projects[0].name, 'Manual');
  assert.equal(next.projects.length, 80);
});
