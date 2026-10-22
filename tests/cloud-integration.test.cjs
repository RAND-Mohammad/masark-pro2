const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const ts = require(path.join(root, 'node_modules/typescript'));
const dataset = JSON.parse(fs.readFileSync(path.join(root, 'src/masarak_dataset.json'), 'utf8'));
const clone = value => JSON.parse(JSON.stringify(value));
function harness() {
  const data = new Map(), files = new Map(), cache = new Map(), clients = [];
  let failOnce = '';
  const storage = {
    getItem: async key => data.get(key) ?? null,
    setItem: async (key, value) => { if (failOnce && key.includes(failOnce)) { failOnce = ''; throw Error('disk write failed'); } data.set(key, value); },
    removeItem: async key => data.delete(key),
    multiSet: async pairs => { for (const [key, value] of pairs) await storage.setItem(key, value); },
    multiRemove: async keys => { for (const key of keys) data.delete(key); },
  };
  class Directory { constructor(parent, name) { this.uri = parent + '/' + name; } create() {} }
  class File {
    constructor(parent, name) { this.uri = name ? (parent.uri ?? parent) + '/' + name : parent.uri ?? parent; }
    get exists() { return files.has(this.uri); }
    async copy(destination) { if (!this.exists) throw Error('file missing'); files.set(destination.uri, files.get(this.uri)); }
    delete() { files.delete(this.uri); }
  }
  function load(file) {
    if (cache.has(file)) return cache.get(file);
    const exports = {}; cache.set(file, exports);
    const code = ts.transpileModule(fs.readFileSync(path.join(root, 'src/utils', file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    const requireModule = name => {
      if (name.includes('async-storage')) return storage;
      if (name.endsWith('masarak_dataset.json')) return dataset;
      if (name === '../constants/job-paths') return { jobPathIds: new Set(), resolveBaseCareerId: id => id, jobPaths: dataset.careers.map(career => ({ id: career.career_id, title: career.title, description: career.description })) };
      if (name === '../constants/learning-resources') return { learningResourceIds: new Set(['github-skills-introduction']) };
      if (name === '../constants/professional-certifications') return { professionalCertificationIds: new Set(['github-foundations']) };
      if (name === 'expo-file-system') return { Directory, File, Paths: { document: 'documents', cache: 'cache' } };
      if (name === 'react-native-url-polyfill/auto') return {};
      if (name === './auth-storage') return { authStorage: {} };
      if (name === '@supabase/supabase-js') return { createClient: (_url, _key, options) => { clients.push(options); return { options }; } };
      return load(name.replace('./', '') + '.ts');
    };
    vm.runInNewContext(code, { exports, require: requireModule, Promise, Map, Set, AbortController, AbortSignal, setTimeout, clearTimeout, fetch: async () => new Response('{}'), process: { env: { EXPO_PUBLIC_SUPABASE_URL: 'https://testproject.supabase.co', EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_TEST_ONLY' } } });
    return exports;
  }
  return { load, data, files, clients, fail: key => { failOnce = key; } };
}
const emptySnapshot = { version: 1, personal: null, skills: null, plan: [], cv: null };
function engineFixture(options = {}) {
  const h = harness(); const { defaultCloudMeta } = h.load('cloud-types.ts');
  const s = { meta: { ...clone(defaultCloudMeta()), ...options.meta }, remote: options.remote ?? null, local: options.local ?? 'empty', hasLocal: !!options.hasLocal, reads: 0, writes: 0, restores: 0, cleanup: 0, current: true };
  const ports = {
    assertCurrent: () => { if (!s.current) throw Error('account switched'); },
    readMeta: async () => clone(s.meta),
    changeMeta: async change => { s.meta = change(clone(s.meta)); },
    readRemote: async () => { s.reads++; if (s.onRead) s.onRead(); return s.remote ? clone(s.remote) : null; },
    hasLocalData: async () => s.hasLocal,
    localState: async () => s.local,
    prepareUpload: async () => { if (s.onPrepare) s.onPrepare(); return { snapshot: clone(emptySnapshot), localState: s.local, binding: null, cleanup: async () => { s.cleanup++; } }; },
    saveRemote: async (_snapshot, expected) => { s.writes++; if (s.onSave) s.onSave(); if (s.failSave) throw s.failSave; if (expected !== (s.remote?.revision ?? null)) throw { code: '40001' }; s.remote = { revision: (expected ?? 0) + 1, snapshot: clone(emptySnapshot), updated_at: '2026-10-14T08:00:00Z' }; return clone(s.remote); },
    restore: async () => { s.restores++; s.local = 'downloaded'; return { binding: null, localState: s.local }; },
    cleanupPrevious: async () => {},
  };
  return { s, sync: (choice = 'auto', enable = false) => h.load('cloud-engine.ts').synchronizeAccount(ports, choice, enable) };
}
const remote = revision => ({ revision, snapshot: clone(emptySnapshot), updated_at: '2026-10-14T08:00:00Z' });

test('new accounts do not upload local data until cloud saving is enabled', async () => {
  const f = engineFixture({ hasLocal: true, local: 'local CV' });
  assert.equal(await f.sync(), 'disabled'); assert.equal(f.s.writes, 0);
  assert.equal(await f.sync('auto', true), 'synced'); assert.equal(f.s.writes, 1); assert.equal(f.s.meta.enabled, true);
});

test('learning progress accepts valid completion dates and old snapshots remain compatible', () => {
  const h = harness();
  const types = h.load('cloud-types.ts');
  const old = types.parseCloudSnapshot(clone(emptySnapshot), 'A');
  assert.deepEqual(clone(old.learningProgress), {});
  assert.deepEqual(clone(old.professionalCertifications), []);
  const updated = types.parseCloudSnapshot({ ...clone(emptySnapshot), learningProgress: { 'github-skills-introduction': '2026-10-14T10:00:00.000Z' } }, 'A');
  assert.equal(updated.learningProgress['github-skills-introduction'], '2026-10-14T10:00:00.000Z');
  assert.throws(() => types.parseCloudSnapshot({ ...clone(emptySnapshot), learningProgress: { course: 'not-a-date' } }, 'A'));
});
test('cloud snapshots retain safe roadmap items and discard malformed plan entries', () => {
  const h = harness(); const types = h.load('cloud-types.ts');
  const parsed = types.parseCloudSnapshot({ ...clone(emptySnapshot), plan: [dataset.career_skills[0].skill_id, 'cert:github-foundations', 'experience:job-soc-analyst:0', 'project:job-soc-analyst:1', 'project:../other:1'] }, 'A');
  assert.deepEqual(clone(parsed.plan), [dataset.career_skills[0].skill_id, 'cert:github-foundations', 'experience:job-soc-analyst:0', 'project:job-soc-analyst:1']);
});

test('cloud snapshots preserve selected professional certifications safely', () => {
  const h = harness();
  const types = h.load('cloud-types.ts');
  const value = types.parseCloudSnapshot({ ...clone(emptySnapshot), professionalCertifications: ['github-foundations'] }, 'A');
  assert.deepEqual(clone(value.professionalCertifications), ['github-foundations']);
  assert.throws(() => types.parseCloudSnapshot({ ...clone(emptySnapshot), professionalCertifications: 'github-foundations' }, 'A'));
});
test('a fresh device restores the existing account snapshot and its baseline', async () => {
  const f = engineFixture({ remote: remote(3) });
  assert.equal(await f.sync(), 'synced'); assert.equal(f.s.restores, 1); assert.equal(f.s.writes, 0); assert.equal(f.s.meta.baseRevision, 3); assert.equal(f.s.meta.lastLocalState, 'downloaded');
});
test('unsynced existing local data is never overwritten on first cloud connection', async () => {
  const f = engineFixture({ remote: remote(2), hasLocal: true, local: 'saved CV' });
  assert.equal(await f.sync(), 'conflict'); assert.equal(f.s.writes, 0); assert.equal(f.s.restores, 0);
});
test('a newer cloud version and offline local edits require a user choice', async () => {
  const f = engineFixture({ remote: remote(4), hasLocal: true, meta: { enabled: true, dirty: true, baseRevision: 3 } });
  assert.equal(await f.sync(), 'conflict'); assert.equal(f.s.writes, 0);
  assert.equal(await f.sync('cloud'), 'synced'); assert.equal(f.s.meta.baseRevision, 4); assert.equal(f.s.restores, 1);
});
test('explicit local choice writes against the latest known cloud revision', async () => {
  const f = engineFixture({ remote: remote(4), hasLocal: true, meta: { enabled: true, dirty: true, baseRevision: 3 } });
  assert.equal(await f.sync('local', true), 'synced'); assert.equal(f.s.meta.baseRevision, 5);
});
test('optimistic locking catches another device writing after the initial fetch', async () => {
  const f = engineFixture({ remote: remote(2), meta: { enabled: true, dirty: true, baseRevision: 2 } });
  f.s.onSave = () => { f.s.remote = remote(3); };
  assert.equal(await f.sync(), 'conflict'); assert.equal(f.s.meta.dirty, true); assert.equal(f.s.cleanup, 1);
});
test('failed requests retain dirty state and do not remove files that might have been committed', async () => {
  const f = engineFixture({ remote: remote(2), meta: { enabled: true, dirty: true, baseRevision: 2 } });
  f.s.failSave = Error('connection lost after request');
  await assert.rejects(f.sync()); assert.equal(f.s.meta.dirty, true); assert.equal(f.s.cleanup, 0);
});
test('an edit during file preparation postpones the upload instead of sending a mixed snapshot', async () => {
  const f = engineFixture({ meta: { enabled: true, dirty: true } });
  f.s.onPrepare = () => { f.s.meta.localVersion++; f.s.local = 'newer edit'; };
  assert.equal(await f.sync(), 'pending'); assert.equal(f.s.writes, 0); assert.equal(f.s.cleanup, 1);
});
test('an edit during upload remains pending after the old snapshot commits', async () => {
  const f = engineFixture({ remote: remote(2), meta: { enabled: true, dirty: true, baseRevision: 2 } });
  f.s.onSave = () => { f.s.meta.localVersion++; f.s.local = 'newer local data'; };
  assert.equal(await f.sync(), 'pending'); assert.equal(f.s.meta.dirty, true); assert.equal(f.s.meta.baseRevision, 3);
});
test('exact baseline comparison recovers an edit whose dirty marker was not persisted', async () => {
  const f = engineFixture({ local: 'edited', remote: remote(2), meta: { enabled: true, dirty: false, lastLocalState: 'before edit', baseRevision: 2 } });
  assert.equal(await f.sync(), 'synced'); assert.equal(f.s.writes, 1); assert.equal(f.s.meta.lastLocalState, 'edited');
});
test('paused accounts make no cloud request, and deleted cloud data is not silently recreated', async () => {
  const paused = engineFixture({ meta: { enabled: false, paused: true } });
  assert.equal(await paused.sync(), 'paused'); assert.equal(paused.s.reads, 0);
  const removed = engineFixture({ hasLocal: true, meta: { enabled: true, baseRevision: 2 } });
  assert.equal(await removed.sync(), 'removed'); assert.equal(removed.s.writes, 0); assert.equal(removed.s.meta.paused, true);
});
test('switching accounts while reading remote data prevents restore and upload', async () => {
  const f = engineFixture({ remote: remote(2) }); f.s.onRead = () => { f.s.current = false; };
  await assert.rejects(f.sync()); assert.equal(f.s.restores, 0); assert.equal(f.s.writes, 0);
});
test('personal profiles and sync markers stay isolated between guest and two accounts', async () => {
  const h = harness(), scope = h.load('scoped-storage.ts'), personal = h.load('personal-profile.ts'); scope.enableCloudChangeTracking();
  const make = name => ({ ...clone(personal.emptyPersonalProfile()), name, interests: ['الأمن السيبراني', 'الأمن السيبراني'], traits: ['التعاون'] });
  await personal.savePersonalProfile(make('Guest')); scope.setDataOwner('A'); await personal.savePersonalProfile(make('Account A')); scope.setDataOwner('B');
  assert.equal(await personal.readPersonalProfile(), null); await personal.savePersonalProfile(make('Account B'));
  scope.setDataOwner('A'); assert.equal((await personal.readPersonalProfile()).name, 'Account A'); assert.equal((await personal.readPersonalProfile()).interests.length, 1);
  assert.equal(JSON.parse(h.data.get('masarak-cloud-sync-v1:account:A')).dirty, true);
  scope.setDataOwner(null); assert.equal((await personal.readPersonalProfile()).name, 'Guest');
});
test('malformed personal profiles cannot overwrite saved data', async () => {
  const h = harness(), personal = h.load('personal-profile.ts');
  await personal.savePersonalProfile({ ...clone(personal.emptyPersonalProfile()), name: 'Saved name' });
  assert.throws(() => personal.savePersonalProfile({ ...clone(personal.emptyPersonalProfile()), careerGoal: 'unknown' }));
  assert.equal((await personal.readPersonalProfile()).name, 'Saved name');
});
test('failed multi-key restore rolls back partial writes in the captured account', async () => {
  const h = harness(), scope = h.load('scoped-storage.ts'); scope.setDataOwner('A'); const captured = scope.captureDataScope();
  h.data.set(captured.key('personal'), 'old personal'); h.data.set(captured.key('skills'), 'old skills'); h.fail('skills');
  await assert.rejects(scope.replaceScopedItems([['personal', 'new personal'], ['skills', 'new skills']], captured));
  assert.equal(h.data.get(captured.key('personal')), 'old personal'); assert.equal(h.data.get(captured.key('skills')), 'old skills');
});
test('native cloud restore retains old CV bytes until success and can roll back after account switching', async () => {
  const h = harness(), scope = h.load('scoped-storage.ts'), saved = h.load('saved-cv.ts'); scope.setDataOwner('A');
  h.files.set('picked-original', 'old bytes'); const prior = await saved.storeCvFile({ uri: 'picked-original', name: 'cv.pdf', size: 20, mimeType: 'application/pdf', lastModified: 1 });
  h.files.set('downloaded', 'new bytes'); const staged = await saved.prepareSavedCvRestore({ uri: 'downloaded', name: 'cv.pdf', size: 20, mimeType: 'application/pdf', lastModified: 2 }, null);
  const next = await staged.commit(); assert.equal(h.files.get(prior.asset.uri), 'old bytes'); assert.equal(h.files.get(next.asset.uri), 'new bytes');
  scope.setDataOwner('B'); await staged.rollback(); assert.equal(await saved.loadSavedCv(), null);
  scope.setDataOwner('A'); assert.equal((await saved.loadSavedCv()).asset.uri, prior.asset.uri); assert.equal(h.files.get(prior.asset.uri), 'old bytes'); assert.equal(h.files.has(next.asset.uri), false);
});
test('cloud snapshots reject another account path and rebuild counted IDs from actual sources', () => {
  const h = harness(), types = h.load('cloud-types.ts');
  const cv = { path: 'B/file.pdf', name: 'cv.pdf', size: 20, mimeType: 'application/pdf', review: null };
  assert.throws(() => types.parseCloudSnapshot({ ...clone(emptySnapshot), cv }, 'A'));
  assert.equal(types.validCloudPath('A/../../B/file.pdf', 'A'), false);
  const malicious = { version: 3, skill_ids: ['T0644'], manual_skill_ids: [], excluded_cv_skill_ids: [], cv: null };
  assert.deepEqual(clone(types.parseCloudSnapshot({ ...clone(emptySnapshot), skills: malicious }, 'A').skills.skill_ids), []);
});
test('cloud transport binds the original bearer token and does not persist a second global session', () => {
  const h = harness(), api = h.load('supabase.ts'); const session = { access_token: 'ACCOUNT_A_TEST_TOKEN', user: { id: 'A' } };
  const client = api.createAccountClient(session); session.access_token = 'ACCOUNT_B_TEST_TOKEN';
  assert.equal(client.options.global.headers.Authorization, 'Bearer ACCOUNT_A_TEST_TOKEN'); assert.equal(client.options.auth.persistSession, false);
});
test('a guest cannot create a cloud request and cloud errors never echo credentials', async () => {
  const h = harness(), runtime = h.load('cloud-runtime.ts'); const before = h.clients.length;
  await assert.rejects(runtime.createCloudRuntime(() => null, () => {}).sync()); assert.equal(h.clients.length, before);
  assert.equal(runtime.cloudErrorMessage({ code: 'PGRST205', message: 'PRIVATE_TEST_SECRET' }).includes('PRIVATE_TEST_SECRET'), false);
});

test('temporary cloud clients never reuse the login client auth storage namespace', () => {
  const h = harness(), sdk = h.load('supabase.ts');
  const first = sdk.createAccountClient({ access_token: 'FIXTURE_A', user: { id: 'A' } });
  const second = sdk.createAccountClient({ access_token: 'FIXTURE_B', user: { id: 'B' } });
  assert.notEqual(first.options.auth.storageKey, second.options.auth.storageKey);
  assert.equal(first.options.auth.persistSession, false);
  assert.equal(second.options.auth.persistSession, false);
  assert.equal(first.options.global.headers.Authorization, 'Bearer FIXTURE_A');
  assert.equal(second.options.global.headers.Authorization, 'Bearer FIXTURE_B');
});
