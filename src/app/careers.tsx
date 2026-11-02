import { ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, createAdaptiveStyles, ui } from '../constants/design';
import { useSkillProfile } from '../hooks/use-skill-profile';
import { CareerCard } from '../components/career-card';
import { usePersonalProfile } from '../hooks/use-personal-profile';
import { getCareerMatches } from '../utils/career-matching';
import { useAppPreferences } from '../contexts/app-preferences-context';

export default function CareersScreen() {
  const { profile, ready, error } = useSkillProfile();
  const personal = usePersonalProfile();
  const { language } = useAppPreferences();
  const en = language === 'en';
  const matches = getCareerMatches({ skillProfile: profile, personal: personal.personal });
  const allReady = ready && personal.ready;
  return <SafeAreaView edges={['top', 'left', 'right']} style={ui.screen}><ScrollView contentContainerStyle={ui.content}>
    <Text style={[ui.eyebrow, en && styles.ltr]}>{en ? 'YOUR CAREER PATHS' : 'مساراتك المهنية'}</Text><Text style={[styles.pageTitle, en && styles.ltr]}>{en ? 'A future built on your strengths.' : 'مستقبل يُبنى على نقاط قوتك.'}</Text><Text style={[styles.description, en && styles.ltr]}>{en ? 'Weighted skills, interests, personality and education.' : 'تُوزن المهارات والاهتمامات والسمات والتعليم لاقتراح مسارات تستحق الاستكشاف.'}</Text>
    <Text style={[ui.note, en && styles.ltr]}>{en ? 'Career match uses skills 50%, interests 20%, traits 15%, and education 15%. Readiness is separate.' : 'تُحسب ملاءمة المسار من المهارات 50%، والاهتمامات 20%، والسمات 15%، والتعليم 15%. الجاهزية مقياس منفصل.'}</Text>
    {!allReady ? <Text style={[ui.text, en && styles.ltr]}>{en ? 'Loading your profile evidence…' : 'جارٍ جمع أدلة ملفك…'}</Text> : error ? <Text style={[ui.text, en && styles.ltr]}>{error}</Text> : matches.map(career => <CareerCard key={career.career_id} career={career} />)}
    <Text style={[ui.note, en && styles.ltr]}>{en ? 'Matches suggest paths to explore—not job eligibility or hiring probabilities.' : 'تساعدك المطابقة على استكشاف المسارات؛ ولا تعني أهلية لوظيفة أو احتمال قبول.'}</Text>
  </ScrollView></SafeAreaView>;
}

const styles = createAdaptiveStyles(() => ({ pageTitle: { color: colors.navy, fontSize: 32, lineHeight: 40, fontWeight: '800', textAlign: 'right' as const }, description: { color: colors.muted, fontSize: 18, lineHeight: 27, textAlign: 'right' as const }, ltr: { textAlign: 'left' as const, writingDirection: 'ltr' as const } }));
