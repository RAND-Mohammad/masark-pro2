import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/auth-context';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MasarakBrand } from '../components/masarak-brand';
import { MasarakIcon, type IconName } from '../components/masarak-icon';
import { CoverageRing } from '../components/coverage-ring';
import { CareerCard } from '../components/career-card';
import { colors, ui } from '../constants/design';
import { useSkillProfile } from '../hooks/use-skill-profile';
import { useLearningPlan } from '../hooks/use-learning-plan';
import { careerTitles } from '../utils/career-matches';
import { usePersonalProfile } from '../hooks/use-personal-profile';
import { useLearningProgress } from '../hooks/use-learning-progress';
import { useProfessionalCertifications } from '../hooks/use-professional-certifications';
import { getCareerReadinessMatches } from '../utils/career-readiness';
import { MarketCareerSummary } from '../components/market-career-summary';

export default function HomeScreen() {
  const router = useRouter();
  const auth = useAuth();
  const personalState = usePersonalProfile();
  const personal = personalState.personal;
  const courseProgress = useLearningProgress();
  const professionalCertifications = useProfessionalCertifications();
  const firstName = personal?.name ? personal.name.trim().split(/\s+/)[0].slice(0, 25) : typeof auth.session?.user.user_metadata?.display_name === 'string' ? auth.session.user.user_metadata.display_name.trim().split(/\s+/)[0].slice(0, 25) : '';
  const { profile, ready, error } = useSkillProfile();
  const learning = useLearningPlan();
  const matches = getCareerReadinessMatches({ skillProfile: profile, personal, learningProgress: courseProgress.progress, professionalCertifications: professionalCertifications.achieved });
  const best = matches[0];
  const readinessReady = ready && personalState.ready && courseProgress.ready && professionalCertifications.ready;
  const tools = [
    { title: 'وظائف مناسبة لي', subtitle: 'توافق سيرتك وفجوات الوظائف وخطتها', route: '/jobs', icon: 'careers' },
    { title: 'ملفي وسيرتي', subtitle: profile?.cv ? 'راجع معلوماتك المحفوظة' : 'ابدأ بإجابات أو PDF اختياري', route: '/profile', icon: 'profile' },
    { title: 'تحليل المهارات', subtitle: 'اكتشف المسارات ومهاراتها', route: '/careers', icon: 'careers' },
    { title: 'تخصصات الجامعة', subtitle: 'وظائف ومهارات وشهادات كل تخصص', route: '/majors', icon: 'careers' },
    { title: 'خطة التعلم', subtitle: learning.ready && !learning.error ? `${learning.plan.length} عناصر في خطتك` : 'خطواتك نحو التطور', route: '/learning-plan', icon: 'plan' },
    { title: 'ملف مهاراتي', subtitle: 'راجع مهاراتك وأضف إليها', route: '/profile', icon: 'profile' },
    { title: 'تدريب المقابلة', subtitle: 'أسئلة وإجابات وتغذية راجعة نصية', route: '/interview', icon: 'careers' },
  ] as const;
  return <SafeAreaView edges={['top', 'left', 'right']} style={ui.screen}>
    <ScrollView contentContainerStyle={ui.content}>
      <View style={ui.row}><MasarakBrand /><Pressable accessibilityRole="button" accessibilityLabel="فتح ملفي" onPress={() => router.push('/profile')} style={styles.avatar}><MasarakIcon name="profile" /></Pressable></View>
      <View style={styles.intro}><Text style={ui.eyebrow}>خطوتك اليوم، مستقبلك بكرة</Text><Text style={ui.title}>{firstName ? `أهلًا بك، ${firstName}.` : 'أهلًا بك في مسارك.'}</Text><Text style={ui.text}>طريق أوضح لمستقبلك في عالم التقنية.</Text></View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.summary}>
        <View style={styles.summaryText}><Text style={ui.eyebrow}>الجاهزية المركبة</Text><Text style={styles.number}>{!readinessReady ? '…' : best.score !== null ? `${best.score}%` : 'لنبدأ'}</Text><Text style={styles.summaryCaption}>{!readinessReady ? 'جارٍ جمع أدلة ملفك…' : best.score !== null ? careerTitles[best.career_id] : 'أكمل ملفك لاكتشاف مساراتك'}</Text><Text style={ui.note}>{best.score !== null ? 'مهارات + تطبيق + شهادات + معدل + تعلم' : 'نتائجك تظهر بعد إضافة أي دليل'}</Text></View>
        <CoverageRing score={readinessReady ? best.score : null} />
      </View>
      <View style={ui.row}><Text style={ui.heading}>أدوات رحلتك</Text><Text style={ui.note}>خطوة بخطوة</Text></View>
      <View style={styles.grid}>{tools.map(tool => <Pressable key={tool.route} accessibilityRole="button" onPress={() => router.push(tool.route)} style={({ pressed }) => [styles.tool, pressed && ui.pressed]}><View style={styles.toolIcon}><MasarakIcon name={tool.icon as IconName} /></View><Text style={styles.toolTitle}>{tool.title}</Text><Text style={styles.toolText}>{tool.subtitle}</Text></Pressable>)}</View>
      <View style={styles.next}><View style={styles.nextText}><Text style={styles.nextTitle}>{profile?.cv ? 'ملفك جاهز للخطوة التالية' : 'كل رحلة تبدأ بخطوة'}</Text><Text style={ui.text}>{profile?.cv ? 'استكشف مهارات المسارات واختر ما تريد تطويره.' : 'ابدأ بإجابات قصيرة عن دراستك ومهاراتك، أو ارفع PDF إن كانت لديك سيرة. الخبرة غير مطلوبة.'}</Text></View><Pressable accessibilityRole="button" accessibilityLabel={profile?.cv ? 'استكشاف المسارات' : 'إنشاء ملفي أو رفع سيرة اختيارية'} onPress={() => router.push(profile?.cv ? '/careers' : '/profile')} style={styles.nextButton}><MasarakIcon name="arrow" color={colors.surface} /></Pressable></View>
      <View style={ui.row}><Text style={ui.heading}>{best.score !== null ? 'مساراتك حسب الجاهزية' : 'اكتشف مسارات التقنية'}</Text><Pressable accessibilityRole="button" onPress={() => router.push('/careers')}><Text style={ui.link}>عرض الكل</Text></Pressable></View>
      <Text style={ui.note}>عند تساوي الجاهزية فقط، تتقدم المسارات المطابقة لاهتماماتك. الاهتمامات لا تزيد درجة الجاهزية.</Text>
      {matches.slice(0, 2).map(career => <CareerCard key={career.career_id} career={career} />)}
      <Text style={ui.note}>الجاهزية تقدير إرشادي من أدلة ملفك وليست احتمال قبول أو ضمان توظيف. افتح المسار لرؤية النقاط والأوزان.</Text>
      <MarketCareerSummary />
      <Text style={ui.note}>المسارات والدورات كتالوج إرشادي ثابت، وليست وظائف أو فرص تدريب حية. الأسعار والتوفر تخضع للمزود. ملف الضيف محلي؛ فعّل الحفظ السحابي داخل «ملفي» لحفظ بيانات حسابك في Supabase.</Text>
    </ScrollView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  avatar: { backgroundColor: colors.mint, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  intro: { gap: 5, marginTop: 8 }, summary: { backgroundColor: colors.mint, borderRadius: 25, padding: 22, gap: 8, flexDirection: 'row-reverse', alignItems: 'center' }, summaryText: { flex: 1, gap: 5 }, number: { color: colors.ink, fontSize: 43, fontWeight: '700', textAlign: 'right' }, summaryCaption: { color: colors.primary, fontSize: 13, lineHeight: 22, textAlign: 'right' },
  grid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 12 }, tool: { width: '48%', flexGrow: 1, flexBasis: '45%', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 20, padding: 16, gap: 9 }, toolIcon: { backgroundColor: colors.mint, borderRadius: 12, padding: 10, alignSelf: 'flex-end' }, toolTitle: { color: colors.ink, fontSize: 15, fontWeight: '600', textAlign: 'right' }, toolText: { color: colors.muted, fontSize: 12, lineHeight: 20, textAlign: 'right' },
  next: { padding: 20, borderRadius: 22, backgroundColor: '#EEF2E7', flexDirection: 'row-reverse', alignItems: 'center', gap: 16 }, nextText: { flex: 1, gap: 7 }, nextTitle: { color: colors.ink, fontWeight: '600', fontSize: 16, textAlign: 'right' }, nextButton: { width: 48, height: 48, backgroundColor: colors.primary, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }, error: { color: colors.error, textAlign: 'right' },
});
