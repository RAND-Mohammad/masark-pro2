import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { colors, ui } from '../constants/design';
import { printStudentResume } from '../utils/print-student-resume';
import type { PersonalProfile } from '../utils/personal-profile';
import type { SkillProfile } from '../utils/skill-profile';

export function ResumeExportButton({ personal, skills, assertCurrent }: {
  personal: PersonalProfile; skills: SkillProfile; assertCurrent: () => void;
}) {
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
        ? 'تم تجهيز PDF وفتح المشاركة. الحفظ أو الإرسال حسب اختيارك.'
        : 'في نافذة الطباعة اختاري «Save as PDF / حفظ PDF»، ثم «Save / حفظ».');
    } catch (failure) {
      if (active.current) setError(failure instanceof Error ? failure.message : 'تعذر تصدير PDF. حاول مجددًا.');
    } finally {
      locked.current = false;
      if (active.current) setBusy(false);
    }
  }
  return <View style={{ gap: 8 }}>
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy, busy }} disabled={busy}
      style={ui.outline} onPress={() => void exportPdf()}>
      <Text style={ui.outlineText}>{busy ? 'جارٍ تجهيز PDF…' : Platform.OS === 'web' ? 'طباعة / حفظ PDF من المتصفح' : 'تصدير ومشاركة PDF'}</Text>
    </Pressable>
    {!!message && <Text accessibilityRole="alert" style={ui.note}>{message}</Text>}
    {!!error && <Text accessibilityRole="alert" style={[ui.note, { color: colors.error }]}>{error}</Text>}
  </View>;
}
