import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { extractText, analyzeLocalText, validateAnalysis } from './analysis.mjs';
import { resumeLines, resumePdf } from './fixtures/fr3-resumes.mjs';
import { experienceDuration } from '../src/utils/cv-duration.mjs';
import { plainLayoutText } from './layout-reader.mjs';

const local = source => analyzeLocalText(source);
for (const language of ['en', 'ar']) {
  test(`real ${language} PDF extracts 9 skills, 3 projects, 5 courses and separate credentials, college and major`, async () => {
    const source = await extractText({ originalname: 'fictional.pdf', mimetype: 'application/pdf', buffer: resumePdf(language) });
    const result = await local(source);
    assert.deepEqual(Object.fromEntries(['skills', 'projects', 'courses', 'certificates', 'education', 'experiences'].map(key => [key, result[key].length])),
      { skills: 9, projects: 3, courses: 5, certificates: 2, education: 1, experiences: 2 });
    assert.deepEqual(result.skills.map(item => item.name), ['Python', 'JavaScript', 'HTML', 'CSS', 'SQL', 'Git', 'Excel', 'Figma', 'Linux']);
    assert.match(result.projects[0].category, /ويب/);
    assert.equal(result.projects[0].category_basis, 'inferred');
    assert.ok(result.projects[0].category_evidence);
    assert.equal(result.projects[2].category, 'غير محدد');
    assert.equal(result.projects[2].category_basis, 'unspecified');
    assert.notEqual(result.education[0].college, result.education[0].major);
    assert.ok(result.education[0].organization);
    assert.match(result.education[0].study_status, /Expected|متوقع/);
    assert.ok(result.experiences[0].location);
    assert.ok(result.experiences[0].description);
    assert.equal(experienceDuration(result.experiences[0].dates, result.analyzed_at)?.months, 14);
    assert.equal(experienceDuration(result.experiences[1].dates, result.analyzed_at)?.approximate, true);
    assert.ok(result.certificates.every(item => item.issuer && item.date));
    for (const key of ['skills', 'projects', 'courses', 'certificates', 'education', 'experiences']) {
      assert.equal(result.section_status[key], 'extracted');
      for (const item of result[key]) {
        assert.ok(item.evidence);
        assert.ok(plainLayoutText(source).includes(item.evidence), `${key} evidence must be visible source text`);
      }
    }
  });
}

test('section boundaries and actual record titles prevent college, major, courses, project and job titles becoming skills', async () => {
  const result = await local([
    'Skills:', 'Python, College of Computing, Computer Science, Campus Portal, Software Engineer, Python Basics',
    'Projects:', 'Project: Campus Portal', 'Technologies: SQL',
    'Courses:', 'Course: Python Basics', 'Provider: Demo Academy',
    'Education:', 'Degree: Bachelor of Science', 'College: College of Computing', 'Major: Computer Science',
    'Experience:', 'Role: Software Engineer',
  ].join('\n'));
  assert.deepEqual(result.skills.map(item => item.name), ['Python', 'SQL']);
  assert.equal(result.courses.length, 1);
  assert.equal(result.projects.length, 1);
  assert.equal(result.education.length, 1);
});

test('recovers a university and dates from a degree row joined with an em dash and a pipe', () => {
  const line = 'Bachelor of Business Information Systems — Lakeview State University | 2022–2026';
  const source = `EDUCATION\n[P1L2 y=100] (x=51) ${line}\nEXPERIENCE`;
  const localEducation = local(source).education[0];
  assert.equal(localEducation.name, 'Bachelor of Business Information Systems');
  assert.equal(localEducation.organization, 'Lakeview State University');
  assert.equal(localEducation.dates, '2022–2026');

  // Simulate the model returning only the degree label. The deterministic
  // evidence pass must supplement the same education record, not guess.
  const validated = validateAnalysis({
    skills: [], certificates: [], courses: [], experiences: [],
    education: [{ name: localEducation.name, organization: '', college: '', major: '', study_status: '', dates: '2022–2026', date_line_id: 'P1L2', description: '', evidence: localEducation.name }],
    projects: [], activities: [], unclassified: [],
  }, source);
  assert.equal(validated.education[0].organization, 'Lakeview State University');
  assert.equal(validated.education[0].dates, '2022–2026');
  assert.equal(validated.education[0].field_evidence.organization, 'Lakeview State University');
});

test('duplicates are unique, combined qualifications need review and missing sections are not proof of absence', async () => {
  const lines = [
    ...resumeLines.en, 'Skills: Python, Python',
    'Projects:', 'Project: Campus Portal',
    'Courses:', 'Course: Python Basics', 'Provider: Demo Academy; Date: 2021',
    'Certifications:', 'Certificate: Python Basics', 'Issuer: Demo Academy; Date: 2021',
    'Courses & Certifications:', 'Cloud Essentials', 'Provider: Fictional Academy',
  ];
  const source = await extractText({ originalname: 'duplicates.pdf', buffer: resumePdf('en', lines) });
  const result = await local(source);
  assert.equal(result.skills.length, 9);
  assert.equal(result.projects.length, 3);
  assert.equal(result.courses.length, 5);
  assert.equal(result.certificates.length, 2);
  assert.ok(result.unclassified.some(item => item.name === 'Cloud Essentials'));
  assert.ok(result.warnings.some(text => /لم نحتسبه مرتين/.test(text)));
  const missing = await local('Skills: SQL\nSynthetic test with no other sections.');
  for (const section of ['education', 'experiences', 'courses', 'certificates', 'projects']) {
    assert.deepEqual(missing[section], []);
    assert.equal(missing.section_status[section], 'not_found');
  }
});

test('evidenced project categories are rules, not invented project facts; combined Arabic qualifications remain unresolved', async () => {
  for (const [technology, expected] of [['Flutter', 'جوال'], ['TensorFlow', 'ذكاء اصطناعي'], ['encryption', 'أمن'], ['PostgreSQL', 'قواعد بيانات']]) {
    const result = await local(`Projects:\nProject: Fictional Demo\nTechnologies: ${technology}`);
    assert.equal(result.projects[0].category, expected);
    assert.equal(result.projects[0].category_basis, 'inferred');
    assert.equal(result.projects[0].category_evidence, technology);
    assert.equal(result.projects[0].role, undefined);
    assert.equal(result.projects[0].organization, '');
  }
  const explicit = await local('Projects:\nProject: Fictional Demo\nCategory: Mobile');
  assert.equal(explicit.projects[0].category, 'Mobile');
  assert.equal(explicit.projects[0].category_basis, 'explicit');
  const ambiguous = await local('الدورات والشهادات:\nأساسيات الحوسبة\nالمنصة: منصة تجريبية');
  assert.equal(ambiguous.courses.length, 0);
  assert.equal(ambiguous.certificates.length, 0);
  assert.equal(ambiguous.unclassified[0].name, 'أساسيات الحوسبة');
  const mixed = await local('Certificates:\nCertificate: Course completion in Testing\nIssuer: Demo School\nIndependent Security Credential\nIssuer: Fictional Board');
  assert.equal(mixed.courses.length, 1);
  assert.equal(mixed.certificates[0].name, 'Independent Security Credential');
  const degree = await local('Education:\nDegree: Bachelor of Science in Computer Science');
  assert.equal(degree.education[0].major, 'Computer Science');
});
test('multi-column ambiguity breaks record association without inventing an employer or college', async () => {
  const result = await local([
    'Education:', 'Degree: Bachelor of Science',
    '[P1L3 y=100] (x=20) University: Wrong University | (x=400) College: Wrong College',
    'Major: Must not attach',
    'Experience:', 'Role: Data Analyst',
    '[P1L7 y=200] (x=20) Company: Wrong Employer | (x=400) Period: 2021 - 2024',
    'Location: Must not attach',
    'Projects:', 'Project: Demo System',
    '[P1L11 y=300] (x=20) Technologies: Python | (x=400) Technologies: Swift',
  ].join('\n'));
  assert.equal(result.education[0].organization, '');
  assert.equal(result.education[0].major, undefined);
  assert.equal(result.experiences[0].organization, '');
  assert.equal(result.experiences[0].dates, '');
  assert.equal(result.experiences[0].location, undefined);
  assert.equal(result.projects[0].category, 'غير محدد');
  assert.deepEqual(result.skills, []);
  assert.equal(result.section_status.education, 'uncertain');
  for (const name of ['layout-two-columns.pdf', 'layout-scrambled.pdf']) {
    const source = await extractText({ originalname: name, mimetype: 'application/pdf', buffer: await readFile(new URL(`fixtures/${name}`, import.meta.url)) });
    const actual = await local(source);
    assert.ok(actual.warnings.some(text => /الأعمدة/.test(text)));
  }
});

test('durations use only sufficient employment ranges, show annual approximation and freeze present at analysis time', () => {
  const asOf = '2026-10-19T00:00:00Z';
  assert.equal(experienceDuration('Jan 2021 - Mar 2022', asOf).months, 14);
  assert.equal(experienceDuration('يناير ٢٠٢١ - مارس ٢٠٢٢', asOf).months, 14);
  assert.equal(experienceDuration('2021-01 - 2022-03', asOf).months, 14);
  assert.equal(experienceDuration('01/2021 - 03/2022', asOf).months, 14);
  assert.equal(experienceDuration('2021 - 2023', asOf).approximate, true);
  assert.equal(experienceDuration('Jan 2026 - Present', asOf).months, 9);
  assert.equal(experienceDuration('Jan 2026 - Present', asOf).asOf, '2026-10-19');
  assert.equal(experienceDuration('Jan 2026 - Present'), null);
  for (const value of ['', '2023', 'Expected graduation 2027', 'تخرج متوقع ٢٠٢٧', '2024 - 2021', 'Unknown - Present', '2026 - 2028', '13/2021 - 03/2022']) {
    assert.equal(experienceDuration(value, asOf), null, value);
  }
});

test('provider schema compatibility never reintroduces section titles as skills', () => {
  const source = 'Projects: Campus Portal\nEducation: College of Computing\nSkills: Python';
  const skills = ['Campus Portal', 'College of Computing', 'Python'].map(name => ({ name, evidence: name, mapped_skill_id: null }));
  const result = validateAnalysis({ skills, projects: [{ name: 'Campus Portal', organization: '', dates: '', description: '', evidence: 'Campus Portal' }], education: [], experiences: [], certificates: [], activities: [] }, source);
  assert.deepEqual(result.skills.map(item => item.name), ['Python']);
  assert.deepEqual(result.courses, []);
});
