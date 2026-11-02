import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MasarakIcon, type IconName } from '../components/masarak-icon';
import { colors, createAdaptiveStyles } from '../constants/design';
import { useAppPreferences } from '../contexts/app-preferences-context';

const steps: { icon: IconName; title: [string, string]; description: [string, string] }[] = [
  { icon: 'upload', title: ['ابدأ بخبرتك', 'Bring your experience'], description: ['ارفع سيرتك بصيغة PDF أو أضف مهاراتك يدويًا.', 'Upload a PDF CV, or add skills manually.'] },
  { icon: 'check', title: ['راجع مهاراتك', 'Review your skills'], description: ['عدّل ما يستخرجه الذكاء الاصطناعي؛ القرار لك.', 'Edit what AI finds. You stay in control.'] },
  { icon: 'careers', title: ['اكتشف اتجاهك', 'Explore your direction'], description: ['قارن المسارات المهنية المناسبة لك.', 'Compare indicative career matches.'] },
  { icon: 'plan', title: ['اتبع خارطة واضحة', 'Follow a clear roadmap'], description: ['سد فجوات المهارات درسًا بعد درس.', 'Close skill gaps, one lesson at a time.'] },
  { icon: 'chat', title: ['تدرّب بثقة', 'Practise with confidence'], description: ['تمرّن للمقابلات وراجع ملاحظاتك.', 'Rehearse interviews and get feedback.'] },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { language } = useAppPreferences();
  const en = language === 'en';
  const text = (ar: string, english: string) => en ? english : ar;
  const rowDirection = en ? 'row' as const : 'row-reverse' as const;

  return <SafeAreaView edges={['top', 'left', 'right']} style={styles.screen}>
    <ScrollView contentContainerStyle={styles.content}>
      <View style={[styles.topRow, { flexDirection: rowDirection }]}>
        <Text style={[styles.header, en && styles.ltr]}>{text('كيف يعمل مسارك', 'How MASARAK works')}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={text('إغلاق', 'Close')} onPress={() => router.canGoBack() ? router.back() : router.replace('/')} style={styles.closeButton}>
          <Text style={styles.closeText}>×</Text>
        </Pressable>
      </View>

      <View style={styles.intro}>
        <Text style={[styles.eyebrow, en && styles.ltr]}>{text('مصمم لخطوتك المهنية القادمة', 'MADE FOR YOUR NEXT CHAPTER')}</Text>
        <Text style={[styles.title, en && styles.ltr]}>{text('مسار واضح، لا تخمين.', 'A path, not a guess.')}</Text>
        <Text style={[styles.description, en && styles.ltr]}>{text('خمس خطوات بسيطة من خبرتك إلى فرصتك القادمة.', 'Five small steps from your experience to your next opportunity.')}</Text>
      </View>

      <View style={styles.stepCard}>
        {steps.map((step, index) => <View key={step.title[1]} style={[styles.stepRow, { flexDirection: rowDirection }]}>
          <View style={styles.iconColumn}>
            <View style={styles.iconBox}><MasarakIcon name={step.icon} size={24} /></View>
            {index < steps.length - 1 ? <View style={styles.connector} /> : null}
          </View>
          <View style={styles.stepCopy}>
            <Text style={[styles.stepTitle, en && styles.ltr]}>{text(step.title[0], step.title[1])}</Text>
            <Text style={[styles.stepDescription, en && styles.ltr]}>{text(step.description[0], step.description[1])}</Text>
          </View>
        </View>)}
      </View>

      <View style={[styles.guidanceNote, { flexDirection: rowDirection }]}>
        <View style={styles.sparkle}><Text style={styles.sparkleText}>✦</Text></View>
        <Text style={[styles.guidanceText, en && styles.ltr]}>{text('الذكاء الاصطناعي يقدم إرشادًا لا ضمانات. اختياراتك بيدك دائمًا.', 'AI offers guidance, not guarantees. Your choices always come first.')}</Text>
      </View>

      <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/account', params: { mode: 'signup' } })} style={({ pressed }) => [styles.startButton, pressed && styles.pressed]}>
        <Text style={styles.startText}>{text('لنبدأ', 'Let’s get started')} <Text style={styles.arrow}>{en ? '→' : '←'}</Text></Text>
      </Pressable>
    </ScrollView>
  </SafeAreaView>;
}

const styles = createAdaptiveStyles(() => ({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { width: '100%', maxWidth: 650, alignSelf: 'center', paddingHorizontal: 24, paddingTop: 12, paddingBottom: 26, gap: 20 },
  topRow: { minHeight: 46, alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  header: { color: colors.navy, fontSize: 18, lineHeight: 26, fontWeight: '700', textAlign: 'right' },
  closeButton: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  closeText: { color: colors.muted, fontSize: 30, lineHeight: 34, fontWeight: '300' },
  intro: { gap: 10, paddingTop: 7, paddingBottom: 1 },
  eyebrow: { color: colors.primary, fontSize: 12, lineHeight: 18, fontWeight: '700', letterSpacing: 1.2, textAlign: 'right' },
  title: { color: colors.navy, fontSize: 34, lineHeight: 43, fontWeight: '800', textAlign: 'right' },
  description: { color: colors.muted, fontSize: 17, lineHeight: 27, textAlign: 'right' },
  stepCard: { backgroundColor: colors.surface, borderRadius: 24, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 19, paddingVertical: 20, gap: 12 },
  stepRow: { minHeight: 73, alignItems: 'flex-start', gap: 16 },
  iconColumn: { width: 40, alignItems: 'center', alignSelf: 'stretch' },
  iconBox: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  connector: { width: 1.5, flex: 1, minHeight: 20, marginTop: 2, backgroundColor: colors.border },
  stepCopy: { flex: 1, gap: 3, paddingTop: 3 },
  stepTitle: { color: colors.navy, fontSize: 17, lineHeight: 24, fontWeight: '700', textAlign: 'right' },
  stepDescription: { color: colors.muted, fontSize: 14, lineHeight: 22, textAlign: 'right' },
  guidanceNote: { backgroundColor: colors.mint, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 15, alignItems: 'center', gap: 11 },
  sparkle: { width: 28, alignItems: 'center' },
  sparkleText: { color: colors.primary, fontSize: 23, fontWeight: '700' },
  guidanceText: { flex: 1, color: colors.muted, fontSize: 14, lineHeight: 22, textAlign: 'right' },
  startButton: { backgroundColor: colors.primary, borderRadius: 17, minHeight: 58, paddingHorizontal: 18, paddingVertical: 15, alignItems: 'center', justifyContent: 'center' },
  startText: { color: colors.onPrimary, fontSize: 17, fontWeight: '700', textAlign: 'center' },
  arrow: { fontSize: 21 },
  ltr: { textAlign: 'left', writingDirection: 'ltr' },
  pressed: { opacity: 0.72 },
}));
