import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Pressable, ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, ui } from '../constants/design';
import { StudentResumePreview } from '../components/student-resume-preview';
import { loadStudentBase, type StudentBase } from '../utils/student-profile';
import { ResumeExportButton } from '../components/resume-export-button';

export default function ResumePreviewScreen() {
  const router = useRouter();
  const [base, setBase] = useState<StudentBase | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  useFocusEffect(useCallback(() => {
    let active = true;
    void loadStudentBase().then(data => { if (active) setBase(data); })
      .catch(() => { if (active) setError('تعذر قراءة ملفك المحفوظ. أعد فتح الصفحة.'); })
      .finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, []));
  const personal = base?.personal, skills = base?.skills;
  return <SafeAreaView style={ui.screen}><ScrollView contentContainerStyle={ui.content}>
    <Text style={ui.title}>سيرتي الأولية المحفوظة</Text>
    {error ? <Text accessibilityRole="alert" style={[ui.text, { color: colors.error }]}>{error}</Text> : null}
    {!ready ? <Text style={ui.text}>جارٍ تحميل الملف…</Text> : personal && skills ? <>
      <StudentResumePreview personal={personal} skills={skills} />
      <ResumeExportButton personal={personal} skills={skills} assertCurrent={base.scope.assertCurrent} />
    </> : <Text style={ui.text}>لم يُحفظ ملف بعد. يمكنك البدء من «ملفي» دون رفع سيرة.</Text>}
    <Pressable accessibilityRole="button" style={ui.outline} onPress={() => router.push('/profile')}><Text style={ui.outlineText}>العودة إلى ملفي</Text></Pressable>
  </ScrollView></SafeAreaView>;
}
