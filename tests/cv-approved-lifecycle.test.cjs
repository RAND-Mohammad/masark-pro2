const test = require('node:test');
const assert = require('node:assert/strict');
const projectModule = require('./helpers/project-module.cjs');
const plain = value => JSON.parse(JSON.stringify(value));

test('only approved CV skills reach existing gaps/recommendations; replacement and deletion preserve manual data', async () => {
  const memory = new Map([['independent-profile', 'unchanged fictional education']]);
  const storage = {
    getItem: async key => memory.get(key) ?? null,
    setItem: async (key, value) => memory.set(key, value),
    removeItem: async key => memory.delete(key),
  };
  const modules = projectModule({
    'src/utils/scoped-storage.ts': { __esModule: true, default: storage, captureDataScope: () => ({ assertCurrent() {} }) },
  });
  const api = modules('src/utils/skill-profile.ts');
  const reviews = modules('src/utils/cv-review.ts');
  const gaps = modules('src/utils/skill-gap.ts');
  const matches = modules('src/utils/career-matches.ts');
  const analysis = {
    skills: [{ name: 'Python', mapped_skill_id: 'T0644', evidence: 'Skills: Python' }],
    education: [], projects: [], courses: [], certificates: [], experiences: [], activities: [],
    unclassified: [{ name: 'Unresolved qualification', organization: '', dates: '', description: '', evidence: 'Unresolved qualification' }],
    warnings: [],
  };
  await api.saveManualSkills(['T0153']);
  const draft = reviews.createCvReview(analysis);
  let profile = await api.readSkillProfile();
  assert.deepEqual(plain(profile.skill_ids), ['T0153'], 'an unapproved draft contributes nothing');
  const initialMatches = plain(matches.getCareerMatches(profile.skill_ids));
  assert.equal(gaps.getSkillGapReport('C01', profile.skill_ids).matchedCore.some(skill => skill.skill_id === 'T0644'), false);

  await api.saveReviewedCv(reviews.approvedCvAnalysis(draft));
  profile = await api.readSkillProfile();
  assert.deepEqual(plain(profile.skill_ids), ['T0153', 'T0644']);
  assert.equal(gaps.getSkillGapReport('C01', profile.skill_ids).matchedCore.some(skill => skill.skill_id === 'T0644'), true);
  assert.notDeepEqual(plain(matches.getCareerMatches(profile.skill_ids)), initialMatches);

  const replacement = { ...draft, skills: [] };
  assert.deepEqual(plain((await api.readSkillProfile()).skill_ids), ['T0153', 'T0644'], 'editing review does not silently change the approved profile');
  await api.saveReviewedCv(reviews.approvedCvAnalysis(replacement));
  profile = await api.readSkillProfile();
  assert.deepEqual(plain(profile.skill_ids), ['T0153']);
  assert.deepEqual(plain(profile.cv.skills), []);
  assert.deepEqual(plain(matches.getCareerMatches(profile.skill_ids)), initialMatches);

  await api.saveReviewedCv(reviews.approvedCvAnalysis(draft));
  await api.clearReviewedCv();
  profile = await api.readSkillProfile();
  assert.equal(profile.cv, null);
  assert.deepEqual(plain(profile.manual_skill_ids), ['T0153']);
  assert.deepEqual(plain(profile.skill_ids), ['T0153']);
  assert.equal(memory.get('independent-profile'), 'unchanged fictional education');
});
