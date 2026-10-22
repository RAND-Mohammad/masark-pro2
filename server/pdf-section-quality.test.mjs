import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeLocalText, extractText } from './analysis.mjs';
import { resumePdf } from './fixtures/fr3-resumes.mjs';
import { CV_PARSER_VERSION } from '../src/utils/cv-parser-version.mjs';

const fixtures = {
  en: { heading: 'EDUCATION', projects: 'ACADEMIC PROJECTS', university: '[University Name]',
    degree: 'Bachelor of Science in Computer Science', major: 'Computer Science', date: 'Expected Graduation: 2027',
    status: 'Expected Graduation', title: 'Aircraft Runway Scheduling System',
    description: 'Designed an optimized Priority Scheduling Algorithm using Priority Queue' },
  ar: { heading: 'التعليم', projects: 'المشاريع الأكاديمية', university: 'جامعة افتراضية',
    degree: 'بكالوريوس في علوم الحاسب', major: 'علوم الحاسب', date: 'التخرج المتوقع: 2027',
    status: 'التخرج المتوقع', title: 'نظام جدولة المدرج', description: 'صممت نظاما لتحسين جدولة المهام باستخدام طابور الأولوية' },
};
for (const [language, f] of Object.entries(fixtures)) for (const layout of ['combined', 'reverse', 'stacked', 'labels']) {
  for (const projectsFirst of [false, true]) test(`PDF quality: ${language}/${layout}/${projectsFirst ? 'projects-first' : 'education-first'}`, async t => {
    const fields = layout === 'combined' ? [`${f.university}, ${f.degree}`]
      : layout === 'reverse' ? [`${f.degree}; ${f.university}`]
        : layout === 'stacked' ? [f.university, f.degree]
          : language === 'ar' ? [`الجامعة: ${f.university}`, `المؤهل: ${f.degree}`]
            : [`University: ${f.university}`, `Degree: ${f.degree}`];
    const education = [layout === 'labels' ? `${f.heading} / ${language === 'ar' ? 'Education' : 'التعليم'}` : f.heading, ...fields, f.date];
    const projects = [f.projects, f.title, `• ${f.description}`];
    const lines = projectsFirst ? [...projects, ...education] : [...education, ...projects];
    const text = await extractText({ originalname: 'synthetic-section-quality.pdf', mimetype: 'application/pdf', buffer: resumePdf(language, lines) });
    const result = analyzeLocalText(text);
    assert.equal(result.parser_version, CV_PARSER_VERSION);
    assert.equal(result.education.length, 1);
    assert.equal(result.projects.length, 1);
    const expected = [
      [result.education[0], 'organization', f.university], [result.education[0], 'name', f.degree],
      [result.education[0], 'major', f.major], [result.education[0], 'dates', '2027'],
      [result.education[0], 'study_status', f.status], [result.projects[0], 'name', f.title],
      [result.projects[0], 'description', f.description],
    ];
    for (const [entry, field, value] of expected) {
      assert.equal(entry[field], value, field);
      assert.ok(text.includes(entry.field_evidence[field]), `${field}: source quote must be literal`);
      assert.ok(entry.field_evidence[field].includes(value), `${field}: quote must support value`);
    }
    assert.deepEqual(result.skills, [], 'descriptions do not manufacture skill qualifications');
    t.diagnostic(JSON.stringify({ expectedFields: expected.length, exactFields: expected.filter(([entry, field, value]) => entry[field] === value).length, quotedFields: expected.length }));
  });
}
test('PDF quality: missing title and education facts outside Education remain unconfirmed', async () => {
  const text = await extractText({ originalname: 'synthetic-incomplete.pdf', mimetype: 'application/pdf',
    buffer: resumePdf('en', ['EDUCATION', 'ACADEMIC PROJECTS', fixtures.en.description,
      'Description: Bachelor of Science at Synthetic University']) });
  const result = analyzeLocalText(text);
  assert.deepEqual(result.education, []);
  assert.equal(result.projects[0].name, '');
  assert.ok(result.projects[0].needs_review.includes('name'));
  assert.ok(result.projects[0].description.includes(fixtures.en.description));
});
