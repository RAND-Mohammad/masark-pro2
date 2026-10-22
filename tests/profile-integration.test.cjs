const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = process.env.MASARAK_TEST_ROOT || path.resolve(__dirname, '..');
const ts = require(path.join(root, 'node_modules/typescript'));
const dataset = JSON.parse(fs.readFileSync(path.join(root, 'src/masarak_dataset.json'), 'utf8'));
const ids = [...new Set(dataset.career_skills.map(row => row.skill_id))];
function harness(initial = null) {
  let saved = initial;
  let fail = false;
  const storage = { getItem: async () => saved, setItem: async (_key, value) => { if (fail) throw Error('write failed'); saved = value; } };
  const modules = new Map();
  function load(name) {
    if (modules.has(name)) return modules.get(name);
    const output = ts.transpileModule(fs.readFileSync(path.join(root, 'src/utils', name), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    const exports = {};
    modules.set(name, exports);
    vm.runInNewContext(output, { exports, require: name => name.includes('async-storage') ? storage : name.endsWith('masarak_dataset.json') ? dataset : name === '../constants/job-paths' ? { resolveBaseCareerId: id => id, jobPaths: dataset.careers.map(career => ({ id: career.career_id, title: career.title, description: career.description })) } : name === '../constants/job-path-requirements' ? { requirementsForCareerPath: id => dataset.career_skills.filter(row => row.career_id === id) } : load(name.replace('./', '') + '.ts') });
    return exports;
  }
  return { api: load('skill-profile.ts'), matches: load('career-matches.ts').getCareerMatches, raw: () => saved, failing: value => { fail = value; } };
}
const plain = value => JSON.parse(JSON.stringify(value));
const sorted = value => Array.from(value).sort();
function analysis(mapped) {
  return { skills: mapped.map(id => ({ name: id || 'Unmapped', mapped_skill_id: id, evidence: 'Synthetic fixture' })), certificates: [], experiences: [], education: [], projects: [], activities: [], warnings: [] };
}
test('legacy selected skills migrate without rewriting or losing data', async () => {
  const initial = JSON.stringify([ids[0], ids[0], 'unknown']);
  const h = harness(initial); const profile = await h.api.readSkillProfile();
  assert.deepEqual(plain(profile.manual_skill_ids), [ids[0]]);
  assert.deepEqual(plain(profile.skill_ids), [ids[0]]);
  assert.equal(h.raw(), initial);
});
test('v2 migration preserves manually excluded CV mappings and all metadata', async () => {
  const h = harness(JSON.stringify({ version: 2, skill_ids: [ids[0]], cv: { ...analysis([ids[1]]), reviewed_at: '2026-01-01' } }));
  const profile = await h.api.readSkillProfile();
  assert.deepEqual(plain(profile.skill_ids), [ids[0]]);
  assert.deepEqual(plain(profile.excluded_cv_skill_ids), [ids[1]]);
  assert.equal(profile.cv.skills.length, 1);
});
test('re-approving a CV replaces its old mappings while retaining manual skills', async () => {
  const h = harness(); await h.api.saveManualSkills([ids[0]]);
  await h.api.saveReviewedCv(analysis([ids[1]]));
  await h.api.saveReviewedCv(analysis([ids[2]]));
  const profile = await h.api.readSkillProfile();
  assert.deepEqual(sorted(profile.skill_ids), sorted([ids[0], ids[2]]));
  assert.equal(profile.skill_ids.includes(ids[1]), false);
});
test('explicit manual confirmation of a CV skill survives replacement', async () => {
  const h = harness(); await h.api.saveReviewedCv(analysis([ids[0]]));
  await h.api.saveManualSkills([ids[0]]); await h.api.saveReviewedCv(analysis([ids[1]]));
  assert.deepEqual(sorted((await h.api.readSkillProfile()).skill_ids), sorted([ids[0], ids[1]]));
});
test('manual editor changes only its own source and preserves CV records', async () => {
  const h = harness(); await h.api.saveReviewedCv(analysis([ids[1]]));
  await h.api.saveManualSkills([ids[0]]); await h.api.saveManualSkills([]);
  const profile = await h.api.readSkillProfile();
  assert.deepEqual(plain(profile.skill_ids), [ids[1]]); assert.equal(profile.cv.skills.length, 1);
});
test('a CV with no accepted mappings removes only previous CV contributions', async () => {
  const h = harness(); await h.api.saveManualSkills([ids[0]]);
  await h.api.saveReviewedCv(analysis([ids[1]])); await h.api.saveReviewedCv(analysis([null]));
  assert.deepEqual(plain((await h.api.readSkillProfile()).skill_ids), [ids[0]]);
});
test('unmapped skills, education, projects and certificates never inflate coverage', async () => {
  const h = harness(); const cv = analysis([ids[0], ids[0], null]);
  cv.certificates = [{ name: 'Sample course', issuer: '', date: '', evidence: 'Synthetic' }];
  cv.projects = [{ name: 'Sample project', organization: '', dates: '', description: '', evidence: 'Synthetic' }];
  await h.api.saveReviewedCv(cv); const profile = await h.api.readSkillProfile();
  assert.deepEqual(plain(profile.skill_ids), [ids[0]]); assert.equal(profile.cv.projects.length, 1);
});
test('failed writes leave the approved profile intact and a subsequent save succeeds', async () => {
  const h = harness(); await h.api.saveReviewedCv(analysis([ids[0]])); const before = h.raw();
  h.failing(true); await assert.rejects(h.api.saveReviewedCv(analysis([ids[1]]))); assert.equal(h.raw(), before);
  h.failing(false); await h.api.saveReviewedCv(analysis([ids[1]]));
  assert.deepEqual(plain((await h.api.readSkillProfile()).skill_ids), [ids[1]]);
});
test('simultaneous manual and CV saves keep both sources', async () => {
  const h = harness(); await Promise.all([h.api.saveManualSkills([ids[0]]), h.api.saveReviewedCv(analysis([ids[1]]))]);
  assert.deepEqual(sorted((await h.api.readSkillProfile()).skill_ids), sorted([ids[0], ids[1]]));
});
test('corrupt profiles and unknown CV links cannot overwrite saved data', async () => {
  const h = harness('invalid JSON'); await assert.rejects(h.api.saveReviewedCv(analysis([ids[0]]))); assert.equal(h.raw(), 'invalid JSON');
  assert.equal(h.api.isCvAnalysis(analysis(['unknown'])), false);
});
test('removing the document removes CV-derived skills and retains independent manual selections', async () => {
  const h = harness();
  await h.api.saveManualSkills([ids[0]]);
  await h.api.saveReviewedCv(analysis([ids[0], ids[1]]));
  await h.api.clearReviewedCv();
  const profile = await h.api.readSkillProfile(); assert.equal(profile.cv, null);
  assert.deepEqual(plain(profile.manual_skill_ids), [ids[0]]);
  assert.deepEqual(plain(profile.skill_ids), [ids[0]]);
  assert.deepEqual(plain(profile.excluded_cv_skill_ids), []);
});
test('removing a PDF preserves independently supplied profile facts without retaining extracted or corrected rows', async () => {
  const h = harness();
  const mixed = analysis([ids[0], ids[1]]);
  mixed.skills[0].source = 'user_supplied';
  mixed.projects = [
    { name: 'Independent student project', organization: '', dates: '', description: 'User answer', evidence: '', source: 'user_supplied' },
    { name: 'Extracted project', organization: '', dates: '', description: '', evidence: 'Synthetic PDF text' },
    { name: 'Corrected extracted project', organization: '', dates: '', description: '', evidence: 'Original PDF quote', source: 'user_corrected' },
  ];
  await h.api.saveManualSkills([ids[2]]);
  await h.api.saveReviewedCv(mixed);
  await h.api.clearReviewedCv();
  const profile = await h.api.readSkillProfile();
  assert.deepEqual(plain(profile.manual_skill_ids), [ids[2]]);
  assert.deepEqual(sorted(profile.skill_ids), sorted([ids[0], ids[2]]));
  assert.deepEqual(plain(profile.cv.projects.map(row => row.name)), ['Independent student project']);
  assert.equal(profile.cv.entry_method, 'answers');
  assert.equal(profile.cv.parser_version, undefined);
  await h.api.clearReviewedCv();
  assert.deepEqual(plain((await h.api.readSkillProfile()).cv.projects), plain(profile.cv.projects));
});
test('career ranking and missing skills reflect the current approved profile after reload', async () => {
  const h = harness(); const core = dataset.career_skills.filter(row => row.career_id === 'C01' && row.priority === 'core');
  const selected = [...new Set(core.map(row => row.skill_id))].slice(0, 2);
  await h.api.saveReviewedCv(analysis(selected));
  let result = h.matches((await h.api.readSkillProfile()).skill_ids).find(row => row.career_id === 'C01');
  assert.equal(result.matched, 2); assert.equal(result.score, Math.round(2 / result.total * 100));
  assert.equal(result.missing.some(row => selected.includes(row.skill_id)), false);
  await h.api.saveReviewedCv(analysis([]));
  result = h.matches((await h.api.readSkillProfile()).skill_ids).find(row => row.career_id === 'C01');
  assert.equal(result.matched, 0); assert.equal(result.missing.length, core.length);
  assert.equal(h.matches(null).every(row => row.score === null), true);
});

test('full dictionary skills survive approval and reload without inflating unrelated career scores', async () => {
  const h = harness();
  await h.api.saveReviewedCv(analysis(['T0001', 'T0153', 'T0710']));
  const profile = await h.api.readSkillProfile();
  assert.deepEqual(sorted(profile.skill_ids), ['T0001', 'T0153', 'T0710']);
  assert.equal(h.matches(profile.skill_ids).find(c => c.career_id === 'C05').score, 0);
});

test('three programming languages count as one core competency and do not alter the denominator', async () => {
  const h = harness();
  const cv = analysis(['T0644', 'T0644', 'T0644']);
  cv.skills.forEach((skill, index) => { skill.name = ['Java', 'Python', 'C++'][index]; });
  await h.api.saveReviewedCv(cv);
  const profile = await h.api.readSkillProfile();
  assert.deepEqual(plain(profile.skill_ids), ['T0644']);
  const report = h.matches(profile.skill_ids).find(c => c.career_id === 'C01');
  assert.equal(report.matched, 1); assert.equal(report.total, 7); assert.equal(report.score, 14);
});
