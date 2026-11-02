import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { colors, ui, createAdaptiveStyles} from '../constants/design';
import { MasarakIcon } from './masarak-icon';
import { DisclosureCard } from './disclosure-card';
import { useAppPreferences } from '../contexts/app-preferences-context';

export function ProfileEntryChoices() {
  const router = useRouter();
  const { language } = useAppPreferences();
  const en = language === 'en';

  return (
    <DisclosureCard title={en ? 'Start your professional profile' : 'ابدئي ملفك المهني'} subtitle={en ? 'Choose how to add your information' : 'اختاري طريقة إدخال بياناتك'} summary={en ? 'Quick questions or optional PDF upload' : 'أسئلة قصيرة أو رفع سيرة PDF اختياري'} status={en ? 'First step' : 'خطوة أولى'} statusTone="success" defaultExpanded>
      <View style={styles.intro}>
        <Text style={[ui.text, en && styles.ltr]}>
          {en ? 'You do not need work experience to get started. Choose the option that suits you; you can add a CV later.' : 'لا تحتاج إلى خبرة عمل لتبدأ. اختر الطريقة الأنسب لك، ويمكنك إضافة سيرة ذاتية لاحقًا.'}
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={en ? 'Upload an English-language PDF CV' : 'رفع سيرة ذاتية بصيغة PDF باللغة الإنجليزية'}
        accessibilityHint={en ? 'Opens the CV upload page' : 'يفتح صفحة رفع السيرة الذاتية'}
        onPress={() => router.push('/upload-cv')}
        style={({ pressed }) => [styles.choice, styles.primaryChoice, pressed && ui.pressed]}
      >
        <View style={styles.choiceTop}>
          <View style={styles.iconFrame}>
            <MasarakIcon name="upload" size={22} />
          </View>
        <Text style={styles.step}>{en ? '1' : '١'}</Text>
        </View>
        <Text style={[styles.choiceTitle, en && styles.ltr]}>{en ? 'I have a CV' : 'لديّ سيرة ذاتية'}</Text>
        <Text style={[styles.choiceDescription, en && styles.ltr]}>
          {en ? 'Upload an English-language PDF to start with the information you already have.' : 'ارفع ملف PDF باللغة الإنجليزية للبدء من معلوماتك الحالية.'}
        </Text>
        <Text style={[styles.action, en && styles.ltr]}>{en ? 'Upload PDF' : 'رفع ملف PDF'}</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={en ? 'Create a professional profile with quick answers' : 'إنشاء ملف مهني من خلال إجابات قصيرة'}
        accessibilityHint={en ? 'Opens the profile setup page' : 'يفتح صفحة إنشاء ملف مهني جديد'}
        onPress={() => router.push('/create-profile')}
        style={({ pressed }) => [styles.choice, pressed && ui.pressed]}
      >
        <View style={styles.choiceTop}>
          <View style={styles.iconFrame}>
            <MasarakIcon name="profile" size={22} />
          </View>
        <Text style={styles.step}>{en ? '2' : '٢'}</Text>
        </View>
        <Text style={[styles.choiceTitle, en && styles.ltr]}>{en ? 'I will start from scratch' : 'سأبدأ من الصفر'}</Text>
        <Text style={[styles.choiceDescription, en && styles.ltr]}>
          {en ? 'Answer a few short questions to build your profile, even if you have not worked before.' : 'أجب عن أسئلة قصيرة لتكوين ملفك، حتى لو لم تعمل من قبل.'}
        </Text>
        <Text style={[styles.action, en && styles.ltr]}>{en ? 'Build my profile' : 'إنشاء ملفي بالإجابات'}</Text>
      </Pressable>

      <Text style={[styles.optionalNote, en && styles.ltr]}>
        {en ? 'Uploading a CV is optional. You can build your profile without one.' : 'رفع السيرة الذاتية اختياري؛ يمكنك بناء ملفك دونها.'}
      </Text>
    </DisclosureCard>
  );
}

const styles = createAdaptiveStyles(() => ({
  intro: {
    alignItems: 'flex-end',
    gap: 10,
    paddingBottom: 6,
  },
  mark: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
    backgroundColor: colors.mint,
    marginBottom: 4,
  },
  choice: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    padding: 18,
    gap: 9,
  },
  primaryChoice: {
    borderColor: colors.primary,
    backgroundColor: colors.mint,
  },
  choiceTop: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  iconFrame: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderRadius: 13,
  },
  step: {
    color: colors.gold,
    fontSize: 13,
    fontWeight: '700',
  },
  choiceTitle: {
    color: colors.ink,
    fontSize: 19,
    lineHeight: 28,
    fontWeight: '700',
    textAlign: 'right',
  },
  choiceDescription: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 23,
    textAlign: 'right',
  },
  action: {
    color: colors.primary,
    fontSize: 15,
    lineHeight: 23,
    fontWeight: '700',
    textAlign: 'right',
    paddingTop: 3,
  },
  optionalNote: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 21,
    textAlign: 'center',
    paddingTop: 2,
  },
  ltr: { textAlign: 'left' as const, writingDirection: 'ltr' as const },
}));
