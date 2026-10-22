import test from 'node:test';
import assert from 'node:assert/strict';
import { findSourceExcerpt } from './evidence-match.mjs';
import { analyzeLegacyGroqText as analyzeText, validateAnalysis } from './analysis.mjs';
import { providerResult } from './fixtures/provider-result.mjs';
const empty = { skills: [], education: [], certificates: [], experiences: [], projects: [], activities: [] };
test('punctuation and spacing differences preserve actual quotes without semantic guessing', () => {
  assert.equal(findSourceExcerpt('Member -Demo Computing Club', 'Member – Demo Computing Club'), 'Member -Demo Computing Club');
  assert.equal(findSourceExcerpt('AES-256 encryption', 'AES 256 encryption'), 'AES-256 encryption');
  assert.equal(findSourceExcerpt('Used Linux commands', 'Managed enterprise networks'), null);
  assert.equal(findSourceExcerpt('I use C++', 'I use C'), null);
});
test('a literal project title preserves a record when a model paraphrases the evidence', () => {
  const source = '[P1L1 y=100] (x=40) Encrypted Notes Application (Python)\n[P1L2 y=115] (x=40) Built a small encryption application.';
  const value = { ...empty, projects: [{ name: 'Encrypted Notes Application (Python)', organization: '', dates: '', description: '', evidence: 'This person developed a secure application' }] };
  const result = validateAnalysis(value, source);
  assert.equal(result.projects.length, 1);
  assert.equal(result.projects[0].evidence, 'Encrypted Notes Application (Python)');
});
test('one bounded coverage check recovers projects and club activity from EXPERIENCE', async () => {
  const text = '[P1L1 y=100] (x=40) EXPERIENCE\n[P1L2 y=115] (x=40) Encrypted Notes Application (Python)\n[P1L3 y=130] (x=40) Built an encryption application.\n[P1L4 y=170] (x=40) Member -Demo Computing Club';
  let calls = 0;
  const fetchImpl = async () => {
    calls++;
    const result = calls === 1 ? empty : { ...empty,
      projects: [{ name: 'Encrypted Notes Application (Python)', organization: '', dates: '', date_line_id: '', description: '', evidence: 'Encrypted Notes Application (Python)' }],
      activities: [{ name: 'Member - Demo Computing Club', organization: 'Demo Computing Club', dates: '', date_line_id: '', description: '', evidence: 'Member - Demo Computing Club' }],
    };
    return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(providerResult(result)) } }] }));
  };
  const result = await analyzeText(text, { key: 'test-only', fetchImpl });
  assert.equal(calls, 2);
  assert.equal(result.projects.length, 1);
  assert.equal(result.activities.length, 1);
});
test('failed coverage check preserves initial results and reports uncertainty', async () => {
  let calls = 0;
  const result = await analyzeText('EXPERIENCE: Member of Demo Club', { key: 'test-only', fetchImpl: async () => ++calls === 1 ? new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(providerResult(empty)) } }] })) : new Response('{}', { status: 429 }) });
  assert.equal(calls, 2);
  assert.ok(result.warnings.length);
});
