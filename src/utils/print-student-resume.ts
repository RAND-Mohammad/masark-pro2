import type { PersonalProfile } from './personal-profile';
import type { SkillProfile } from './skill-profile';
import { printToFileAsync } from 'expo-print';
import { isAvailableAsync, shareAsync } from 'expo-sharing';
import { File } from 'expo-file-system';
import { captureDataScope } from './scoped-storage';
import { studentResumeHtml } from './student-resume-html';

/** The native sharing API does not distinguish delivery, saving or cancellation. */
export async function printStudentResume(personal: PersonalProfile, skills: SkillProfile,
  assertCurrent = captureDataScope().assertCurrent): Promise<'native-share'> {
  assertCurrent();
  let available: boolean;
  try { available = await isAvailableAsync(); }
  catch { throw new Error('تعذر فتح المشاركة. حاول مجددًا؛ ملفك محفوظ.'); }
  assertCurrent();
  if (!available) throw new Error('المشاركة غير متاحة على هذا الجهاز. ملفك محفوظ.');
  let file: File | null = null;
  let stage: 'create' | 'share' = 'create';
  try {
    const result = await printToFileAsync({
      html: studentResumeHtml(personal, skills), width: 595, height: 842, base64: false,
    });
    // Only share the local file returned by the renderer, never a remote URL.
    if (!result.uri.startsWith('file://')) throw new Error('Invalid local PDF');
    file = new File(result.uri);
    assertCurrent();
    if (!file.exists || file.size <= 0 || !Number.isInteger(result.numberOfPages) || result.numberOfPages < 1) throw new Error('Empty PDF');
    stage = 'share';
    await shareAsync(file.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'حفظ أو مشاركة السيرة PDF' });
    assertCurrent();
    // Retain in OS-managed cache: deleting immediately can race an Android
    // recipient reading its granted URI. This is not permanent document storage.
    return 'native-share';
  } catch {
    // A failed/stale export must not leave a newly generated personal document.
    try { if (file?.exists) file.delete(); } catch { /* The private cache remains OS-managed. */ }
    assertCurrent();
    throw new Error(stage === 'create'
      ? 'تعذر إنشاء PDF. حاول مجددًا؛ ملفك محفوظ.'
      : 'تعذرت مشاركة PDF. حاول مجددًا؛ ملفك محفوظ.');
  }
}
