import { Linking, Pressable, Text, View } from 'react-native';
import { createAdaptiveStyles, ui } from '../constants/design';
import { resourcesForJobRequirement } from '../utils/job-learning-plan';
import { useLearningResources } from '../hooks/use-learning-resources';
import { useLearningProgress } from '../hooks/use-learning-progress';
import type { JobMatch } from '../utils/job-matching';
import { useAppPreferences } from '../contexts/app-preferences-context';

export function JobGapPlan({ match }: { match: JobMatch }) {
  useLearningResources();
  const progress = useLearningProgress();
  const { language } = useAppPreferences(); const en = language === 'en';
  const t = (ar: string, english: string) => en ? english : ar;
  return <View style={ui.card}>
    <Text style={[ui.heading, en && styles.ltr]}>{t('خطة الفجوات لهذه الوظيفة', 'Skill gap plan for this job')}</Text>
    <Text style={[ui.text, en && styles.ltr]}>{match.job.title} · {match.job.employer}</Text>
    {match.missing.length === 0 ? <Text style={[ui.text, en && styles.ltr]}>{match.preferredMissing.length
      ? t(`ما ظهر نقص في المهارات الأساسية. مهارات إضافية مقترحة: ${match.preferredMissing.map(item => item.name).join('، ')}.`, `No core skill gaps found. Suggested additional skills: ${match.preferredMissing.map(item => item.name).join(', ')}.`)
      : t('ما ظهر نقص في المهارات الأساسية المستخرجة. راجع بقية شروط الإعلان قبل التقديم.', 'No gaps found in the extracted core skills. Review the rest of the listing before applying.')}</Text> : null}
    {match.missing.map((requirement, index) => {
      const resources = resourcesForJobRequirement(requirement);
      return <View key={requirement.key} style={{ gap: 10 }}>
        <Text style={ui.heading}>{index + 1}. {requirement.name}{requirement.alternatives.length ? ` أو ${requirement.alternatives.join(' أو ')}` : ''}</Text>
        <Text style={[ui.text, en && styles.ltr]}>{t('تعلّمها ووثّق تطبيقها بمشروع أو خبرة في ملفك.', 'Learn it, then document it with a project or experience in your profile.')}</Text>
        <Text selectable style={[ui.note, en && styles.ltr]}>{t('المتطلب في الإعلان:', 'Listing requirement:')} {requirement.evidence}</Text>
        {!resources.length ? <Text style={[ui.note, en && styles.ltr]}>{t('ما عندنا مورد محدد راجعناه لهذه المهارة حاليًا. نحتاج اختيار مصدر مناسب قبل إضافته.', 'There is no reviewed resource for this skill yet. A suitable source needs to be selected before one can be added.')}</Text> : null}
        {resources.map(resource => <View key={resource.id} style={{ gap: 6 }}>
          <Text style={[ui.text, en && styles.ltr]}>{resource.title}</Text><Text style={[ui.note, en && styles.ltr]}>{resource.provider} · {resource.level} · {resource.duration}</Text><Text style={[ui.note, en && styles.ltr]}>{resource.access}</Text>
          <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(resource.url)}><Text style={[ui.link, en && styles.ltr]}>{t('فتح المورد الرسمي', 'Open official resource')}</Text></Pressable>
          <Pressable accessibilityRole="checkbox" disabled={!progress.ready || progress.busy} accessibilityState={{ checked: Boolean(progress.progress[resource.id]), disabled: !progress.ready || progress.busy }} onPress={() => void progress.change(resource.id, !progress.progress[resource.id])}>
            <Text style={[ui.link, en && styles.ltr]}>{progress.progress[resource.id] ? `✓ ${t('أكملت المورد بإقراري', 'Marked complete by me')}` : `□ ${t('أكملت هذا المورد', 'Mark this resource complete')}`}</Text>
          </Pressable>
        </View>)}
      </View>;
    })}
    {match.experience.state === 'gap' || match.experience.state === 'unknown' ? <><Text style={[ui.heading, en && styles.ltr]}>{t('الخبرة المرتبطة بالوظيفة', 'Relevant experience')}</Text><Text style={[ui.text, en && styles.ltr]}>{match.experience.message}</Text><Text style={[ui.note, en && styles.ltr]}>{t('أضف خبرتك الفعلية وتواريخها؛ المشروع أو الدورة لا يُحتسب سنوات خبرة.', 'Add your actual experience and dates; a project or course does not count as years of work experience.')}</Text></> : null}
    {match.education.state === 'gap' || match.education.state === 'unknown' ? <><Text style={[ui.heading, en && styles.ltr]}>{t('المؤهل والتخصص', 'Education and major')}</Text><Text style={[ui.text, en && styles.ltr]}>{match.education.message}</Text><Text style={[ui.note, en && styles.ltr]}>{t('راجع شرط المؤهل والبدائل المذكورة في الإعلان.', 'Review the degree requirement and accepted alternatives in the listing.')}</Text></> : null}
    {match.missing.length > 0 && match.preferredMissing.length ? <Text style={[ui.note, en && styles.ltr]}>{t('مهارات إضافية مفضلة:', 'Additional preferred skills:')} {match.preferredMissing.map(item => item.name).join(en ? ', ' : '، ')}.</Text> : null}
    {progress.error ? <Text style={ui.note}>{progress.error}</Text> : null}
  </View>;
}

const styles = createAdaptiveStyles(() => ({ ltr: { textAlign: 'left', writingDirection: 'ltr' } }));
