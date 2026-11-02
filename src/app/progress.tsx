import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { learningResources } from '../constants/learning-resources';
import { useLearningProgress } from '../hooks/use-learning-progress';
import { useLearningPlan } from '../hooks/use-learning-plan';
import { useLearningResources } from '../hooks/use-learning-resources';
import { usePersonalProfile } from '../hooks/use-personal-profile';
import { colors, ui, createAdaptiveStyles} from '../constants/design';
import { useAppPreferences } from '../contexts/app-preferences-context';
import { MasarakIcon } from '../components/masarak-icon';

export default function LearningProgressScreen() {
  useLearningResources();
  const router = useRouter();
  const state = useLearningProgress();
  const plan = useLearningPlan();
  const personal = usePersonalProfile();
  const { language } = useAppPreferences();
  const en = language === 'en';
  const text = (ar: string, english: string) => en ? english : ar;
  const visibleResources = useMemo(() => learningResources.filter(item => item.skillIds.some(id => plan.plan.includes(id)) || Boolean(state.progress[item.id])), [plan.plan, state.progress]);
  const completedCount = useMemo(() => visibleResources.filter(item => Boolean(state.progress[item.id])).length, [visibleResources, state.progress]);
  const percentage = visibleResources.length ? Math.round(completedCount * 100 / visibleResources.length) : 0;
  const openLearningPath = () => personal.personal?.careerGoal
    ? router.push({ pathname: '/roadmap', params: { id: personal.personal.careerGoal } } as never)
    : router.push('/careers' as never);

  return <SafeAreaView edges={['top', 'left', 'right']} style={ui.screen}>
    <ScrollView contentContainerStyle={ui.content}>
      <Pressable accessibilityRole="button" onPress={() => router.canGoBack() ? router.back() : router.replace('/learning-plan')}><Text style={[ui.link, en && styles.ltr]}>{text('رجوع', 'Back')}</Text></Pressable>
      <Text style={[ui.eyebrow, en && styles.ltr]}>{text('تعلّمك خطوة بخطوة', 'YOUR LEARNING')}</Text>
      <Text style={[ui.title, en && styles.ltr]}>{text('تقدّم التعلم', 'Learning progress')}</Text>
      <Text style={[ui.text, en && styles.ltr]}>{text('تابعي الموارد التي سجلتِ إكمالها. التقدم إقرار ذاتي، ولا يثبت مستوى إتقان المهارة.', 'Track resources you marked as complete. Progress is self-reported and does not prove skill proficiency.')}</Text>
      <View style={styles.summary}>
        <Text style={styles.summaryNumber}>{state.ready ? `${percentage}%` : '—'}</Text>
        <Text style={[styles.summaryLabel, en && styles.ltr]}>{en ? `${completedCount} of ${visibleResources.length} resources in your plan marked complete` : `${completedCount} من ${visibleResources.length} موارد مرتبطة بخطتك مسجلة كمكتملة`}</Text>
        <View style={styles.track}><View style={[styles.fill, { width: `${percentage}%` }]} /></View>
        <Text style={[styles.note, en && styles.ltr]}>{text('لا ترتفع تغطية مهاراتك إلا بعد توثيق المهارة في ملفك.', 'Skill coverage increases only after you document the skill in your profile.')}</Text>
      </View>
      {state.error ? <View style={ui.card}><Text style={[styles.error, en && styles.ltr]}>{state.error}</Text><Pressable accessibilityRole="button" onPress={() => void state.reload()}><Text style={[ui.link, en && styles.ltr]}>{text('إعادة المحاولة', 'Try again')}</Text></Pressable></View> : null}
      {(!state.ready || !plan.ready) && !state.error ? <Text style={[ui.text, en && styles.ltr]}>{text('جارٍ تحميل التقدم…', 'Loading progress…')}</Text> : null}
      {state.ready && plan.ready && visibleResources.length === 0 ? <View style={styles.emptyState}>
        <Text style={[styles.emptyTitle, en && styles.ltr]}>{text('كل مسار يبدأ بدرس واحد.', 'Every path starts with one lesson.')}</Text>
        <View style={styles.emptyIcon}><MasarakIcon name="course" size={30} color={colors.primary} /></View>
        <View style={styles.emptyCard}>
          <Text style={[ui.heading, en && styles.ltr]}>{text('لم تسجّلي أي تعلّم بعد', 'No learning logged yet')}</Text>
          <Text style={[ui.text, en && styles.ltr]}>{text('ستظهر الدروس التي تضعين علامة إكمال عليها هنا. اختاري مسارك لعرض أول خطوة مناسبة لك.', 'Lessons you mark complete will appear here. Choose your career path to see a relevant first step.')}</Text>
        </View>
        <Pressable accessibilityRole="button" style={ui.button} onPress={openLearningPath}>
          <Text style={ui.buttonText}>{text('افتحي خارطة تعلمي', 'Open my learning roadmap')}</Text>
        </Pressable>
      </View> : null}
      {state.ready && plan.ready ? visibleResources.map(resource => {
        const completedAt = state.progress[resource.id];
        return <Pressable key={resource.id} accessibilityRole="button" onPress={() => router.push({ pathname: '/course-details' as never, params: { id: resource.id } } as never)} style={({ pressed }) => [styles.resource, pressed && styles.pressed]}>
          <View style={[styles.indicator, completedAt && styles.indicatorDone]}><Text style={[styles.indicatorText, completedAt && styles.indicatorTextDone]}>{completedAt ? '✓' : '·'}</Text></View>
          <View style={styles.resourceCopy}>
            <Text style={styles.resourceTitle}>{resource.title}</Text>
            <Text style={[styles.note, en && styles.ltr]}>{resource.provider} · {resource.duration}</Text>
            <Text style={[styles.status, en && styles.ltr]}>{completedAt ? `${text('مكتمل', 'Complete')} · ${new Date(completedAt).toLocaleDateString(en ? 'en-US' : 'ar-SA')}` : text('لم يُسجّل كمكتمل', 'Not marked complete')}</Text>
          </View>
        </Pressable>;
      }) : null}
      <Pressable accessibilityRole="button" style={ui.outline} onPress={() => router.push('/learning-plan')}><Text style={ui.outlineText}>{text('العودة إلى خطة تعلمي', 'Back to my learning plan')}</Text></Pressable>
    </ScrollView>
  </SafeAreaView>;
}

const styles = createAdaptiveStyles(() => ({
  summary: { backgroundColor: colors.contrastPanel, borderRadius: 22, padding: 20, gap: 10 },
  emptyState: { gap: 14 },
  emptyTitle: { color: colors.ink, fontSize: 21, lineHeight: 29, fontWeight: '800', textAlign: 'right' },
  emptyIcon: { width: 72, height: 72, borderRadius: 24, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.mint },
  emptyCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 17, gap: 8 },
  summaryNumber: { color: colors.contrastOnPanel, fontSize: 40, fontWeight: '800', textAlign: 'right' },
  summaryLabel: { color: colors.contrastOnPanel, opacity: 0.82, fontSize: 15, textAlign: 'right' },
  track: { height: 9, borderRadius: 8, backgroundColor: colors.track, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.contrastAccent, borderRadius: 8 },
  note: { color: colors.contrastOnPanel, opacity: 0.82, fontSize: 12, lineHeight: 20, textAlign: 'right' },
  resource: { flexDirection: 'row-reverse', alignItems: 'center', gap: 13, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 17, padding: 15 },
  resourceCopy: { flex: 1, gap: 5 },
  resourceTitle: { color: colors.ink, fontSize: 15, fontWeight: '700', textAlign: 'right' },
  status: { color: colors.primary, fontSize: 12, textAlign: 'right' },
  indicator: { width: 31, height: 31, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.soft },
  indicatorDone: { backgroundColor: colors.mint },
  indicatorText: { color: colors.muted, fontSize: 20, fontWeight: '700' },
  indicatorTextDone: { color: colors.primary, fontSize: 16 },
  pressed: { opacity: 0.75 },
  error: { color: colors.error, textAlign: 'right' },
  ltr: { textAlign: 'left' as const, writingDirection: 'ltr' as const },
}));
