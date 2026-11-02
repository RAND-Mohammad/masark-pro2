import { useLocalSearchParams, useRouter } from 'expo-router';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { learningResources } from '../constants/learning-resources';
import dataset from '../masarak_dataset.json';
import { useLearningProgress } from '../hooks/use-learning-progress';
import { useLearningResources } from '../hooks/use-learning-resources';
import { displaySkillName } from '../utils/skill-labels';
import { colors, ui, createAdaptiveStyles} from '../constants/design';
import { useAppPreferences } from '../contexts/app-preferences-context';

export default function CourseDetailsScreen() {
  useLearningResources();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const resourceId = Array.isArray(params.id) ? params.id[0] : params.id;
  const resource = learningResources.find(item => item.id === resourceId);
  const progress = useLearningProgress();
  const { language } = useAppPreferences(); const en = language === 'en';
  const t = (ar: string, english: string) => en ? english : ar;
  const completedAt = resource ? progress.progress[resource.id] : undefined;
  const relatedSkills = resource
    ? resource.skillIds.flatMap(id => {
      const skill = dataset.skills.find(item => item.skill_id === id);
      return skill ? [{ id, name: en ? skill.name : displaySkillName(skill.name) }] : [];
    })
    : [];

  return <SafeAreaView edges={['top', 'left', 'right']} style={ui.screen}>
    <ScrollView contentContainerStyle={ui.content}>
      <Pressable accessibilityRole="button" onPress={() => router.canGoBack() ? router.back() : router.replace('/learning-plan')}>
        <Text style={[ui.link, en && styles.ltr]}>{t('رجوع', 'Back')}</Text>
      </Pressable>
      {!resource ? <View style={ui.card}>
        <Text style={[ui.heading, en && styles.ltr]}>{t('لم نعثر على هذا المورد', 'Resource not found')}</Text>
        <Text style={[ui.text, en && styles.ltr]}>{t('قد يكون المورد أُزيل من الكتالوج أو تغيّر رابطه.', 'This resource may have been removed or its link may have changed.')}</Text>
        <Pressable accessibilityRole="button" onPress={() => router.replace('/progress' as never)}><Text style={[ui.link, en && styles.ltr]}>{t('فتح تقدّم التعلم', 'Open learning progress')}</Text></Pressable>
      </View> : <>
        <Text style={[ui.eyebrow, en && styles.ltr]}>{t('مورد تعلّم', 'LEARNING RESOURCE')}</Text>
        <Text style={[ui.title, en && styles.ltr]}>{resource.title}</Text>
        <Text style={[ui.text, en && styles.ltr]}>{resource.provider}</Text>

        <View style={styles.statusCard}>
          <Text style={[styles.statusTitle, en && styles.ltr]}>{completedAt ? t('أكملتِ هذا المورد', 'You marked this resource complete') : t('لم يُسجّل كمكتمل بعد', 'Not marked complete yet')}</Text>
          {completedAt ? <Text style={[styles.meta, en && styles.ltr]}>{t('تاريخ الإكمال:', 'Completed:')} {new Date(completedAt).toLocaleDateString(en ? 'en-US' : 'ar-SA')}</Text> : <Text style={[styles.meta, en && styles.ltr]}>{t('علّميه كمكتمل بعد إنهائه. هذا إقرار منك ولا يثبت امتلاك المهارة.', 'Mark it complete when finished. This is self-reported and does not prove the skill.')}</Text>}
          <View style={styles.track}><View style={[styles.fill, { width: completedAt ? '100%' : '0%' }]} /></View>
          <Text style={[styles.meta, en && styles.ltr]}>{completedAt ? (en ? '100% complete' : '100% مسجّل') : (en ? '0% complete' : '0% مسجّل')}</Text>
        </View>

        <View style={ui.card}>
          <Text style={[ui.heading, en && styles.ltr]}>{t('تفاصيل المورد', 'Resource details')}</Text>
          <InfoRow label={t('الجهة', 'Provider')} value={resource.provider} en={en} />
          <InfoRow label={t('المستوى', 'Level')} value={resource.level} en={en} />
          <InfoRow label={t('المدة التقديرية', 'Estimated duration')} value={resource.duration} en={en} />
          <InfoRow label={t('طريقة الوصول', 'Access')} value={resource.access} en={en} />
          <InfoRow label={t('اللغة', 'Language')} value={resource.language} en={en} />
        </View>

        <View style={ui.card}>
          <Text style={[ui.heading, en && styles.ltr]}>{t('المهارات المرتبطة', 'Related skills')}</Text>
          {relatedSkills.length ? relatedSkills.map(skill => <View key={skill.id} style={[styles.skillRow, en && styles.skillRowLtr]}><Text style={[styles.skillName, en && styles.ltr]}>{skill.name}</Text><Text style={styles.skillId}>{skill.id}</Text></View>) : <Text style={[ui.note, en && styles.ltr]}>{t('لا توجد مهارات مرتبطة بهذا المورد.', 'No skills are linked to this resource.')}</Text>}
        </View>

        {progress.error ? <Pressable accessibilityRole="button" onPress={() => void progress.reload()}><Text style={[styles.error, en && styles.ltr]}>{progress.error} {t('اضغطي لإعادة التحميل.', 'Tap to reload.')}</Text></Pressable> : null}
        <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(resource.url)} style={ui.outline}>
          <Text style={ui.outlineText}>{t('فتح صفحة المورد الرسمية', 'Open official resource page')}</Text>
        </Pressable>
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: Boolean(completedAt), disabled: !progress.ready || progress.busy }} disabled={!progress.ready || progress.busy} onPress={() => void progress.change(resource.id, !completedAt)} style={[ui.button, (!progress.ready || progress.busy) && styles.disabled]}>
          <Text style={ui.buttonText}>{progress.busy ? t('جارٍ الحفظ…', 'Saving…') : completedAt ? t('إلغاء علامة الإكمال', 'Undo completion') : t('وضع علامة كمكتمل', 'Mark complete')}</Text>
        </Pressable>
        <Text style={[ui.note, en && styles.ltr]}>{t('يُحفظ التقدم على هذا الجهاز، ويُزامن مع حسابك إذا فعّلت الحفظ السحابي. إكمال المورد لا يضيف المهارة إلى ملفك تلقائيًا.', 'Progress is saved on this device and syncs to your account when cloud sync is enabled. Completing a resource does not automatically add a skill to your profile.')}</Text>
      </>}
    </ScrollView>
  </SafeAreaView>;
}

function InfoRow({ label, value, en }: { label: string; value: string; en: boolean }) {
  return <View style={styles.infoRow}><Text style={[styles.infoValue, en && styles.ltr]}>{value}</Text><Text style={[styles.infoLabel, en && styles.ltr]}>{label}</Text></View>;
}

const styles = createAdaptiveStyles(() => ({
  statusCard: { backgroundColor: colors.mint, borderRadius: 20, padding: 20, gap: 9 },
  statusTitle: { color: colors.ink, fontSize: 18, fontWeight: '700', textAlign: 'right' },
  meta: { color: colors.muted, fontSize: 13, lineHeight: 21, textAlign: 'right' },
  track: { height: 9, borderRadius: 8, backgroundColor: colors.border, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.primary, borderRadius: 8 },
  infoRow: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12, gap: 4 },
  infoValue: { color: colors.ink, fontSize: 15, lineHeight: 23, textAlign: 'right' },
  infoLabel: { color: colors.muted, fontSize: 12, textAlign: 'right' },
  skillRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: 11, borderRadius: 12, backgroundColor: colors.soft },
  skillName: { flex: 1, color: colors.ink, fontSize: 14, textAlign: 'right' },
  skillId: { color: colors.muted, fontSize: 11, writingDirection: 'ltr' },
  error: { color: colors.error, textAlign: 'right', lineHeight: 22 },
  disabled: { opacity: 0.55 },
  ltr: { textAlign: 'left', writingDirection: 'ltr' },
  skillRowLtr: { flexDirection: 'row' },
}));
