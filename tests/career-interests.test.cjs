const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const cache = new Map();
function load(relative) {
  const filename = path.resolve(root, relative);
  if (cache.has(filename)) return cache.get(filename);
  if (filename.endsWith('.json')) return JSON.parse(fs.readFileSync(filename, 'utf8'));
  const exports = {};
  cache.set(filename, exports);
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, { exports, require: name => {
    const target = path.resolve(path.dirname(filename), name);
    return load(target.endsWith('.json') ? target : `${target}.ts`);
  } });
  return exports;
}
const { getCareerReadinessMatches, calculateCareerReadiness } = load('src/utils/career-readiness.ts');
const { getCareerMatches, careerMatchWeights } = load('src/utils/career-matching.ts');
const { jobPaths } = load('src/constants/job-paths.ts');
const empty = { skillProfile: null, personal: null, learningProgress: {}, professionalCertifications: [] };
const withInterests = (interests, extra = {}) => ({ ...empty, ...extra, personal: { education: '', major: '', gpa: null, gpaScale: null, interests, ...(extra.personal ?? {}) } });
const ids = matches => Array.from(matches, item => item.career_id);

test('missing, empty, blank and unmatched interests preserve catalogue order', () => {
  for (const input of [empty, withInterests([]), withInterests([' ', 'gardening', 'rapid'])]) {
    const matches = getCareerReadinessMatches(input);
    assert.deepEqual(ids(matches), Array.from(jobPaths, item => item.id));
    assert.ok(matches.every(item => item.matchedInterests.length === 0));
  }
});

test('English titles and Arabic keywords match with normalized case, spacing and diacritics', () => {
  for (const interests of [['  WEB   DEVELOPER  '], ['تَطْوِير الوِيب']]) {
    const matches = getCareerReadinessMatches(withInterests(interests));
    const web = matches.find(item => item.title === 'Web Developer');
    assert.deepEqual(Array.from(web.matchedInterests), interests);
    assert.equal(matches[0].matchedInterests.length, 1);
    assert.ok(matches.every(item => item.score === null));
  }
});

test('matching is binary and stable, regardless of repeated or multiple interests', () => {
  const matches = getCareerReadinessMatches(withInterests(['web', 'WEB', 'ويب', 'mobile']));
  for (const matched of [true, false]) {
    const group = matches.filter(item => Boolean(item.matchedInterests.length) === matched);
    assert.deepEqual(ids(group), Array.from(jobPaths).filter(item => group.some(row => row.career_id === item.id)).map(item => item.id));
  }
});

test('weighted interests change career fit while readiness remains independent', () => {
  const input = withInterests(['WEB DEVELOPER'], { professionalCertifications: ['cisco-ccna'] });
  const matches = getCareerMatches(input);
  const baseline = getCareerMatches({ ...input, personal: { ...input.personal, interests: [] } });
  assert.deepEqual(matches[0].weights, careerMatchWeights);
  assert.equal(matches[0].weights.skills, 50);
  assert.equal(matches[0].weights.interests, 20);
  assert.equal(matches[0].weights.personality, 15);
  assert.equal(matches[0].weights.education, 15);
  const web = matches.find(item => item.title === 'Web Developer');
  assert.ok(web);
  assert.equal(web.breakdown.interests, 100);
  assert.ok(web.score > baseline.find(item => item.career_id === web.career_id).score);

  const readiness = getCareerReadinessMatches(input);
  const readinessBaseline = getCareerReadinessMatches({ ...input, personal: { ...input.personal, interests: [] } });
  for (const item of readiness) {
    const before = readinessBaseline.find(row => row.career_id === item.career_id);
    assert.equal(item.score, before.score);
    assert.deepEqual(item.breakdown, before.breakdown);
    assert.deepEqual(item.weights, before.weights);
    assert.deepEqual(calculateCareerReadiness(item.career_id, input), calculateCareerReadiness(item.career_id, { ...input, personal: { ...input.personal, interests: [] } }));
  }
});

test('weighted personality and education signals affect career fit without changing skill coverage', () => {
  const skillProfile = { skill_ids: ['T0217'], cv: { education: [] } };
  const baseline = getCareerMatches({ skillProfile, personal: { education: '', major: '', interests: [], traits: [] } });
  const traits = getCareerMatches({ skillProfile, personal: { education: '', major: '', interests: [], traits: ['تعاون'] } });
  const education = getCareerMatches({ skillProfile, personal: { education: '', major: 'علوم الحاسب', interests: [], traits: [] } });
  const webBase = baseline.find(item => item.title === 'Web Developer');
  const webTraits = traits.find(item => item.title === 'Web Developer');
  const webEducation = education.find(item => item.title === 'Web Developer');
  assert.equal(webTraits.breakdown.personality, 100);
  assert.equal(webEducation.breakdown.education, 100);
  assert.ok(webTraits.score > webBase.score);
  assert.ok(webEducation.score > webBase.score);
  assert.equal(webTraits.skillScore, webBase.skillScore);
  assert.equal(webEducation.skillScore, webBase.skillScore);
});

test('Home and Careers explain weighted path fit separately from readiness', () => {
  for (const screen of ['home', 'careers']) {
    const source = fs.readFileSync(path.join(root, `src/app/${screen}.tsx`), 'utf8');
    assert.match(source, /<CareerCard/);
    assert.match(source, /getCareerMatches/);
    assert.match(source, /الجاهزية|readiness/);
    assert.doesNotMatch(source, /عند تساوي الجاهزية فقط/);
  }
  const careers = fs.readFileSync(path.join(root, 'src/app/careers.tsx'), 'utf8');
  assert.match(careers, /المهارات 50%، الاهتمامات 20%، السمات 15%، والتعليم 15%/);
  assert.match(careers, /الاهتمامات لا تزيد نسبة تغطية المهارات/);
  const card = fs.readFileSync(path.join(root, 'src/components/career-card.tsx'), 'utf8');
  assert.match(card, /career\.matchedInterests\.length > 0/);
  assert.match(card, /اهتمامات متطابقة/);
});
