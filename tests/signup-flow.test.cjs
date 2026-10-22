const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const compile = file => ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const screenCode = compile('src/app/account.tsx');
const utilityCode = Object.fromEntries(['signup-confirmation', 'auth-errors'].map(name => [name, compile(`src/utils/${name}.ts`)]));

// Exercise the real screen handlers with isolated hooks and a fake Supabase.
// These tests never request actual emails or expose a route that bypasses signup.
function harness(mode = 'signup') {
  const slots = []; let cursor = 0; let clock = 100000; let tree; let completed = 0;
  const calls = { signup: [], verify: [], resend: [], login: [] };
  const api = {
    signUp: async options => { calls.signup.push(options); return { error: null, data: { session: null } }; },
    verifyOtp: async options => { calls.verify.push(options); return { error: null, data: { session: { user: { id: 'fixture-user' } } } }; },
    resend: async options => { calls.resend.push(options); return { error: null }; },
    signInWithPassword: async options => { calls.login.push(options); return { error: null, data: { session: { user: { id: 'fixture-user' } } } }; },
  };
  const auth = { session: null, configured: true, completeLogin: () => completed++ };
  const jsx = (type, props) => ({ type, props });
  const mocks = {
    react: {
      useState: initial => {
        const index = cursor++;
        if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
        return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
      },
      useRef: value => { const index = cursor++; return slots[index] ?? (slots[index] = { current: value }); },
      useEffect: () => {},
    },
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'expo-router': { useLocalSearchParams: () => ({ mode }), useRouter: () => ({ replace: () => {}, canGoBack: () => false, push: () => {} }) },
    'react-native': { Platform: { OS: 'ios' }, StyleSheet: { create: styles => styles },
      KeyboardAvoidingView: 'KeyboardAvoidingView', Pressable: 'Pressable', ScrollView: 'ScrollView', Text: 'Text', TextInput: 'TextInput', View: 'View' },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    '../components/masarak-brand': { MasarakBrand: 'MasarakBrand' },
    '../components/masarak-icon': { MasarakIcon: 'MasarakIcon' },
    '../constants/design': { colors: {}, ui: {} },
    '../contexts/auth-context': { useAuth: () => auth },
    '../utils/supabase': { supabase: { auth: api } },
  };
  class ClockDate extends Date { static now() { return clock; } }
  for (const [name, code] of Object.entries(utilityCode)) {
    const exports = {};
    vm.runInNewContext(code, { exports });
    mocks[`../utils/${name}`] = exports;
  }
  const exports = {};
  vm.runInNewContext(screenCode, { exports, require: name => {
    if (!(name in mocks)) throw Error('Unexpected module: ' + name);
    return mocks[name];
  }, Date: ClockDate, setInterval, clearInterval });
  const render = () => { cursor = 0; tree = exports.default(); return tree; };
  function nodes(node) {
    if (Array.isArray(node)) return node.flatMap(item => nodes(item));
    if (!node || typeof node !== 'object') return [];
    return [node, ...nodes(node.props?.children)];
  }
  function text(node) {
    if (Array.isArray(node)) return node.map(text).join('');
    if (node && typeof node === 'object') return text(node.props?.children);
    return typeof node === 'string' || typeof node === 'number' ? String(node) : '';
  }
  render();
  return {
    api, calls, auth, render, completed: () => completed,
    text: () => text(tree),
    input: label => nodes(tree).find(node => node.type === 'TextInput' && node.props.accessibilityLabel === label),
    button: label => nodes(tree).find(node => node.type === 'Pressable' && text(node) === label),
    fill(label, value) { this.input(label).props.onChangeText(value); render(); },
    async press(label) { const button = this.button(label); assert.ok(button, label); assert.equal(Boolean(button.props.disabled), false); button.props.onPress(); await new Promise(setImmediate); render(); },
    advance(milliseconds) { clock += milliseconds; },
  };
}

async function signup(h) {
  h.fill('الاسم', 'مستخدم تجريبي');
  h.fill('البريد الإلكتروني', 'USER@example.com');
  h.fill('كلمة المرور', 'fixture-password');
  await h.press('إنشاء حساب');
}

test('a login response without a session never completes login', async () => {
  const h = harness('login');
  h.api.signInWithPassword = async () => ({ error: null, data: { session: null } });
  h.fill('البريد الإلكتروني', 'user@example.test');
  h.fill('كلمة المرور', 'fixture-password');
  await h.press('تسجيل الدخول');
  assert.equal(h.completed(), 0);
});

test('new signup displays a six-digit input and verifies before completing login', async () => {
  const h = harness();
  await signup(h);
  const input = h.input('رمز تأكيد البريد المكوّن من ستة أرقام');
  assert.equal(input.props.maxLength, 6);
  assert.equal(input.props.textContentType, 'oneTimeCode');
  assert.equal(h.completed(), 0);
  assert.equal(h.button('تأكيد البريد').props.disabled, true);
  assert.doesNotMatch(h.text(), /إذا وصل رابط|أكدت البريد بالرابط/);
  h.fill(input.props.accessibilityLabel, '٠١٢٣٤٥');
  assert.equal(h.input(input.props.accessibilityLabel).props.value, '012345');
  await h.press('تأكيد البريد');
  assert.equal(h.calls.verify.length, 1);
  assert.equal(h.calls.verify[0].type, 'email');
  assert.equal(h.calls.verify[0].email, 'user@example.com');
  assert.equal(h.completed(), 1);
});

test('incorrect code leaves verification open with an error; retry succeeds', async () => {
  const h = harness();
  await signup(h);
  h.fill('رمز تأكيد البريد المكوّن من ستة أرقام', '123456');
  h.api.verifyOtp = async () => ({ error: { code: 'otp_expired' }, data: { session: null } });
  await h.press('تأكيد البريد');
  assert.match(h.text(), /الرمز غير صحيح أو انتهت صلاحيته/);
  assert.equal(h.completed(), 0);
  assert.ok(h.input('رمز تأكيد البريد المكوّن من ستة أرقام'));
  h.api.verifyOtp = async () => ({ error: null, data: { session: { user: { id: 'fixture-user' } } } });
  await h.press('تأكيد البريد');
  assert.equal(h.completed(), 1);
});

test('resending cannot happen early and restarts the cooldown after success', async () => {
  const h = harness();
  await signup(h);
  const early = h.button('إعادة إرسال الرمز بعد 60 ثانية');
  assert.equal(early.props.disabled, true);
  early.props.onPress();
  await new Promise(setImmediate);
  assert.equal(h.calls.resend.length, 0);
  // Even before the UI timer refreshes, the handler checks actual elapsed time.
  h.advance(61000);
  early.props.onPress();
  await new Promise(setImmediate);
  h.render();
  assert.equal(h.calls.resend.length, 1);
  assert.equal(h.calls.resend[0].type, 'signup');
  assert.equal(h.calls.resend[0].email, 'user@example.com');
  assert.equal(h.button('إعادة إرسال الرمز بعد 60 ثانية').props.disabled, true);
});

test('unconfirmed users can resume confirmation, while ordinary login stays password-based', async () => {
  const h = harness('login');
  h.fill('البريد الإلكتروني', 'user@example.com');
  h.fill('كلمة المرور', 'fixture-password');
  h.api.signInWithPassword = async () => ({ error: { code: 'email_not_confirmed' } });
  await h.press('تسجيل الدخول');
  assert.ok(h.input('رمز تأكيد البريد المكوّن من ستة أرقام'));
  await h.press('إعادة إرسال الرمز');
  assert.equal(h.calls.resend.length, 1);
  await h.press('العودة لتسجيل الدخول');
  h.fill('كلمة المرور', 'fixture-password');
  h.api.signInWithPassword = async options => { h.calls.login.push(options); return { error: null, data: { session: { user: { id: 'fixture-user' } } } }; };
  await h.press('تسجيل الدخول');
  assert.equal(h.calls.login.length, 1);
  assert.equal(h.calls.verify.length, 0);
  assert.equal(h.completed(), 1);
});
