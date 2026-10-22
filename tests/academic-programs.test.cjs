const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const ts = require(path.join(root, 'node_modules/typescript'));
function moduleFrom(relativePath, requireModule = require) { const code = fs.readFileSync(path.join(root, relativePath), 'utf8'); const output = ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText; const exports = {}; vm.runInNewContext(output, { exports, Set, Map, Object, require: requireModule, Error }); return exports; }
const academic = moduleFrom('src/constants/academic-programs.ts');
const programs = academic.academicPrograms;
const jobPaths = moduleFrom('src/constants/job-paths.ts', name => name === './academic-programs' ? academic : require(name)).jobPaths;
const certifications = moduleFrom('src/constants/professional-certifications.ts').professionalCertifications;
const dataset = JSON.parse(fs.readFileSync(path.join(root, 'src/masarak_dataset.json'), 'utf8'));
const jobPathModule = { ...moduleFrom('src/constants/job-paths.ts', name => name === './academic-programs' ? academic : require(name)) };
const requirements = moduleFrom('src/constants/job-path-requirements.ts', name => name.endsWith('masarak_dataset.json') ? dataset : name === './job-paths' ? jobPathModule : require(name));
test('the guide contains the eight requested computing majors', () => {
  assert.deepEqual(Array.from(programs, item => item.englishTitle), ['Computer Science', 'Information Technology', 'Information Systems', 'Software Engineering', 'Computer Engineering', 'Cybersecurity', 'Artificial Intelligence', 'Data Science']);
});
test('job titles have a career stage and all links resolve', () => {
  const careerIds = new Set(dataset.careers.map(item => item.career_id)); const certificationIds = new Set(certifications.map(item => item.id));
  for (const program of programs) { assert.ok(program.commonTitles.length >= 7); assert.ok(program.commonTitles.every(job => job.title && ['entry', 'experienced'].includes(job.stage))); assert.ok(program.careerIds.every(id => careerIds.has(id))); assert.ok(program.recommendedCertificationIds.every(id => certificationIds.has(id))); }
});
test('every unique job title is an independent readiness path', () => {
  const titles = new Set(programs.flatMap(program => program.commonTitles.map(job => job.title)));
  assert.equal(jobPaths.length, titles.size);
  assert.equal(new Set(jobPaths.map(path => path.id)).size, jobPaths.length);
  assert.ok(jobPaths.every(path => titles.has(path.title) && path.baseCareerId));
});
test('every job path has validated role-specific skills, education, experience and certification choices', () => {
  const knownSkills = new Set(dataset.skills.map(item => item.skill_id));
  const knownCertificates = new Set(certifications.map(item => item.id));
  for (const pathItem of jobPaths) {
    const profile = requirements.jobPathRequirementProfile(pathItem.id);
    const rows = requirements.requirementsForCareerPath(pathItem.id);
    assert.ok(profile, pathItem.title);
    assert.ok(rows.filter(row => row.priority === 'core').length >= 6, pathItem.title);
    assert.ok(rows.every(row => knownSkills.has(row.skill_id)), pathItem.title);
    assert.ok(profile.education && profile.experience && profile.projects.length >= 2, pathItem.title);
    assert.ok(profile.certificationIds.every(id => knownCertificates.has(id)), pathItem.title);
    assert.equal(Object.values(profile.weights).reduce((sum, value) => sum + value, 0), 100, pathItem.title);
    if (profile.certificationIds.length === 0) assert.equal(profile.weights.certifications, 0, pathItem.title);
  }
});
test('different role families no longer inherit one identical skill checklist', () => {
  const signatures = new Set(jobPaths.map(pathItem => requirements.requirementsForCareerPath(pathItem.id).filter(row => row.priority === 'core').map(row => row.skill_id).sort().join(',')));
  assert.ok(signatures.size >= 25);
  const signature = title => requirements.requirementsForCareerPath(jobPaths.find(item => item.title === title).id).map(row => row.skill_id).join(',');
  assert.notEqual(signature('Front-End Developer'), signature('Back-End Developer'));
  assert.notEqual(signature('SOC Analyst'), signature('Penetration Tester'));
  assert.notEqual(signature('NLP Engineer'), signature('Computer Vision Engineer'));
});
