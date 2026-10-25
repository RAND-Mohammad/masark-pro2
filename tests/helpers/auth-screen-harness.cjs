const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');
const compile = file => ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

// Runs real handlers/effects with synthetic sessions; never contacts any provider.
module.exports = function harness(file, { provider = false, session = null, getSessionFailure = false, getUserFailure = false, signOutFailure = false, platform = 'web', moduleOverrides = {}, renderComponents = false } = {}) {
  const slots = [], queued = [], intervals = new Map(), routes = [], owners = [], cleanups = [];
  let cursor = 0, dirty = true, tree, clock = 100000, incoming = null, listener, saved = session;
  const calls = { send: [], verify: [], update: [], setSession: [], signOut: [] };
  const auth = { session, ready: true, configured: true, recoveryPending: false, callbackBusy: false,
    finishRecovery: () => { auth.recoveryPending = false; calls.finished = (calls.finished || 0) + 1; },
    completeLogin: () => { calls.completed = (calls.completed || 0) + 1; } };
  const fixture = { access_token: 'fixture-only-access', refresh_token: 'fixture-only-refresh', user: { id: 'fixture-owner', email: 'fixture@example.test' } };
  const emit = (event, next) => { saved = next; listener?.(event, next); dirty = true; };
  const api = {
    getSession: async () => ({ data: { session: saved }, error: getSessionFailure ? { message: 'test-only storage failure' } : null }),
    getUser: async () => ({ data: { user: saved?.user ?? null }, error: getUserFailure ? { message: 'test-only revoked session' } : null }),
    onAuthStateChange: callback => { listener = callback; return { data: { subscription: { unsubscribe() {} } } }; },
    setSession: async args => { calls.setSession.push(args); emit('SIGNED_IN', fixture); return { data: { session: fixture }, error: null }; },
    signOut: async args => { calls.signOut.push(args); if (signOutFailure) throw new Error('test-only local storage failure'); emit('SIGNED_OUT', null); return { error: null }; },
    resetPasswordForEmail: async (...args) => { calls.send.push(args); return { error: null }; },
    verifyOtp: async args => { calls.verify.push(args); auth.session = fixture; return { data: { session: fixture }, error: null }; },
    updateUser: async args => { calls.update.push(args); return { data: { user: fixture.user }, error: null }; },
  };
  const depsChanged = (old, next) => !old || !next || old.length !== next.length || old.some((v, i) => !Object.is(v, next[i]));
  const react = {
    useState(initial) {
      const i = cursor++;
      if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
      return [slots[i], value => {
        const next = typeof value === 'function' ? value(slots[i]) : value;
        if (!Object.is(next, slots[i])) { slots[i] = next; dirty = true; }
      }];
    },
    useRef(value) { const i = cursor++; return slots[i] ?? (slots[i] = { current: value }); },
    useEffect(callback, deps) {
      const i = cursor++, old = slots[i];
      if (!old || depsChanged(old.deps, deps)) {
        slots[i] = { deps, cleanup: old?.cleanup };
        queued.push(() => { slots[i].cleanup?.(); slots[i].cleanup = callback(); });
      }
    },
    useCallback(callback, deps) {
      const i = cursor++;
      if (!slots[i] || depsChanged(slots[i].deps, deps)) slots[i] = { deps, callback };
      return slots[i].callback;
    },
    useMemo(factory, deps) {
      const i = cursor++;
      if (!slots[i] || depsChanged(slots[i].deps, deps)) slots[i] = { deps, value: factory() };
      return slots[i].value;
    },
    createContext: () => ({ Provider: 'Provider' }),
    useContext: () => auth,
  };
  const router = { replace: route => routes.push(route), push: route => routes.push(route), canGoBack: () => false, back() {} };
  const jsx = (type, props) => renderComponents && typeof type === 'function' ? type(props) : ({ type, props });
  const browser = {
    location: { origin: 'https://app.example.test', pathname: '/auth-callback' },
    history: { state: null, replaceState: (_state, _title, url) => cleanups.push(url) },
  };
  const mocks = {
    react,
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'expo-linking': { useLinkingURL: () => incoming },
    'expo-router': { useRouter: () => router, useLocalSearchParams: () => ({ mode: 'login' }), useFocusEffect: callback => react.useEffect(callback, [callback]) },
    'react-native': { Platform: { OS: platform }, AppState: {}, StyleSheet: { create: value => value },
      KeyboardAvoidingView: 'KeyboardAvoidingView', Pressable: 'Pressable', ScrollView: 'ScrollView',
      Text: 'Text', TextInput: 'TextInput', View: 'View' },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    '../contexts/auth-context': { useAuth: () => auth },
    '../utils/supabase': { authConfigured: true, supabase: { auth: api } },
    '../utils/scoped-storage': { setDataOwner: owner => owners.push(owner) },
    '../utils/auth-redirect': { authRedirectUrl: () => 'https://app.example.test/auth-callback' },
    '../constants/design': { colors: {}, ui: {} },
    '../components/masarak-brand': { MasarakBrand: 'MasarakBrand' },
    '../components/masarak-icon': { MasarakIcon: 'MasarakIcon' },
  };
  Object.assign(mocks, moduleOverrides);
  class ClockDate extends Date { static now() { return clock; } }
  const globals = { Date: ClockDate, Error, URL, URLSearchParams, Promise, Map, Set, window: browser,
    process: { env: { EXPO_PUBLIC_CV_API_URL: 'https://app.example.test/api/cv' } }, __DEV__: true,
    Blob, FormData, AbortController, queueMicrotask, setTimeout, clearTimeout,
    setInterval: fn => { const id = intervals.size + 1; intervals.set(id, fn); return id; },
    clearInterval: id => intervals.delete(id) };
  const cache = {};
  function load(name, from = path.join(root, file)) {
    if (mocks[name]) return mocks[name];
    const location = path.resolve(path.dirname(from), name);
    for (const [key, value] of Object.entries(mocks)) {
      if (key.startsWith('.') && path.resolve(root, path.dirname(file), key) === location) return value;
    }
    if (cache[location]) return cache[location];
    if (/\.(?:json|mjs)$/u.test(location)) return require(location);
    const actual = ['.ts', '.tsx', ''].map(extension => location + extension).find(candidate => fs.existsSync(candidate));
    if (!actual) throw new Error(`Unknown fixture dependency ${name}`);
    const exports = {}; cache[location] = exports;
    vm.runInNewContext(compile(path.relative(root, actual)), { ...globals, exports, require: name => load(name, actual) });
    return exports;
  }
  const exports = {};
  vm.runInNewContext(compile(file), { ...globals, exports, require: load });
  const render = () => { cursor = 0; dirty = false; tree = provider ? exports[typeof provider === 'string' ? provider : 'AuthProvider']({ children: 'fixture-child' }) : exports.default(); };
  async function flush() {
    for (let pass = 0; pass < 30; pass++) {
      if (dirty) render();
      while (queued.length) queued.shift()();
      await new Promise(setImmediate);
      if (!dirty && !queued.length) return;
    }
    throw new Error('Unexpected render loop');
  }
  const nodes = node => Array.isArray(node) ? node.flatMap(nodes) : node && typeof node === 'object' ? [node, ...nodes(node.props?.children)] : [];
  const text = node => Array.isArray(node) ? node.map(text).join('') : node && typeof node === 'object' ? text(node.props?.children) : typeof node === 'string' || typeof node === 'number' ? String(node) : '';
  render();
  return {
    api, auth, calls, routes, owners, cleanups, fixture, flush, emit, module: name => load(name),
    value: () => tree.props.value,
    text: () => text(tree),
    nodes: () => nodes(tree),
    input: label => nodes(tree).find(n => n.type === 'TextInput' && n.props.accessibilityLabel === label),
    button: label => nodes(tree).find(n => n.type === 'Pressable' && text(n) === label),
    async fill(label, value) { this.input(label).props.onChangeText(value); dirty = true; await flush(); },
    async press(label) { const b = this.button(label); if (!b || b.props.disabled) throw new Error(`Unavailable button: ${label}`); b.props.onPress(); await flush(); },
    async act(callback) { callback(nodes(tree)); dirty = true; await flush(); },
    async updateAuth(change) { Object.assign(auth, change); dirty = true; await flush(); },
    async setLink(value) { incoming = value; dirty = true; await flush(); },
    async advance(ms) { clock += ms; for (const tick of intervals.values()) tick(); await flush(); },
    dispose() { for (const slot of slots) slot?.cleanup?.(); intervals.clear(); },
  };
};
