import type { DocumentPickerAsset } from 'expo-document-picker';
import { validateCvFile } from './cv-file';
import { validReview, type CvReview, type SavedCv } from './saved-cv.types';
import { captureDataScope, reportDataChange } from './scoped-storage';

type Scope = ReturnType<typeof captureDataScope>;
type BrowserRecord = { file_id?: string; asset: Omit<DocumentPickerAsset, 'uri' | 'file'>; blob: Blob; review: CvReview | null };
function openDatabase(scope: Scope): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('masarak-cv' + scope.suffix, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('resume');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('أغلق صفحات مسارك الأخرى ثم حاول الحفظ مجددًا.'));
  });
}
async function transaction<T>(scope: Scope, mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDatabase(scope);
  try { scope.assertCurrent(); } catch (error) { db.close(); throw error; }
  return new Promise((resolve, reject) => {
    const tx = db.transaction('resume', mode);
    const request = action(tx.objectStore('resume'));
    tx.oncomplete = async () => { db.close(); if (mode === 'readwrite') await reportDataChange('masarak-saved-cv-v1', scope); try { scope.assertCurrent(); resolve(request.result); } catch (error) { reject(error); } };
    tx.onabort = () => { db.close(); reject(tx.error ?? new Error('تعذر حفظ السيرة في المتصفح.')); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}
const activeUrls = new Map<string, string>();
const activeFileIds = new Map<string, string>();
function asSaved(scope: Scope, record: BrowserRecord): SavedCv {
  scope.assertCurrent();
  const identity = record.file_id ?? 'legacy';
  const old = activeUrls.get(scope.suffix);
  let uri = old;
  if (!uri || activeFileIds.get(scope.suffix) !== identity) {
    if (old) URL.revokeObjectURL(old);
    uri = URL.createObjectURL(record.blob);
    activeUrls.set(scope.suffix, uri); activeFileIds.set(scope.suffix, identity);
  }
  return { file_id: record.file_id, asset: { ...record.asset, uri, file: new File([record.blob], record.asset.name, { type: record.blob.type, lastModified: record.asset.lastModified }) }, review: record.review };
}
export async function loadSavedCv(): Promise<SavedCv | null> {
  const scope = captureDataScope();
  const record = await transaction<BrowserRecord | undefined>(scope, 'readonly', store => store.get('current'));
  if (!record) return null;
  if (!(record.blob instanceof Blob) || validateCvFile(record.asset) || (record.review !== null && !validReview(record.review))) throw new Error('تعذر قراءة السيرة المحفوظة.');
  if (!record.file_id) { record.file_id = 'cv-' + Date.now() + '-' + Math.random().toString(36).slice(2); await transaction(scope, 'readwrite', store => store.put(record, 'current')); }
  return asSaved(scope, record);
}
export async function storeCvFile(asset: DocumentPickerAsset): Promise<SavedCv> {
  const scope = captureDataScope();
  const problem = validateCvFile(asset);
  if (problem) throw new Error(problem);
  if (!asset.file) throw new Error('اختر الملف مجددًا من جهازك.');
  const record: BrowserRecord = { file_id: 'cv-' + Date.now() + '-' + Math.random().toString(36).slice(2), asset: { name: asset.name, size: asset.size, mimeType: asset.mimeType, lastModified: asset.lastModified }, blob: asset.file, review: null };
  await transaction(scope, 'readwrite', store => store.put(record, 'current'));
  return asSaved(scope, record);
}
export async function storeCvReview(uri: string, review: CvReview): Promise<void> {
  const scope = captureDataScope();
  if (!validReview(review)) throw new Error('Invalid CV review');
  if (uri !== activeUrls.get(scope.suffix)) return;
  const db = await openDatabase(scope);
  try { scope.assertCurrent(); } catch (error) { db.close(); throw error; }
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('resume', 'readwrite');
    const store = tx.objectStore('resume');
    const request = store.get('current');
    request.onsuccess = () => { if (request.result) store.put({ ...request.result, review }, 'current'); };
    tx.oncomplete = async () => { db.close(); await reportDataChange('masarak-saved-cv-v1', scope); try { scope.assertCurrent(); resolve(); } catch (error) { reject(error); } };
    tx.onabort = () => { db.close(); reject(tx.error); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}
export async function deleteSavedCv(): Promise<void> {
  const scope = captureDataScope();
  await transaction(scope, 'readwrite', store => store.delete('current'));
  const uri = activeUrls.get(scope.suffix);
  if (uri) URL.revokeObjectURL(uri);
  activeUrls.delete(scope.suffix); activeFileIds.delete(scope.suffix);
}

export async function prepareSavedCvRestore(asset: DocumentPickerAsset | null, review: CvReview | null) {
  const scope = captureDataScope();
  const prior = await transaction<BrowserRecord | undefined>(scope, 'readonly', store => store.get('current'));
  scope.assertCurrent();
  let record: BrowserRecord | null = null;
  if (asset) {
    const problem = validateCvFile(asset); if (problem) throw new Error(problem);
    if (!asset.file) throw new Error('Cloud CV file unavailable');
    record = { file_id: 'cv-cloud-' + Date.now() + '-' + Math.random().toString(36).slice(2), asset: { name: asset.name, size: asset.size, mimeType: asset.mimeType, lastModified: asset.lastModified }, blob: asset.file, review };
  }
  const rollbackScope = { ...scope, assertCurrent: () => {} };
  return {
    commit: async () => { if (record) await transaction(scope, 'readwrite', store => store.put(record, 'current')); else await transaction(scope, 'readwrite', store => store.delete('current')); return record ? asSaved(scope, record) : null; },
    rollback: async () => {
      if (prior) await transaction(rollbackScope, 'readwrite', store => store.put(prior, 'current')); else await transaction(rollbackScope, 'readwrite', store => store.delete('current'));
      const active = activeUrls.get(scope.suffix); if (active) URL.revokeObjectURL(active); activeUrls.delete(scope.suffix);
    },
    finish: async () => {},
  };
}
