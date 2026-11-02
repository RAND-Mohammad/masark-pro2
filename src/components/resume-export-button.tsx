import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { colors, ui } from '../constants/design';
import { printStudentResume } from '../utils/print-student-resume';
import type { PersonalProfile } from '../utils/personal-profile';
import type { SkillProfile } from '../utils/skill-profile';
import { useAppPreferences } from '../contexts/app-preferences-context';

export function ResumeExportButton({ personal, skills, assertCurrent }: {
  personal: PersonalProfile; skills: SkillProfile; assertCurrent: () => void;
}) {
  const { language } = useAppPreferences();
  const en = language === 'en';
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const locked = useRef(false);
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  async function exportPdf() {
    if (locked.current) return;
    locked.current = true; setBusy(true); setMessage(''); setError('');
    try {
      assertCurrent();
      const result = await printStudentResume(personal, skills, assertCurrent);
      assertCurrent();
      if (active.current) setMessage(result === 'native-share'
        ? en ? 'The PDF is ready and the share sheet is open. Save or send it using your preferred option.' : 'تم تجهيز PDF وفتح المشاركة. الحفظ أو الإرسال حسب اختيارك.'
        : en ? 'In the print window, choose “Save as PDF”, then “Save”.' : 'في نافذة الطباعة اختاري «Save as PDF / حفظ PDF»، ثم «Save / حفظ».');
    } catch (failure) {
      if (active.current) setError(failure instanceof Error && en
        ? failure.message.includes('المشاركة غير متاحة') ? 'Sharing is not available on this device. Your profile is saved.' : failure.message.includes('فتح المشاركة') ? 'Could not open sharing. Try again; your profile is saved.' : failure.message.includes('إنشاء PDF') ? 'Could not create the PDF. Try again; your profile is saved.' : 'Could not share the PDF. Try again; your profile is saved.'
        : failure instanceof Error ? failure.message : en ? 'Could not export the PDF. Try again.' : 'تعذر تصدير PDF. حاول مجددًا.');
    } finally {
      locked.current = false;
      if (active.current) setBusy(false);
    }
  }
  return <View style={{ gap: 8 }}>
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy, busy }} disabled={busy}
      style={ui.outline} onPress={() => void exportPdf()}>
      <Text style={ui.outlineText}>{busy ? en ? 'Preparing PDF…' : 'جارٍ تجهيز PDF…' : Platform.OS === 'web' ? en ? 'Print / save PDF from browser' : 'طباعة / حفظ PDF من المتصفح' : en ? 'Export and share PDF' : 'تصدير ومشاركة PDF'}</Text>
    </Pressable>
    {!!message && <Text accessibilityRole="alert" style={ui.note}>{message}</Text>}
    {!!error && <Text accessibilityRole="alert" style={[ui.note, { color: colors.error }]}>{error}</Text>}
  </View>;
}
