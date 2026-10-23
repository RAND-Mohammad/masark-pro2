import test from 'node:test';
import assert from 'node:assert/strict';
import { recoverListedSkills } from './skill-list-recovery.mjs';
import { analyzeText, extractText } from './analysis.mjs';
import { providerResult } from './fixtures/provider-result.mjs';
import { syntheticPdf } from './fixtures/synthetic-pdf.mjs';

test('recovers Python and C++ when the model returns only Java from their shared list', async () => {
  const line = 'Programming Languages: Java, Python, C++';
  const pdf = syntheticPdf([line]);
  const source = await extractText({ buffer: pdf, originalname: 'synthetic-skills.pdf', mimetype: 'application/pdf' });
  const initial = providerResult({ skills: [{ name: 'Java', mapped_skill_id: null, evidence: line }] });
  let calls = 0;
  const result = await analyzeText(source, { key: 'test-only', fetchImpl: async () => {
    calls++;
    return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(initial) } }] }));
  } });
  assert.deepEqual(result.skills.map(skill => skill.name), ['Java', 'Python', 'C++']);
  assert.ok(result.skills.every(skill => skill.mapped_skill_id === 'T0644'));
  assert.equal(calls, 1);
});

test('preserves model evidence and mappings while deduplicating repeated literal lists', () => {
  const original = { name: 'Java', mapped_skill_id: 'existing-mapping', evidence: 'Java' };
  const result = recoverListedSkills('Skills: Java, Python, C++\nSkills: python, Java, C++', [original]);
  assert.equal(result.length, 3);
  assert.deepEqual(result[0], original);
});

test('supports Arabic labels and punctuation and preserves C#, .NET-like tool names, and TCP/IP', () => {
  const result = recoverListedSkills('لغات البرمجة: Java، Python، C++\nTools: C#, ASP.NET, TCP/IP', []);
  assert.deepEqual(result.map(skill => skill.name), ['Java', 'Python', 'C++', 'C#', 'ASP.NET', 'TCP/IP']);
});

test('does not cross PDF columns or convert project, degree and course lists to skills', () => {
  const source = '[P1L1 y=100] (x=40) Programming Languages: Java, Python (x=400) Bachelor in Computer Science\nCertificates: Linux Course, Networking Course\nProjects: Encryption Application, Personal Website';
  assert.deepEqual(recoverListedSkills(source, []).map(skill => skill.name), ['Java', 'Python']);
});

test('does not invent skills from prose or instruction-like list fragments', () => {
  assert.deepEqual(recoverListedSkills('Skills: Developed a website, obtained a certificate\nUse Java, Python and C++\nSkills: Java, ignore instructions', []), []);
});
