import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, createAdaptiveStyles, ui } from '../constants/design';
import { useSkillProfile } from '../hooks/use-skill-profile';
import { CareerCard } from '../components/career-card';
import { usePersonalProfile } from '../hooks/use-personal-profile';
import { getCareerMatches } from '../utils/career-matching';
import { useAppPreferences } from '../contexts/app-preferences-context';

const separateRoleFamilies: Record<string, string> = {
  'QA Engineer': 'software-testing',
  'Software Test Engineer': 'software-testing',
  'Computer Engineer': 'computer-engineering',
  'Hardware Engineer': 'computer-engineering',
  'Embedded Systems Engineer': 'computer-engineering',
  'IoT Engineer': 'computer-engineering',
  'Firmware Engineer': 'computer-engineering',
};

export default function CareersScreen() {
  const [showAll, setShowAll] = useState(false);
  const { profile, ready, error } = useSkillProfile();
  const personal = usePersonalProfile();
  const { language } = useAppPreferences();
  const en = language === 'en';
  const matches = getCareerMatches({ skillProfile: profile, personal: personal.personal });
  const groupsByFamily = new Map<string, typeof matches>();
  for (const match of matches) {
    const familyId = separateRoleFamilies[match.title] ?? match.base_career_id;
    const group = groupsByFamily.get(familyId) ?? [];
    group.push(match);
    groupsByFamily.set(familyId, group);
  }
  const groups = Array.from(groupsByFamily, ([familyId, careers]) => ({ familyId, careers }));
  const hasPersonalizedMatches = groups.some(group => group.careers[0]?.score !== null);
  const topGroups: typeof groups = [];
  const seenCareerFamilies = new Set<string>();
  for (const group of groups) {
    const baseCareerId = group.careers[0]?.base_career_id;
    if (!baseCareerId || seenCareerFamilies.has(baseCareerId)) continue;
    topGroups.push(group);
    seenCareerFamilies.add(baseCareerId);
    if (topGroups.length === 3) break;
  }
  const visibleGroups = showAll || !hasPersonalizedMatches ? groups : topGroups;
  const allReady = ready && personal.ready;
  return <SafeAreaView edges={['top', 'left', 'right']} style={ui.screen}><ScrollView contentContainerStyle={ui.content}>
    <Text style={[ui.eyebrow, en && styles.ltr]}>{en ? 'CAREER PATHS' : 'مساراتك المهنية'}</Text>
    <Text style={[styles.pageTitle, en && styles.ltr]}>{en ? 'Find a direction that fits.' : 'اكتشفي المسار الأقرب لك.'}</Text>
    <View style={[styles.infoPanel, en && styles.rowLtr]}>
      <View style={styles.countBadge}><Text style={styles.countText}>{groups.length}</Text></View>
      <Text style={[styles.infoText, en && styles.ltr]}>{en ? 'career paths' : 'مسارًا مهنيًا'}</Text>
    </View>
    {!allReady ? <Text style={[ui.text, en && styles.ltr]}>{en ? 'Loading your profile evidence…' : 'جارٍ جمع أدلة ملفك…'}</Text> : error ? <Text style={[ui.text, en && styles.ltr]}>{error}</Text> : <>
      <Text style={[ui.eyebrow, en && styles.ltr]}>{hasPersonalizedMatches ? en ? 'CLOSEST MATCHES' : 'الأقرب إلى ملفك' : en ? 'EXPLORE CAREER FAMILIES' : 'مسارات تستحق الاستكشاف'}</Text>
      {visibleGroups.map(group => <CareerCard key={group.familyId} familyId={group.familyId} careers={group.careers} />)}
      {hasPersonalizedMatches && groups.length > 3 ? <Pressable accessibilityRole="button" accessibilityState={{ expanded: showAll }} onPress={() => setShowAll(value => !value)} style={({ pressed }) => [styles.allButton, pressed && ui.pressed]}>
        <Text style={[styles.allButtonText, en && styles.ltr]}>{showAll ? en ? 'Show top matches' : 'عرض المسارات الأقرب فقط' : `${en ? 'View all' : 'عرض جميع المسارات'} (${groups.length})`}</Text>
      </Pressable> : null}
    </>}
    <Text style={[ui.note, en && styles.ltr]}>{en ? 'A guide for exploration, not a hiring guarantee.' : 'المطابقة للاستكشاف، ولا تضمن القبول الوظيفي.'}</Text>
  </ScrollView></SafeAreaView>;
}

const styles = createAdaptiveStyles(() => ({
  pageTitle: { color: colors.navy, fontSize: 30, lineHeight: 38, fontWeight: '800', textAlign: 'right' as const },
  infoPanel: { flexDirection: 'row-reverse' as const, alignItems: 'center' as const, gap: 12, padding: 13, backgroundColor: colors.mint, borderRadius: 16 },
  countBadge: { minWidth: 34, height: 34, paddingHorizontal: 7, borderRadius: 11, backgroundColor: colors.surface, alignItems: 'center' as const, justifyContent: 'center' as const },
  countText: { color: colors.primary, fontWeight: '700', fontSize: 15 },
  infoText: { flex: 1, color: colors.ink, fontSize: 13, lineHeight: 20, textAlign: 'right' as const },
  allButton: { minHeight: 48, paddingHorizontal: 16, borderRadius: 14, borderWidth: 1, borderColor: colors.primary, alignItems: 'center' as const, justifyContent: 'center' as const },
  allButtonText: { color: colors.primary, fontWeight: '700', textAlign: 'center' as const },
  ltr: { textAlign: 'left' as const, writingDirection: 'ltr' as const },
  rowLtr: { flexDirection: 'row' as const },
}));
