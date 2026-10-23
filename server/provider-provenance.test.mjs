import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeGroqText as analyzeText, validateAnalysis } from './analysis.mjs';

const lines = [
  'EDUCATION',
  'University: Example University',
  'Degree: Bachelor of Science in Computer Science',
  'Expected Graduation: 2027',
  'ACADEMIC PROJECTS',
  'Aircraft Runway Scheduling System',
  'Designed an optimized Priority Scheduling Algorithm using Priority Queue',
  'Technologies: Python',
  'TECHNICAL SKILLS',
  'Python, SQL',
  'WORK EXPERIENCE',
  'Role: Data Analyst',
  'Company: Fictional Labs',
  'Jan 2021 - Mar 2022',
  'Reviewed synthetic survey records.',
  'COURSES',
  'Introduction to Testing',
  'CERTIFICATIONS',
  'Independent Network Credential',
];
const source = lines.map((line, index) => `[P1L${index + 1} y=${20 + index * 12}] (x=40) ${line}`).join('\n');
const empty = { skills: [], certificates: [], courses: [], experiences: [], education: [], projects: [], activities: [], unclassified: [] };
const education = {
  name: 'Bachelor of Science in Computer Science', organization: 'Example University',
  college: '', major: 'Computer Science', study_status: 'Expected Graduation', dates: '2027', date_line_id: 'P1L4', description: '',
  evidence: lines.slice(1, 4).join('\n'),
};
const project = {
  name: lines[5], organization: '', role: '', technologies: ['Python'], category: '', category_basis: '', category_evidence: '',
  dates: '', date_line_id: '', description: lines[6], evidence: lines.slice(5, 8).join('\n'),
};
const experience = {
  role: 'Data Analyst', organization: 'Fictional Labs', location: '', dates: 'Jan 2021 - Mar 2022',
  date_line_id: 'P1L14', description: lines[14], evidence: lines.slice(11, 15).join('\n'),
};
const response = {
  ...empty, skills: [{ name: 'Python', mapped_skill_id: null, evidence: 'Python, SQL' }],
  education: [education], projects: [project], experiences: [experience],
  courses: [{ name: lines[16], issuer: '', date: '', date_line_id: '', evidence: lines[16] }],
  certificates: [{ name: lines[18], issuer: '', date: '', date_line_id: '', evidence: lines[18] }],
};

test('mocked provider uses the detailed six-section schema and preserves associated field quotes', async () => {
  let calls = 0;
  const result = await analyzeText(source, { key: 'synthetic-test-key', fetchImpl: async (_url, options) => {
    calls++;
    const request = JSON.parse(options.body);
    const schema = request.response_format.json_schema;
    assert.equal(schema.strict, true);
    for (const section of ['skills', 'projects', 'courses', 'certificates', 'education', 'experiences']) {
      assert.ok(schema.schema.required.includes(section));
      assert.equal(schema.schema.properties[section].items.additionalProperties, false);
    }
    for (const [section, fields] of [
      ['education', ['name', 'organization', 'college', 'major', 'study_status', 'dates', 'evidence']],
      ['projects', ['name', 'description', 'role', 'technologies', 'category', 'category_basis', 'category_evidence', 'evidence']],
      ['experiences', ['role', 'organization', 'location', 'description', 'dates', 'evidence']],
    ]) for (const field of fields) assert.ok(schema.schema.properties[section].items.required.includes(field));
    return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(response) } }] }));
  } });
  assert.equal(calls, 1);
  for (const section of ['education', 'projects', 'courses', 'certificates', 'experiences']) assert.equal(result[section].length, 1, section);
  assert.equal(result.education[0].dates, '2027');
  assert.equal(result.education[0].field_evidence.organization, 'Example University');
  assert.equal(result.education[0].field_evidence.major, 'Computer Science');
  assert.equal(result.projects[0].name, lines[5]);
  assert.equal(result.projects[0].description, lines[6]);
  assert.equal(result.projects[0].field_evidence.description, lines[6]);
  assert.equal(result.experiences[0].field_evidence.organization, 'Fictional Labs');
  assert.equal(result.courses[0].field_evidence.name, lines[16]);
  assert.equal(result.certificates[0].field_evidence.name, lines[18]);
  for (const section of ['education', 'projects', 'courses', 'certificates', 'experiences']) {
    for (const quote of Object.values(result[section][0].field_evidence)) {
      assert.ok(quote && lines.join('\n').includes(quote), `${section}: a field must quote readable source text, not layout metadata`);
    }
  }
});

test('provider fields cannot borrow from another section or another record quote', () => {
  const result = validateAnalysis({
    ...response,
    skills: [...response.skills, { name: 'Computer Science', mapped_skill_id: 'T0644', evidence: lines[2] }],
    education: [...response.education, { ...education, name: project.name, organization: 'Fictional Labs', evidence: project.evidence }],
    projects: [
      { ...project, organization: 'Invented Employer', role: 'Invented Lead', technologies: ['Python', 'InventedTool'] },
      { ...project, name: education.name, evidence: education.evidence },
    ],
  }, source);
  assert.deepEqual(result.skills.map(item => item.name).sort(), ['Python', 'SQL']);
  assert.equal(result.education.length, 1);
  assert.equal(result.projects.length, 1);
  assert.equal(result.projects[0].organization, '');
  assert.equal(result.projects[0].role, '');
  assert.deepEqual(result.projects[0].technologies, ['Python']);
  assert.equal(result.projects[0].field_evidence.organization, undefined);
  assert.ok(result.warnings.some(warning => /استُبعدت/.test(warning)));
});

test('provider descriptive project titles remain descriptions requiring review, not invented names', () => {
  const result = validateAnalysis({ ...empty, projects: [{ ...project, name: lines[6], description: '' }] }, source);
  assert.equal(result.projects.length, 1);
  assert.equal(result.projects[0].name, '');
  assert.equal(result.projects[0].description, lines[6]);
  assert.ok(result.projects[0].needs_review.includes('name'));
  assert.equal(result.section_status.projects, 'uncertain');
});

test('explicit project technologies separated by prose retain the associated record quote', () => {
  const description = 'Designed a frontend using React and stored synthetic records in PostgreSQL.';
  const projectSource = `PROJECTS\nFictional Record Portal\n${description}`;
  const result = validateAnalysis({ ...empty, projects: [{
    ...project, name: 'Fictional Record Portal', description, technologies: ['React', 'PostgreSQL', 'InventedTool'],
    evidence: `Fictional Record Portal\n${description}`,
  }] }, projectSource);
  assert.deepEqual(result.projects[0].technologies, ['React', 'PostgreSQL']);
  assert.ok(result.projects[0].field_evidence.technologies.includes('React'));
  assert.ok(result.projects[0].field_evidence.technologies.includes('PostgreSQL'));
});

test('provider rejects malformed detailed fields and cannot merge an ambiguous PDF row', () => {
  assert.throws(() => validateAnalysis({ ...response, projects: [{ ...project, technologies: [7] }] }, source), /تقنيات/);
  const ambiguous = [
    '[P1L1 y=20] (x=40) EDUCATION',
    '[P1L2 y=32] (x=40) Bachelor of Science in Computer Science | (x=400) Example University',
  ].join('\n');
  const result = validateAnalysis({ ...empty, education: [{ ...education, evidence: 'Bachelor of Science in Computer Science Example University' }] }, ambiguous);
  assert.deepEqual(result.education, []);
});

test('mocked provider rejects omitted sections, missing detailed fields and extra properties before acceptance', async () => {
  const omittedSection = { ...response };
  delete omittedSection.courses;
  const missingDetail = { ...response, projects: response.projects.map(({ technologies: _technologies, ...row }) => row) };
  for (const invalid of [omittedSection, missingDetail, { ...response, guessed_age: 22 }]) {
    let calls = 0;
    await assert.rejects(analyzeText(source, { key: 'synthetic-test-key', fetchImpl: async () => {
      calls++;
      return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(invalid) } }] }));
    } }), error => error.status === 502 && /المخطط/.test(error.message));
    assert.equal(calls, 1, 'invalid transport output cannot trigger another provider request');
  }
});
