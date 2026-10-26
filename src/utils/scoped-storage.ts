import AsyncStorage from '@react-native-async-storage/async-storage';

let owner: string | null = null;
let revision = 0;
export function setDataOwner(id: string | null) {
  if (id !== null && !/^[a-zA-Z0-9_-]{1,80}$/.test(id)) throw new Error('Invalid account identifier');
  if (owner !== id) { owner = id; revision += 1; }
}
export function invalidateDataScope() { revision += 1; }
export function captureDataScope() {
  const capturedOwner = owner;
  const capturedRevision = revision;
  return { owner: capturedOwner, suffix: capturedOwner ? `-account-${capturedOwner}` : '', key: (base: string) => capturedOwner ? `${base}:account:${capturedOwner}` : base,
    assertCurrent() { if (revision !== capturedRevision) throw new Error('تغيّر الحساب أو تم تحديث بياناته أثناء العملية. حاول مجددًا.'); } };
}
type Scope = ReturnType<typeof captureDataScope>;
const rawWrites = new Map<string, Promise<unknown>>();
export async function readScopedRaw(key: string, scope: Scope) {
  const physical = scope.key(key);
  await rawWrites.get(physical);
  scope.assertCurrent();
  const value = await AsyncStorage.getItem(physical);
  scope.assertCurrent(); return value;
}
export function updateScopedRaw(key: string, change: (raw: string | null) => string, scope: Scope) {
  const physical = scope.key(key);
  const task = (rawWrites.get(physical) ?? Promise.resolve()).then(async () => {
    const raw = await AsyncStorage.getItem(physical);
    await AsyncStorage.setItem(physical, change(raw));
  });
  rawWrites.set(physical, task.catch(() => undefined));
  return task;
}
let tracking = false;
const suppressed = new Map<string | null, number>();
const listeners = new Set<(scope: Scope, failure: boolean) => void>();
const trackedKeys = new Set(['masarak-skills-v1', 'masarak-learning-plan-v1', 'masarak-learning-progress-v1', 'masarak-professional-certifications-v1', 'masarak-personal-profile-v1', 'masarak-saved-cv-v1', 'masarak-interviews-v1', 'masarak-job-target-v1']);
export function enableCloudChangeTracking() { tracking = true; }
export function subscribeDataChanges(listener: (scope: Scope, failure: boolean) => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export async function withoutChangeTracking<T>(account: string | null, action: () => Promise<T>): Promise<T> {
  suppressed.set(account, (suppressed.get(account) ?? 0) + 1);
  try { return await action(); } finally { const count = (suppressed.get(account) ?? 1) - 1; if (count) suppressed.set(account, count); else suppressed.delete(account); }
}
async function changed(key: string, scope: Scope) {
  if (!tracking || !trackedKeys.has(key) || suppressed.has(scope.owner)) return;
  let failure = false;
  try {
    // Persist dirty state in the *captured* account even after a sign-out. Never fail a committed local file write.
    await updateScopedRaw('masarak-cloud-sync-v1', raw => {
      let meta: Record<string, unknown> = {};
      try { const value = raw ? JSON.parse(raw) : null; if (value?.version === 1) meta = value; } catch { /* Preserve local data; a fresh baseline requires conflict review. */ }
      const version = Number.isSafeInteger(meta.localVersion) ? Number(meta.localVersion) : 0;
      return JSON.stringify({ version: 1, enabled: false, paused: false, baseRevision: null, lastSynced: null, lastLocalState: null, fileBinding: null, ...meta, dirty: true, localVersion: version + 1 });
    }, scope);
  } catch { failure = true; }
  for (const listener of listeners) { try { listener(scope, failure); } catch { /* UI reporting cannot undo committed data. */ } }
}
export const reportDataChange = changed;
export async function replaceScopedItems(items: [string, string | null][], scope: Scope) {
  scope.assertCurrent();
  const prior = await Promise.all(items.map(async ([key]) => [scope.key(key), await AsyncStorage.getItem(scope.key(key))] as const));
  scope.assertCurrent();
  try {
    await AsyncStorage.multiSet(items.filter((item): item is [string, string] => item[1] !== null).map(([key, value]) => [scope.key(key), value]));
    const removed = items.filter(([, value]) => value === null).map(([key]) => scope.key(key));
    if (removed.length) await AsyncStorage.multiRemove(removed);
    scope.assertCurrent();
  } catch (error) {
    // Restore the captured account's previous keys; never use the newly active account's namespace.
    await AsyncStorage.multiSet(prior.filter((item): item is readonly [string, string] => item[1] !== null).map(([key, value]) => [key, value]));
    const absent = prior.filter(([, value]) => value === null).map(([key]) => key);
    if (absent.length) await AsyncStorage.multiRemove(absent);
    throw error;
  }
}
export default {
  async getItem(key: string) { const scope = captureDataScope(); const value = await AsyncStorage.getItem(scope.key(key)); scope.assertCurrent(); return value; },
  async setItem(key: string, value: string) { const scope = captureDataScope(); await AsyncStorage.setItem(scope.key(key), value); await changed(key, scope); },
  async removeItem(key: string) { const scope = captureDataScope(); await AsyncStorage.removeItem(scope.key(key)); await changed(key, scope); },
};
