import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { colors, ui, createAdaptiveStyles } from '../constants/design';
import { careerTitles } from '../utils/career-matches';
import { getCareerMatches } from '../utils/career-matching';
import { MasarakIcon } from './masarak-icon';
import { useAppPreferences } from '../contexts/app-preferences-context';

type CareerMatch = ReturnType<typeof getCareerMatches>[number];

const careerFamilyTitles: Record<string, { ar: string; en: string }> = {
  C01: { ar: 'تطوير البرمجيات', en: 'Software development' },
  C02: { ar: 'تحليل البيانات', en: 'Data analytics' },
  C03: { ar: 'علم البيانات', en: 'Data science' },
  C04: { ar: 'الذكاء الاصطناعي وتعلّم الآلة', en: 'AI & machine learning' },
  C05: { ar: 'الأمن السيبراني', en: 'Cybersecurity' },
  C06: { ar: 'هندسة الشبكات', en: 'Network engineering' },
  C07: { ar: 'هندسة البيانات', en: 'Data engineering' },
  C08: { ar: 'السحابة وDevOps', en: 'Cloud & DevOps' },
  C09: { ar: 'نظم الأعمال', en: 'Business systems' },
  'software-testing': { ar: 'اختبار البرمجيات وضمان الجودة', en: 'Software testing & QA' },
  'computer-engineering': { ar: 'هندسة الحاسب والأنظمة المضمنة', en: 'Computer & embedded systems' },
};

export function CareerCard({ careers, familyId }: { careers: CareerMatch[]; familyId: string }) {
  const router = useRouter();
  const { language } = useAppPreferences();
  const [expanded, setExpanded] = useState(false);
  const en = language === 'en';
  const bestCareer = careers[0];
  const title = careerFamilyTitles[familyId]?.[en ? 'en' : 'ar'] ?? (en ? bestCareer.title : careerTitles[bestCareer.base_career_id] ?? bestCareer.title);
  const labels = en
    ? { match: 'match', explore: 'Explore', closest: 'Closest role', example: 'Example role', skills: 'core skills', addSkills: 'Add skills to see your match', show: 'Show job titles', hide: 'Hide job titles' }
    : { match: 'ملاءمة', explore: 'استكشف', closest: 'أقرب مسمى', example: 'مثال على المسمى', skills: 'مهارات أساسية', addSkills: 'أضيفي مهاراتك لعرض الملاءمة', show: 'عرض المسميات الوظيفية', hide: 'إخفاء المسميات الوظيفية' };
  const openCareer = (career: CareerMatch) => router.push({ pathname: '/career', params: { id: career.career_id } });

  return <View style={[ui.card, styles.card]}>
    <Pressable accessibilityRole="button" accessibilityLabel={`${title}, ${bestCareer.score === null ? labels.explore : `${labels.match} ${bestCareer.score}%`}`} onPress={() => openCareer(bestCareer)} style={({ pressed }) => [styles.cardMain, pressed && ui.pressed]}>
      <View style={[ui.row, en && styles.rowLtr]}>
        <View style={styles.badge}><MasarakIcon name="careers" /></View>
        <Text style={[styles.score, en && styles.ltr]}>{bestCareer.score === null ? labels.explore : `${bestCareer.score}% ${labels.match}`}</Text>
      </View>
      <Text style={[ui.heading, en && styles.ltr]}>{title}</Text>
      <Text style={[styles.english, en && styles.ltr]}>{bestCareer.score === null ? labels.example : labels.closest}: {bestCareer.title}</Text>
      <View style={[styles.track, en && styles.trackLtr]}><View style={[styles.progress, { width: `${bestCareer.score ?? 0}%` }]} /></View>
      <View style={[ui.row, en && styles.rowLtr]}>
        <Text style={[ui.note, en && styles.ltr]}>{bestCareer.score === null ? labels.addSkills : `${bestCareer.matched} ${en ? 'of' : 'من'} ${bestCareer.total} ${labels.skills}`}</Text>
        <MasarakIcon name="arrow" size={19} />
      </View>
    </Pressable>
    <View style={styles.divider} />
    <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setExpanded(value => !value)} style={({ pressed }) => [styles.expandButton, en && styles.rowLtr, pressed && ui.pressed]}>
      <Text style={[styles.expandText, en && styles.ltr]}>{expanded ? labels.hide : labels.show} ({careers.length})</Text>
      <Text style={styles.expandIcon}>{expanded ? '⌃' : '⌄'}</Text>
    </Pressable>
    {expanded ? <View style={[styles.roles, en && styles.rolesLtr]}>
      {careers.map(career => <Pressable key={career.career_id} accessibilityRole="button" onPress={() => openCareer(career)} style={({ pressed }) => [styles.roleChip, pressed && ui.pressed]}>
        <Text style={[styles.roleText, en && styles.ltr]}>{career.title}</Text>
      </Pressable>)}
    </View> : null}
  </View>;
}
const styles = createAdaptiveStyles(() => ({
  card: { gap: 0, paddingBottom: 12 },
  cardMain: { gap: 11 },
  badge: { padding: 9, backgroundColor: colors.mint, borderRadius: 13 },
  score: { color: colors.primary, backgroundColor: colors.mint, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, fontSize: 12, fontWeight: '700' },
  english: { color: colors.muted, fontSize: 13, lineHeight: 20, textAlign: 'right' as const },
  track: { height: 5, borderRadius: 3, backgroundColor: colors.soft, overflow: 'hidden', alignItems: 'flex-end' as const },
  trackLtr: { alignItems: 'flex-start' as const },
  progress: { height: 5, backgroundColor: colors.primary, borderRadius: 3 },
  divider: { height: 1, backgroundColor: colors.border, marginTop: 14 },
  expandButton: { minHeight: 42, flexDirection: 'row-reverse' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, gap: 10 },
  expandText: { color: colors.primary, fontSize: 13, fontWeight: '600', textAlign: 'right' as const },
  expandIcon: { color: colors.primary, fontSize: 21, lineHeight: 24 },
  roles: { flexDirection: 'row-reverse' as const, flexWrap: 'wrap' as const, gap: 8, paddingTop: 4 },
  rolesLtr: { flexDirection: 'row' as const },
  roleChip: { minHeight: 36, justifyContent: 'center' as const, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.soft, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 7 },
  roleText: { color: colors.ink, fontSize: 12, textAlign: 'right' as const },
  ltr: { textAlign: 'left' as const, writingDirection: 'ltr' as const },
  rowLtr: { flexDirection: 'row' as const },
}));
