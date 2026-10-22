const test = require('node:test');
const assert = require('node:assert/strict');
const projectModule = require('./helpers/project-module.cjs');
const plain = value => JSON.parse(JSON.stringify(value));
const answers = () => ({
  name: 'طالب اختبار', institution: 'Test University', degree: 'Bachelor of Science',
  major: 'Computer Science', graduation: '2027', skills: 'Python, SQL, imaginary-test-skill',
  interests: 'تحليل البيانات', projects: [{ name: 'Data Analysis Dashboard', description: 'Analyzed a synthetic dataset with Python and SQL', technologies: 'Python, SQL' }],
  courses: [{ name: 'Introduction to Python', issuer: 'Test Provider' }], experiences: [],
});
function setup() {
  const data = new Map();
  let fail = false;
  const storage = {
    async getItem(key) { return data.get(key) ?? null; },
    async setItem(key, value) { data.set(key, value); },
    async removeItem(key) { data.delete(key); },
    async multiSet(pairs) {
      for (const [key, value] of pairs) {
        if (fail && key.startsWith('masarak-skills')) { fail = false; throw Error('synthetic disk failure'); }
        data.set(key, value);
      }
    },
    async multiRemove(keys) { keys.forEach(k => data.delete(k)); },
  };
  const load = projectModule({ '@react-native-async-storage/async-storage': storage });
  const scoped = load('src/utils/scoped-storage.ts');
  scoped.setDataOwner('synthetic-student-a');
  return { data, load, scoped, util: load('src/utils/student-profile.ts'), failOnce() { fail = true; } };
}
test('a graduate without any experience saves through existing stores and round-trips the cloud snapshot contract', async () => {
  const h = setup(), { util } = h;
  h.scoped.enableCloudChangeTracking();
  const events = [];
  h.scoped.subscribeDataChanges((scope, failure) => events.push({ owner: scope.owner, failure }));
  const result = await util.saveStudentProfile(answers(), await util.loadStudentBase());
  assert.equal(result.personal.studyDates, '2027');
  assert.equal(result.personal.studyStatus, 'تخرج متوقع');
  assert.equal(result.skills.cv.experiences.length, 0);
  assert.equal(result.skills.cv.projects[0].source, 'user_supplied');
  assert.equal(result.skills.cv.entry_method, 'answers');
  assert.equal(result.skills.cv.courses[0].name, 'Introduction to Python');
  assert.ok(result.unmappedSkills.includes('imaginary-test-skill'));
  assert.ok(result.skills.skill_ids.length >= 1);
  assert.equal((await h.load('src/utils/personal-profile.ts').readPersonalProfile()).major, 'Computer Science');
  assert.equal((await h.load('src/utils/skill-profile.ts').readSkillProfile()).cv.projects[0].name, 'Data Analysis Dashboard');
  assert.deepEqual(events, [{ owner: 'synthetic-student-a', failure: false }]);
  const meta = JSON.parse(h.data.get('masarak-cloud-sync-v1:account:synthetic-student-a'));
  assert.equal(meta.dirty, true);
  assert.equal(meta.enabled, false, 'saving must not enable cloud sync by itself');
  const snap = { version: 1, personal: result.personal, skills: result.skills, plan: [], learningProgress: {}, professionalCertifications: [], cv: null, interviews: [] };
  const parsed = h.load('src/utils/cloud-types.ts').parseCloudSnapshot(plain(snap), 'synthetic-student-a');
  assert.deepEqual(plain(parsed.skills), plain(result.skills));
  assert.equal(parsed.cv, null, 'no fake PDF is required or created');
  const { needsCvReanalysis } = h.load('src/utils/cv-parser-version.mjs');
  assert.equal(needsCvReanalysis(result.skills.cv), false, 'answers are not stale parser output');
});
test('same saved data drives readiness, recommendations, skill gaps and learning plan without another input', async () => {
  const h = setup();
  const result = await h.util.saveStudentProfile(answers(), await h.util.loadStudentBase());
  const r = h.load('src/utils/career-readiness.ts');
  const input = { personal: result.personal, skillProfile: result.skills, learningProgress: {}, professionalCertifications: [] };
  const matches = r.getCareerReadinessMatches(input);
  assert.ok(matches.length > 6);
  assert.ok(matches.some(m => m.score > 0 && m.matched > 0));
  const target = matches.find(m => r.calculateCareerReadiness(m.career_id, input).evidence.projects > 0);
  assert.ok(target, 'explicit project description must be usable as practical evidence');
  const score = r.calculateCareerReadiness(target.career_id, input);
  assert.equal(score.evidence.experiences, 0);
  assert.ok(score.breakdown.academic > 0);
  const gaps = h.load('src/utils/skill-gap.ts').getSkillGapReport(target.career_id, result.skills.skill_ids);
  assert.ok(gaps.matchedCore.length + gaps.missingCore.length > 0);
  const plan = h.load('src/utils/personal-learning-plan.ts').personalLearningPlan(target.career_id, result.skills, []);
  assert.ok(Array.isArray(plan));
  assert.ok(plan.length > 0);
  assert.equal(score.breakdown.learning, 0, 'a course name alone must not certify completion');
});
test('existing facts, evidence, exclusions and unrelated profile fields survive additive save; repeat is idempotent', async () => {
  const h = setup(), base = await h.util.loadStudentBase();
  const seed = h.util.buildStudentProfile(answers(), base);
  seed.personal.name = 'Existing Name'; seed.personal.major = 'Existing Major';
  seed.personal.gpa = 4.2; seed.personal.gpaScale = 5; seed.personal.traits = ['Existing trait'];
  seed.skills.cv.projects[0].description = 'Original detailed project description';
  seed.skills.cv.projects[0].evidence = 'Original literal source';
  delete seed.skills.cv.entry_method;
  seed.skills.cv.parser_version = 'old-parser';
  seed.skills.excluded_cv_skill_ids = [seed.skills.skill_ids[0]];
  const rawP = JSON.stringify(seed.personal), rawS = JSON.stringify(seed.skills);
  h.data.set(base.scope.key('masarak-personal-profile-v1'), rawP);
  h.data.set(base.scope.key('masarak-skills-v1'), rawS);
  const result = await h.util.saveStudentProfile(answers(), await h.util.loadStudentBase());
  assert.equal(result.personal.name, 'Existing Name');
  assert.equal(result.personal.major, 'Existing Major');
  assert.equal(result.personal.gpa, 4.2);
  assert.deepEqual(plain(result.personal.traits), ['Existing trait']);
  assert.ok(result.keptFields.includes('major'));
  assert.equal(result.skills.cv.projects.length, 1);
  assert.equal(result.skills.cv.projects[0].description, 'Original detailed project description');
  assert.equal(result.skills.cv.projects[0].evidence, 'Original literal source');
  assert.equal(result.skills.cv.parser_version, 'old-parser');
  assert.equal(result.skills.cv.entry_method, undefined);
  assert.equal(result.skills.skill_ids.includes(seed.skills.excluded_cv_skill_ids[0]), false);
  const again = await h.util.saveStudentProfile(answers(), await h.util.loadStudentBase());
  assert.deepEqual(plain(again.skills.cv.projects), plain(result.skills.cv.projects));
  assert.equal(again.skills.cv.education.length, 1);
});
test('review/validation performs no writes, tolerates no optional history, rejects incomplete and oversized data', async () => {
  const h = setup(), base = await h.util.loadStudentBase();
  const minimal = { ...answers(), projects: [], courses: [], interests: '', experiences: [], graduation: '٢٠٢٧' };
  const preview = h.util.buildStudentProfile(minimal, base);
  assert.equal(preview.personal.studyDates, '2027');
  assert.equal(preview.skills.cv.projects.length, 0);
  assert.equal(h.data.size, 0);
  for (const patch of [{ major: '' }, { graduation: 'soon' }, { skills: '' }, { projects: [{ name: '', description: '', technologies: '' }] },
    { experiences: [{ role: '', organization: '', description: '' }] }, { interests: Array.from({ length: 31 }, (_, i) => `interest${i}`).join(',') }]) {
    assert.ok(h.util.validateStudentAnswers({ ...minimal, ...patch }));
    assert.throws(() => h.util.buildStudentProfile({ ...minimal, ...patch }, base));
  }
  assert.equal(h.data.size, 0);
});
test('concurrent change is refused and account switching cannot save into another owner', async () => {
  const h = setup(), base = await h.util.loadStudentBase();
  h.data.set(base.scope.key('masarak-personal-profile-v1'), 'changed externally');
  await assert.rejects(h.util.saveStudentProfile(answers(), base), /تغيّر ملفك/);
  assert.equal(h.data.get(base.scope.key('masarak-personal-profile-v1')), 'changed externally');
  h.scoped.setDataOwner('synthetic-student-b');
  await assert.rejects(h.util.saveStudentProfile(answers(), base), /تغيّر الحساب/);
  assert.equal([...h.data.keys()].some(k => k.endsWith(':synthetic-student-b')), false);
});
test('a partial storage failure rolls back both existing keys and allows retry', async () => {
  const h = setup();
  const base = await h.util.loadStudentBase();
  h.failOnce();
  await assert.rejects(h.util.saveStudentProfile(answers(), base), /disk failure/);
  assert.equal(h.data.size, 0);
  await h.util.saveStudentProfile(answers(), base);
  assert.ok(h.data.has(base.scope.key('masarak-personal-profile-v1')));
  assert.ok(h.data.has(base.scope.key('masarak-skills-v1')));
});
test('print HTML escapes user content, embeds no external resources and includes optional experience only when present', async () => {
  const h = setup();
  const result = h.util.buildStudentProfile({ ...answers(), name: '<script>alert("test")</script>', interests: '<img src=x onerror=alert(1)>' }, await h.util.loadStudentBase());
  const html = h.load('src/utils/student-resume-html.ts').studentResumeHtml(result.personal, result.skills);
  assert.ok(html.includes('&lt;script&gt;'));
  assert.equal(html.includes('<script>'), false);
  assert.equal(html.includes('<img '), false);
  assert.equal(html.includes('<h2>الخبرة</h2>'), false);
  assert.ok(html.includes('Data Analysis Dashboard'));
  assert.ok(html.includes("default-src 'none'"));
});
