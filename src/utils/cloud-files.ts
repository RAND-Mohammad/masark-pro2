import { File, Paths } from 'expo-file-system';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { DocumentPickerAsset } from 'expo-document-picker';
import type { CloudCv } from './cloud-types';
import { CV_MAX_BYTES, validateCvFile } from './cv-file';

export async function cvBytes(asset: DocumentPickerAsset): Promise<ArrayBuffer> {
  const bytes = await new File(asset.uri).arrayBuffer();
  if (!bytes.byteLength || bytes.byteLength > CV_MAX_BYTES) throw new Error('Invalid CV size');
  return bytes;
}
export async function downloadCloudCv(client: SupabaseClient, cv: CloudCv, parent?: AbortSignal) {
  const result = await client.storage.from('masarak-cvs').createSignedUrl(cv.path, 120);
  if (result.error) throw result.error;
  const destination = new File(Paths.cache, `masarak-download-${Date.now()}-${Math.random().toString(36).slice(2)}.${cv.name.toLowerCase().endsWith('.pdf') ? 'pdf' : 'docx'}`);
  const controller = new AbortController(); const abort = () => controller.abort();
  if (parent?.aborted) abort(); else parent?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, 60000);
  try {
    const downloaded = await File.downloadFileAsync(result.data.signedUrl, destination, { signal: controller.signal });
    const asset: DocumentPickerAsset = { uri: downloaded.uri, name: cv.name, size: downloaded.size, mimeType: cv.mimeType, lastModified: Date.now() };
    const error = validateCvFile(asset);
    if (error) throw new Error(error);
    return { asset, cleanup: async () => { if (destination.exists) destination.delete(); } };
  } catch (error) { if (destination.exists) destination.delete(); throw error; }
  finally { clearTimeout(timer); parent?.removeEventListener('abort', abort); }
}
