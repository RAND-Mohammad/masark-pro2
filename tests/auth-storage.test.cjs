const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const ts = require(path.join(root, 'node_modules/typescript'));
const dataset = JSON.parse(fs.readFileSync(path.join(root, 'src/masarak_dataset.json'), 'utf8'));
const ids = [...new Set(dataset.career_skills.map(row => row.skill_id))];
function harness() {
  const data = new Map(); const secure = new Map(); const cache = new Map(); const disk = new Map(); let failKey = '';
  let releaseRead = null;
  let pendingWrite = null;
  const storage = {
    getItem: async key => { const value = data.get(key) ?? null; if (releaseRead) await releaseRead.promise; return value; },
    setItem: async (key, value) => { data.set(key, value); if (pendingWrite) { pendingWrite.started(); await pendingWrite.promise; } }, removeItem: async key => { data.delete(key); },
  };
  const secureStore = {
    getItemAsync: async key => secure.get(key) ?? null,
    setItemAsync: async (key, value) => { assert.ok(Buffer.byteLength(value, 'utf8') <= 2048); if (failKey && key.endsWith(failKey)) throw Error('Secure write failed'); secure.set(key, value); },
    deleteItemAsync: async key => { secure.delete(key); },
  };
  class Directory { constructor(parent, name) { this.uri = parent + '/' + name; } create() {} }
  class File {
    constructor(parent, name) { this.uri = typeof parent === 'string' ? parent : parent.uri + '/' + name; }
    get exists() { return disk.has(this.uri); }
    async copy(destination) { if (!this.exists) throw Error('Missing fixture'); disk.set(destination.uri, disk.get(this.uri)); }
    delete() { disk.delete(this.uri); }
  }
  function load(file) {
    const location = path.join(root, 'src/utils', file);
    if (cache.has(location)) return cache.get(location);
    const exports = {}; cache.set(location, exports);
    const code = ts.transpileModule(fs.readFileSync(location, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    const requireModule = name => {
      if (name.includes('async-storage')) return storage;
      if (name === 'expo-secure-store') return secureStore;
      if (name === 'expo-file-system') return { Directory, File, Paths: { document: 'documents' } };
      if (name.endsWith('masarak_dataset.json')) return dataset;
      if (name.startsWith('.')) return load(name.replace('./', '') + '.ts');
      throw Error('Unexpected dependency ' + name);
    };
    vm.runInNewContext(code, { exports, require: requireModule, URL, URLSearchParams });
    return exports;
  }
  const scoped = load('scoped-storage.ts');
  return { load, data, secure, disk, scoped, fail: value => { failKey = value; },
    blockWrite: () => { let release; let started; const promise = new Promise(resolve => { release = resolve; }); const began = new Promise(resolve => { started = resolve; }); pendingWrite = { promise, started }; return { began, release: () => { pendingWrite = null; release(); } }; },
    blockRead: () => { let release; const promise = new Promise(resolve => { release = resolve; }); releaseRead = { promise }; return () => { releaseRead = null; release(); }; } };
}
const plain = value => JSON.parse(JSON.stringify(value));
const cv = id => ({ skills: [{ name: 'Synthetic skill', mapped_skill_id: id, evidence: 'Synthetic fixture' }], certificates: [], experiences: [], warnings: [] });
test('guest, account A and account B never share profile or learning-plan keys', async () => {
  const h = harness(); const profile = h.load('skill-profile.ts'); const plan = h.load('learning-plan.ts');
  await profile.saveReviewedCv(cv(ids[0])); await plan.changeLearningPlan(ids[1], true);
  h.scoped.setDataOwner('account-a'); assert.equal(await profile.readSkillProfile(), null); assert.deepEqual(plain(await plan.readLearningPlan()), []);
  await profile.saveReviewedCv(cv(ids[2])); await plan.changeLearningPlan(ids[3], true);
  h.scoped.setDataOwner('account-b'); assert.equal(await profile.readSkillProfile(), null); assert.deepEqual(plain(await plan.readLearningPlan()), []);
  h.scoped.setDataOwner('account-a'); assert.deepEqual(plain((await profile.readSkillProfile()).skill_ids), [ids[2]]); assert.deepEqual(plain(await plan.readLearningPlan()), [ids[3]]);
  h.scoped.setDataOwner(null); assert.deepEqual(plain((await profile.readSkillProfile()).skill_ids), [ids[0]]); assert.deepEqual(plain(await plan.readLearningPlan()), [ids[1]]);
});
test('learning plans safely store skills, certifications, experience and projects', async () => {
  const h = harness(); const plan = h.load('learning-plan.ts');
  const entries = [ids[0], 'cert:github-foundations', 'experience:job-software-engineer:0', 'project:job-software-engineer:1'];
  for (const entry of entries) await plan.changeLearningPlan(entry, true);
  assert.deepEqual(plain(await plan.readLearningPlan()), entries);
  await assert.rejects(plan.changeLearningPlan('project:../other:1', true));
});
test('queued saves reject after account switching instead of writing into the new account', async () => {
  const h = harness(); const profile = h.load('skill-profile.ts');
  const queued = profile.saveReviewedCv(cv(ids[0])); h.scoped.setDataOwner('account-a');
  await assert.rejects(queued); assert.equal(h.data.size, 0);
});
test('a read interrupted by account switching never returns the previous account data', async () => {
  const h = harness(); await h.scoped.default.setItem('private', 'guest'); const release = h.blockRead();
  const read = h.scoped.default.getItem('private'); h.scoped.setDataOwner('account-a'); release();
  await assert.rejects(read);
});
test('invalid account identifiers cannot be used as file or storage paths', () => {
  const h = harness(); assert.throws(() => h.scoped.setDataOwner('../other')); assert.throws(() => h.scoped.setDataOwner('user@example.com'));
});
test('native CV bytes and reviews stay isolated; deleting account CV leaves guest CV intact', async () => {
  const h = harness(); const files = h.load('saved-cv.ts');
  h.disk.set('cache/guest.pdf', 'GUEST PDF'); h.disk.set('cache/account.pdf', 'ACCOUNT PDF');
  const guest = await files.storeCvFile({ uri: 'cache/guest.pdf', name: 'Guest.pdf', size: 100, mimeType: 'application/pdf' });
  h.scoped.setDataOwner('account-a'); assert.equal(await files.loadSavedCv(), null);
  const account = await files.storeCvFile({ uri: 'cache/account.pdf', name: 'Account.pdf', size: 100, mimeType: 'application/pdf' });
  const review = { analysis: cv(ids[0]), skills: [0], certificates: [], experiences: [] };
  await files.storeCvReview(guest.asset.uri, review); assert.equal((await files.loadSavedCv()).review, null);
  h.scoped.setDataOwner('account-b'); assert.equal(await files.loadSavedCv(), null);
  h.scoped.setDataOwner('account-a'); await files.deleteSavedCv(); assert.equal(h.disk.has(account.asset.uri), false);
  h.scoped.setDataOwner(null); assert.equal((await files.loadSavedCv()).asset.uri, guest.asset.uri); assert.equal(h.disk.get(guest.asset.uri), 'GUEST PDF');
});
test('a tampered account record cannot point to the guest CV directory', async () => {
  const h = harness(); const files = h.load('saved-cv.ts'); h.disk.set('cache/guest.pdf', 'GUEST PDF');
  const guest = await files.storeCvFile({ uri: 'cache/guest.pdf', name: 'Guest.pdf', size: 100, mimeType: 'application/pdf' });
  h.scoped.setDataOwner('account-a'); h.data.set(h.scoped.captureDataScope().key('masarak-saved-cv-v1'), JSON.stringify(guest));
  await assert.rejects(files.loadSavedCv()); assert.equal(h.disk.has(guest.asset.uri), true);
});
test('switching accounts during a committed CV write never deletes the newly saved bytes', async () => {
  const h = harness(); const files = h.load('saved-cv.ts'); h.disk.set('cache/test.pdf', 'SAVED PDF');
  const blocked = h.blockWrite(); const saving = files.storeCvFile({ uri: 'cache/test.pdf', name: 'Test.pdf', size: 100, mimeType: 'application/pdf' });
  await blocked.began; h.scoped.setDataOwner('account-a'); blocked.release(); await assert.rejects(saving);
  assert.equal(await files.loadSavedCv(), null);
  h.scoped.setDataOwner(null); const restored = await files.loadSavedCv(); assert.equal(h.disk.get(restored.asset.uri), 'SAVED PDF');
});
test('email callback parsing supports Expo Go and web recovery without accepting unrelated links', () => {
  const h = harness(); const api = h.load('auth-links.ts');
  const expo = api.parseAuthLink('exp://192.168.1.13:8081/--/auth-callback#access_token=synthetic-access&refresh_token=synthetic-refresh&type=recovery');
  assert.equal(expo.recovery, true); assert.equal(expo.refresh_token, 'synthetic-refresh');
  const web = api.parseAuthLink('http://localhost:8081/auth-callback#access_token=test&refresh_token=test&type=signup'); assert.equal(web.recovery, false);
  assert.equal(api.parseAuthLink('https://example.com/other#access_token=test&refresh_token=test'), null);
  assert.equal(api.parseAuthLink('javascript:alert(1)'), null);
  assert.throws(() => api.parseAuthLink('masarak://auth-callback#error_code=otp_expired'));
  assert.throws(() => api.parseAuthLink('http://localhost:8081/auth-callback#access_token=incomplete'));
});
test('secure session storage round-trips large Arabic and emoji content without exceeding native limits', async () => {
  const h = harness(); const api = h.load('auth-storage.ts').authStorage;
  const value = JSON.stringify({ access_token: 'x'.repeat(6500), display_name: 'ريوف 🌱'.repeat(250) });
  await api.setItem('sb-test-auth-token', value); assert.equal(await api.getItem('sb-test-auth-token'), value);
  assert.ok(h.secure.size > 2);
});
test('a failed secure write preserves the previous session and cleans only the incomplete generation', async () => {
  const h = harness(); const api = h.load('auth-storage.ts').authStorage;
  await api.setItem('session', 'original'); const before = new Map(h.secure);
  h.fail('.1'); await assert.rejects(api.setItem('session', 'x'.repeat(1000))); h.fail('');
  assert.equal(await api.getItem('session'), 'original'); assert.deepEqual(h.secure, before);
});
test('secure replacement and sign-out remove all old chunks', async () => {
  const h = harness(); const api = h.load('auth-storage.ts').authStorage;
  await api.setItem('session', 'x'.repeat(5000)); await api.setItem('session', 'short');
  assert.equal(h.secure.size, 2); assert.equal(await api.getItem('session'), 'short');
  await api.removeItem('session'); assert.equal(h.secure.size, 0); assert.equal(await api.getItem('session'), null);
});
test('safe account errors are specific and never echo server text or credentials', () => {
  const h = harness(); const api = h.load('auth-errors.ts');
  assert.match(api.authErrorMessage({ code: 'invalid_credentials' }), /غير صحيحة/);
  assert.match(api.authErrorMessage({ code: 'email_address_not_authorized' }), /خدمة البريد/);
  assert.equal(api.authErrorMessage({ message: 'sensitive raw text' }).includes('sensitive'), false);
  assert.ok(api.validateAccount('invalid', 'password', false));
  assert.ok(api.validateAccount('demo@example.com', 'short', true, 'Demo'));
  assert.equal(api.validateAccount('demo@example.com', 'long-password', true, 'Demo'), null);
});
test('session restoration uses the server identity instead of a modified cached user ID', async () => {
  const h = harness(); const api = h.load('verified-session.ts');
  const restored = await api.restoreVerifiedSession({ auth: {
    getSession: async () => ({ data: { session: { access_token: 'synthetic', user: { id: 'modified-cache-id' } } }, error: null }),
    getUser: async token => { assert.equal(token, 'synthetic'); return { data: { user: { id: 'verified-server-id' } }, error: null }; },
  } });
  assert.equal(restored.user.id, 'verified-server-id');
});
test('revoked sessions never unlock account data and guests need no remote identity request', async () => {
  const h = harness(); const api = h.load('verified-session.ts');
  await assert.rejects(api.restoreVerifiedSession({ auth: {
    getSession: async () => ({ data: { session: { access_token: 'synthetic', user: { id: 'cache-id' } } }, error: null }),
    getUser: async () => ({ data: { user: null }, error: new Error('revoked') }),
  } }));
  assert.equal(await api.restoreVerifiedSession({ auth: {
    getSession: async () => ({ data: { session: null }, error: null }),
    getUser: async () => { throw Error('Guest must not send an identity request'); },
  } }), null);
});
