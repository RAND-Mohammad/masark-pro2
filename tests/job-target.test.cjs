const test = require('node:test');
const assert = require('node:assert/strict');
const projectModule = require('./helpers/project-module.cjs');
function setup() {
  const values = new Map();
  const raw = { getItem: async key => values.get(key) ?? null, setItem: async (key, value) => { values.set(key, value); }, removeItem: async key => values.delete(key),
    multiSet: async pairs => pairs.forEach(([key, value]) => values.set(key, value)), multiRemove: async keys => keys.forEach(key => values.delete(key)) };
  const load = projectModule({ '@react-native-async-storage/async-storage': raw });
  return { values, load, scope: load('src/utils/scoped-storage.ts'), target: load('src/utils/job-target.ts') };
}
const job = { id: 'job-test', title: 'Database Trainee', employer: 'Test', description: 'Requirements\nSQL required.', locations: ['Riyadh'], source: 'test', sourceUrl: 'https://example.com/job', applyUrl: 'https://example.com/apply', postedAt: '2026-10-20', lastCheckedAt: null, attribution: null };
test('targeted job stays isolated between guest and two accounts and triggers cloud dirty tracking', async () => {
  const h = setup(); h.scope.enableCloudChangeTracking();
  h.scope.setDataOwner('A'); await h.target.saveJobTarget(job);
  assert.equal((await h.target.readJobTarget()).job.id, job.id);
  assert.equal(JSON.parse(h.values.get('masarak-cloud-sync-v1:account:A')).dirty, true);
  h.scope.setDataOwner('B'); assert.equal(await h.target.readJobTarget(), null);
  h.scope.setDataOwner(null); assert.equal(await h.target.readJobTarget(), null);
  h.scope.setDataOwner('A'); assert.equal((await h.target.readJobTarget()).job.id, job.id);
  await h.target.saveJobTarget(null); assert.equal(await h.target.readJobTarget(), null);
});
test('invalid saved job URL or oversized text is rejected before writing', async () => {
  const h = setup();
  await assert.rejects(h.target.saveJobTarget({ ...job, sourceUrl: 'javascript:alert(1)' }));
  await assert.rejects(h.target.saveJobTarget({ ...job, description: 'x'.repeat(30001) }));
  assert.equal(h.values.size, 0);
});
test('job target round-trips optional cloud field and old snapshots remain compatible', () => {
  const h = setup(); const cloud = h.load('src/utils/cloud-types.ts');
  const old = { version: 1, personal: null, skills: null, plan: [], learningProgress: {}, professionalCertifications: [], cv: null };
  assert.equal(Object.hasOwn(cloud.parseCloudSnapshot(old, 'A'), 'jobTarget'), false);
  const target = { version: 1, selectedAt: '2026-10-26T00:00:00Z', job };
  assert.equal(cloud.parseCloudSnapshot({ ...old, jobTarget: target }, 'A').jobTarget.job.id, job.id);
  assert.equal(cloud.parseCloudSnapshot({ ...old, jobTarget: null }, 'A').jobTarget, null);
});
test('job gap skills outside the old career catalog are retained in the existing plan and cloud contract', async () => {
  const h = setup(); const dataset = require('../src/masarak_dataset.json');
  const oldCareer = new Set(dataset.career_skills.map(item => item.skill_id));
  const skill = dataset.skills.find(item => !oldCareer.has(item.skill_id));
  const plan = h.load('src/utils/learning-plan.ts');
  await plan.addLearningPlanItems([skill.skill_id]);
  assert.ok((await plan.readLearningPlan()).includes(skill.skill_id));
});
