import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MasarakBrand } from '../components/masarak-brand';
import { MasarakIcon } from '../components/masarak-icon';
import { colors, ui, createAdaptiveStyles } from '../constants/design';
import { useAppPreferences } from '../contexts/app-preferences-context';
import { useAuth } from '../contexts/auth-context';
import { useLearningPlan } from '../hooks/use-learning-plan';
import { useLearningProgress } from '../hooks/use-learning-progress';
import { usePersonalProfile } from '../hooks/use-personal-profile';
import { useSkillProfile } from '../hooks/use-skill-profile';
import dataset from '../masarak_dataset.json';
import { getLearningResources } from '../constants/learning-resources';
import { careerTitles } from '../utils/career-matches';
import { getCareerMatches } from '../utils/career-matching';
import { getSkillGapReport } from '../utils/skill-gap';

export default function HomeScreen() {
  const router = useRouter();
  const auth = useAuth();
  const { language } = useAppPreferences();
  const en = language === 'en';
  const personalState = usePersonalProfile();
  const personal = personalState.personal;
  const firstName = personal?.name
    ? personal.name.trim().split(/\s+/)[0].slice(0, 25)
    : typeof auth.session?.user.user_metadata?.display_name === 'string'
      ? auth.session.user.user_metadata.display_name.trim().split(/\s+/)[0].slice(0, 25)
      : '';
  const profileState = useSkillProfile();
  const profile = profileState.profile;
  const learning = useLearningPlan();
  const progress = useLearningProgress();
  const matches = getCareerMatches({ skillProfile: profile, personal });
  const best = matches[0];
  const gap = best ? getSkillGapReport(best.career_id, profile?.skill_ids ?? null) : null;

  const plannedSkillIds = learning.plan.filter(id => dataset.skills.some(skill => skill.skill_id === id));
  const suggestedSkillIds = gap?.missingCore.map(skill => skill.skill_id) ?? [];
  const lessonSkills = plannedSkillIds.length ? plannedSkillIds : suggestedSkillIds;
  const lessonResources = [...new Map(lessonSkills.flatMap(id => getLearningResources(id)).map(item => [item.id, item])).values()];
  const nextLesson = lessonResources.find(item => !progress.progress[item.id]) ?? lessonResources[0] ?? null;
  const completedLessons = lessonResources.filter(item => Boolean(progress.progress[item.id])).length;
  const text = (ar: string, english: string) => en ? english : ar;

  return <SafeAreaView edges={['top', 'left', 'right']} style={ui.screen}>
    <ScrollView contentContainerStyle={styles.content}>
      <View style={ui.row}>
        <MasarakBrand />
        <Pressable accessibilityRole="button" accessibilityLabel={text('الإعدادات', 'Settings')} onPress={() => router.push('/settings' as never)} style={styles.settingsButton}>
          <MasarakIcon name="settings" />
        </Pressable>
      </View>

      <View style={styles.intro}>
        <Text style={[ui.eyebrow, en && styles.ltr]}>{text('خطوتك اليوم، مستقبلك بكرة', 'Final-year student · Saudi Arabia')}</Text>
        <Text style={[styles.greeting, en && styles.ltr]}>{firstName ? text(`أهلًا ${firstName}،`, `Keep moving, ${firstName}.`) : text('أهلًا بك في مسارك.', 'Keep moving, one step at a time.')}</Text>
        <Text style={[ui.text, en && styles.ltr]}>{text('مستقبلك يتشكل، خطوة في كل مرة.', 'Your future is taking shape, one step at a time.')}</Text>
      </View>

      {profileState.error || personalState.error ? <Text accessibilityRole="alert" style={[styles.error, en && styles.ltr]}>{profileState.error || personalState.error}</Text> : null}

      <View style={styles.sectionHeading}>
        <Text style={[styles.sectionTitle, en && styles.ltr]}>{text('مسارك المقترح', 'Your recommended path')}</Text>
        <Pressable accessibilityRole="button" onPress={() => router.push('/careers' as never)}><Text style={ui.link}>{text('عرض الكل', 'See all')}</Text></Pressable>
      </View>
      {best ? <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/career', params: { id: best.career_id } } as never)} style={({ pressed }) => [styles.pathCard, pressed && ui.pressed]}>
        <View style={[ui.row, en && styles.rowLtr]}>
          <Text style={styles.matchBadge}>{best.score === null ? text('أكملي ملفك', 'Complete profile') : `${best.score}% ${text('ملاءمة إرشادية', 'indicative match')}`}</Text>
          <MasarakIcon name="arrow" color={colors.primary} size={18} />
        </View>
        <Text style={[styles.pathTitle, en && styles.ltr]}>{en ? best.title : careerTitles[best.career_id] ?? best.title}</Text>
        <Text style={[styles.pathDescription, en && styles.ltr]}>{en ? best.description : 'اكتشفي المهارات والخطوات المناسبة لهذا المسار.'}</Text>
      </Pressable> : <Pressable accessibilityRole="button" style={styles.pathCard} onPress={() => router.push('/profile' as never)}>
        <Text style={[styles.pathTitle, en && styles.ltr]}>{text('ابدئي بإضافة معلوماتك', 'Start with your profile')}</Text>
        <Text style={[styles.pathDescription, en && styles.ltr]}>{text('أضيفي مهاراتك أو ارفعي سيرة اختيارية لاقتراح المسارات.', 'Add skills or upload an optional CV to see suggested paths.')}</Text>
      </Pressable>}

      <View style={styles.sectionHeading}>
        <Text style={[styles.sectionTitle, en && styles.ltr]}>{text('درسك التالي', 'Your next lesson')}</Text>
        <Pressable accessibilityRole="button" onPress={() => router.push('/roadmap' as never)}><Text style={ui.link}>{text('الخارطة', 'Roadmap')}</Text></Pressable>
      </View>
      <Pressable accessibilityRole="button" onPress={() => nextLesson
        ? router.push({ pathname: '/course-details', params: { id: nextLesson.id } } as never)
        : router.push('/learning-plan' as never)} style={({ pressed }) => [styles.lessonCard, pressed && ui.pressed]}>
        <View style={[ui.row, en && styles.rowLtr]}>
          <View style={styles.playIcon}><MasarakIcon name="plan" color={colors.primary} /></View>
          <View style={styles.lessonCopy}>
            <Text style={[styles.lessonTitle, en && styles.ltr]}>{nextLesson?.title ?? text('اختاري مهارة لتبدئي التعلم', 'Choose a skill to start learning')}</Text>
            <Text style={[styles.lessonMeta, en && styles.ltr]}>{nextLesson ? `${nextLesson.provider} · ${nextLesson.duration}` : text('تُقترح الموارد بحسب الفجوات أو خطتك', 'Resources follow your skill gaps or plan')}</Text>
          </View>
          <Text style={styles.startLabel}>{text('ابدئي', 'Start')}</Text>
        </View>
        {lessonResources.length > 0 ? <>
          <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.round(completedLessons * 100 / lessonResources.length)}%` }]} /></View>
          <Text style={[styles.lessonMeta, en && styles.ltr]}>{text(`${completedLessons} من ${lessonResources.length} موارد مكتملة`, `${completedLessons} of ${lessonResources.length} resources complete`)}</Text>
        </> : null}
      </Pressable>

      <View style={[styles.quickLinks, en && styles.quickLinksLtr]}>
        <Pressable accessibilityRole="button" onPress={() => router.push('/interview' as never)} style={styles.quickLink}><MasarakIcon name="chat" size={16} /><Text style={styles.quickText}>{text('تدرّبي للمقابلة', 'Practise interview')}</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={() => router.push('/jobs' as never)} style={styles.quickLink}><MasarakIcon name="careers" size={16} /><Text style={styles.quickText}>{text('الوظائف', 'Jobs')}</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={() => router.push('/market' as never)} style={styles.quickLink}><Text style={styles.quickText}>{text('استكشفي السوق', 'Explore the market')}</Text><MasarakIcon name="arrow" size={16} /></Pressable>
      </View>
    </ScrollView>
  </SafeAreaView>;
}

const styles = createAdaptiveStyles(() => ({
  content: { width: '100%', maxWidth: 620, alignSelf: 'center', padding: 22, paddingBottom: 30, gap: 17 },
  settingsButton: { width: 42, height: 42, borderRadius: 15, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  intro: { gap: 3, marginTop: 2 },
  greeting: { color: colors.ink, fontSize: 28, lineHeight: 36, fontWeight: '800', textAlign: 'right' },
  sectionHeading: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  sectionTitle: { color: colors.ink, fontSize: 17, fontWeight: '700', textAlign: 'right' },
  pathCard: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 20, padding: 16, gap: 9 },
  matchBadge: { color: colors.primary, backgroundColor: colors.mint, overflow: 'hidden', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5, fontSize: 11, fontWeight: '700' },
  pathTitle: { color: colors.ink, fontSize: 20, lineHeight: 26, fontWeight: '800', textAlign: 'right' },
  pathDescription: { color: colors.muted, fontSize: 13, lineHeight: 20, textAlign: 'right' },
  lessonCard: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 19, padding: 15, gap: 12 },
  playIcon: { width: 38, height: 38, borderRadius: 13, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  lessonCopy: { flex: 1, gap: 4 },
  lessonTitle: { color: colors.ink, fontSize: 14, fontWeight: '700', textAlign: 'right' },
  lessonMeta: { color: colors.muted, fontSize: 11, lineHeight: 17, textAlign: 'right' },
  startLabel: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  progressTrack: { height: 7, backgroundColor: colors.soft, borderRadius: 8, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 8 },
  quickLinks: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingTop: 1 },
  quickLinksLtr: { flexDirection: 'row' },
  quickLink: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, minHeight: 36 },
  quickText: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  error: { color: colors.error, fontSize: 13, lineHeight: 20, textAlign: 'right' },
  ltr: { textAlign: 'left', writingDirection: 'ltr' },
  rowLtr: { flexDirection: 'row' },
}));
