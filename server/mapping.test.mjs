import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createSkillMatcher } from '../src/utils/skill-matching.mjs';
import { analyzeText, validateAnalysis } from './analysis.mjs';
import { providerResult } from './fixtures/provider-result.mjs';
const data = JSON.parse(readFileSync(new URL('../src/masarak_dataset.json', import.meta.url)));
const match = createSkillMatcher(data);
const empty = { skills: [], certificates: [], education: [], experiences: [], activities: [], projects: [] };

test('Arabic and English aliases preserve programming language symbols and share one competency', () => {
  for (const name of ['Python', 'Java', 'C++', 'C#', 'بايثون', 'البرمجة']) assert.equal(match(name), 'T0644');
  assert.equal(match(' C++ '), 'T0644');
});
test('Linux, Bash and encryption map to their actual foundations rather than network management or IAM', () => {
  assert.equal(match('Linux OS'), 'T0153');
  assert.equal(match('Command line'), 'T0710');
  assert.equal(match('AES-256 encryption'), 'T0179');
  assert.equal(match('CTF'), null);
  assert.equal(match('NDG Linux Essentials'), null);
  assert.equal(match('Python certificate'), null);
  assert.equal(match('Python expert at managing enterprise networks'), null);
});
test('all canonical skills are recognized even when they are outside the role subsets', () => {
  for (const skill of data.skills) assert.equal(match(skill.name), skill.skill_id);
});
test('an ambiguous alias is never silently assigned', () => {
  const small = { skills: [{ skill_id: 'A', name: 'One' }, { skill_id: 'B', name: 'Two' }], skill_aliases: [{ alias: 'tool', skill_id: 'A' }, { alias: 'tool', skill_id: 'B' }] };
  assert.equal(createSkillMatcher(small)('tool'), null);
});
test('analysis repairs missing and contradictory literal mappings but retains separate CV entries', async () => {
  const source = 'Programming Languages: Java, Python, C++\nTools: Linux OS, Command line';
  const result = await analyzeText(source, { key: 'test-only', fetchImpl: async () => new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(providerResult({ ...empty, skills: [{ name: 'Java', evidence: 'Programming Languages: Java, Python, C++', mapped_skill_id: null }, { name: 'Linux OS', evidence: 'Tools: Linux OS, Command line', mapped_skill_id: 'T0543' }] })) } }] })) });
  assert.equal(result.skills.length, 5);
  assert.equal(result.skills.find(skill => skill.name === 'Linux OS').mapped_skill_id, 'T0153');
  assert.equal(result.skills.find(skill => skill.name === 'Python').mapped_skill_id, 'T0644');
});
test('a known name without source evidence is still rejected', () => {
  const result = validateAnalysis({ ...empty, skills: [{ name: 'Python', evidence: 'Python', mapped_skill_id: 'T0644' }] }, 'Skills: Java');
  assert.deepEqual(result.skills.map(skill => skill.name), ['Java'], 'recover only the literal skill, never the unsupported model name');
});
test('data references resolve and aliases do not produce extra counted core requirements', () => {
  const ids = new Set(data.skills.map(s => s.skill_id));
  for (const row of data.career_skills) assert.ok(ids.has(row.skill_id));
  for (const role of data.careers) {
    const core = data.career_skills.filter(row => row.career_id === role.career_id && row.priority === 'core');
    assert.ok(core.length >= 6 && core.length <= 8);
    assert.equal(new Set(core.map(row => row.skill_id)).size, core.length);
  }
  assert.equal(new Set(['Java', 'Python', 'C++'].map(match)).size, 1);
});

test('a known name attached to another skill quote cannot produce a counted mapping', () => {
  const result = validateAnalysis({ ...empty, skills: [{ name: 'Python', evidence: 'Linux', mapped_skill_id: 'T0644' }] }, 'Linux');
  assert.deepEqual(result.skills, []);
});

test('an unreviewed semantic guess is kept as an unmapped skill instead of inflating core coverage', () => {
  const result = validateAnalysis({ ...empty, skills: [{ name: 'CTF', evidence: 'CTF', mapped_skill_id: 'T0198' }] }, 'CTF');
  assert.equal(result.skills[0].mapped_skill_id, null);
});
