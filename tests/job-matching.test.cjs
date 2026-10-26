const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./helpers/project-module.cjs')({ '@react-native-async-storage/async-storage': { getItem: async () => null, setItem: async () => {}, removeItem: async () => {} } });
const matching = load('src/utils/job-matching.ts');
const plans = load('src/utils/job-learning-plan.ts');
const updates = load('src/utils/job-updates.ts');
const { createSkillMatcher } = require('../src/utils/skill-matching.mjs');
const dataset = require('../src/masarak_dataset.json');
const map = createSkillMatcher(dataset);
function vacancy(description, id = 'job-one', title = 'Software Developer') {
  return { id, title, employer: 'Test employer', description, locations: ['Riyadh'], source: 'test-only',
    sourceUrl: 'https://example.com/job', applyUrl: 'https://example.com/apply', postedAt: '2026-10-20T00:00:00Z', lastCheckedAt: null, attribution: null };
}
function profile(names = [], experiences = [], education = []) {
  return { version: 3, skill_ids: [...new Set(names.map(map).filter(Boolean))], manual_skill_ids: [], excluded_cv_skill_ids: [], cv: {
    reviewed_at: '2026-10-26T00:00:00Z', analyzed_at: '2026-10-26T00:00:00Z',
    skills: names.map(name => ({ name, mapped_skill_id: map(name), evidence: name })), experiences, education, projects: [], certificates: [], warnings: [],
  } };
}
function exp(dates, description = 'Built software applications', role = 'Software Developer') { return { role, organization: 'Test', dates, description, evidence: description }; }
function personal(major = 'Computer Science', studyStatus = 'Graduated') {
  return { version: 1, name: 'Test', major, education: 'Bachelor', studyStatus, institution: '', studyDates: '', gpa: null, gpaScale: null, interests: [], traits: [], careerGoal: null };
}
test('requirements and preferred skills have exact quotes; company tools do not become requirements', () => {
  const job = vacancy('About us\nOur company uses Docker.\nRequirements\nPython and SQL are required.\nPreferred skills\nJava is preferred.\nWhat you will learn\nKubernetes.');
  const result = matching.extractJobRequirements(job);
  assert.equal(result.skills.find(row => row.key === 'python').priority, 'required');
  assert.equal(result.skills.find(row => row.key === 'java').priority, 'preferred');
  assert.equal(result.skills.find(row => row.key === 'docker').priority, 'mentioned');
  assert.equal(result.skills.find(row => row.key === 'kubernetes').priority, 'mentioned');
  assert.ok(result.skills.every(row => job.description.includes(row.evidence)));
});
test('Java and generic Programming cannot satisfy Python', () => {
  const job = vacancy('Requirements\nPython is required.');
  assert.equal(matching.matchMarketJob(job, profile(['Java']), null).matched.length, 0);
  const generic = profile([]); generic.skill_ids = [map('Programming')];
  assert.equal(matching.matchMarketJob(job, generic, null).matched.length, 0);
  assert.equal(matching.matchMarketJob(job, profile(['Python']), null).matched.length, 1);
});
test('explicit tools remain distinct even when their competency id is shared', () => {
  const match = matching.matchMarketJob(vacancy('Requirements\nPython, Java, and C++ are required.'), profile(['Python']), null);
  assert.equal(match.matched.length, 1); assert.equal(match.missing.length, 2);
});
test('or alternatives count once; one alternative is enough', () => {
  const job = vacancy('Requirements\nPython or Java required.\nSQL required.');
  const match = matching.matchMarketJob(job, profile(['Java', 'SQL']), null);
  assert.equal(match.matched.length, 2); assert.equal(match.missing.length, 0);
});
test('word boundaries and explicit negation do not invent skills', () => {
  const job = vacancy('Requirements\nJavaScript required.\nNo Python experience required.');
  const req = matching.extractJobRequirements(job);
  assert.equal(req.skills.some(item => item.key === 'java'), false);
  assert.equal(req.skills.some(item => item.key === 'python'), false);
});
test('missing minimum experience is a visible blocker even with all required skills', () => {
  const match = matching.matchMarketJob(vacancy('Requirements\nPython required.\n5 years of experience required.'), profile(['Python']), null);
  assert.equal(match.matched.length, 1); assert.equal(match.experience.state, 'unknown');
  assert.ok(match.score <= 69); assert.ok(match.blockers.length > 0); assert.equal(match.status, 'review');
});
test('overlapping exact monthly intervals are unioned, not added', () => {
  const p = profile(['Python'], [exp('January 2022 - January 2024'), exp('January 2023 - January 2025')]);
  const m = matching.matchMarketJob(vacancy('Requirements\nPython required.\n4 years of experience required.'), p, null);
  assert.equal(m.experience.documentedMonths, 36); assert.equal(m.experience.state, 'gap'); assert.ok(m.score <= 49);
});
test('projects and unrelated employment do not create years of relevant work experience', () => {
  const p = profile(['Python'], [exp('January 2020 - January 2026', 'Teaching history', 'History Teacher')]);
  p.cv.projects = [{ name: 'Python project', dates: 'January 2020 - January 2026', organization: '', description: 'Software', evidence: 'Software' }];
  assert.equal(matching.matchMarketJob(vacancy('Requirements\nPython required.\n3 years of experience required.'), p, null).experience.documentedMonths, 0);
});
test('specialized work experience needs the tool in the work record, not just the CV skill list', () => {
  const p = profile(['Python'], [exp('January 2020 - January 2026', 'Built Java applications')]);
  const m = matching.matchMarketJob(vacancy('Requirements\nPython required.\n3 years of experience in Python required.'), p, null);
  assert.equal(m.experience.state, 'unknown'); assert.equal(m.experience.documentedMonths, 0);
});
test('year-only and undated ongoing experience remain uncertain', () => {
  const p = profile(['Python'], [exp('2020 - 2026')]);
  assert.equal(matching.matchMarketJob(vacancy('Requirements\nPython required.\n2 years of experience required.'), p, null).experience.state, 'unknown');
  p.cv.experiences = [exp('January 2020 - Present')]; delete p.cv.analyzed_at;
  assert.equal(matching.matchMarketJob(vacancy('Requirements\nPython required.\n2 years of experience required.'), p, null).experience.state, 'unknown');
});
test('more than five years does not accept exactly five years', () => {
  const m = matching.matchMarketJob(vacancy('Requirements\nPython required.\nMore than 5 years of experience required.'), profile(['Python'], [exp('January 2020 - January 2025')]), null);
  assert.equal(m.experience.state, 'gap');
});
test('in-progress degree and wrong major cannot silently satisfy education', () => {
  const job = vacancy('Requirements\nPython required.\nBachelor degree in Computer Science required.');
  assert.notEqual(matching.matchMarketJob(job, profile(['Python']), personal('Computer Science', 'Student in progress')).education.state, 'met');
  assert.notEqual(matching.matchMarketJob(job, profile(['Python']), personal('Business Administration')).education.state, 'met');
  assert.equal(matching.matchMarketJob(job, profile(['Python']), personal()).education.state, 'met');
});
test('equivalent-experience education clauses stay reviewable, not an automatic degree failure or success', () => {
  const m = matching.matchMarketJob(vacancy('Requirements\nSQL required.\nBachelor degree or equivalent experience required.'), profile(['SQL']), personal());
  assert.equal(m.education.state, 'unknown'); assert.ok(m.blockers.length);
});
test('preferred experience and skills do not become required blockers', () => {
  const m = matching.matchMarketJob(vacancy('Requirements\nSQL required.\nPreferred skills\nPython preferred.\n5 years of experience preferred.'), profile(['SQL']), null);
  assert.equal(m.blockers.length, 0); assert.equal(m.missing.length, 0); assert.ok(m.preferredMissing.length);
});
test('Arabic headings, aliases and experience digits are recognized', () => {
  const r = matching.extractJobRequirements(vacancy('المتطلبات\nبايثون مطلوب\nخبرة لا تقل عن ٣ سنوات\nالمهارات المفضلة\nجافا', 'arabic'));
  assert.ok(r.skills.some(item => item.key === 'python' && item.priority === 'required'));
  assert.equal(r.experience.minYears, 3);
});
test('no profile or no extracted required skills means no invented score', () => {
  assert.equal(matching.matchMarketJob(vacancy('Requirements\nPython required.'), null, null).score, null);
  assert.equal(matching.matchMarketJob(vacancy('A great opportunity. Apply today.'), profile(['Python']), null).score, null);
});
test('a lower-skill feasible job outranks a senior job with an experience blocker', () => {
  const p = profile(['Python']);
  const jobs = [vacancy('Requirements\nPython required.\n5 years of experience required.', 'senior'), vacancy('Requirements\nPython and SQL required.\nFresh graduate.', 'entry')];
  assert.equal(matching.rankMarketJobs(jobs, p, null)[0].job.id, 'entry');
});
test('current profile changes recompute gaps; courses and generic shared mapping cannot remove a tool gap', () => {
  const job = vacancy('Requirements\nPython required.');
  const before = matching.matchMarketJob(job, profile(['Java']), null);
  const after = matching.matchMarketJob(job, profile(['Java', 'Python']), null);
  assert.equal(before.missing.length, 1); assert.equal(after.missing.length, 0);
  assert.equal(plans.jobPlanSkillIds(before, profile(['Java'])).length, 0);
});
test('course links come from the existing catalog and do not substitute an unrelated tool', () => {
  const match = matching.matchMarketJob(vacancy('Requirements\nPython required.'), profile(['SQL']), null);
  for (const resource of plans.resourcesForJobRequirement(match.missing[0])) assert.match(resource.title + resource.url, /python/i);
});
test('job updates distinguish new content; disappearance from a page is not a closed-job event', () => {
  const a = vacancy('Requirements\nSQL required.', 'a'); const b = vacancy('Requirements\nPython required.', 'b');
  const old = updates.jobDigest([a]); a.description += '\nDocker preferred.';
  const diff = updates.compareJobDigests(old, updates.jobDigest([a, b]));
  assert.deepEqual(Array.from(diff.changed), ['a']); assert.deepEqual(Array.from(diff.added), ['b']);
  assert.deepEqual(Object.keys(updates.compareJobDigests(old, {})).sort(), ['added', 'changed']);
});
test('sales titles are not forced into technical career rankings', () => {
  assert.equal(matching.classifyJobCareer('Software Sales Account Manager'), null);
  assert.equal(matching.classifyJobCareer('Database Administrator - Tamheer Program'), 'C07');
});
