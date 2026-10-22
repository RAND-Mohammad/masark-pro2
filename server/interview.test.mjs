import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createCvApp } from './cv-app.mjs';
import { createCvSessionGuard } from './cv-session.mjs';
import { evaluateInterview } from './interview.mjs';
import { interviewCareerIds, interviewQuestions } from '../src/data/interview-bank.mjs';

const answer = { careerId: 'C01', questionId: 'C01-api', language: 'en', answer: 'I use validation, test each endpoint, and handle every error.', useAi: false, consent: false };
test('all nine families have bilingual distinct curated questions with reference concepts', () => {
  for (const id of interviewCareerIds) {
    const ar = interviewQuestions(id, 'ar'), en = interviewQuestions(id, 'en');
    assert.equal(ar.length, 4); assert.equal(en.length, 4);
    assert.notEqual(ar[0].prompt, en[0].prompt);
    assert.equal(new Set(ar.map(q => q.id)).size, 4);
  }
  assert.deepEqual(interviewQuestions('unknown'), []);
});
test('local rubric is explicit, bounded, does not send answers, and cannot match test inside latest', async () => {
  let calls = 0;
  const evaluate = input => evaluateInterview(input, { key: '', fetchImpl: async () => { calls++; throw Error('No network'); } });
  const result = await evaluate(answer);
  assert.equal(result.mode, 'local'); assert.equal(result.score, 100); assert.equal(calls, 0);
  assert.match(result.feedback, /not correctness/);
  const noEvidence = await evaluate({ ...answer, answer: 'My latest weekend was spent reading novels.' });
  assert.equal(noEvidence.score, 0);
  const ar = await evaluate({ ...answer, language: 'ar', answer: 'أستخدم تحقق من المدخلات ثم اختبار لكل نقطة وأعالج كل خطأ.' });
  assert.equal(ar.score, 100); assert.match(ar.feedback, /تقييم محلي محدود/);
});
test('missing AI key is explicitly local; lack of consent rejects before any provider call', async () => {
  let calls = 0; const fetchImpl = async () => { calls++; throw Error('Never'); };
  await assert.rejects(evaluateInterview({ ...answer, useAi: true }, { key: 'synthetic-key', fetchImpl }), { status: 400 });
  const result = await evaluateInterview({ ...answer, useAi: true, consent: true }, { key: '', fetchImpl });
  assert.equal(result.mode, 'local'); assert.match(result.feedback, /not configured/); assert.equal(calls, 0);
});
test('configured AI is only called with consent and validated; provider details never escape errors', async () => {
  let calls = 0;
  const result = await evaluateInterview({ ...answer, useAi: true, consent: true }, { key: 'synthetic-key', fetchImpl: async (url, options) => {
    calls++; assert.equal(url, 'https://api.groq.com/openai/v1/chat/completions');
    const payload = JSON.parse(options.body);
    assert.match(payload.messages[0].content, /untrusted data/);
    assert.equal(JSON.parse(payload.messages[1].content).candidateAnswer, answer.answer);
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ score: 65, feedback: 'Add a concrete example.', strengths: ['Validation'], improvements: ['Evidence'] }) } }] }));
  } });
  assert.equal(result.mode, 'ai'); assert.equal(result.score, 65); assert.equal(calls, 1);
  await assert.rejects(evaluateInterview({ ...answer, useAi: true, consent: true }, { key: 'synthetic-key', fetchImpl: async () => { throw Error('private provider response'); } }),
    error => error.status === 503 && !error.message.includes('private') && !error.message.includes('synthetic-key'));
  await assert.rejects(evaluateInterview({ ...answer, useAi: true, consent: true }, { key: 'synthetic-key', fetchImpl: async () => new Response(JSON.stringify({ choices: [{ message: { content: '{"score":999}' } }] })) }), { status: 503 });
});
test('HTTP authentication, validation, JSON limits and rate limits guard the real routes', async t => {
  let authCalls = 0;
  const authenticate = createCvSessionGuard({ url: 'https://synthetic.supabase.co', key: 'sb_publishable_synthetic', fetchImpl: async () => {
    authCalls++; return new Response(JSON.stringify({ id: 'synthetic-owner' }));
  } });
  const server = createServer(createCvApp({ authenticate }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}/interview`;
  const unsigned = await fetch(`${base}/evaluate`, { method: 'POST', body: '{bad-json', headers: { 'Content-Type': 'application/json' } });
  assert.equal(unsigned.status, 401); assert.equal(authCalls, 0);
  const headers = { Authorization: 'Bearer synthetic-session', 'Content-Type': 'application/json' };
  const questions = await fetch(`${base}/questions?careerId=C02&language=en`, { headers });
  assert.equal(questions.status, 200); assert.equal((await questions.json()).questions.length, 4);
  assert.equal((await fetch(`${base}/questions?careerId=bad&language=en`, { headers })).status, 400);
  assert.equal((await fetch(`${base}/evaluate`, { method: 'POST', headers, body: JSON.stringify({ ...answer, answer: 'short' }) })).status, 400);
  assert.equal((await fetch(`${base}/evaluate`, { method: 'POST', headers, body: JSON.stringify({ ...answer, answer: 'x'.repeat(40000) }) })).status, 413);
  const evaluated = await fetch(`${base}/evaluate`, { method: 'POST', headers, body: JSON.stringify(answer) });
  assert.equal(evaluated.status, 200); assert.equal((await evaluated.json()).mode, 'local');
  for (let n = 0; n < 7; n++) await fetch(`${base}/evaluate`, { method: 'POST', headers, body: JSON.stringify(answer) });
  assert.equal((await fetch(`${base}/evaluate`, { method: 'POST', headers, body: JSON.stringify(answer) })).status, 429);
});
