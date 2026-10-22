const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src/utils/signup-confirmation.ts'), 'utf8');
const exportsObject = {};
vm.runInNewContext(ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: exportsObject });
const { normalizeSignupCode, signupCodeIsValid, signupResendSeconds, confirmSignupEmail } = exportsObject;

test('signup confirmation accepts exactly six digits, preserving leading zeroes', () => {
  for (const value of ['123456', '000001', '٠١٢٣٤٥', '۰۱۲۳۴۵', ' 123456 ']) {
    assert.equal(signupCodeIsValid(value), true);
  }
  for (const value of ['', '12345', '1234567', '1234567890', '12345a', '-12345', '123.45']) {
    assert.equal(signupCodeIsValid(value), false);
  }
  assert.equal(normalizeSignupCode('٠١٢٣٤٥'), '012345');
  assert.equal(normalizeSignupCode('۰۱۲۳۴۵'), '012345');
});

test('incomplete or invalid codes never reach Supabase', async () => {
  let calls = 0;
  const client = { verifyOtp: async () => { calls++; } };
  await assert.rejects(confirmSignupEmail(client, 'user@example.com', '12345'));
  await assert.rejects(confirmSignupEmail(client, 'user@example.com', '1234567'));
  assert.equal(calls, 0);
});

test('verification uses the signup email, normalized code and email verification type', async () => {
  let received;
  const session = { user: { id: 'fixture-user' } };
  const client = { verifyOtp: async options => { received = options; return { error: null, data: { session } }; } };
  assert.equal(await confirmSignupEmail(client, ' USER@Example.com ', '٠١٢٣٤٥'), session);
  assert.deepEqual(JSON.parse(JSON.stringify(received)), { email: 'user@example.com', token: '012345', type: 'email' });
});

test('invalid, expired, reused and rate-limited codes do not complete login', async () => {
  for (const code of ['otp_expired', 'over_request_rate_limit']) {
    const failure = { code };
    const client = { verifyOtp: async () => ({ error: failure, data: { session: null } }) };
    await assert.rejects(confirmSignupEmail(client, 'user@example.com', '123456'), error => error === failure);
  }
  await assert.rejects(confirmSignupEmail({ verifyOtp: async () => { throw new Error('Network unavailable'); } }, 'user@example.com', '123456'));
  await assert.rejects(confirmSignupEmail({ verifyOtp: async () => ({ error: null, data: { session: null } }) }, 'user@example.com', '123456'));
});

test('resend cooldown follows elapsed time rather than timer ticks', () => {
  assert.equal(signupResendSeconds(60000, 0), 60);
  assert.equal(signupResendSeconds(60000, 59001), 1);
  assert.equal(signupResendSeconds(60000, 60000), 0);
  assert.equal(signupResendSeconds(60000, 120000), 0);
});

test('signup email template contains an OTP and no confirmation link', () => {
  const template = fs.readFileSync(path.join(root, 'docs/confirm-email.html'), 'utf8');
  assert.match(template, /\{\{\s*\.Token\s*\}\}/);
  assert.doesNotMatch(template, /ConfirmationURL|TokenHash/);
});
