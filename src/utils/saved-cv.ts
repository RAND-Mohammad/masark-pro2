import AsyncStorage, { captureDataScope, replaceScopedItems } from './scoped-storage';
import { Directory, File, Paths } from 'expo-file-system';
import type { DocumentPickerAsset } from 'expo-document-picker';
import { validateCvFile } from './cv-file';
import { validReview, type CvReview, type SavedCv } from './saved-cv.types';

const key = 'masarak-saved-cv-v1';
function cvDirectory() { return new Directory(Paths.document, 'masarak-cv' + captureDataScope().suffix); }
function ownedFile(uri: string) {
  const directory = cvDirectory();
  if (!uri.startsWith(directory.uri.replace(/\/$/, '') + '/')) throw new Error('Invalid saved CV path');
  return new File(uri);
}
let pending: Promise<unknown> = Promise.resolve();
function serialize<T>(action: () => Promise<T>): Promise<T> {
  const scope = captureDataScope();
  const operation = pending.then(async () => { scope.assertCurrent(); const result = await action(); scope.assertCurrent(); return result; });
  pending = operation.catch(() => undefined);
  return operation;
}
async function readRecord(): Promise<SavedCv | null> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return null;
  const parsed = JSON.parse(raw) as SavedCv;
  if (!parsed?.asset || typeof parsed.asset.uri !== 'string' || typeof parsed.asset.name !== 'string' || validateCvFile(parsed.asset) || (parsed.review !== null && !validReview(parsed.review))) throw new Error('Invalid saved CV');
  if (!ownedFile(parsed.asset.uri).exists) throw new Error('ملف السيرة المحفوظ غير متوفر. اختر نسخة جديدة.');
  return { ...parsed, file_id: parsed.file_id ?? parsed.asset.uri };
}
export function loadSavedCv(): Promise<SavedCv | null> { return serialize(readRecord); }

export function storeCvFile(asset: DocumentPickerAsset): Promise<SavedCv> {
  const scope = captureDataScope();
  return serialize(async () => {
    const problem = validateCvFile(asset);
    if (problem) throw new Error(problem);
    const directory = cvDirectory();
    directory.create({ idempotent: true, intermediates: true });
    const destination = new File(directory, `cv-${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`);
    const prior = await AsyncStorage.getItem(key);
    await new File(asset.uri).copy(destination);
    try { scope.assertCurrent(); } catch (error) { if (destination.exists) destination.delete(); throw error; }
    const saved: SavedCv = { file_id: destination.uri, asset: { uri: destination.uri, name: asset.name, size: asset.size, mimeType: asset.mimeType, lastModified: asset.lastModified }, review: null };
    try { await AsyncStorage.setItem(key, JSON.stringify(saved)); }
    catch (error) { if (destination.exists) destination.delete(); throw error; }
    if (prior) {
      try {
        const old = ownedFile(JSON.parse(prior).asset.uri);
        if (old.exists) old.delete();
      } catch { /* Retain the new saved CV even if cleanup of an old file fails. */ }
    }
    return saved;
  });
}
export function storeCvReview(uri: string, review: CvReview): Promise<void> {
  return serialize(async () => {
    if (!validReview(review)) throw new Error('Invalid CV review');
    const saved = await readRecord();
    if (!saved || saved.asset.uri !== uri) return;
    await AsyncStorage.setItem(key, JSON.stringify({ ...saved, review }));
  });
}
export function deleteSavedCv(): Promise<void> {
  return serialize(async () => {
    const raw = await AsyncStorage.getItem(key);
    if (raw) {
      const file = ownedFile(JSON.parse(raw).asset.uri);
      if (file.exists) file.delete();
    }
    await AsyncStorage.removeItem(key);
  });
}

// Stage the new bytes without deleting the previous file; the caller commits the whole account snapshot.
export async function prepareSavedCvRestore(asset: DocumentPickerAsset | null, review: CvReview | null) {
  const scope = captureDataScope();
  const prior = await readRecord(); scope.assertCurrent();
  let destination: File | null = null;
  let saved: SavedCv | null = null;
  if (asset) {
    const problem = validateCvFile(asset); if (problem) throw new Error(problem);
    const directory = cvDirectory(); directory.create({ idempotent: true, intermediates: true });
    destination = new File(directory, `cv-cloud-${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`);
    await new File(asset.uri).copy(destination);
    try { scope.assertCurrent(); } catch (error) { if (destination.exists) destination.delete(); throw error; }
    saved = { file_id: destination.uri, asset: { uri: destination.uri, name: asset.name, size: asset.size, mimeType: asset.mimeType, lastModified: asset.lastModified }, review };
  }
  const rollbackScope = { ...scope, assertCurrent: () => {} };
  return {
    commit: async () => { scope.assertCurrent(); await replaceScopedItems([[key, saved ? JSON.stringify(saved) : null]], scope); return saved; },
    rollback: async () => { await replaceScopedItems([[key, prior ? JSON.stringify(prior) : null]], rollbackScope); if (destination?.exists) destination.delete(); },
    finish: async () => { if (prior && prior.asset.uri !== saved?.asset.uri) { const old = new File(prior.asset.uri); if (old.exists) old.delete(); } },
  };
}
