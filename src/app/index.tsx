import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/auth-context';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MasarakBrand } from '../components/masarak-brand';
import { colors, createAdaptiveStyles } from '../constants/design';
import { useAppPreferences } from '../contexts/app-preferences-context';

export default function WelcomeScreen() {
  const router = useRouter();
  const auth = useAuth();
  const { language, setLanguage } = useAppPreferences();
  const en = language === 'en';
  const t = (ar: string, english: string) => en ? english : ar;

  return <SafeAreaView style={styles.screen}>
    <ScrollView contentContainerStyle={styles.content}>
      <View style={[styles.topRow, en && styles.rowLtr]}>
        <Text style={[styles.topLabel, en && styles.ltr]}>{t('من الجامعة إلى المسار المهني', 'FROM CAMPUS TO CAREER')}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={en ? 'Switch to Arabic' : 'Switch to English'} onPress={() => void setLanguage(en ? 'ar' : 'en')} style={styles.languageButton}>
          <Text style={styles.languageButtonText}>{en ? 'العربية' : 'English'}</Text>
        </Pressable>
      </View>

      <View style={styles.logo}><MasarakBrand hero /></View>

      <View style={styles.hero}>
        <Text style={[styles.eyebrow, en && styles.ltr]}>{t('مسارك يبدأ بخطوة واضحة', 'YOUR NEXT CHAPTER STARTS HERE')}</Text>
        <Text style={[styles.title, en && styles.ltr]}>{en ? <>Your future.{ '\n' }A clearer direction.</> : <>مستقبلك.{ '\n' }واتجاه أوضح.</>}</Text>
        <Text style={[styles.description, en && styles.ltr]}>{t('إرشاد مهني لطلاب وخريجي التخصصات الحاسوبية في السعودية.', 'AI career guidance for students and graduates across computing fields in Saudi Arabia.')}</Text>
      </View>

      <View style={styles.actions}>
        {!auth.session ? <>
          <Pressable accessibilityRole="button" style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]} onPress={() => router.push('/onboarding' as never)}>
            <Text style={styles.primaryText}>{t('اكتشف مسارك', 'Find my path')} <Text style={styles.arrow}>{en ? '→' : '←'}</Text></Text>
          </Pressable>
          <Pressable accessibilityRole="button" style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]} onPress={() => router.push({ pathname: '/account', params: { mode: 'login' } })}>
            <Text style={styles.secondaryText}>{t('لدي حساب بالفعل', 'I already have an account')}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => router.replace('/home')}>
            <Text style={[styles.guestLink, en && styles.ltr]}>{t('المتابعة دون حساب', 'Continue without an account')}</Text>
          </Pressable>
        </> : <Pressable accessibilityRole="button" style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]} onPress={() => router.replace('/home')}>
          <Text style={styles.primaryText}>{t('تابع رحلتك', 'Continue my journey')} <Text style={styles.arrow}>{en ? '→' : '←'}</Text></Text>
        </Pressable>}
      </View>

      <Text style={[styles.note, en && styles.ltr]}>{t('مبني حول مهاراتك. وتقودك طموحاتك.', 'Built around your skills. Led by your ambition.')}</Text>
    </ScrollView>
  </SafeAreaView>;
}

const styles = createAdaptiveStyles(() => ({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { width: '100%', maxWidth: 520, alignSelf: 'center', flexGrow: 1, paddingHorizontal: 26, paddingTop: 16, paddingBottom: 26, justifyContent: 'space-between', gap: 20 },
  topRow: { minHeight: 42, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  rowLtr: { flexDirection: 'row' },
  topLabel: { color: colors.primary, fontSize: 11, fontWeight: '700', letterSpacing: 1.1, textAlign: 'right', flexShrink: 1 },
  languageButton: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  languageButtonText: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  logo: { marginTop: 4, marginBottom: 0 },
  hero: { gap: 12 },
  eyebrow: { color: colors.primary, fontSize: 12, fontWeight: '700', letterSpacing: 1, textAlign: 'right' },
  title: { color: colors.navy, fontSize: 34, lineHeight: 43, fontWeight: '800', textAlign: 'right' },
  description: { color: colors.muted, fontSize: 17, lineHeight: 26, textAlign: 'right' },
  actions: { gap: 11 },
  primaryButton: { backgroundColor: colors.primary, borderRadius: 17, minHeight: 58, paddingHorizontal: 18, paddingVertical: 15, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: colors.onPrimary, fontSize: 17, fontWeight: '700', textAlign: 'center' },
  arrow: { fontSize: 21 },
  secondaryButton: { backgroundColor: colors.mint, borderRadius: 17, minHeight: 54, padding: 15, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: colors.primary, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  guestLink: { color: colors.primary, fontSize: 13, textAlign: 'center', padding: 6 },
  note: { color: colors.muted, fontSize: 12, lineHeight: 20, textAlign: 'center' },
  ltr: { textAlign: 'left', writingDirection: 'ltr' },
  pressed: { opacity: 0.72 },
}));
