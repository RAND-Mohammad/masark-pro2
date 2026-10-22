const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const ts = require(path.join(root, 'node_modules/typescript'));
const dataset = JSON.parse(fs.readFileSync(path.join(root, 'src/masarak_dataset.json'), 'utf8'));
const resourcesCode = fs.readFileSync(path.join(root, 'src/constants/learning-resources.ts'), 'utf8');
const certificationsCode = fs.readFileSync(path.join(root, 'src/constants/professional-certifications.ts'), 'utf8');
const profilesCode = fs.readFileSync(path.join(root, 'src/constants/career-profiles.ts'), 'utf8');

function moduleFrom(code, requireModule = require) {
  const exports = {};
  const output = ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(output, { exports, require: requireModule, Set, Map, Object, Math });
  return exports;
}
const resources = moduleFrom(resourcesCode);
const certifications = moduleFrom(certificationsCode);
const profiles = moduleFrom(profilesCode);
const evidence = moduleFrom(fs.readFileSync(path.join(root, 'src/utils/evidence-keywords.ts'), 'utf8'));
const careerScore = moduleFrom(fs.readFileSync(path.join(root, 'src/utils/career-score.ts'), 'utf8'), name => {
  if (name.endsWith('masarak_dataset.json')) return dataset;
  if (name.includes('job-path-requirements')) return { requirementsForCareerPath: id => dataset.career_skills.filter(row => row.career_id === id) };
  throw Error(name);
});
const readiness = moduleFrom(fs.readFileSync(path.join(root, 'src/utils/career-readiness.ts'), 'utf8'), name => {
  if (name.endsWith('masarak_dataset.json')) return dataset;
  if (name.includes('professional-certifications')) return certifications;
  if (name.includes('learning-resources')) return resources;
  if (name.includes('career-profiles')) return profiles;
  if (name.includes('job-paths')) return { resolveBaseCareerId: id => id, jobPaths: dataset.careers.map(career => ({ id: career.career_id, title: career.title, description: career.description })) };
  if (name.includes('job-path-requirements')) return { jobPathRequirementProfile: () => null };
  if (name === './career-score') return careerScore;
  if (name === './evidence-keywords') return evidence;
  return {};
});
const empty = { skillProfile: null, personal: null, learningProgress: {}, professionalCertifications: [] };

test('readiness stays empty without evidence and exposes weights totaling 100', () => {
  const result = readiness.calculateCareerReadiness('C01', empty);
  assert.equal(result.score, null);
  assert.equal(Object.values(result.weights).reduce((sum, value) => sum + value, 0), 100);
});

test('software readiness separates skills, practical evidence, GPA, learning and certification points', () => {
  const coreIds = dataset.career_skills.filter(row => row.career_id === 'C01' && row.priority === 'core').map(row => row.skill_id);
  const firstCore = coreIds[0];
  const resource = resources.learningResources.find(item => item.skillIds.includes(firstCore));
  const result = readiness.calculateCareerReadiness('C01', {
    skillProfile: { skill_ids: coreIds, cv: { projects: [{ name: 'Software API application' }, { description: 'Backend software testing' }], experiences: [{ role: 'Software developer' }] } },
    personal: { education: 'Bachelor', major: 'Computer Science', gpa: 5, gpaScale: 5 },
    learningProgress: resource ? { [resource.id]: '2026-10-14T10:00:00.000Z' } : {},
    professionalCertifications: ['github-foundations'],
  });
  assert.equal(result.breakdown.skills, 55);
  assert.equal(result.breakdown.practical, 25);
  assert.equal(result.breakdown.academic, 10);
  assert.equal(result.breakdown.certifications, 5);
  assert.ok(result.breakdown.learning > 0 && result.breakdown.learning <= 5);
});

test('practical evidence is counted only for the matching career', () => {
  const softwareIds = dataset.career_skills.filter(row => row.career_id === 'C01' && row.priority === 'core').map(row => row.skill_id);
  const skillProfile = { skill_ids: softwareIds, cv: { projects: [{ name: 'Backend software API' }], experiences: [] } };
  const software = readiness.calculateCareerReadiness('C01', { ...empty, skillProfile });
  const cyber = readiness.calculateCareerReadiness('C05', { ...empty, skillProfile });
  assert.ok(software.breakdown.practical > 0);
  assert.equal(cyber.breakdown.practical, 0);
});

test('new careers have complete weights and core skills', () => {
  for (const id of ['C07', 'C08', 'C09']) {
    assert.equal(Object.values(readiness.readinessWeights[id]).reduce((sum, value) => sum + value, 0), 100);
    assert.ok(dataset.career_skills.some(row => row.career_id === id && row.priority === 'core'));
  }
});

test('one role certification earns the certificate component when alternatives exist', () => {
  const result = readiness.calculateCareerReadiness('C07', { ...empty, professionalCertifications: ['microsoft-dp-700'] });
  assert.equal(result.breakdown.certifications, readiness.readinessWeights.C07.certifications);
  assert.ok(result.evidence.totalCertifications > 1);
});

test('role weights make the selected networking certification more influential than the software certification', () => {
  const software = readiness.calculateCareerReadiness('C01', { ...empty, professionalCertifications: ['github-foundations'] });
  const network = readiness.calculateCareerReadiness('C06', { ...empty, professionalCertifications: ['cisco-ccna'] });
  assert.equal(software.breakdown.certifications, 5);
  assert.equal(network.breakdown.certifications, 25);
});
