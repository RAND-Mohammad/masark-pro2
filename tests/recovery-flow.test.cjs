const test = require('node:test');
const assert = require('node:assert/strict');
const harness = require('./helpers/auth-screen-harness.cjs');
const screen = 'src/app/reset-password.tsx';
const setup = async (t, options) => { const h = harness(screen, options); t.after(h.dispose); await h.flush(); return h; };
async function request(h) {
  await h.fill('البريد الإلكتروني', 'OWNER@EXAMPLE.TEST');
  await h.press('إرسال رسالة الاستعادة');
}

test('recovery requests a link, normalizes the email and does not force an OTP', async t => {
  const h = await setup(t); await request(h);
  assert.equal(h.calls.send.length, 1);
  assert.equal(h.calls.send[0][0], 'owner@example.test');
  assert.equal(h.calls.send[0][1].redirectTo, 'https://app.example.test/auth-callback');
  assert.equal(h.input('رمز استعادة كلمة المرور'), undefined);
  assert.equal(h.button('تأكيد الرمز'), undefined);
  assert.match(h.text(), /لا تحتاج لإدخال رمز/);
});

test('recovery resend waits sixty seconds and cannot be bypassed by double submission', async t => {
  const h = await setup(t); await request(h);
  assert.equal(h.button('طلب رسالة جديدة بعد 60 ثانية').props.disabled, true);
  await h.advance(59000);
  assert.equal(h.button('طلب رسالة جديدة بعد 1 ثانية').props.disabled, true);
  await h.advance(1000); await h.press('طلب رسالة جديدة');
  await h.press('إرسال رسالة الاستعادة');
  assert.equal(h.calls.send.length, 2);
});

test('an arriving authenticated recovery session updates the already mounted screen', async t => {
  const h = await setup(t); await request(h);
  await h.updateAuth({ session: h.fixture, recoveryPending: true });
  assert.ok(h.input('كلمة المرور الجديدة'));
  await h.fill('كلمة المرور الجديدة', 'fixture-password');
  await h.fill('تأكيد كلمة المرور الجديدة', 'fixture-password');
  await h.press('حفظ كلمة المرور');
  assert.equal(h.calls.update.length, 1);
  assert.equal(h.calls.finished, 1);
  assert.match(h.text(), /تم تحديث كلمة المرور/);
});

test('invalid or mismatching passwords never reach Supabase', async t => {
  const h = await setup(t, { session: { user: { id: 'fixture-owner' } } });
  await h.fill('كلمة المرور الجديدة', 'short');
  await h.fill('تأكيد كلمة المرور الجديدة', 'short');
  await h.press('حفظ كلمة المرور');
  await h.fill('كلمة المرور الجديدة', 'fixture-password');
  await h.press('حفظ كلمة المرور');
  assert.equal(h.calls.update.length, 0);
});

test('optional recovery OTP supports Arabic digits but requires a returned session', async t => {
  const h = await setup(t); await request(h);
  await h.press('وصلني رمز بدل رابط');
  await h.fill('رمز استعادة كلمة المرور', '١٢٣٤٥٦');
  h.api.verifyOtp = async args => { h.calls.verify.push(args); return { data: { session: null }, error: null }; };
  await h.press('تأكيد الرمز');
  assert.equal(h.calls.verify[0].token, '123456');
  assert.equal(h.calls.verify[0].type, 'recovery');
  assert.equal(h.input('كلمة المرور الجديدة'), undefined);
  assert.equal(h.calls.finished, undefined);
});

test('a revoked session removes the password form without changing any account', async t => {
  const h = await setup(t, { session: { user: { id: 'fixture-owner' } } });
  await h.fill('كلمة المرور الجديدة', 'fixture-password');
  await h.updateAuth({ session: null });
  assert.equal(h.input('كلمة المرور الجديدة'), undefined);
  assert.ok(h.input('البريد الإلكتروني'));
  assert.equal(h.calls.update.length, 0);
});

test('provider failures never show recovery success or leak their raw message', async t => {
  const h = await setup(t, { session: { user: { id: 'fixture-owner' } } });
  await h.fill('كلمة المرور الجديدة', 'fixture-password');
  await h.fill('تأكيد كلمة المرور الجديدة', 'fixture-password');
  h.api.updateUser = async () => ({ error: { code: 'session_not_found', message: 'PRIVATE_FIXTURE_TOKEN' } });
  await h.press('حفظ كلمة المرور');
  assert.doesNotMatch(h.text(), /تم تحديث كلمة المرور|PRIVATE_FIXTURE_TOKEN/);
  assert.equal(h.calls.finished, undefined);
});

test('a successful response with no updated user is not reported as success', async t => {
  const h = await setup(t, { session: { user: { id: 'fixture-owner' } } });
  await h.fill('كلمة المرور الجديدة', 'fixture-password');
  await h.fill('تأكيد كلمة المرور الجديدة', 'fixture-password');
  h.api.updateUser = async () => ({ data: { user: null }, error: null });
  await h.press('حفظ كلمة المرور');
  assert.doesNotMatch(h.text(), /تم تحديث كلمة المرور/);
});

test('concurrent recovery button calls issue one provider request', async t => {
  const h = await setup(t);
  await h.fill('البريد الإلكتروني', 'owner@example.test');
  let release; let count = 0;
  h.api.resetPasswordForEmail = async () => { count++; return new Promise(resolve => { release = resolve; }); };
  const button = h.button('إرسال رسالة الاستعادة');
  button.props.onPress(); button.props.onPress();
  assert.equal(count, 1);
  release({ error: null }); await h.flush();
});

test('optional recovery OTP succeeds only when the authenticated context receives a session', async t => {
  const h = await setup(t); await request(h);
  await h.press('وصلني رمز بدل رابط');
  await h.fill('رمز استعادة كلمة المرور', '١٢٣٤٥٦');
  await h.press('تأكيد الرمز');
  assert.equal(h.calls.verify[0].type, 'recovery');
  assert.ok(h.input('كلمة المرور الجديدة'));
});

test('a different user in the update response is never reported as a successful password change', async t => {
  const h = await setup(t, { session: { user: { id: 'fixture-owner' } } });
  await h.fill('كلمة المرور الجديدة', 'fixture-password');
  await h.fill('تأكيد كلمة المرور الجديدة', 'fixture-password');
  h.api.updateUser = async () => ({ data: { user: { id: 'other-fixture-owner' } }, error: null });
  await h.press('حفظ كلمة المرور');
  assert.doesNotMatch(h.text(), /تم تحديث كلمة المرور/);
  assert.equal(h.calls.finished, undefined);
});
