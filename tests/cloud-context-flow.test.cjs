const test = require('node:test');
const assert = require('node:assert/strict');
const harness = require('./helpers/auth-screen-harness.cjs');

async function setup(t, session = null) {
  const runtimes = [];
  let change;
  const h = harness('src/contexts/cloud-context.tsx', { provider: 'CloudProvider', session, moduleOverrides: {
    'react-native': { AppState: { addEventListener: () => ({ remove() {} }) } },
    '../utils/scoped-storage': { enableCloudChangeTracking() {}, subscribeDataChanges(fn) { change = fn; return () => { change = null; }; } },
    '../utils/cloud-runtime': { cloudErrorMessage: () => 'offline', createCloudRuntime(getSession) {
      const runtime = { owner: getSession().user.id, calls: 0, stopped: false, fail: false,
        async sync() { this.calls++; if (this.fail) throw Error('offline'); return 'synced'; },
        async meta() { return { enabled: true, paused: false, lastSynced: '2026-10-25T00:00:00Z' }; },
        stop() { this.stopped = true; },
      };
      runtimes.push(runtime); return runtime;
    } },
  } });
  t.after(h.dispose); await h.flush();
  return { h, runtimes, edit: owner => change?.({ owner }, false) };
}
const session = id => ({ user: { id }, access_token: 'test-only' });

test('sign-in and session restoration automatically sync; guests never create a runtime', async t => {
  const { h, runtimes } = await setup(t);
  assert.equal(runtimes.length, 0);
  await h.updateAuth({ session: session('A') });
  assert.equal(runtimes[0].calls, 1);
  assert.equal(h.value().status, 'synced');
  const restored = await setup(t, session('B'));
  assert.equal(restored.runtimes[0].calls, 1);
});

test('offline changes immediately clear saved status; reconnect retry and sign-out are safe', async t => {
  const { h, runtimes, edit } = await setup(t, session('A'));
  const a = runtimes[0]; a.fail = true;
  await h.act(() => edit('A'));
  assert.equal(h.value().status, 'pending');
  await h.advance(30000);
  assert.equal(h.value().status, 'pending'); assert.equal(h.value().error, 'offline');
  a.fail = false; await h.advance(30000);
  assert.equal(h.value().status, 'synced'); assert.equal(h.value().error, '');
  await h.updateAuth({ session: session('B') });
  assert.equal(a.stopped, true); assert.equal(runtimes[1].owner, 'B');
  await h.updateAuth({ session: null });
  assert.equal(runtimes[1].stopped, true);
  const calls = runtimes[1].calls; await h.advance(30000);
  assert.equal(runtimes[1].calls, calls);
});

test('late account A completion cannot replace account B sync status', async t => {
  const { h, runtimes } = await setup(t, session('A'));
  let finish;
  runtimes[0].sync = () => new Promise(resolve => { finish = resolve; });
  const pending = h.value().synchronize();
  await h.updateAuth({ session: session('B') });
  assert.equal(h.value().status, 'synced');
  finish('conflict'); await pending; await h.flush();
  assert.equal(h.value().status, 'synced');
});
