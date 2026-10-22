import type { PersonalProfile } from './personal-profile';
import type { SkillProfile } from './skill-profile';
import { studentResumeHtml } from './student-resume-html';
import { captureDataScope } from './scoped-storage';

export async function printStudentResume(personal: PersonalProfile, skills: SkillProfile,
  assertCurrent = captureDataScope().assertCurrent): Promise<'web-print'> {
  assertCurrent();
  const popup = window.open('', '_blank');
  if (!popup) throw new Error('اسمح بفتح نافذة الطباعة في المتصفح ثم أعد المحاولة. ملفك محفوظ.');
  try {
    popup.opener = null;
    popup.document.open();
    popup.document.write(studentResumeHtml(personal, skills));
    popup.document.close();
    popup.focus();
    popup.print();
    return 'web-print';
  } catch {
    try { popup.close(); } catch { /* The browser owns the print window. */ }
    throw new Error('تعذر فتح الطباعة. حاول مجددًا؛ ملفك محفوظ.');
  }
}
