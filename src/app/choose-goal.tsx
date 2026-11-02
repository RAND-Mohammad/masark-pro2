import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors, createAdaptiveStyles, ui } from '../constants/design';
import { useAppPreferences } from '../contexts/app-preferences-context';
import { usePersonalProfile } from '../hooks/use-personal-profile';
import { emptyPersonalProfile, savePersonalProfile } from '../utils/personal-profile';
import { resolveBaseCareerId } from '../constants/job-paths';

const paths = [
  { id: 'C01', ar: 'تطوير البرمجيات', en: 'Software development' },
  { id: 'C02', ar: 'تحليل البيانات', en: 'Data analysis' },
  { id: 'C03', ar: 'علم البيانات', en: 'Data science' },
  { id: 'C04', ar: 'الذكاء الاصطناعي وتعلّم الآلة', en: 'AI and machine learning' },
  { id: 'C05', ar: 'الأمن السيبراني', en: 'Cybersecurity' },
  { id: 'C06', ar: 'الشبكات', en: 'Networking' },
  { id: 'C07', ar: 'هندسة البيانات', en: 'Data engineering' },
  { id: 'C08', ar: 'السحابة وDevOps', en: 'Cloud and DevOps' },
  { id: 'C09', ar: 'تحليل نظم الأعمال', en: 'Business systems analysis' },
] as const;

export default function ChooseGoalScreen() {
  const router = useRouter();
  const { source } = useLocalSearchParams<{ source?: string }>();
  const fromProfile = source === 'profile';
  const en = useAppPreferences().language === 'en';
  const text = (ar: string, english: string) => en ? english : ar;
  const profileState = usePersonalProfile();
  const savedGoal = profileState.personal?.careerGoal ? resolveBaseCareerId(profileState.personal.careerGoal) : null;
  const [modeChoice, setModeChoice] = useState<'discover' | 'choose' | null>(null);
  const mode = modeChoice ?? (savedGoal ? 'choose' : 'discover');
  const [chosenPath, setChosenPath] = useState<string | null>(null);
  const selectedPath = chosenPath ?? savedGoal;
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function continueToNext() {
    if (!profileState.ready || busy || (mode === 'choose' && !selectedPath)) return;
    setBusy(true); setError('');
    try {
      const current = profileState.personal ?? emptyPersonalProfile();
      const saved = await savePersonalProfile({ ...current, careerGoal: mode === 'discover' ? null : selectedPath });
      profileState.setPersonal(saved);
      router.push((fromProfile ? '/profile' : '/careers') as never);
    } catch {
      setError(text('تعذر حفظ اختيارك. أعد المحاولة.', 'Could not save your choice. Try again.'));
    } finally { setBusy(false); }
  }

  const selectedName = paths.find(path => path.id === selectedPath);

  return <SafeAreaView edges={['top', 'left', 'right']} style={ui.screen}>
    <ScrollView contentContainerStyle={styles.content}>
      <Pressable accessibilityRole="button" onPress={() => router.replace(fromProfile ? '/profile' as never : '/profile-setup' as never)}>
        <Text style={[ui.link, en && styles.ltr]}>{fromProfile ? text('رجوع إلى ملفي', 'Back to my profile') : text('رجوع', 'Back')}</Text>
      </Pressable>
      <View style={[styles.stepHeader, en && styles.rowLtr]}>
        <Text style={[ui.eyebrow, en && styles.ltr]}>{text('الخطوة 2 من 2', 'CAREER GOAL')}</Text>
        <Text style={[styles.stepCount, en && styles.ltr]}>{text('٢ من ٢', '2 of 2')}</Text>
      </View>
      <View accessibilityRole="progressbar" accessibilityLabel={text('تقدم إعداد الملف', 'Profile setup progress')} accessibilityValue={{ min: 0, max: 2, now: 2 }} style={styles.track}><View style={styles.fill} /></View>
      <View style={styles.intro}>
        <Text style={[ui.title, en && styles.ltr]}>{text('إلى أين تودين التوجه؟', 'Where would you like to go?')}</Text>
        <Text style={[ui.text, en && styles.ltr]}>{text('ليس مطلوبًا أن تكون لديك كل الإجابات الآن.', 'You don’t need to have it all figured out.')}</Text>
      </View>

      {!profileState.ready ? <Text style={[ui.note, en && styles.ltr]}>{text('جارٍ تحميل ملفك…', 'Loading your profile…')}</Text> : <>
        <Pressable accessibilityRole="radio" accessibilityState={{ selected: mode === 'discover', disabled: busy }} disabled={busy} onPress={() => { setModeChoice('discover'); setPickerOpen(false); }} style={[styles.option, mode === 'discover' && styles.optionSelected]}>
          <View style={[styles.optionTop, en && styles.rowLtr]}>
            <Text style={[styles.optionIcon, mode === 'discover' && styles.optionIconSelected]}>⌕</Text>
            {mode === 'discover' ? <Text style={styles.check}>✓</Text> : null}
          </View>
          <Text style={[styles.optionTitle, en && styles.ltr]}>{text('اكتشفي مساري', 'Discover my path')}</Text>
          <Text style={[styles.optionText, en && styles.ltr]}>{text('استكشفي المسارات بناءً على مهاراتك واهتماماتك وخلفيتك.', 'Explore careers based on your reviewed skills, interests and background.')}</Text>
        </Pressable>

        <View style={[styles.option, mode === 'choose' && styles.optionSelected]}>
          <Pressable accessibilityRole="radio" accessibilityState={{ selected: mode === 'choose', disabled: busy }} disabled={busy} onPress={() => setModeChoice('choose')} style={styles.chooseHeader}>
            <View style={[styles.optionTop, en && styles.rowLtr]}>
              <Text style={[styles.optionIcon, mode === 'choose' && styles.optionIconSelected]}>◎</Text>
              {mode === 'choose' ? <Text style={styles.check}>✓</Text> : null}
            </View>
            <Text style={[styles.optionTitle, en && styles.ltr]}>{text('لديّ مسار في بالي', 'I have a career in mind')}</Text>
            <Text style={[styles.optionText, en && styles.ltr]}>{text('اختاري هدفًا مبدئيًا وابدئي بناء ملفك نحوه.', 'Choose a starting goal and build your profile toward it.')}</Text>
          </Pressable>
          {mode === 'choose' ? <>
            <Pressable accessibilityRole="button" accessibilityState={{ expanded: pickerOpen }} disabled={busy} onPress={() => setPickerOpen(value => !value)} style={[styles.selectedPath, en && styles.rowLtr]}>
              <Text style={[styles.selectedPathText, en && styles.ltr]}>{selectedName ? en ? selectedName.en : selectedName.ar : text('اختاري المجال المهني', 'Choose a career area')}</Text>
              <Text style={styles.chevron}>{pickerOpen ? '⌃' : '⌄'}</Text>
            </Pressable>
            {pickerOpen ? <View style={styles.pathList}>
              {paths.map(path => {
                const active = selectedPath === path.id;
                return <Pressable key={path.id} accessibilityRole="button" accessibilityState={{ selected: active, disabled: busy }} disabled={busy} onPress={() => { setChosenPath(path.id); setPickerOpen(false); }} style={[styles.pathOption, active && styles.pathOptionActive, en && styles.rowLtr]}>
                  <Text style={[styles.pathOptionText, en && styles.ltr]}>{en ? path.en : path.ar}</Text>{active ? <Text style={styles.pathCheck}>✓</Text> : null}
                </Pressable>;
              })}
            </View> : null}
          </> : null}
        </View>
      </>}

      {error ? <Text accessibilityRole="alert" style={[styles.error, en && styles.ltr]}>{error}</Text> : null}
      <Pressable accessibilityRole="button" disabled={!profileState.ready || busy || (mode === 'choose' && !selectedPath)} style={[ui.button, (!profileState.ready || busy || (mode === 'choose' && !selectedPath)) && styles.disabled]} onPress={() => void continueToNext()}>
        <Text style={ui.buttonText}>{busy ? text('جارٍ الحفظ…', 'Saving…') : mode === 'discover' ? text('اكتشفي مسارك', 'Discover my path') : fromProfile ? text('حفظ الهدف والعودة إلى ملفي', 'Save goal and return to profile') : text('حفظ الهدف واستكشاف المسارات', 'Save goal and explore paths')}</Text>
      </Pressable>
      <Text style={[ui.note, en && styles.ltr]}>{text('يمكنك تغيير هدفك لاحقًا. هذا اختيار مبدئي وليس قرارًا نهائيًا.', 'You can change your goal later. This is a starting point, not a permanent decision.')}</Text>
    </ScrollView>
  </SafeAreaView>;
}

const styles = createAdaptiveStyles(() => ({
  content: { width: '100%', maxWidth: 620, alignSelf: 'center', padding: 22, paddingBottom: 34, gap: 14 },
  ltr: { textAlign: 'left', writingDirection: 'ltr' },
  stepHeader: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
  rowLtr: { flexDirection: 'row' },
  stepCount: { color: colors.muted, fontSize: 11 },
  track: { height: 6, borderRadius: 8, backgroundColor: colors.soft, overflow: 'hidden' },
  fill: { width: '100%', height: '100%', alignSelf: 'flex-end', backgroundColor: colors.primary, borderRadius: 8 },
  intro: { gap: 5, marginBottom: 2 },
  option: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 15, gap: 6 },
  optionSelected: { borderColor: colors.primary, backgroundColor: colors.mint },
  optionTop: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
  optionIcon: { color: colors.primary, backgroundColor: colors.soft, width: 34, height: 34, lineHeight: 34, borderRadius: 12, textAlign: 'center', fontSize: 21, overflow: 'hidden' },
  optionIconSelected: { backgroundColor: colors.surface },
  check: { color: colors.primary, fontSize: 18, fontWeight: '800' },
  optionTitle: { color: colors.ink, fontSize: 16, fontWeight: '700', textAlign: 'right' },
  optionText: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: 'right' },
  chooseHeader: { gap: 6 },
  selectedPath: { minHeight: 42, paddingHorizontal: 11, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginTop: 5 },
  selectedPathText: { color: colors.ink, fontSize: 13, textAlign: 'right' },
  chevron: { color: colors.muted, fontSize: 19 },
  pathList: { gap: 5, marginTop: 5 },
  pathOption: { minHeight: 40, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', borderRadius: 10, paddingHorizontal: 11, backgroundColor: colors.surface },
  pathOptionActive: { backgroundColor: colors.mint },
  pathOptionText: { color: colors.ink, fontSize: 12, textAlign: 'right' },
  pathCheck: { color: colors.primary, fontWeight: '700' },
  error: { color: colors.error, fontSize: 13, lineHeight: 20, textAlign: 'right' },
  disabled: { opacity: 0.5 },
}));
