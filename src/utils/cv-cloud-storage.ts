import scopedStorage, { captureDataScope, readScopedRaw, updateScopedRaw } from './scoped-storage';
import { CLOUD_META_KEY, parseCloudMeta } from './cloud-types';

export const CV_CLOUD_STORAGE_KEY = 'masarak-cv-cloud-storage-v1';

export async function readCvCloudStorageConsent(): Promise<boolean> {
  const scope = captureDataScope();
  const raw = await readScopedRaw(CV_CLOUD_STORAGE_KEY, scope);
  if (raw === 'true') return true;
  if (raw === 'false') return false;

  // Existing accounts may already have a cloud CV. Keep that copy until the user changes the setting.
  const meta = parseCloudMeta(await readScopedRaw(CLOUD_META_KEY, scope));
  const legacyConsent = meta.baseRevision !== null && meta.fileBinding !== null;
  await updateScopedRaw(CV_CLOUD_STORAGE_KEY, () => JSON.stringify(legacyConsent), scope);
  scope.assertCurrent();
  return legacyConsent;
}

export function saveCvCloudStorageConsent(enabled: boolean): Promise<void> {
  return scopedStorage.setItem(CV_CLOUD_STORAGE_KEY, JSON.stringify(enabled));
}
