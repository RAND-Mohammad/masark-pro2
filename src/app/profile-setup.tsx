import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PersonalBasicsForm } from '../components/personal-basics-form';
import { colors, createAdaptiveStyles, ui } from '../constants/design';
import { useAppPreferences } from '../contexts/app-preferences-context';

export default function ProfileSetupScreen() {
  const router = useRouter();
  const en = useAppPreferences().language === 'en';
  const text = (ar: string, english: string) => en ? english : ar;

  return <SafeAreaView edges={['top', 'left', 'right']} style={ui.screen}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={[styles.topline, en && styles.toplineLtr]}>
        <Text style={[ui.eyebrow, en && styles.ltr]}>{text('إعداد الملف · الخطوة 1 من 2', 'PROFILE SETUP · STEP 1 OF 2')}</Text>
        <Text style={[styles.stepCount, en && styles.ltr]}>{text('١ من ٢', '1 of 2')}</Text>
      </View>
      <View accessibilityRole="progressbar" accessibilityLabel={text('تقدم إعداد الملف', 'Profile setup progress')} accessibilityValue={{ min: 0, max: 2, now: 1 }} style={styles.track}><View style={styles.fill} /></View>
      <View style={styles.intro}>
        <Text style={[ui.title, en && styles.ltr]}>{text('أخبرينا من أين تبدأين.', 'Tell us where you’re starting.')}</Text>
        <Text style={[ui.text, en && styles.ltr]}>{text('معلومات الدراسة تساعدنا في تخصيص الإرشاد. يمكنك تعديلها لاحقًا.', 'Your education helps tailor guidance. You can update these details later.')}</Text>
      </View>
      <PersonalBasicsForm submitLabel={{ ar: 'متابعة إلى أهدافي', en: 'Continue to my goals' }} onSaved={() => router.replace('/choose-goal' as never)} />
      <View style={styles.privacyNote}><Text style={[ui.note, en && styles.ltr]}>{text('أضيفي فقط ما ترغبين بمشاركته، ويمكنك تحديث ملفك في أي وقت.', 'Only share what you are comfortable sharing. You can update your profile anytime.')}</Text></View>
      <Pressable accessibilityRole="button" onPress={() => router.replace('/choose-goal' as never)}><Text style={[ui.link, en && styles.ltr]}>{text('تخطي هذه الخطوة', 'Skip this step')}</Text></Pressable>
    </ScrollView>
  </SafeAreaView>;
}

const styles = createAdaptiveStyles(() => ({
  content: { width: '100%', maxWidth: 620, alignSelf: 'center', padding: 22, paddingBottom: 34, gap: 16 },
  topline: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  toplineLtr: { flexDirection: 'row' },
  stepCount: { color: colors.muted, fontSize: 11, textAlign: 'right' },
  track: { height: 6, borderRadius: 8, backgroundColor: colors.soft, overflow: 'hidden' },
  fill: { width: '50%', height: '100%', alignSelf: 'flex-end', backgroundColor: colors.primary, borderRadius: 8 },
  intro: { gap: 5 },
  privacyNote: { backgroundColor: colors.mint, borderRadius: 14, padding: 13 },
  ltr: { textAlign: 'left', writingDirection: 'ltr' },
}));
