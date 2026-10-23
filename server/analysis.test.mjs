import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { analyzeGroqText as analyzeText, analyzeLocalText, extractText, validateAnalysis, dictionary } from './analysis.mjs';
import { syntheticPdf } from './fixtures/synthetic-pdf.mjs';
import { providerResult } from './fixtures/provider-result.mjs';

const text = 'Demo Candidate. Skills: Python programming and software testing. Certificate: Example Certificate, issued by Demo Institute in 2024. Experience: Developer Intern at Demo Company, 2023.';
const id = dictionary.find(item => item.name === 'Programming').id;
const result = {
  education: [], projects: [], activities: [],
  skills: [{ name: 'Python', mapped_skill_id: id, evidence: 'Python programming' }],
  certificates: [{ name: 'Example Certificate', issuer: 'Demo Institute', date: '2024', evidence: 'Example Certificate, issued by Demo Institute in 2024' }],
  experiences: [{ role: 'Developer Intern', organization: 'Demo Company', dates: '2023', description: '', evidence: 'Developer Intern at Demo Company, 2023' }],
};
test('validates source evidence and rejects unsupported information', () => {
  const safe = validateAnalysis({ ...result, skills: [...result.skills, { name: 'Invented skill', mapped_skill_id: id, evidence: 'No such words in the CV' }] }, text);
  assert.equal(safe.skills.length, 1);
  assert.equal(safe.certificates.length, 1);
  assert.equal(safe.experiences.length, 1);
  assert.ok(safe.warnings.length >= 1);
  assert.equal(safe.certificates[0].date, '');
  const unmapped = validateAnalysis({ ...result, skills: [{ ...result.skills[0], mapped_skill_id: 'UNKNOWN' }] }, text);
  assert.equal(unmapped.skills[0].mapped_skill_id, id); // A known literal name repairs an invalid model ID.
  assert.throws(() => validateAnalysis({ skills: 'bad' }, text));
});
test('handles schema completion and provider failures without leaking secrets', async () => {
  const fakeFetch = async (_url, options) => {
    const request = JSON.parse(options.body);
    assert.equal(request.response_format.json_schema.strict, true);
    assert.match(request.messages[0].content, /untrusted/);
    return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(providerResult(result)) } }] }));
  };
  assert.equal((await analyzeText(text, { key: 'test-only', fetchImpl: fakeFetch })).skills.length, 1);
  const local = analyzeLocalText(text);
  assert.deepEqual(local.skills, []);
  for (const section of ['certificates', 'experiences', 'education', 'projects', 'activities']) assert.deepEqual(local[section], []);
  assert.match(local.warnings[0], /تحليل محلي محدود/);
  for (const status of [401, 429, 500]) {
    await assert.rejects(analyzeText(text, { key: 'test-only', fetchImpl: async () => new Response('{}', { status }) }), error => !error.message.includes('test-only') && error.status >= 400);
  }
  await assert.rejects(analyzeText(text, { key: 'test-only', fetchImpl: async () => new Response(JSON.stringify({ choices: [{ finish_reason: 'length' }] })) }));
});
test('local mode extracts only literal skills under the approved English and Arabic headings', async () => {
  const source = [
    'Summary: communication, leadership',
    'Skills: Python, JavaScript, C++, Unknown Tool',
    'Experience:',
    'Communication',
    'Technical Skills',
    'SQL',
    'Education: Python',
    'المهارات التقنية: تحليل البيانات، قيادة',
    'المشاريع:',
    'Python',
    'المهارات',
    'Excel',
  ].join('\n');
  const local = analyzeLocalText(source);
  assert.deepEqual(local.skills.map(skill => skill.name), ['Python', 'JavaScript', 'C++', 'Unknown Tool', 'SQL', 'تحليل البيانات', 'قيادة', 'Excel']);
  assert.equal(local.skills[0].mapped_skill_id, matchSkillId('Python'));
  assert.equal(local.skills.find(skill => skill.name === 'Unknown Tool').mapped_skill_id, null);
  for (const skill of local.skills) assert.ok(source.includes(skill.evidence));
  for (const section of ['certificates', 'experiences', 'education', 'projects', 'activities']) assert.deepEqual(local[section], []);
  assert.match(local.warnings[0], /لم نخمن/);
});
test('local mode ignores nonapproved headings, sentence fragments, and other visual PDF columns', async () => {
  const source = [
    'Languages: Arabic, English',
    'Tools: Photoshop, Figma',
    'Skills and Interests: Figma, Python',
    'Skills: Python programming and software testing.',
    '[P1L4 y=250] (x=20) Skills: | (x=400) Python, JavaScript',
    '[P1L5 y=300] (x=20) Database administration | (x=400) SQL',
    '[P1L6 y=320] (x=20) Education | (x=400) Bachelor of Science',
  ].join('\n');
  assert.deepEqual(analyzeLocalText(source).skills, []);
});

test('local mode extracts explicit English work experience with exact evidence and its source date line', async () => {
  const experience = 'Senior Data Analyst at Sample Labs, Jan 2021 – Present';
  const source = [
    'Technical Skills: Python, SQL',
    'Experience:',
    `[P1L4 y=250] (x=20) ${experience}`,
    'Education: Bachelor of Science in Computing',
    'Engineer at an unrelated organization, 2020',
  ].join('\n');
  const local = analyzeLocalText(source);
  assert.deepEqual(local.skills.map(item => item.name), ['Python', 'SQL']);
  assert.equal(local.experiences.length, 1);
  assert.deepEqual(local.experiences[0], {
    role: 'Senior Data Analyst', organization: 'Sample Labs', dates: 'Jan 2021 – Present',
    date_line_id: 'P1L4', description: '', evidence: experience,
  });
});

test('local mode extracts Arabic work experience and preserves Arabic dates without inference', async () => {
  const experience = 'مهندسة برمجيات لدى شركة آفاق، يناير ٢٠٢٢ - مارس ٢٠٢٤';
  const source = ['الخبرات العملية:', `[D1L2] ${experience}`, 'الشهادات: شهادة مهنية، ٢٠٢٣'].join('\n');
  const local = analyzeLocalText(source);
  assert.equal(local.experiences.length, 1);
  assert.deepEqual(local.experiences[0], {
    role: 'مهندسة برمجيات', organization: 'شركة آفاق', dates: 'يناير ٢٠٢٢ - مارس ٢٠٢٤',
    date_line_id: 'D1L2', description: '', evidence: experience,
  });
  assert.deepEqual(local.certificates, []);
});

test('local mode leaves unclear experience empty and never turns actions or ambiguous PDF columns into jobs', async () => {
  const source = [
    'Experience:',
    'Built a dashboard at Sample Labs during 2024.',
    'Supported the release at Example Company.',
    'طورت لوحة متابعة لدى شركة خيالية.',
    '[P1L4 y=250] (x=20) Software Engineer | (x=600) Example Company, 2022–2023',
    'Projects: Product Designer at a fictional employer, 2021',
    'Education: Engineer at a fictional employer, 2020',
  ].join('\n');
  const local = analyzeLocalText(source);
  assert.deepEqual(local.experiences, []);
  assert.deepEqual(local.projects, []);
  assert.match(local.warnings[0], /لا نخمن|لم نخمن/);
});

test('local mode has no work experiences without a work section and does not infer skills from a role', async () => {
  const absent = analyzeLocalText('Education:\nStudent at Demo University\nProjects:\nSoftware Engineer at a demo project\nSkills: Python');
  assert.deepEqual(absent.experiences, []);
  assert.deepEqual(absent.skills.map(item => item.name), ['Python']);
  const sparse = analyzeLocalText('Experience:\nSoftware Engineer at Sample Labs\n2020 - 2023');
  assert.equal(sparse.experiences[0].role, 'Software Engineer');
  assert.equal(sparse.experiences[0].organization, 'Sample Labs');
  assert.equal(sparse.experiences[0].dates, '');
  assert.equal(sparse.experiences[0].description, '');
  assert.deepEqual(sparse.skills, []);
});

test('local mode accepts an explicit role while leaving unstated employer and dates blank', async () => {
  const source = 'Work Experience:\nRole: Product Designer\nSkills: Figma';
  const local = analyzeLocalText(source);
  assert.deepEqual(local.experiences, [{
    role: 'Product Designer', organization: '', dates: '', date_line_id: '', description: '', evidence: 'Role: Product Designer',
  }]);
  assert.deepEqual(local.skills.map(item => item.name), ['Figma']);
});

test('local mode joins only consecutive explicit experience fields and keeps all evidence in the source language', async () => {
  for (const lines of [
    ['Role: Data Analyst', 'Company: Demo Labs', 'Period: 2021 - 2023', 'Description: Reviewed synthetic survey data.'],
    ['المسمى: محللة بيانات', 'الجهة: شركة آفاق', 'الفترة: ٢٠٢١ - ٢٠٢٣', 'المهام: مراجعة بيانات استبيان تجريبي.'],
  ]) {
    const source = ['Experience:', ...lines.map((line, index) => `[D1L${index + 2}] ${line}`), 'Education:', 'Company: Must not leak into the job'].join('\n');
    const local = analyzeLocalText(source);
    assert.equal(local.experiences.length, 1);
    const experience = local.experiences[0];
    assert.equal(experience.evidence, lines.join('\n'));
    assert.ok(lines[0].includes(experience.role));
    assert.ok(lines[1].includes(experience.organization));
    assert.ok(lines[2].includes(experience.dates));
    assert.ok(lines[3].includes(experience.description));
    assert.equal(experience.date_line_id, 'D1L4');
    assert.ok(!experience.organization.includes('Must not leak'));
  }
});

test('local mode does not complete a labelled job across an ambiguous PDF row or an unrelated line', async () => {
  for (const gap of ['Unrelated narrative', '[P1L3 y=300] (x=20) Company: Wrong employer | (x=500) Other column']) {
    const local = analyzeLocalText(['Experience:', 'Role: Data Analyst', gap, 'Company: Must not attach', 'Period: 2022 - 2024'].join('\n'));
    assert.equal(local.experiences.length, 1);
    assert.equal(local.experiences[0].organization, '');
    assert.equal(local.experiences[0].dates, '');
  }
  const undecodable = analyzeLocalText('Experience:\nSoftware Engineer at Demo Labs, 2020 and 2021');
  assert.equal(undecodable.experiences[0].organization, '');
  assert.equal(undecodable.experiences[0].dates, '');
});

test('local skill limits do not skip a later experience section or rewrite literal technical job titles', async () => {
  const local = analyzeLocalText(['Skills:', ...Array.from({ length: 85 }, (_, index) => `Demo Tool ${index + 1}`), 'Experience:', '.NET Developer at Sample Labs'].join('\n'));
  assert.equal(local.skills.length, 80);
  assert.equal(local.experiences.length, 1);
  assert.equal(local.experiences[0].role, '.NET Developer');
});

function matchSkillId(name) {
  return dictionary.find(entry => entry.aliases.some(alias => alias.toLowerCase() === name.toLowerCase()))?.id ?? null;
}
test('extracts valid PDF only and rejects other types, disguised images, empty and damaged files', async () => {
  const buffer = await readFile(new URL('fixtures/demo.pdf', import.meta.url));
  assert.match(await extractText({ originalname: 'demo.PDF', mimetype: 'application/pdf', buffer }), /Python programming/);
  for (const file of [
    { originalname: 'cv.png', mimetype: 'image/png', buffer: Buffer.from('\x89PNG\r\n\x1a\n') },
    { originalname: 'cv.jpg', mimetype: 'image/jpeg', buffer: Buffer.from('\xff\xd8\xff') },
    { originalname: 'cv.docx', mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: await readFile(new URL('fixtures/demo.docx', import.meta.url)) },
    { originalname: 'renamed.pdf', mimetype: 'application/pdf', buffer: Buffer.from('\x89PNG\r\n\x1a\n') },
    { originalname: 'renamed.pdf', mimetype: 'application/pdf', buffer: Buffer.from('\xff\xd8\xff') },
    { originalname: 'cv.pdf', mimetype: 'image/png', buffer },
  ]) {
    await assert.rejects(extractText(file), error => error.status === 400 && error.message === 'يرجى رفع السيرة الذاتية بصيغة PDF فقط');
  }
  await assert.rejects(extractText({ originalname: 'cv.pdf', buffer: Buffer.alloc(0) }), /فارغ/);
  await assert.rejects(extractText({ originalname: 'cv.pdf', buffer: Buffer.from('%PDF-1.4 corrupted') }), /تعذر قراءة ملف PDF/);
  await assert.rejects(extractText({ originalname: 'cv.pdf', buffer: Buffer.alloc(10 * 1024 * 1024 + 1) }), /10 ميجابايت/);
  await assert.rejects(extractText({ originalname: 'scan.pdf', mimetype: 'application/pdf', buffer: syntheticPdf() }), /نصًا كافيًا.*قراءة الصور غير متاحة/);
});

