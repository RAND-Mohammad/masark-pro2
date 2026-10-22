import type { SupabaseClient } from '@supabase/supabase-js';
import type { DocumentPickerAsset } from 'expo-document-picker';
import type { CloudCv } from './cloud-types';
import { CV_MAX_BYTES, validateCvFile } from './cv-file';

export async function cvBytes(asset: DocumentPickerAsset): Promise<ArrayBuffer> {
  if (!asset.file) throw new Error('CV file unavailable');
  const bytes = await asset.file.arrayBuffer();
  if (!bytes.byteLength || bytes.byteLength > CV_MAX_BYTES) throw new Error('Invalid CV size');
  return bytes;
}
export async function downloadCloudCv(client: SupabaseClient, cv: CloudCv, parent?: AbortSignal) {
  if (parent?.aborted) throw new Error('Download canceled');
  const result = await client.storage.from('masarak-cvs').download(cv.path);
  if (result.error) throw result.error;
  const file = new File([result.data], cv.name, { type: cv.mimeType });
  const uri = URL.createObjectURL(file);
  const asset: DocumentPickerAsset = { uri, file, name: cv.name, size: file.size, mimeType: cv.mimeType, lastModified: file.lastModified };
  const error = validateCvFile(asset);
  if (error) { URL.revokeObjectURL(uri); throw new Error(error); }
  return { asset, cleanup: async () => URL.revokeObjectURL(uri) };
}
