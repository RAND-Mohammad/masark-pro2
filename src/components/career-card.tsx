import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, ui } from '../constants/design';
import { careerTitles } from '../utils/career-matches';
import { getCareerReadinessMatches } from '../utils/career-readiness';
import { MasarakIcon } from './masarak-icon';

export function CareerCard({ career }: { career: ReturnType<typeof getCareerReadinessMatches>[number] }) {
  const router = useRouter();
  return <Pressable accessibilityRole="button" accessibilityLabel={`${careerTitles[career.career_id] ?? career.title}، ${career.score === null ? 'استكشاف المسار' : `جاهزية ${career.score}%`}`} onPress={() => router.push({ pathname: '/career', params: { id: career.career_id } })} style={({ pressed }) => [ui.card, pressed && ui.pressed]}>
    <View style={ui.row}><View style={styles.badge}><MasarakIcon name="careers" /></View><Text style={styles.score}>{career.score === null ? 'استكشف' : `${career.score}% جاهزية`}</Text></View>
    <Text style={ui.heading}>{careerTitles[career.career_id] ?? career.title}</Text>
    <Text style={styles.english}>{career.title}</Text>
    <View style={styles.track}><View style={[styles.progress, { width: `${career.score ?? 0}%` }]} /></View>
    <View style={ui.row}><Text style={ui.note}>{career.score === null ? 'أكمل ملفك لاحتساب الجاهزية' : `تغطية المهارات ${career.skillScore ?? 0}% · ${career.matched} من ${career.total}`}</Text><MasarakIcon name="arrow" size={19} /></View>
  </Pressable>;
}
const styles = StyleSheet.create({ badge: { padding: 10, backgroundColor: colors.mint, borderRadius: 14 }, score: { color: colors.primary, backgroundColor: colors.mint, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, fontSize: 12, fontWeight: '600' }, english: { color: colors.muted, fontSize: 13, lineHeight: 20 }, track: { height: 5, borderRadius: 3, backgroundColor: colors.soft, overflow: 'hidden', alignItems: 'flex-end' }, progress: { height: 5, backgroundColor: colors.primary, borderRadius: 3 } });
