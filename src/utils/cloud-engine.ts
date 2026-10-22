import type { CloudMeta, CloudRecord, CloudSnapshot } from './cloud-types';

export type CloudResult = 'disabled' | 'paused' | 'synced' | 'pending' | 'conflict' | 'removed';
export type SyncChoice = 'auto' | 'local' | 'cloud';
export type CloudPorts = {
  assertCurrent: () => void;
  readMeta: () => Promise<CloudMeta>;
  changeMeta: (change: (current: CloudMeta) => CloudMeta) => Promise<void>;
  readRemote: () => Promise<CloudRecord | null>;
  hasLocalData: () => Promise<boolean>;
  localState: () => Promise<string>;
  prepareUpload: () => Promise<{ snapshot: CloudSnapshot; localState: string; binding: CloudMeta['fileBinding']; cleanup: () => Promise<void> }>;
  saveRemote: (snapshot: CloudSnapshot, expected: number | null) => Promise<CloudRecord>;
  restore: (snapshot: CloudSnapshot) => Promise<{ binding: CloudMeta['fileBinding']; localState: string }>;
  cleanupPrevious: (oldSnapshot: CloudSnapshot | null, snapshot: CloudSnapshot) => Promise<void>;
};
export async function synchronizeAccount(ports: CloudPorts, choice: SyncChoice = 'auto', enable = false): Promise<CloudResult> {
  ports.assertCurrent();
  let meta = await ports.readMeta();
  // Compare exact canonical local state as well as the dirty marker. A failed marker write or app crash must not hide an edit.
  if (!meta.dirty && meta.lastLocalState !== null && await ports.localState() !== meta.lastLocalState) {
    await ports.changeMeta(m => ({ ...m, dirty: true, localVersion: m.localVersion + 1 }));
    meta = await ports.readMeta();
  }
  if (meta.paused && !enable && choice === 'auto') return 'paused';
  const remote = await ports.readRemote();
  ports.assertCurrent();
  meta = await ports.readMeta();
  if (!remote && choice === 'cloud') return 'removed';
  if (!remote && !meta.enabled && !enable) return 'disabled';
  if (!remote && meta.baseRevision !== null && !enable) {
    await ports.changeMeta(m => ({ ...m, enabled: false, paused: true, baseRevision: null, dirty: true }));
    return 'removed';
  }
  const initialLocal = remote !== null && meta.baseRevision === null && await ports.hasLocalData();
  ports.assertCurrent();
  const hasConflict = remote !== null && ((meta.dirty && remote.revision !== meta.baseRevision) || initialLocal);
  if (choice === 'auto' && hasConflict) return 'conflict';
  if (remote && (choice === 'cloud' || (!meta.dirty && meta.baseRevision !== remote.revision && !initialLocal))) {
    const version = meta.localVersion;
    if ((await ports.readMeta()).localVersion !== version) return 'pending';
    const restored = await ports.restore(remote.snapshot);
    ports.assertCurrent();
    await ports.changeMeta(m => ({ ...m, enabled: true, paused: false, dirty: false, baseRevision: remote.revision, lastSynced: new Date().toISOString(), fileBinding: restored.binding, lastLocalState: restored.localState }));
    return 'synced';
  }
  if (!meta.enabled && !enable && choice === 'auto') return 'disabled';
  if (!meta.dirty && remote && choice !== 'local') return 'synced';
  const version = meta.localVersion;
  const prepared = await ports.prepareUpload();
  try {
    ports.assertCurrent();
    if ((await ports.readMeta()).localVersion !== version) { await prepared.cleanup(); return 'pending'; }
    const saved = await ports.saveRemote(prepared.snapshot, remote?.revision ?? null);
    ports.assertCurrent();
    await ports.changeMeta(m => ({ ...m, enabled: true, paused: false, baseRevision: saved.revision, dirty: m.localVersion !== version, lastSynced: new Date().toISOString(), fileBinding: prepared.binding, lastLocalState: prepared.localState }));
    await ports.cleanupPrevious(remote?.snapshot ?? null, prepared.snapshot).catch(() => undefined);
    return (await ports.readMeta()).dirty ? 'pending' : 'synced';
  } catch (error) {
    // An uncertain network result might already be committed: preserve its file.
    // Only a known optimistic-lock conflict proves the new object is unreferenced.
    if (error && typeof error === 'object' && 'code' in error && error.code === '40001') { await prepared.cleanup(); return 'conflict'; }
    throw error;
  }
}
