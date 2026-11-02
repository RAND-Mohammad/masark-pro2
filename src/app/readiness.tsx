import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MasarakIcon } from '../components/masarak-icon';
import { colors, ui, createAdaptiveStyles} from '../constants/design';
import { jobPathById, jobPaths } from '../constants/job-paths';
import { usePersonalProfile } from '../hooks/use-personal-profile';
import { useSkillProfile } from '../hooks/use-skill-profile';
import { getCareerMatches } from '../utils/career-matching';
import { careerTitles } from '../utils/career-matches';
import { getSkillGapReport } from '../utils/skill-gap';
import { displaySkillName } from '../utils/skill-labels';
import { useAppPreferences } from '../contexts/app-preferences-context';

export default function ReadinessScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const profileState = useSkillProfile();
  const personalState = usePersonalProfile();
  const { language } = useAppPreferences();
  const en = language === 'en';
  const text = (ar: string, english: string) => en ? english : ar;
  const profile = profileState.profile;
  const personal = personalState.personal;
  const matches = getCareerMatches({
    skillProfile: profile,
    personal,
  });
  const requestedId = typeof params.id === 'string' ? params.id : '';
  const requestedPath = jobPathById(requestedId)
    ?? jobPaths.find(path => path.baseCareerId === requestedId)
    ?? null;
  const goalPath = jobPathById(personal?.careerGoal)
    ?? jobPaths.find(path => path.baseCareerId === personal?.careerGoal)
    ?? null;
  const bestPath = jobPathById(matches[0]?.career_id)
    ?? jobPaths.find(path => path.baseCareerId === matches[0]?.career_id)
    ?? jobPaths[0];
  const career = requestedPath ?? goalPath ?? bestPath;
  const gap = career ? getSkillGapReport(career.id, profile?.skill_ids ?? null) : null;
  const loading = !profileState.ready || !personalState.ready;
  const error = profileState.error || personalState.error;
  const score = gap?.score ?? null;
  const matched = gap?.matchedCore ?? [];
  const missing = gap?.missingCore ?? [];
  const total = matched.length + missing.length;

  return <SafeAreaView edges={['top', 'left', 'right']} style={ui.screen}>
    <ScrollView contentContainerStyle={ui.content}>
      <View style={[styles.topBar, en && styles.rowLtr]}>
        <Pressable accessibilityRole="button" onPress={() => router.canGoBack() ? router.back() : router.replace('/home')} style={styles.backButton}><Text style={[ui.link, en && styles.ltr]}>{text('رجوع', 'Back')}</Text></Pressable>
        <Text style={[styles.topBarTitle, en && styles.ltr]}>{text('جاهزيتك', 'Your readiness')}</Text>
        <Text style={styles.more}>···</Text>
      </View>
      <Text style={[styles.pageTitle, en && styles.ltr]}>{text('تقدّمك أصبح واضحًا.', 'Progress, made visible.')}</Text>
      {career ? <Text style={[ui.text, en && styles.ltr]}>{en ? career.title : careerTitles[career.id] ?? career.title}</Text> : null}

      {loading ? <View style={ui.card}><Text style={[ui.text, en && styles.ltr]}>{text('جارٍ جمع بيانات ملفك…', 'Loading your profile…')}</Text></View> : null}
      {!loading && error ? <View style={ui.card}><Text accessibilityRole="alert" style={[ui.text, styles.error]}>{error}</Text>
        <Pressable accessibilityRole="button" onPress={() => router.push('/profile')}><Text style={[ui.link, en && styles.ltr]}>{text('فتح ملفي ومراجعة المهارات', 'Open my profile and review skills')}</Text></Pressable>
      </View> : null}

      {!loading && !error && gap ? <>
        <View style={styles.hero}>
          <View style={styles.scoreBadge}>
            <Text style={styles.score}>{score === null ? '—' : `${score}%`}</Text>
            <Text style={styles.scoreCaption}>{text('مطابقة / مطلوبة', 'MATCHED / REQUIRED')}</Text>
          </View>
          <View style={styles.heroCopy}>
            <Text style={[styles.heroTitle, en && styles.ltr]}>{score === null ? text('أضيفي مهاراتك', 'Add your skills') : score >= 80 ? text('تقدم قوي', 'Building momentum') : score >= 50 ? text('تقدّم ثابت', 'Building momentum') : text('ابدئي بالأساسيات', 'Build your foundation')}</Text>
            <Text style={[styles.heroText, en && styles.ltr]}>{en ? `${matched.length} matched · ${missing.length} to build · ${total} required role skills` : `${matched.length} مطابقة · ${missing.length} تحتاج إلى تطوير · ${total} مهارات مطلوبة للمسار`}</Text>
          </View>
        </View>

        <View style={ui.card}>
          <Text style={[ui.heading, en && styles.ltr]}>{text('المهارات المطلوبة للمسار', 'Required role skills')}</Text>
          <View style={styles.skillList}>
            {matched.map(skill => <View key={skill.skill_id} style={[styles.skillChip, styles.matchedChip]}><Text style={[styles.matchedText, en && styles.ltr]}>✓ {en ? skill.name : displaySkillName(skill.name)}</Text></View>)}
            {missing.map(skill => <View key={skill.skill_id} style={styles.skillChip}><Text style={[styles.missingText, en && styles.ltr]}>＋ {en ? skill.name : displaySkillName(skill.name)}</Text></View>)}
          </View>
          <Text style={[ui.note, en && styles.ltr]}>{text(`الجاهزية = المهارات المطلوبة الموثقة ÷ إجمالي مهارات المسار المطلوبة × 100.`, 'Readiness = documented required role skills ÷ all required role skills × 100.')}</Text>
        </View>

        <View style={styles.separation}><MasarakIcon name="info" size={20} color={colors.primary} /><View style={{ flex: 1, gap: 4 }}><Text style={[styles.separationTitle, en && styles.ltr]}>{text('ماذا تقيس هذه النسبة؟', 'What does this score measure?')}</Text><Text style={[ui.note, en && styles.ltr]}>{text('تقيس نسبة المهارات الأساسية المطلوبة التي وثّقتها لهذا المسار فقط. لا تقيس ملاءمة المسار ولا احتمال قبولك في وظيفة.', 'It counts the required core skills you have documented for this path. It does not measure career fit or your chance of getting a job.')}</Text></View></View>

        <Pressable accessibilityRole="button" style={styles.primaryButton} onPress={() => router.push({ pathname: '/roadmap', params: { id: career.id } })}>
          <Text style={styles.primaryButtonText}>{text('واصلي بناء مهاراتك', 'Continue building my skills')}  →</Text>
        </Pressable>
      </> : null}
    </ScrollView>
  </SafeAreaView>;
}

const styles = createAdaptiveStyles(() => ({
  topBar: { minHeight: 48, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { minWidth: 54, minHeight: 44, justifyContent: 'center' },
  topBarTitle: { color: colors.ink, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  more: { minWidth: 54, color: colors.muted, fontSize: 24, lineHeight: 27, textAlign: 'left' },
  pageTitle: { color: colors.navy, fontSize: 31, lineHeight: 38, fontWeight: '800', textAlign: 'right' },
  rowLtr: { flexDirection: 'row' },
  hero: { backgroundColor: colors.contrastPanel, borderRadius: 24, padding: 20, gap: 16, flexDirection: 'row-reverse', alignItems: 'center' },
  scoreBadge: { width: 118, minHeight: 118, borderRadius: 60, borderWidth: 8, borderColor: colors.contrastAccent, alignItems: 'center', justifyContent: 'center', padding: 8 },
  score: { color: colors.contrastOnPanel, fontSize: 28, fontWeight: '800' },
  scoreCaption: { color: colors.contrastOnPanel, opacity: 0.78, fontSize: 10, textAlign: 'center', lineHeight: 15 },
  heroCopy: { flex: 1, gap: 8, alignItems: 'flex-end' },
  heroTitle: { color: colors.contrastOnPanel, fontSize: 20, fontWeight: '700', textAlign: 'right' },
  heroText: { color: colors.contrastOnPanel, opacity: 0.82, fontSize: 13, lineHeight: 21, textAlign: 'right' },
  skillList: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
  skillChip: { borderRadius: 13, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.soft, paddingHorizontal: 12, paddingVertical: 9 },
  matchedChip: { borderColor: colors.mint, backgroundColor: colors.mint },
  matchedText: { color: colors.primary, fontSize: 14, fontWeight: '600' },
  missingText: { color: colors.muted, fontSize: 14 },
  separation: { borderRadius: 17, backgroundColor: colors.mint, padding: 15, gap: 10, flexDirection: 'row-reverse', alignItems: 'flex-start' },
  separationTitle: { color: colors.ink, fontSize: 14, fontWeight: '700', textAlign: 'right' },
  primaryButton: { minHeight: 56, borderRadius: 15, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', padding: 15 },
  primaryButtonText: { color: colors.onPrimary, fontSize: 16, lineHeight: 24, fontWeight: '700', textAlign: 'center' },
  error: { color: colors.error },
  ltr: { textAlign: 'left' as const, writingDirection: 'ltr' as const },
}));
