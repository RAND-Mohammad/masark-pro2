import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeLocalText, extractText } from './analysis.mjs';
import { resumePdf } from './fixtures/fr3-resumes.mjs';
const analyze = source => analyzeLocalText(source);
const description = 'Designed an optimized Priority Schedule';
const combinedExample = [
  'EDUCATION',
  '[University Name], Bachelor of Science in Computer Science',
  'Expected Graduation: 2027',
  'ACADEMIC PROJECTS',
  'Aircraft Runway Scheduling System',
  '• Designed an optimized Priority Scheduling Algorithm using Priority Queue',
];
function verifyQuotes(result, source) {
  for (const section of ['education', 'projects']) for (const entry of result[section]) {
    for (const [field, quote] of Object.entries(entry.field_evidence)) {
      assert.ok(source.includes(quote), `${field} quote must be literal`);
      const value = entry[field];
      if (typeof value === 'string') assert.ok(value.split('\n').every(part => quote.includes(part)), `${field} must be supported by its own quote`);
    }
  }
}
test('reported descriptive phrase is preserved as description, never invented project title, while university-first Education is extracted', async () => {
  const source = ['Graduation Project', description, 'Education', 'Fictional University', 'Bachelor of Science in Computer Science', 'Technical Skills', 'Python, SQL'].join('\n');
  const result = await analyze(source);
  assert.equal(result.projects.length, 1);
  assert.equal(result.projects[0].name, '');
  assert.equal(result.projects[0].description, description);
  assert.ok(result.projects[0].needs_review.includes('name'));
  assert.equal(result.education[0].organization, 'Fictional University');
  assert.equal(result.education[0].name, 'Bachelor of Science in Computer Science');
  assert.equal(result.education[0].major, 'Computer Science');
  assert.deepEqual(result.skills.map(item => item.name), ['Python', 'SQL']);
  verifyQuotes(result, source);
});
test('real synthetic PDF follows the local upload/extraction path for the reported layout', async () => {
  const source = await extractText({ originalname: 'fictional-regression.pdf', mimetype: 'application/pdf', buffer: resumePdf('en', [
    'Synthetic data only', 'Education', 'Sample University', 'Bachelor of Science in Computer Science',
    'Graduation Project', 'Priority Scheduler', description, 'Technical Skills', 'Python, SQL',
  ]) });
  const result = await analyze(source);
  assert.equal(result.education[0].organization, 'Sample University');
  assert.equal(result.education[0].major, 'Computer Science');
  assert.equal(result.projects[0].name, 'Priority Scheduler');
  assert.equal(result.projects[0].description, description);
  assert.equal(result.projects.length, 1);
});
for (const language of ['ar', 'en']) for (const reversed of [false, true]) {
  test(`${language} headings, explicit field evidence and ${reversed ? 'project-first' : 'education-first'} section order`, async () => {
    const education = language === 'ar' ? ['التعليم والمؤهلات العلمية:', 'جامعة افتراضية', 'بكالوريوس في علوم الحاسب', 'الكلية: كلية الحوسبة']
      : ['EDUCATION & QUALIFICATIONS:', 'Example University', 'B.Sc. in Computer Science', 'College: College of Computing'];
    const projects = language === 'ar' ? ['مشاريع التخرج:', 'اسم المشروع: نظام الجدولة', 'صممت نظاما لتحسين جدولة المهام']
      : ['ACADEMIC PROJECTS:', 'Project title: Scheduling System', description];
    const source = [...(reversed ? projects : education), ...(reversed ? education : projects)].join('\n');
    const result = await analyze(source);
    assert.equal(result.education.length, 1); assert.equal(result.projects.length, 1);
    assert.equal(result.education[0].organization, language === 'ar' ? 'جامعة افتراضية' : 'Example University');
    assert.equal(result.education[0].major, language === 'ar' ? 'علوم الحاسب' : 'Computer Science');
    assert.equal(result.projects[0].name, language === 'ar' ? 'نظام الجدولة' : 'Scheduling System');
    assert.ok(result.projects[0].description);
    verifyQuotes(result, source);
  });
}
test('education fields never originate from project or employment descriptions and a descriptive labeled project name remains unnamed', async () => {
  const source = ['Projects:', 'Project: ' + description, 'Description: Studied at Pretend University for a Bachelor of Computing',
    'Degree: Bachelor of Invention', 'Experience:', 'Role: Software Intern', 'Description: Built tools for Other University',
    'Education:', 'Major: Computer Science'].join('\n');
  const result = await analyze(source);
  assert.ok(result.projects.every(item => item.name === ''));
  assert.equal(result.education.length, 1);
  assert.equal(result.education[0].name, '');
  assert.equal(result.education[0].organization, '');
  assert.equal(result.education[0].major, 'Computer Science');
  assert.ok(result.education[0].needs_review.includes('name'));
  assert.ok(result.education[0].needs_review.includes('organization'));
  assert.equal(result.projects[0].description.includes(description), true);
  verifyQuotes(result, source);
});
test('split field labels and bilingual section headings preserve literal degree, university and major', async () => {
  const source = ['Education / التعليم:', 'University:', 'Demo University', 'Degree:', 'Bachelor of Science', 'Major:', 'Computer Science',
    'Projects / المشاريع:', 'Project: Explicit Title', description].join('\n');
  const result = await analyze(source);
  assert.equal(result.education[0].organization, 'Demo University');
  assert.equal(result.education[0].name, 'Bachelor of Science');
  assert.equal(result.education[0].major, 'Computer Science');
  assert.equal(result.projects[0].name, 'Explicit Title');
  verifyQuotes(result, source);
});
test('ambiguous rows quarantine association until a clear heading instead of borrowing a different column', async () => {
  const source = ['Education:', 'Degree: Bachelor of Science',
    '[P1L3 y=100] (x=20) University: Wrong University | (x=400) Project: Wrong Project',
    'Major: Must not attach', 'University: Must not attach',
    'Projects:', 'Project: Safe Project', description].join('\n');
  const result = await analyze(source);
  assert.equal(result.education.length, 1);
  assert.equal(result.education[0].organization, '');
  assert.equal(result.education[0].major, undefined);
  assert.equal(result.projects.length, 1);
  assert.equal(result.projects[0].name, 'Safe Project');
  assert.equal(result.section_status.education, 'uncertain');
});
test('unknown university and degree remain blank, lengthy prose is not a title, no implicit skills are manufactured', async () => {
  const source = ['Graduation Project:', 'This project was a collaborative system where a fictional team explored many ideas and learned about algorithms without stating any confirmed project title',
    'Education:', 'University: Demo University', 'Projects:', 'Project: Another Example', 'Description: Used Python for a fictional experiment.'].join('\n');
  const result = await analyze(source);
  assert.equal(result.projects[0].name, '');
  assert.equal(result.education[0].name, '');
  assert.equal(result.education[0].major, undefined);
  assert.deepEqual(result.skills, []);
});
test('project field labels outside Projects cannot create records or lend later fields to Education', async () => {
  for (const label of ['Project: Synthetic Outside Title', 'اسم المشروع: عنوان خارج القسم']) {
    const source = ['Courses:', label, 'University: Must Not Attach',
      'Education:', 'Degree: Bachelor of Science', label, 'University: Wrong Association',
      'Projects:', 'Project: Genuine Title', description,
      'Education:', 'University: Real Synthetic University', 'Degree: Bachelor of Science in Computer Science'].join('\n');
    const result = await analyze(source);
    assert.deepEqual(result.projects.map(row => row.name), ['Genuine Title']);
    assert.equal(result.education.length, 2);
    assert.equal(result.education[0].organization, '');
    assert.equal(result.education[1].organization, 'Real Synthetic University');
    assert.equal(result.education[1].major, 'Computer Science');
    verifyQuotes(result, source);
  }
});
test('narrative descriptions mentioning universities cannot become an educational institution', async () => {
  for (const narrative of ['Graduation project at Synthetic University', 'Studied scheduling for a project at Synthetic University',
    'مشروع تخرج في جامعة افتراضية', 'تدريب في جامعة افتراضية']) {
    const result = await analyze(`Education:\n${narrative}`);
    assert.deepEqual(result.education, []);
    assert.equal(result.section_status.education, 'uncertain');
    const labeled = await analyze(`Education:\nDegree: Bachelor of Science\nUniversity: ${narrative}`);
    assert.equal(labeled.education[0].organization, '');
    assert.ok(labeled.education[0].needs_review.includes('organization'));
  }
});
test('a prefixed action sentence is still a description, never a title reconstructed from its prefix', async () => {
  for (const sentence of ['Graduation work - Designed an optimized Priority Schedule', 'Scheduling work: Designed an optimized Priority Schedule',
    'عمل التخرج — صممت نظاما لتحسين جدولة المهام']) {
    const result = await analyze(`Projects:\n${sentence}\nEducation:\nDemo University\nBachelor of Science in Computer Science`);
    assert.equal(result.projects.length, 1);
    assert.equal(result.projects[0].name, '');
    assert.equal(result.projects[0].description, sentence);
    assert.equal(result.projects[0].field_evidence.description, sentence);
    assert.ok(result.projects[0].needs_review.includes('name'));
    assert.equal(result.education[0].organization, 'Demo University');
    verifyQuotes(result, `Projects:\n${sentence}\nEducation:\nDemo University\nBachelor of Science in Computer Science`);
  }
});
for (const format of ['text', 'pdf']) test(`the exact deidentified example separates institution, degree and expected graduation in ${format}`, async () => {
  const source = format === 'pdf'
    ? await extractText({ originalname: 'synthetic-combined-education.pdf', mimetype: 'application/pdf', buffer: resumePdf('en', combinedExample) })
    : combinedExample.join('\n');
  const result = await analyze(source);
  assert.equal(result.education.length, 1);
  const education = result.education[0];
  assert.equal(education.organization, '[University Name]');
  assert.equal(education.name, 'Bachelor of Science in Computer Science');
  assert.equal(education.major, 'Computer Science');
  assert.equal(education.dates, '2027');
  assert.equal(education.study_status, 'Expected Graduation');
  assert.deepEqual(education.needs_review, []);
  for (const field of ['organization', 'name', 'major']) assert.equal(education.field_evidence[field], combinedExample[1]);
  assert.equal(education.field_evidence.dates, 'Expected Graduation: 2027');
  assert.equal(education.field_evidence.study_status, 'Expected Graduation: 2027');
  assert.equal(result.projects.length, 1);
  assert.equal(result.projects[0].name, 'Aircraft Runway Scheduling System');
  assert.equal(result.projects[0].description, 'Designed an optimized Priority Scheduling Algorithm using Priority Queue');
  assert.equal(result.projects[0].field_evidence.name, 'Aircraft Runway Scheduling System');
  assert.match(result.projects[0].field_evidence.description, /Designed an optimized Priority Scheduling Algorithm using Priority Queue/u);
  assert.deepEqual(result.skills, [], 'algorithm prose does not create implicit skills');
  verifyQuotes(result, source);
});
test('combined academic facts support Arabic delimiters and reverse order without crossing sections or ambiguous cells', async () => {
  for (const line of ['جامعة افتراضية، بكالوريوس في علوم الحاسب', 'Bachelor of Science in Computer Science; Demo University']) {
    const result = await analyze(`Education\n${line}\nExpected Graduation: 2027`);
    assert.equal(result.education.length, 1);
    assert.ok(!result.education[0].organization.includes('Bachelor'));
    assert.ok(result.education[0].name.startsWith(line.includes('بكالوريوس') ? 'بكالوريوس' : 'Bachelor'));
    verifyQuotes(result, `Education\n${line}\nExpected Graduation: 2027`);
  }
  const outside = await analyze(`Projects\n${combinedExample[1]}\nDescription: Fictional details`);
  assert.deepEqual(outside.education, []);
  for (const row of [
    'Demo University, Bachelor of Science, Other University',
    '[P1L2 y=100] (x=20) Demo University | (x=400) Bachelor of Science in Computer Science',
  ]) {
    const ambiguous = await analyze(`Education\n${row}\nExpected Graduation: 2027`);
    assert.deepEqual(ambiguous.education, []);
    assert.equal(ambiguous.section_status.education, 'uncertain');
  }
});
