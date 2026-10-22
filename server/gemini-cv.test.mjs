import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeText, extractText } from './analysis.mjs';
import { geminiCvSchema, GEMINI_CV_MODEL, GEMINI_CV_SECRET } from './gemini-cv.mjs';
import { providerResult } from './fixtures/provider-result.mjs';
import { syntheticPdf } from './fixtures/synthetic-pdf.mjs';
import { plainLayoutText } from './layout-reader.mjs';
import { createCvApp } from './cv-app.mjs';
import { createCvSessionGuard } from './cv-session.mjs';

const lines = [
  'EDUCATION', 'Fictional Example University', 'Bachelor of Science in Computer Science',
  'Expected Graduation: 2027', 'ACADEMIC PROJECTS', 'Synthetic Inventory Portal',
  'Designed a portal using Python and SQL.', 'WORK EXPERIENCE', 'Role: Software Intern',
  'Company: Fictional Example Labs', 'Jun 2024 - Aug 2024', 'Tested synthetic records.',
  'TECHNICAL SKILLS', 'Python, SQL', 'COURSES', 'Introduction to Testing', 'CERTIFICATIONS', 'Example Credential',
];
const pdf = syntheticPdf(lines, { fontSize: 9 });
const text = await extractText({ buffer: pdf, originalname: 'synthetic-only.pdf', mimetype: 'application/pdf' });
const values = () => providerResult({
  skills: ['Python', 'SQL'].map(name => ({ name, mapped_skill_id: null, evidence: 'Python, SQL' })),
  education: [{ name: lines[2], organization: lines[1], major: 'Computer Science', dates: '2027',
    date_line_id: 'P1L4', study_status: 'Expected Graduation', evidence: lines.slice(1, 4).join('\n') }],
  projects: [{ name: lines[5], description: lines[6], technologies: ['Python', 'SQL'], evidence: lines.slice(5, 7).join('\n') }],
  experiences: [{ role: 'Software Intern', organization: 'Fictional Example Labs', dates: 'Jun 2024 - Aug 2024',
    date_line_id: 'P1L11', description: lines[11], evidence: lines.slice(8, 12).join('\n') }],
  courses: [{ name: lines[15], evidence: lines[15] }],
  certificates: [{ name: lines[17], evidence: lines[17] }],
});
function payload() {
  const value = values(), schema = geminiCvSchema();
  for (const [section, rows] of Object.entries(value)) for (const row of rows) {
    row.field_sources = schema.properties[section].items.properties.field_sources.items.properties.field.enum
      .filter(field => row[field] && (!Array.isArray(row[field]) || row[field].length))
      .map(field => ({ field, quote: field === 'technologies' ? lines[6] : row[field], page: 1 }));
  }
  return value;
}
const client = (data, capture = () => {}) => ({ models: { generateContent: async request => {
  capture(request);
  return { text: JSON.stringify(data), candidates: [{ finishReason: 'STOP' }] };
} } });
const run = data => analyzeText(text, { key: 'synthetic-only', pdf, client: client(data) });

test('active PDF analyzer uses Gemini model/schema and sends original PDF via official SDK request shape', async () => {
  assert.equal(GEMINI_CV_SECRET, 'Gemini_API_Key_masarak');
  let calls = 0;
  const result = await analyzeText(text, { key: 'synthetic-only', pdf, client: client(payload(), request => {
    calls++;
    assert.equal(request.model, 'gemini-3.8-flash');
    assert.equal(request.model, GEMINI_CV_MODEL);
    assert.deepEqual(request.config.thinkingConfig, { thinkingLevel: 'medium' });
    assert.equal(request.config.responseMimeType, 'application/json');
    assert.equal(request.config.responseJsonSchema.additionalProperties, false);
    assert.ok(request.config.responseJsonSchema.required.includes('education'));
    const part = request.contents[0].parts[0];
    assert.equal(part.inlineData.mimeType, 'application/pdf');
    assert.deepEqual(Buffer.from(part.inlineData.data, 'base64'), pdf);
    assert.ok(request.contents[0].parts[1].text.includes('[P1L'));
  }) });
  assert.equal(calls, 1);
  assert.equal(result.education[0].organization, lines[1]);
  assert.equal(result.education[0].major, 'Computer Science');
  assert.equal(result.education[0].dates, '2027');
  assert.equal(result.projects[0].name, lines[5]);
  assert.equal(result.projects[0].description, lines[6]);
  assert.equal(result.experiences[0].organization, 'Fictional Example Labs');
  assert.deepEqual(result.skills.map(row => row.name), ['Python', 'SQL']);
  assert.deepEqual(result.education[0].field_pages.organization, [1]);
  for (const section of ['skills', 'education', 'projects', 'experiences', 'courses', 'certificates'])
    for (const row of result[section]) for (const quote of Object.values(row.field_evidence))
      assert.ok(plainLayoutText(text).includes(quote));
});

test('missing or fabricated field quotes and incorrect page claims leave fields empty for review', async () => {
  for (const variation of ['missing', 'fabricated', 'wrong-page']) {
    const data = payload();
    const row = data.education[0];
    const source = row.field_sources.find(item => item.field === 'organization');
    if (variation === 'missing') row.field_sources = row.field_sources.filter(item => item !== source);
    if (variation === 'fabricated') source.quote = 'Invented University';
    if (variation === 'wrong-page') source.page = 2;
    const result = await run(data);
    assert.equal(result.education[0].organization, '');
    assert.ok(result.education[0].needs_review.includes('organization'));
    assert.equal(result.education[0].field_evidence.organization, undefined);
    assert.equal(result.education[0].field_pages?.organization, undefined);
    assert.equal(result.section_status.education, 'uncertain');
  }
});

test('a project description cannot become education or an invented project title', async () => {
  const data = payload();
  data.education.push({ ...data.education[0], name: lines[6], organization: '', evidence: lines[6] });
  data.projects[0].name = lines[6];
  data.projects[0].field_sources.find(item => item.field === 'name').quote = lines[6];
  const result = await run(data);
  assert.equal(result.education.length, 1);
  assert.equal(result.projects[0].name, '');
  assert.ok(result.projects[0].needs_review.includes('name'));
  assert.equal(result.projects[0].description, lines[6]);
});

test('missing secret, missing PDF, provider failures and truncated output fail without fallback', async () => {
  let calls = 0;
  const sdk = { models: { generateContent: async () => { calls++; throw Error('Unexpected call'); } } };
  await assert.rejects(analyzeText(text, { key: '', pdf, client: sdk }), error =>
    error.status === 503 && error.message.includes('Gemini_API_Key_masarak'));
  await assert.rejects(analyzeText(text, { key: 'synthetic-only', client: sdk }), error => error.status === 400);
  assert.equal(calls, 0);
  for (const status of [400, 401, 403, 404, 429, 500]) {
    await assert.rejects(analyzeText(text, { key: 'synthetic-only', pdf, client: {
      models: { generateContent: async () => { throw Object.assign(new Error('synthetic-sensitive-provider-body'), { status }); } },
    } }), error => error.status >= 400 && !error.message.includes('synthetic-sensitive-provider-body'));
  }
  await assert.rejects(analyzeText(text, { key: 'synthetic-only', pdf,
    client: { models: { generateContent: async () => ({ text: '{}', candidates: [{ finishReason: 'MAX_TOKENS' }] }) } } }),
  error => error.status === 502);
  const invalid = payload(); delete invalid.education[0].field_sources;
  await assert.rejects(run(invalid), error => error.status === 502);
});

test('authenticated and consented multipart forwards PDF to Gemini; invalid sessions/files never call it', async t => {
  let calls = 0;
  const app = createCvApp({
    authenticate: createCvSessionGuard({
      url: 'https://synthetic-project.supabase.co', key: 'sb_publishable_synthetic',
      fetchImpl: async () => new Response(JSON.stringify({ id: 'synthetic-owner' })),
    }),
    analyzeCvText: async (extracted, options) => {
      calls++;
      assert.deepEqual(options.pdf, pdf);
      return analyzeText(extracted, { ...options, key: 'synthetic-only', client: client(payload()) });
    },
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/analyze-cv`;
  const send = (token, consent, bytes = pdf, name = 'synthetic.pdf', mime = 'application/pdf') => {
    const body = new FormData();
    body.append('cv', new Blob([bytes], { type: mime }), name);
    if (consent) body.append('consent', 'true');
    return fetch(url, { method: 'POST', headers: token ? { Authorization: 'Bearer synthetic-session' } : {}, body });
  };
  assert.equal((await send(false, true)).status, 401);
  assert.equal((await send(true, false)).status, 400);
  assert.equal((await send(true, true, Buffer.from('not a PDF'), 'fake.pdf')).status, 400);
  assert.equal(calls, 0);
  const response = await send(true, true);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).education[0].organization, lines[1]);
  assert.equal(calls, 1);
});
