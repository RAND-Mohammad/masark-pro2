import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, createAdaptiveStyles, ui } from '../constants/design';
import { useAppPreferences } from '../contexts/app-preferences-context';
import { readInterviewHistory } from '../utils/interview-history';
import type { InterviewResult } from '../utils/interview-types';
import { careerTitles } from '../utils/career-matches';

export default function InterviewHistoryScreen() {
  const router = useRouter();
  const { language } = useAppPreferences();
  const en = language === 'en';
  const text = (ar: string, english: string) => en ? english : ar;
  const [history, setHistory] = useState<InterviewResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openedId, setOpenedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setHistory(await readInterviewHistory()); setError(''); }
    catch { setError(en ? 'Could not load practice history. Try again.' : 'تعذر تحميل سجل التدريب. أعد المحاولة.'); }
    finally { setLoading(false); }
  }, [en]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const latest = history[0];
  const average = history.length ? Math.round(history.reduce((sum, item) => sum + item.score, 0) / history.length) : null;

  return <SafeAreaView edges={['top', 'left', 'right']} style={ui.screen}>
    <ScrollView contentContainerStyle={styles.content}>
      <Pressable accessibilityRole="button" onPress={() => router.canGoBack() ? router.back() : router.replace('/interview' as never)}>
        <Text style={[ui.link, en && styles.ltr]}>{text('رجوع', 'Back')}</Text>
      </Pressable>
      <Text style={[ui.eyebrow, en && styles.ltr]}>{text('تدريبك المهني', 'PRACTICE & GROWTH')}</Text>
      <Text style={[ui.title, en && styles.ltr]}>{text('تقدّمك خطوة بخطوة.', 'Look how far you’ve come.')}</Text>
      <Text style={[ui.text, en && styles.ltr]}>{text('راجعي إجاباتك وتغذيتك الراجعة السابقة، واختاري خطوة التدريب التالية.', 'Review your previous answers and feedback, then choose your next practice step.')}</Text>

      {loading ? <View style={ui.card}><Text style={[ui.text, en && styles.ltr]}>{text('جارٍ تحميل النتائج…', 'Loading your results…')}</Text></View> : null}
      {error ? <View style={styles.errorCard}><Text accessibilityRole="alert" style={[styles.error, en && styles.ltr]}>{error}</Text><Pressable accessibilityRole="button" onPress={() => void load()}><Text style={[ui.link, en && styles.ltr]}>{text('إعادة المحاولة', 'Try again')}</Text></Pressable></View> : null}

      {!loading && !error && history.length > 0 ? <>
        <View style={styles.stats}>
          <View style={styles.stat}><Text style={styles.statValue}>{history.length}</Text><Text style={[styles.statLabel, en && styles.ltr]}>{text('إجابة مقيّمة', 'evaluated answers')}</Text></View>
          <View style={styles.stat}><Text style={styles.statValue}>{average ?? '—'}</Text><Text style={[styles.statLabel, en && styles.ltr]}>{text('متوسط التدريب', 'practice average')}</Text></View>
          <View style={styles.stat}><Text style={styles.statValue}>{latest?.score ?? '—'}</Text><Text style={[styles.statLabel, en && styles.ltr]}>{text('آخر نتيجة', 'latest score')}</Text></View>
        </View>
        <Text style={[ui.heading, en && styles.ltr]}>{text('نتائجك السابقة', 'Previous results')}</Text>
        <View style={styles.list}>
          {history.map(item => {
            const opened = openedId === item.id;
            const date = new Date(item.createdAt).toLocaleDateString(en ? 'en-US' : 'ar-SA');
            return <View key={item.id} style={styles.resultCard}>
              <Pressable accessibilityRole="button" accessibilityState={{ expanded: opened }} onPress={() => setOpenedId(opened ? null : item.id)} style={styles.resultHead}>
                <View style={[styles.resultTop, en && styles.rowLtr]}>
                  <Text style={styles.score}>{item.score}<Text style={styles.scoreSmall}>/100</Text></Text>
                  <Text style={[styles.mode, item.mode === 'ai' ? styles.aiMode : styles.localMode]}>{item.mode === 'ai' ? 'AI' : text('محلي', 'LOCAL')}</Text>
                </View>
                <Text style={[styles.role, en && styles.ltr]}>{careerTitles[item.careerId] ?? item.careerId}</Text>
                <Text numberOfLines={2} style={[styles.question, en && styles.ltr]}>{item.question}</Text>
                <Text style={[styles.date, en && styles.ltr]}>{date}</Text>
              </Pressable>
              {opened ? <View style={styles.details}>
                <Text style={[styles.detailLabel, en && styles.ltr]}>{text('إجابتك', 'Your answer')}</Text>
                <Text style={[ui.text, en && styles.ltr]}>{item.answer}</Text>
                <Text style={[styles.detailLabel, en && styles.ltr]}>{text('ملاحظات التدريب', 'Practice feedback')}</Text>
                <Text style={[ui.text, en && styles.ltr]}>{item.feedback}</Text>
                {item.strengths.length ? <><Text style={[styles.detailLabel, en && styles.ltr]}>{text('نقاط جيدة', 'What worked well')}</Text>{item.strengths.map((value, index) => <Text key={`s-${index}`} style={[styles.bullet, en && styles.ltr]}>• {value}</Text>)}</> : null}
                {item.improvements.length ? <><Text style={[styles.detailLabel, en && styles.ltr]}>{text('خطوات للتطوير', 'Next steps')}</Text>{item.improvements.map((value, index) => <Text key={`i-${index}`} style={[styles.bullet, en && styles.ltr]}>• {value}</Text>)}</> : null}
              </View> : null}
            </View>;
          })}
        </View>
        <Pressable accessibilityRole="button" style={ui.outline} onPress={() => router.push('/interview' as never)}><Text style={ui.outlineText}>{text('ابدئي تدريبًا جديدًا', 'Start a new practice')}</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={() => router.push('/interview' as never)}><Text style={[ui.link, en && styles.ltr]}>{text('إدارة النتائج المحفوظة', 'Manage saved results')}</Text></Pressable>
      </> : null}

      {!loading && !error && history.length === 0 ? <View style={styles.empty}>
        <View style={styles.emptyIcon}><Text style={styles.emptyGlyph}>↗</Text></View>
        <View style={styles.emptyCard}>
          <Text style={[ui.heading, en && styles.ltr]}>{text('أول تدريب لك بداية جديدة.', 'Your first practice is a fresh start.')}</Text>
          <Text style={[ui.text, en && styles.ltr]}>{text('ستظهر إجاباتك وتغذيتك الراجعة هنا بعد أول تمرين. ابدئي بسؤال قصير لمسار يناسبك.', 'Your answers and feedback will appear here after your first practice. Start with one entry-level question for a path you choose.')}</Text>
        </View>
        <Text style={[ui.note, en && styles.ltr]}>{text('مساحة للتعلّم، وليست اختبار توظيف.', 'This is a learning space, not a hiring test.')}</Text>
        <Pressable accessibilityRole="button" style={ui.button} onPress={() => router.push('/interview' as never)}><Text style={ui.buttonText}>{text('ابدئي أول تدريب', 'Start my first practice')}</Text></Pressable>
      </View> : null}

      <Text style={[ui.note, en && styles.ltr]}>{text('النتائج محفوظة في نطاق هذا الجهاز أو الحساب. تقييم التدريب إرشادي ولا يمثل تقييم جهة توظيف.', 'Results stay within this device or account scope. Practice feedback is guidance, not an employer assessment.')}</Text>
    </ScrollView>
  </SafeAreaView>;
}

const styles = createAdaptiveStyles(() => ({
  content: { width: '100%', maxWidth: 620, alignSelf: 'center', padding: 22, paddingBottom: 34, gap: 17 },
  ltr: { textAlign: 'left', writingDirection: 'ltr' },
  stats: { flexDirection: 'row-reverse', backgroundColor: colors.mint, borderRadius: 19, paddingVertical: 16 },
  stat: { flex: 1, alignItems: 'center', gap: 5, paddingHorizontal: 5 },
  statValue: { color: colors.primary, fontSize: 23, fontWeight: '800' },
  statLabel: { color: colors.muted, fontSize: 10, textAlign: 'center' },
  list: { gap: 11 },
  resultCard: { borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  resultHead: { padding: 16, gap: 7 },
  resultTop: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  rowLtr: { flexDirection: 'row' },
  score: { color: colors.primary, fontSize: 22, fontWeight: '800' },
  scoreSmall: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  mode: { borderRadius: 10, paddingHorizontal: 9, paddingVertical: 5, fontSize: 10, fontWeight: '700' },
  aiMode: { backgroundColor: colors.warningSurface, color: colors.gold },
  localMode: { backgroundColor: colors.mint, color: colors.primary },
  role: { color: colors.ink, fontSize: 15, fontWeight: '700', textAlign: 'right' },
  question: { color: colors.muted, fontSize: 13, lineHeight: 20, textAlign: 'right' },
  date: { color: colors.muted, fontSize: 11, textAlign: 'right' },
  details: { borderTopWidth: 1, borderColor: colors.border, padding: 16, gap: 8 },
  detailLabel: { color: colors.ink, fontSize: 13, fontWeight: '700', textAlign: 'right', marginTop: 4 },
  bullet: { color: colors.muted, fontSize: 13, lineHeight: 20, textAlign: 'right' },
  empty: { gap: 14 },
  emptyIcon: { width: 104, height: 104, borderRadius: 52, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.mint },
  emptyGlyph: { color: colors.primary, fontSize: 50, fontWeight: '300' },
  emptyCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 20, padding: 18, gap: 10 },
  errorCard: { backgroundColor: colors.errorSurface, borderWidth: 1, borderColor: colors.errorBorder, borderRadius: 17, padding: 15, gap: 4 },
  error: { color: colors.error, fontSize: 14, lineHeight: 21, textAlign: 'right' },
}));
