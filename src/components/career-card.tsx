import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { colors, ui, createAdaptiveStyles} from '../constants/design';
import { careerTitles } from '../utils/career-matches';
import { getCareerMatches } from '../utils/career-matching';
import { MasarakIcon } from './masarak-icon';
import { useAppPreferences } from '../contexts/app-preferences-context';

export function CareerCard({ career }: { career: ReturnType<typeof getCareerMatches>[number] }) {
  const router = useRouter();
  const { language } = useAppPreferences();
  const en = language === 'en';
  const title = en ? career.title : careerTitles[career.career_id] ?? career.title;
  const labels = en ? { discover: 'Explore path', match: 'match', explore: 'Explore', completeProfile: 'Complete your profile to get recommendations', documented: 'core skills documented' } : { discover: 'استكشاف المسار', match: 'ملاءمة', explore: 'استكشف', completeProfile: 'أكمل ملفك للحصول على اقتراحات', documented: 'مهارات أساسية موثقة' };
  return <Pressable accessibilityRole="button" accessibilityLabel={`${title}, ${career.score === null ? labels.discover : `${labels.match} ${career.score}%`}`} onPress={() => router.push({ pathname: '/career', params: { id: career.career_id } })} style={({ pressed }) => [ui.card, pressed && ui.pressed]}>
    <View style={[ui.row, en && styles.rowLtr]}><View style={styles.badge}><MasarakIcon name="careers" /></View><Text style={[styles.score, en && styles.ltr]}>{career.score === null ? labels.explore : `${career.score}% ${labels.match}`}</Text></View>
    <Text style={[ui.heading, en && styles.ltr]}>{title}</Text>
    {!en ? <Text style={styles.english}>{career.title}</Text> : null}
    {career.matchedInterests.length > 0 ? <Text style={[ui.note, en && styles.ltr]}>{en ? 'Related interests: ' : 'اهتمامات متطابقة: '}{career.matchedInterests.join(en ? ', ' : '، ')}</Text> : null}
    <View style={styles.track}><View style={[styles.progress, { width: `${career.score ?? 0}%` }]} /></View>
    <View style={[ui.row, en && styles.rowLtr]}><Text style={[ui.note, en && styles.ltr]}>{career.score === null ? labels.completeProfile : `${career.matched} ${en ? 'of' : 'من'} ${career.total} ${labels.documented}`}</Text><MasarakIcon name="arrow" size={19} /></View>
  </Pressable>;
}
const styles = createAdaptiveStyles(() => ({ badge: { padding: 10, backgroundColor: colors.mint, borderRadius: 14 }, score: { color: colors.primary, backgroundColor: colors.mint, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, fontSize: 12, fontWeight: '600' }, english: { color: colors.muted, fontSize: 13, lineHeight: 20 }, track: { height: 5, borderRadius: 3, backgroundColor: colors.soft, overflow: 'hidden', alignItems: 'flex-end' }, progress: { height: 5, backgroundColor: colors.primary, borderRadius: 3 }, ltr: { textAlign: 'left', writingDirection: 'ltr' }, rowLtr: { flexDirection: 'row' } }));
