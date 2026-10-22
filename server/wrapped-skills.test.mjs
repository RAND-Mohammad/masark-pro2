import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeLocalText, analyzeLegacyGroqText as analyzeText, extractText } from './analysis.mjs';
import { recoverListedSkills } from './skill-list-recovery.mjs';
import { findSourceExcerpt } from './evidence-match.mjs';
import { plainLayoutText } from './layout-reader.mjs';
import { providerResult } from './fixtures/provider-result.mjs';
import { skillLines, expectedSkills, wrappedSkillsPdf, incompleteSkills } from './fixtures/wrapped-skills.mjs';

const names = result => result.skills.map(skill => skill.name);
const sorted = values => [...values].sort();

test('literal text and real PDF layout preserve all 15 full skills and field evidence', async () => {
  const pdfSource = await extractText({ buffer: wrappedSkillsPdf(), originalname: 'synthetic.pdf', mimetype: 'application/pdf' });
  assert.ok(pdfSource.includes('— SQLite'));
  assert.match(pdfSource, /Object-Oriented\n\[P1L4 .*Programming/u);
  for (const source of [skillLines.join('\n'), skillLines.join('\n').replaceAll('—', ':'), pdfSource]) {
    const analysis = analyzeLocalText(source);
    assert.deepEqual(names(analysis), expectedSkills);
    for (const skill of analysis.skills) assert.ok(findSourceExcerpt(plainLayoutText(source), skill.evidence));
    assert.equal(analysis.skills.find(item => item.name === 'Object-Oriented Programming').evidence, 'Object-Oriented\nProgramming');
    assert.equal(new Set(analysis.skills.filter(item => ['Python', 'Java', 'C++'].includes(item.name)).map(item => item.mapped_skill_id)).size, 1, 'shared canonical IDs must not collapse literal skill names');
  }
});

test('mocked Groq omissions, labels and fragments reconcile to the same 15 literal names', async () => {
  const source = await extractText({ buffer: wrappedSkillsPdf(), originalname: 'synthetic.pdf', mimetype: 'application/pdf' });
  let calls = 0;
  const analysis = await analyzeText(source, { key: 'synthetic-test-key', fetchImpl: async () => {
    calls++;
    return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: {
      content: JSON.stringify(providerResult({ skills: incompleteSkills(source) })),
    } }] }));
  } });
  assert.equal(calls, 1);
  assert.equal(analysis.skills.length, 15);
  assert.deepEqual(sorted(names(analysis)), sorted(expectedSkills));
  assert.ok(analysis.skills.every(item => findSourceExcerpt(plainLayoutText(source), item.evidence)));
  assert.equal(analysis.skills.find(item => item.name === 'Databases').evidence, 'Databases', 'the value is supported, not the category label');
});

test('labels are positional: colon, own-line labels, duplicate values and a real Databases concept', () => {
  const source = 'TECHNICAL SKILLS\nProgramming Languages\nPython, Java, Python\nDatabases:\nSQLite\nTools: NetBeans, Visual Studio Code\nConcepts: Databases, Algorithms, Databases';
  const result = recoverListedSkills(source, []);
  assert.deepEqual(result.map(item => item.name), ['Python', 'Java', 'SQLite', 'NetBeans', 'Visual Studio Code', 'Databases', 'Algorithms']);
  assert.deepEqual(recoverListedSkills('SKILLS\nData Structures\nLinked List, Priority Queue', []).map(item => item.name), ['Linked List', 'Priority Queue']);
  assert.deepEqual(recoverListedSkills('SKILLS\nDatabases — SQLite\nConcepts — Algorithms', [{ name: 'Databases', evidence: 'Databases' }]).map(item => item.name), ['SQLite', 'Algorithms']);
});

test('independent Programming survives; only actual wrapped-list fragments are suppressed', () => {
  assert.deepEqual(names(analyzeLocalText('SKILLS\nProgramming\nC++, C#\nGit')), ['Programming', 'C++', 'C#', 'Git']);
  assert.deepEqual(names(analyzeLocalText('SKILLS\nConcepts: Algorithms, Object-Oriented\nProgramming')), ['Algorithms', 'Object-Oriented Programming']);
  const source = 'TECHNICAL SKILLS\nConcepts: Algorithms, Test-Driven\nDevelopment, Programming, Object-Oriented\nProgramming, Programming';
  const result = recoverListedSkills(source, [{ name: 'Object-Oriented', evidence: 'Object-Oriented' }, { name: 'Programming', evidence: 'Programming' }]);
  assert.deepEqual(sorted(result.map(item => item.name)), sorted(['Algorithms', 'Test-Driven Development', 'Programming', 'Object-Oriented Programming']));
});

test('does not cross section boundaries, prose, list bullets or ambiguous PDF columns', () => {
  const source = 'SKILLS\nConcepts: Algorithms, Object-Oriented\n(x=40) Programming, SQL (x=400) Unrelated column\nEDUCATION\nDesigned a system using Python, SQL\nPROJECTS\nBuilt a website using Java, Git';
  const result = recoverListedSkills(source, []);
  assert.ok(!result.some(item => item.name === 'Object-Oriented Programming'));
  assert.ok(!result.some(item => ['Python', 'SQL', 'Java', 'Git'].includes(item.name)));
  assert.deepEqual(recoverListedSkills('PROJECTS\nDesigned a system using Python, SQL', []), []);
  assert.deepEqual(recoverListedSkills('SKILLS\nConcepts: Algorithms, Object-Oriented\n• Programming, Git', []).map(item => item.name), ['Algorithms', 'Object-Oriented', 'Programming', 'Git']);
});

test('structural category parsing is not tied to this resume vocabulary or a count of 15', () => {
  assert.deepEqual(names(analyzeLocalText('SKILLS\nLibraries — Alpha, Beta, Editors — One Editor, Two Editor')), ['Alpha', 'Beta', 'One Editor', 'Two Editor']);
  const tools = Array.from({ length: 18 }, (_, index) => `Tool ${index + 1}`);
  assert.deepEqual(names(analyzeLocalText(`SKILLS\n${tools.join(', ')}`)), tools);
});
