import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { DocumentPickerAsset } from 'expo-document-picker';

export async function exportAccountData(payload: unknown): Promise<void> {
  const stamp = new Date().toISOString().slice(0, 10);
  const file = new File(Paths.cache, `masarak-account-data-${stamp}.json`);
  await file.write(JSON.stringify(payload, null, 2));
  if (!await Sharing.isAvailableAsync()) throw new Error('مشاركة الملفات غير متاحة على هذا الجهاز.');
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json',
    dialogTitle: 'تصدير بيانات مسارك',
    UTI: 'public.json',
  });
}

export async function exportSavedCvFile(asset: DocumentPickerAsset): Promise<void> {
  if (!await Sharing.isAvailableAsync()) throw new Error('مشاركة الملفات غير متاحة على هذا الجهاز.');
  await Sharing.shareAsync(asset.uri, {
    mimeType: asset.mimeType ?? 'application/pdf',
    dialogTitle: asset.name,
    UTI: 'com.adobe.pdf',
  });
}
