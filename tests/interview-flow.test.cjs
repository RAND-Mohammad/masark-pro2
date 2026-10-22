const test = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const projectModule = require('./helpers/project-module.cjs');
const plain = value => JSON.parse(JSON.stringify(value));
function device(remote = new Map()) {
  const disk = new Map();
  const storage = {
    getItem: async key => disk.get(key) ?? null, setItem: async (key, value) => disk.set(key, value),
    removeItem: async key => disk.delete(key),
    multiSet: async pairs => { for (const [key, value] of pairs) disk.set(key, value); },
    multiRemove: async keys => { for (const key of keys) disk.delete(key); },
  };
  const calls = [];
  const modules = projectModule({
    '@react-native-async-storage/async-storage': storage,
    'src/utils/saved-cv.ts': { loadSavedCv: async () => null, prepareSavedCvRestore: async () => ({ commit: async () => null, finish: async () => {}, rollback: async () => {} }) },
    'src/utils/cloud-files.ts': { cvBytes: async () => { throw Error('No CV in this fixture'); }, downloadCloudCv: async () => { throw Error('No CV in this fixture'); } },
    'src/utils/supabase.ts': { createAccountClient: session => {
      const owner = session.user.id;
      return {
        from: table => { assert.equal(table, 'masarak_account_data'); return { select: () => ({ eq: (key, id) => {
          assert.equal(key, 'user_id'); assert.equal(id, owner);
          return { maybeSingle: async () => ({ data: remote.get(owner) ?? null, error: null }) };
        } }) }; },
        rpc: async (name, args) => {
          assert.equal(name, 'save_masarak_account'); calls.push({ name, owner, args: plain(args) });
          const old = remote.get(owner);
          if (args.p_expected_revision !== (old?.revision ?? null)) return { data: null, error: { code: '40001' } };
          const row = { user_id: owner, revision: (old?.revision ?? 0) + 1, snapshot: plain(args.p_snapshot), updated_at: '2026-10-19T12:00:00Z' };
          remote.set(owner, row); return { data: [row], error: null };
        },
      };
    } },
  });
  const scope = modules('src/utils/scoped-storage.ts'); scope.enableCloudChangeTracking();
  return { modules, scope, calls, disk };
}
test('real authenticated HTTP interview → client validation → account history → cloud RPC adapter → fresh-device restore', async t => {
  const { createCvApp } = await import('../server/cv-app.mjs');
  const { createCvSessionGuard } = await import('../server/cv-session.mjs');
  const auth = createCvSessionGuard({ url: 'https://synthetic.supabase.co', key: 'sb_publishable_synthetic', fetchImpl: async () => new Response(JSON.stringify({ id: 'A' })) });
  const server = createServer(createCvApp({ authenticate: auth }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  const api = projectModule({
    'src/utils/scoped-storage.ts': { captureDataScope: () => ({ assertCurrent() {} }) },
    'src/utils/cv-api.ts': { serverUrl: () => 'https://app.example.test/api/cv' },
    'src/utils/supabase.ts': { supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'synthetic-session' } }, error: null }) } } },
    'expo/fetch': { fetch: async (url, options) => {
      assert.ok(url.startsWith('https://app.example.test/api/cv/interview/'));
      return fetch(base + url.slice('https://app.example.test/api/cv'.length), options);
    } },
  })('src/utils/interview-api.ts');
  const available = await api.getInterviewQuestions('C01', 'en');
  assert.equal(available.questions.length, 4);
  const result = await api.evaluateInterviewAnswer({ careerId: 'C01', questionId: 'C01-api', language: 'en', answer: 'I use validation and test each error scenario.', useAi: false, consent: false });
  assert.equal(result.mode, 'local'); assert.equal(result.score, 100);
  const remote = new Map(), first = device(remote); first.scope.setDataOwner('A');
  await first.modules('src/utils/interview-history.ts').saveInterviewResult(result);
  const runtime = first.modules('src/utils/cloud-runtime.ts').createCloudRuntime(() => ({ user: { id: 'A' }, access_token: 'synthetic-A' }), () => {});
  assert.equal(await runtime.sync('auto', true), 'synced');
  assert.equal(first.calls.length, 1); assert.equal(remote.get('A').snapshot.interviews[0].id, result.id); runtime.stop();
  const second = device(remote); second.scope.setDataOwner('A');
  const restored = second.modules('src/utils/cloud-runtime.ts').createCloudRuntime(() => ({ user: { id: 'A' }, access_token: 'synthetic-A' }), () => {});
  assert.equal(await restored.sync(), 'synced');
  assert.deepEqual(plain(await second.modules('src/utils/interview-history.ts').readInterviewHistory()), plain([result]));
  second.scope.setDataOwner('B');
  assert.equal((await second.modules('src/utils/interview-history.ts').readInterviewHistory()).length, 0);
  second.scope.setDataOwner(null);
  assert.equal((await second.modules('src/utils/interview-history.ts').readInterviewHistory()).length, 0);
  restored.stop();
});
test('switching owner while acquiring the session prevents an answer being sent under another account', async () => {
  let valid = true, calls = 0;
  const api = projectModule({
    'src/utils/scoped-storage.ts': { captureDataScope: () => ({ assertCurrent: () => { if (!valid) throw Error('Account changed'); } }) },
    'src/utils/cv-api.ts': { serverUrl: () => 'https://app.example.test/api/cv' },
    'src/utils/supabase.ts': { supabase: { auth: { getSession: async () => { valid = false; return { data: { session: { access_token: 'synthetic-B' } }, error: null }; } } } },
    'expo/fetch': { fetch: async () => { calls++; throw Error('Must not send'); } },
  })('src/utils/interview-api.ts');
  await assert.rejects(api.evaluateInterviewAnswer({ careerId: 'C01', questionId: 'C01-api', language: 'en', answer: 'A synthetic answer from account A', useAi: false, consent: false }));
  assert.equal(calls, 0);
});
test('history validation, account switching, failed writes and explicit deletion preserve isolation', async () => {
  const { evaluateInterview } = await import('../server/interview.mjs');
  const value = await evaluateInterview({ careerId: 'C01', questionId: 'C01-api', language: 'ar', answer: 'أستخدم تحقق ثم اختبار ثم معالجة خطأ.', useAi: false });
  const h = device(); const api = h.modules('src/utils/interview-history.ts');
  h.scope.setDataOwner('A');
  await api.saveInterviewResult(value);
  assert.equal(JSON.parse(h.disk.get('masarak-cloud-sync-v1:account:A')).dirty, true);
  await assert.rejects(api.saveInterviewResult({ ...value, score: 1000 }));
  assert.equal((await api.readInterviewHistory()).length, 1);
  const queued = api.saveInterviewResult({ ...value, id: 'synthetic-new' });
  h.scope.setDataOwner('B'); await assert.rejects(queued);
  assert.equal((await api.readInterviewHistory()).length, 0);
  h.scope.setDataOwner('A');
  assert.equal((await api.readInterviewHistory()).length, 1);
  await api.removeInterviewResult(value.id);
  assert.equal((await api.readInterviewHistory()).length, 0);
});
