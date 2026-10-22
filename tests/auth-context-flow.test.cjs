const test = require('node:test');
const assert = require('node:assert/strict');
const harness = require('./helpers/auth-screen-harness.cjs');
const provider = async (t, options = {}) => {
  const h = harness('src/contexts/auth-context.tsx', { provider: true, ...options });
  t.after(h.dispose); await h.flush(); return h;
};

test('invalid cached session is cleared locally and startup continues to login without an error', async t => {
  for (const failure of [{ getUserFailure: true }, { getSessionFailure: true, signOutFailure: true }]) {
    const h = await provider(t, { session: hFixture(), ...failure });
    assert.equal(h.calls.signOut.length, 1);
    assert.equal(h.calls.signOut[0].scope, 'local');
    assert.equal(h.value().session, null);
    assert.equal(h.value().ready, true);
    assert.equal(h.value().error, '');
    assert.equal(h.owners.at(-1), null);
  }
});

function hFixture() {
  return { access_token: 'fixture-only-access', refresh_token: 'fixture-only-refresh', user: { id: 'fixture-owner', email: 'fixture@example.test' } };
}

test('PASSWORD_RECOVERY events preserve the recovery route instead of an ordinary login', async t => {
  const h = await provider(t);
  h.emit('PASSWORD_RECOVERY', h.fixture); await h.flush();
  assert.equal(h.value().recoveryPending, true);
  assert.equal(h.value().session.user.id, 'fixture-owner');
});

test('valid recovery links clean browser credentials and route to reset, not home', async t => {
  const h = await provider(t);
  await h.setLink('https://app.example.test/auth-callback#access_token=fixture&refresh_token=fixture&type=recovery');
  assert.deepEqual(h.cleanups, ['/auth-callback']);
  assert.equal(h.calls.setSession.length, 1);
  assert.equal(h.value().recoveryPending, true);
  assert.equal(h.routes.at(-1), '/reset-password');
});

test('incomplete and expired callbacks remove URL credentials even when parsing fails', async t => {
  const h = await provider(t);
  await h.setLink('https://app.example.test/auth-callback#access_token=PRIVATE_FIXTURE');
  assert.equal(h.calls.setSession.length, 0);
  assert.equal(h.cleanups.at(-1), '/auth-callback');
  assert.ok(h.value().callbackError);
  assert.equal(h.value().callbackError.includes('PRIVATE_FIXTURE'), false);
  await h.setLink('https://app.example.test/auth-callback?error_code=otp_expired');
  assert.equal(h.cleanups.length, 2);
});

test('unrelated links do not alter browser history or create a session', async t => {
  const h = await provider(t);
  await h.setLink('https://app.example.test/other?value=fixture');
  assert.equal(h.cleanups.length, 0);
  assert.equal(h.calls.setSession.length, 0);
});

test('failed callback verification does not leave recovery enabled or navigate', async t => {
  const h = await provider(t);
  h.api.setSession = async () => ({ error: { code: 'otp_expired' } });
  await h.setLink('masarak://auth-callback#access_token=fixture&refresh_token=fixture&type=recovery');
  assert.equal(h.value().recoveryPending, false);
  assert.ok(h.value().callbackError);
  assert.equal(h.routes.length, 0);
});

test('local sign-out clears the active owner without requesting global sign-out', async t => {
  const h = await provider(t);
  h.emit('SIGNED_IN', h.fixture); await h.flush();
  await h.value().signOut(); await h.flush();
  assert.equal(h.calls.signOut[0].scope, 'local');
  assert.equal(h.value().session, null);
  assert.equal(h.owners.at(-1), null);
});

test('the login screen redirects a recovery session to the password form', async t => {
  const h = harness('src/app/account.tsx');
  t.after(h.dispose); await h.flush();
  await h.updateAuth({ session: h.fixture, recoveryPending: true });
  assert.equal(h.routes.at(-1), '/reset-password');
});
