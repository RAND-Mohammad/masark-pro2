import type { DocumentPickerAsset } from 'expo-document-picker';

export async function exportAccountData(payload: unknown): Promise<void> {
  const stamp = new Date().toISOString().slice(0, 10);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `masarak-account-data-${stamp}.json`;
    anchor.click();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

export async function exportSavedCvFile(asset: DocumentPickerAsset): Promise<void> {
  const response = asset.file ? null : await fetch(asset.uri);
  if (response && !response.ok) throw new Error('تعذر فتح ملف السيرة المحفوظ.');
  const content = asset.file ?? await response!.blob();
  const url = URL.createObjectURL(content);
  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = asset.name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
