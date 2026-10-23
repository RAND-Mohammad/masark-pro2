import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, ui } from '../constants/design';
import { MasarakIcon } from './masarak-icon';
import { DisclosureCard } from './disclosure-card';

export function ProfileEntryChoices() {
  const router = useRouter();

  return (
    <DisclosureCard title="ابدئي ملفك المهني" subtitle="اختاري طريقة إدخال بياناتك" summary="أسئلة قصيرة أو رفع سيرة PDF اختياري" status="خطوة أولى" statusTone="success" defaultExpanded>
      <View style={styles.intro}>
        <Text style={ui.text}>
          لا تحتاج إلى خبرة عمل لتبدأ. اختر الطريقة الأنسب لك، ويمكنك إضافة سيرة ذاتية لاحقًا.
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="رفع سيرة ذاتية بصيغة PDF باللغة الإنجليزية"
        accessibilityHint="يفتح صفحة رفع السيرة الذاتية"
        onPress={() => router.push('/upload-cv')}
        style={({ pressed }) => [styles.choice, styles.primaryChoice, pressed && ui.pressed]}
      >
        <View style={styles.choiceTop}>
          <View style={styles.iconFrame}>
            <MasarakIcon name="upload" size={22} />
          </View>
          <Text style={styles.step}>١</Text>
        </View>
        <Text style={styles.choiceTitle}>لديّ سيرة ذاتية</Text>
        <Text style={styles.choiceDescription}>
          ارفع ملف PDF باللغة الإنجليزية للبدء من معلوماتك الحالية.
        </Text>
        <Text style={styles.action}>رفع ملف PDF</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="إنشاء ملف مهني من خلال إجابات قصيرة"
        accessibilityHint="يفتح صفحة إنشاء ملف مهني جديد"
        onPress={() => router.push('/create-profile')}
        style={({ pressed }) => [styles.choice, pressed && ui.pressed]}
      >
        <View style={styles.choiceTop}>
          <View style={styles.iconFrame}>
            <MasarakIcon name="profile" size={22} />
          </View>
          <Text style={styles.step}>٢</Text>
        </View>
        <Text style={styles.choiceTitle}>سأبدأ من الصفر</Text>
        <Text style={styles.choiceDescription}>
          أجب عن أسئلة قصيرة لتكوين ملفك، حتى لو لم تعمل من قبل.
        </Text>
        <Text style={styles.action}>إنشاء ملفي بالإجابات</Text>
      </Pressable>

      <Text style={styles.optionalNote}>
        رفع السيرة الذاتية اختياري؛ يمكنك بناء ملفك دونها.
      </Text>
    </DisclosureCard>
  );
}

const styles = StyleSheet.create({
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
});
