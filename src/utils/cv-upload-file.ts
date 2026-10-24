import { File, FileMode } from 'expo-file-system';
import { Platform } from 'react-native';
import type { DocumentPickerAsset } from 'expo-document-picker';
import { PDF_ONLY_MESSAGE, validateCvFile } from './cv-file';

// Picker filters are only hints. Validate metadata and actual bytes both on
// selection and immediately before constructing the upload request.
export async function getValidatedCvFile(asset: DocumentPickerAsset) {
  const problem = validateCvFile(asset);
  if (problem) throw new Error(problem);
  const nativeFile = Platform.OS === 'web' ? null : new File(asset.uri);
  const content = Platform.OS === 'web' ? asset.file : nativeFile;
  if (!content) throw new Error('تعذر قراءة ملف PDF. اختر الملف مجددًا.');
  const actualProblem = validateCvFile({ name: asset.name, size: content.size, mimeType: content.type || asset.mimeType });
  if (actualProblem) throw new Error(actualProblem);
  let header: Uint8Array;
  try {
    if (Platform.OS === 'web') {
      header = new Uint8Array(await content.slice(0, 5).arrayBuffer());
    } else {
      // File.slice() reads synchronously on native and can fail for iOS picker URLs.
      // Use Expo's async file handle API so the picker cache/security scope is honored.
      const handle = nativeFile!.open(FileMode.ReadOnly);
      try {
        header = await handle.readBytes(5);
      } finally {
        handle.close();
      }
    }
  } catch {
    throw new Error('تعذر قراءة ملف PDF. اختر نسخة سليمة أو اختر الملف مجددًا.');
  }
  if (String.fromCharCode(...header) !== '%PDF-') throw new Error(PDF_ONLY_MESSAGE);
  return content;
}
