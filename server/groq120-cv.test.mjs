import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeGroqText as analyzeText, analysisSchema, extractText } from './analysis.mjs';
import { verifyFieldProvenance } from './cv-provenance.mjs';
import { providerResult } from './fixtures/provider-result.mjs';
import { syntheticPdf } from './fixtures/synthetic-pdf.mjs';
import { plainLayoutText } from './layout-reader.mjs';

const lines = [
  'EDUCATION', 'Example University', 'Bachelor of Science in Computer Science',
  'Expected Graduation: 2027', 'Another University', 'Master of Science in Information Systems',
  'Expected Graduation: 2029', 'ACADEMIC PROJECTS', 'Synthetic Scheduling System',
  'Designed a scheduler using Priority Queue.', 'Synthetic Testing Portal',
  'Implemented a portal using Python.', 'WORK EXPERIENCE',
  'Role: Data Analyst', 'Company: Fictional Labs', 'Jan 2021 - Mar 2022',
  'Reviewed synthetic records.', 'Role: Software Intern', 'Company: Sample Systems',
  'Jun 2023 - Aug 2023', 'Tested a synthetic application.', 'SKILLS', 'Python, SQL',
];
const source = lines.map((line, i) => `[P${i < 8 ? 1 : 2}L${i + 1} y=${20 + i * 12}] (x=40) ${line}`).join('\n');
const education = (name, organization, date, index) => ({
  name, organization, dates: date, description: '', evidence: name,
  college: '', major: name.split(' in ')[1], study_status: 'Expected Graduation',
  date_line_id: `P1L${index}`,
});
const project = (index) => ({
  name: lines[index], organization: '', dates: '', description: lines[index + 1],
  evidence: lines.slice(index, index + 2).join('\n'),
});
const records = () => providerResult({
  skills: [{ name: 'Python', mapped_skill_id: null, evidence: 'Python, SQL' }],
  education: [
    education(lines[2], '', '2027', 4),
    education(lines[5], lines[4], '2029', 7),
  ],
  projects: [project(8), project(10)],
  experiences: [
    { role: 'Data Analyst', organization: 'Fictional Labs', dates: 'Jan 2021 - Mar 2022',
      description: lines[16], evidence: lines.slice(13, 17).join('\n'), date_line_id: 'P2L16' },
    { role: 'Software Intern', organization: 'Sample Systems', dates: 'Jun 2023 - Aug 2023',
      description: lines[20], evidence: lines.slice(17, 21).join('\n'), date_line_id: 'P2L20' },
  ],
  courses: [], certificates: [], activities: [],
});
const response = value => new Response(JSON.stringify({
  choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(value) } }],
}));

test('Groq120 strict schema and distinct records retain verified field quotes and PDF pages', async () => {
  let calls = 0;
  const result = await analyzeText(source, { key: 'synthetic-only', fetchImpl: async (url, options) => {
    calls++;
    assert.equal(url, 'https://api.groq.com/openai/v1/chat/completions');
    const body = JSON.parse(options.body);
    assert.equal(body.model, 'openai/gpt-oss-120b');
    assert.equal(body.response_format.json_schema.strict, true);
    assert.deepEqual(body.response_format.json_schema.schema, analysisSchema);
    for (const schema of [analysisSchema, ...Object.values(analysisSchema.properties).map(array => array.items)]) {
      assert.equal(schema.additionalProperties, false);
      assert.deepEqual(schema.required.sort(), Object.keys(schema.properties).sort());
    }
    return response(records());
  } });
  assert.equal(calls, 1);
  assert.equal(result.education.length, 2);
  assert.equal(result.projects.length, 2);
  assert.equal(result.experiences.length, 2);
  assert.equal(result.education[0].organization, 'Example University');
  assert.equal(result.education[1].organization, 'Another University');
  assert.deepEqual(result.education[0].field_pages.organization, [1]);
  assert.deepEqual(result.projects[0].field_pages.description, [2]);
  assert.deepEqual(result.experiences[1].field_pages.role, [2]);
  assert.equal(result.education[0].dates, '2027');
  assert.equal(result.education[1].dates, '2029');
  const visible = plainLayoutText(source);
  for (const section of ['skills', 'education', 'projects', 'experiences']) {
    for (const item of result[section]) {
      for (const quote of Object.values(item.field_evidence ?? {})) assert.ok(visible.includes(quote));
    }
  }
});

test('missing key and unavailable model fail explicitly without invoking a local substitute', async () => {
  let calls = 0;
  await assert.rejects(analyzeText(source, { key: ' ', fetchImpl: async () => { calls++; } }),
    error => error.status === 503 && /GROQ_API_KEY/.test(error.message));
  assert.equal(calls, 0);
  for (const status of [400, 404, 401, 429]) {
    await assert.rejects(analyzeText(source, { key: 'synthetic-only', model: 'unavailable-test-model',
      fetchImpl: async () => { calls++; return new Response('{}', { status }); } }),
    error => error.status >= 400 && !error.message.includes('synthetic-only'));
  }
  assert.equal(calls, 4);
});

test('explicit model override is honored only through the Groq endpoint', async () => {
  await analyzeText('SKILLS\nPython', { key: 'synthetic-only', model: ' custom-groq-model ', fetchImpl: async (url, options) => {
    assert.equal(url, 'https://api.groq.com/openai/v1/chat/completions');
    assert.equal(JSON.parse(options.body).model, 'custom-groq-model');
    return response(providerResult({ skills: [{ name: 'Python', mapped_skill_id: null, evidence: 'Python' }] }));
  } });
});

test('a record cannot borrow a second university or employer through a combined evidence passage', async () => {
  const value = records();
  value.education[0].organization = 'Another University';
  value.education[0].evidence = lines.slice(1, 7).join('\n');
  value.experiences[0].organization = 'Sample Systems';
  value.experiences[0].evidence = lines.slice(13, 21).join('\n');
  const result = await analyzeText(source, { key: 'synthetic-only', fetchImpl: async () => response(value) });
  assert.notEqual(result.education[0].organization, 'Another University');
  assert.notEqual(result.experiences[0].organization, 'Sample Systems');
});

test('unverifiable field evidence is cleared for review, and plain text never invents page numbers', () => {
  const result = verifyFieldProvenance({
    education: [{ name: 'Bachelor of Science', organization: 'Imaginary University', evidence: 'Bachelor of Science',
      field_evidence: { name: 'Bachelor of Science', organization: 'Imaginary University' } }],
  }, 'EDUCATION\nBachelor of Science');
  assert.equal(result.education[0].organization, '');
  assert.ok(result.education[0].needs_review.includes('organization'));
  assert.equal(result.education[0].field_pages, undefined);
});

test('identical degrees at different institutions do not authorize a merged education record', async () => {
  const degree = 'Bachelor of Science in Computer Science';
  const text = ['EDUCATION', 'Example University', degree, 'Expected Graduation: 2027',
    'Another University', degree, 'Expected Graduation: 2029', 'SKILLS', 'Python'].join('\n');
  const value = providerResult({ education: [{
    name: degree, organization: 'Another University', major: 'Computer Science',
    evidence: text.split('\n').slice(1, 7).join('\n'),
  }] });
  const result = await analyzeText(text, { key: 'synthetic-only', fetchImpl: async () => response(value) });
  assert.equal(result.education[0].organization, '');
  assert.ok(result.education[0].needs_review.includes('organization'));
});

test('real synthetic PDF extraction preserves record boundaries before mocked Groq analysis', async () => {
  const text = await extractText({ buffer: syntheticPdf(lines, { fontSize: 9 }),
    originalname: 'synthetic.pdf', mimetype: 'application/pdf' });
  assert.match(text, /\[P1L\d+ y=\d+\]/);
  assert.match(text, /Example University/);
  const result = await analyzeText(text, { key: 'synthetic-only', fetchImpl: async () => response(records()) });
  assert.equal(result.education.length, 2);
  assert.equal(result.education[0].organization, 'Example University');
  assert.equal(result.projects[0].name, 'Synthetic Scheduling System');
  assert.match(result.projects[0].description, /^Designed/);
  assert.deepEqual(result.projects[0].field_pages.name, [1]);
});
