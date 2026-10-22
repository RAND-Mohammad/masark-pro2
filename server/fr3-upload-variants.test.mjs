import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createCvApp } from './cv-app.mjs';
import { createCvSessionGuard } from './cv-session.mjs';
import { analyzeLocalText } from './analysis.mjs';
import { resumePdf } from './fixtures/fr3-resumes.mjs';

async function upload(t, lines) {
  const app = createCvApp({
    authenticate: createCvSessionGuard({
      url: 'https://synthetic-project.supabase.co', key: 'sb_publishable_test-only',
      fetchImpl: async (_url, options) => {
        assert.equal(options.headers.Authorization, 'Bearer synthetic-session');
        return new Response(JSON.stringify({ id: 'synthetic-owner' }));
      },
    }),
    analyzeCvText: text => analyzeLocalText(text),
  });
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const form = new FormData();
  form.append('cv', new Blob([resumePdf('en', lines)], { type: 'application/pdf' }), 'synthetic.pdf');
  form.append('consent', 'true');
  const result = await fetch(`http://127.0.0.1:${server.address().port}/analyze-cv`, {
    method: 'POST', headers: { Authorization: 'Bearer synthetic-session' }, body: form,
  });
  assert.equal(result.status, 200);
  return result.json();
}

test('authenticated PDF upload: student without experience, natural education and multi-line project description', async t => {
  const result = await upload(t, [
    'EDUCATION', '[University Name], Bachelor of Science in Computer Science', 'Expected Graduation: 2027',
    'ACADEMIC PROJECTS', 'Aircraft Runway Scheduling System',
    '• Designed an optimized Priority Scheduling Algorithm using Priority Queue',
    '• Implemented a simulation using Python',
    'TECHNICAL SKILLS', 'Python, SQL',
    'COURSES', 'Introduction to Networks',
  ]);
  assert.equal(result.education[0].organization, '[University Name]');
  assert.equal(result.education[0].major, 'Computer Science');
  assert.equal(result.education[0].dates, '2027');
  assert.equal(result.projects[0].name, 'Aircraft Runway Scheduling System');
  assert.match(result.projects[0].description, /Designed[\s\S]*Implemented/);
  assert.equal(result.experiences.length, 0);
  assert.equal(result.certificates.length, 0);
  assert.equal(result.courses.length, 1);
  assert.deepEqual(result.skills.map(item => item.name), ['Python', 'SQL']);
  assert.ok(result.warnings.some(warning => /محلي محدود/.test(warning)));
});

test('authenticated PDF upload: natural employment, reordered sections, duplicate skills and non-skill names', async t => {
  const result = await upload(t, [
    'WORK EXPERIENCE', 'Data Analyst at Fictional Labs, Jan 2021 - Mar 2022',
    '• Reviewed synthetic survey records.',
    'TECHNICAL SKILLS', 'Python, Python, Linux OS, Fictional University, Bachelor of Science, Demo Project',
    'EDUCATION', 'Bachelor of Science in Computer Science', 'Example University',
  ]);
  assert.equal(result.experiences.length, 1);
  assert.equal(result.experiences[0].role, 'Data Analyst');
  assert.equal(result.experiences[0].organization, 'Fictional Labs');
  assert.equal(result.experiences[0].dates, 'Jan 2021 - Mar 2022');
  assert.match(result.experiences[0].description, /Reviewed synthetic/);
  assert.equal(result.education[0].organization, 'Example University');
  assert.deepEqual(result.skills.map(item => item.name), ['Python', 'Linux OS']);
});

test('authenticated PDF upload: ambiguous qualifications stay unresolved and never become counted credentials or skills', async t => {
  const result = await upload(t, [
    'COURSES AND CERTIFICATIONS', 'Introduction to Networks', 'Provider: Fictional Academy',
    'ACADEMIC PROJECTS', 'Designed an optimized Priority Scheduling Algorithm using Priority Queue',
    'EDUCATION', 'Example University', 'Bachelor of Science in Computer Science',
    'SKILLS', 'Python',
  ]);
  assert.equal(result.courses.length, 0);
  assert.equal(result.certificates.length, 0);
  assert.equal(result.unclassified.length, 1);
  assert.equal(result.projects[0].name, '');
  assert.ok(result.projects[0].needs_review.includes('name'));
  assert.deepEqual(result.skills.map(item => item.name), ['Python']);
  assert.equal(result.education[0].organization, 'Example University');
});
