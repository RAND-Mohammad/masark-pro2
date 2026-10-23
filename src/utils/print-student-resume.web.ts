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
    // Keep a manual print action in the document for browsers that do not open
    // the print dialog from script. The toolbar is hidden in the resulting PDF.
    const toolbar = popup.document.createElement('div');
    toolbar.className = 'masarak-print-toolbar';
    toolbar.dir = 'rtl';
    toolbar.style.cssText = 'position:sticky;top:0;z-index:10;display:flex;justify-content:center;padding:12px;background:#eef4ef;border-bottom:1px solid #dce5da';
    const button = popup.document.createElement('button');
    button.type = 'button';
    button.textContent = 'حفظ السيرة كـ PDF';
    button.style.cssText = 'border:0;border-radius:10px;background:#176b62;color:#fff;padding:12px 20px;font:700 16px Arial,sans-serif;cursor:pointer';
    button.addEventListener('click', () => { popup.focus(); popup.print(); });
    toolbar.append(button);
    popup.document.body.prepend(toolbar);
    const printStyles = popup.document.querySelector('style');
    printStyles?.append('\n@media print{.masarak-print-toolbar{display:none!important}}');
    popup.focus();
    popup.print();
    return 'web-print';
  } catch {
    try { popup.close(); } catch { /* The browser owns the print window. */ }
    throw new Error('تعذر فتح الطباعة. حاول مجددًا؛ ملفك محفوظ.');
  }
}
