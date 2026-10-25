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
const { jobPaths } = load('src/constants/job-paths.ts');
const empty = { skillProfile: null, personal: null, learningProgress: {}, professionalCertifications: [] };
const withInterests = (interests, extra = {}) => ({ ...empty, ...extra, personal: { education: '', major: '', gpa: null, gpaScale: null, interests } });
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

test('interests cannot change scores, breakdowns, weights or outrank higher readiness', () => {
  const input = withInterests(['web'], { professionalCertifications: ['cisco-ccna'] });
  const matches = getCareerReadinessMatches(input);
  const baseline = getCareerReadinessMatches({ ...input, personal: { ...input.personal, interests: [] } });
  for (const [index, item] of matches.entries()) {
    const before = baseline.find(row => row.career_id === item.career_id);
    assert.equal(item.score, before.score);
    assert.deepEqual(item.breakdown, before.breakdown);
    assert.deepEqual(item.weights, before.weights);
    assert.deepEqual(calculateCareerReadiness(item.career_id, input), calculateCareerReadiness(item.career_id, { ...input, personal: { ...input.personal, interests: [] } }));
    if (index) assert.ok((matches[index - 1].score ?? -1) >= (item.score ?? -1));
  }
  assert.ok(matches[0].score > matches.find(item => item.title === 'Web Developer').score);
});

test('Home and Careers share interest labels and explain tie-only ranking', () => {
  for (const screen of ['home', 'careers']) {
    const source = fs.readFileSync(path.join(root, `src/app/${screen}.tsx`), 'utf8');
    assert.match(source, /<CareerCard/);
    assert.match(source, /عند تساوي الجاهزية فقط/);
    assert.match(source, /الاهتمامات لا تزيد درجة الجاهزية/);
  }
  const card = fs.readFileSync(path.join(root, 'src/components/career-card.tsx'), 'utf8');
  assert.match(card, /career\.matchedInterests\.length > 0/);
  assert.match(card, /اهتمامات متطابقة/);
});
