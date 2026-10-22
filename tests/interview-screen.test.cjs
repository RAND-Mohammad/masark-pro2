const test = require('node:test');
const assert = require('node:assert/strict');
const screen = require('./helpers/auth-screen-harness.cjs');
const { interviewQuestions } = require('../src/data/interview-bank.mjs');
const text = node => Array.isArray(node) ? node.map(text).join('') : node && typeof node === 'object' ? text(node.props?.children) : typeof node === 'string' || typeof node === 'number' ? String(node) : '';
function fixture(signedIn) {
  const submissions = [], removals = [];
  const result = { id: 'synthetic-result', careerId: 'C01', questionId: 'C01-api', question: interviewQuestions('C01', 'en')[0].prompt,
    answer: 'I use validation, test each endpoint and handle every error.', language: 'en', score: 100, mode: 'local',
    feedback: 'Limited local rubric, not correctness or hiring readiness.', strengths: ['validation'], improvements: [], createdAt: '2026-10-19T12:00:00Z' };
  const state = { history: [], result: null, aiConfigured: false, loading: false, busy: false, error: '', signedIn,
    submit: async (...args) => submissions.push(args), remove: async id => removals.push(id) };
  const h = screen('src/app/interview.tsx', { moduleOverrides: {
    '../hooks/use-interview': { useInterview: (careerId, language) => ({ ...state, questions: interviewQuestions(careerId, language) }) },
    '../hooks/use-personal-profile': { usePersonalProfile: () => ({ ready: true, personal: null, error: '' }) },
    '../components/cloud-card': { CloudCard: () => null },
  } });
  return { h, state, result, submissions, removals };
}
test('guest preview is real bilingual curated content, sign-in gates evaluation, and input direction changes', async () => {
  const { h } = fixture(false); await h.flush();
  assert.match(h.text(), /ليست من بنك مقابلات شركة/);
  await h.fill('إجابتك', 'هذه إجابة تجريبية طويلة بما يكفي.');
  assert.equal(h.button('قيّم إجابتي محليًا').props.disabled, true);
  await h.press('تسجيل الدخول أو إنشاء حساب');
  assert.equal(h.routes.at(-1).pathname, '/account');
  await h.press('English');
  assert.match(h.text(), /not a company interview bank/);
  assert.equal(h.input('Your answer').props.value, '');
  assert.ok(JSON.stringify(h.input('Your answer').props.style).includes('"writingDirection":"ltr"'));
  h.dispose();
});
test('real screen handlers submit local-only, prevent stale feedback, clear a changed question and confirm history deletion', async () => {
  const { h, state, result, submissions, removals } = fixture(true);
  await h.flush(); await h.press('English');
  await h.fill('Your answer', result.answer);
  await h.press('Evaluate locally');
  assert.deepEqual(Array.from(submissions[0]), ['C01-api', result.answer, false, false]);
  await h.act(() => { state.result = result; state.history = [result]; });
  assert.match(h.text(), /Limited local rubric/);
  const next = interviewQuestions('C01', 'en')[1];
  await h.act(nodes => nodes.find(n => n.type === 'Pressable' && n.props.accessibilityState?.selected === false && JSON.stringify(n.props.children).includes(next.prompt)).props.onPress());
  assert.equal(h.input('Your answer').props.value, '');
  assert.equal(h.text().includes(result.feedback), false);
  await h.act(nodes => nodes.find(n => n.type === 'Pressable' && text(n).includes('100/100')).props.onPress());
  await h.press('Delete this result');
  assert.equal(removals.length, 0);
  assert.match(h.text(), /Permanently remove/);
  await h.press('Confirm delete');
  assert.deepEqual(removals, [result.id]);
  h.dispose();
});
