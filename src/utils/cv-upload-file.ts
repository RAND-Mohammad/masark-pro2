import { File } from 'expo-file-system';
import { Platform } from 'react-native';
import type { DocumentPickerAsset } from 'expo-document-picker';
import { PDF_ONLY_MESSAGE, validateCvFile } from './cv-file';

// Picker filters are only hints. Validate metadata and actual bytes both on
// selection and immediately before constructing the upload request.
export async function getValidatedCvFile(asset: DocumentPickerAsset) {
  const problem = validateCvFile(asset);
  if (problem) throw new Error(problem);
  const content = Platform.OS === 'web' ? asset.file : new File(asset.uri);
  if (!content) throw new Error('تعذر قراءة ملف PDF. اختر الملف مجددًا.');
  const actualProblem = validateCvFile({ name: asset.name, size: content.size, mimeType: content.type || asset.mimeType });
  if (actualProblem) throw new Error(actualProblem);
  let header: Uint8Array;
  try {
    header = new Uint8Array(await content.slice(0, 5).arrayBuffer());
  } catch {
    throw new Error('تعذر قراءة ملف PDF. اختر نسخة سليمة أو اختر الملف مجددًا.');
  }
  if (String.fromCharCode(...header) !== '%PDF-') throw new Error(PDF_ONLY_MESSAGE);
  return content;
}
