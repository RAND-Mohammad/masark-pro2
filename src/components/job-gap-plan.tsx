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
    <Text style={[ui.note, en && styles.ltr]}>{t('ابدأ بالمهارات المطلوبة، ثم وثّق تطبيقها في مشروع أو خبرة وراجع ملفك. إكمال مورد تعليمي وحده لا يضيف مهارة ولا يرفع نسبة التوافق.', 'Start with required skills, then document them in a project or experience entry and update your profile. Completing a resource alone does not add a skill or raise the match score.')}</Text>
    {match.missing.length === 0 ? <Text style={[ui.text, en && styles.ltr]}>{t('لا توجد فجوات في المهارات المطلوبة التي استخرجناها. راجع بقية شروط الإعلان قبل التقديم.', 'No gaps were found in the required skills we extracted. Review the rest of the listing before applying.')}</Text> : null}
    {match.missing.map((requirement, index) => {
      const resources = resourcesForJobRequirement(requirement);
      return <View key={requirement.key} style={{ gap: 10 }}>
        <Text style={ui.heading}>{index + 1}. {requirement.name}{requirement.alternatives.length ? ` أو ${requirement.alternatives.join(' أو ')}` : ''}</Text>
        <Text style={[ui.text, en && styles.ltr]}>{t('تعلم الأساسيات، ثم أنجز مثالًا أو مشروعًا تستخدم فيه المهارة وتوضح فيه قراراتك ونتائجك. أضف الدليل إلى ملفك بعد المراجعة.', 'Learn the basics, then build an example or project that uses the skill and explains your decisions and results. Add the evidence to your profile after review.')}</Text>
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
    {match.experience.state === 'gap' || match.experience.state === 'unknown' ? <><Text style={[ui.heading, en && styles.ltr]}>{t('الخبرة المرتبطة بالوظيفة', 'Relevant experience')}</Text><Text style={[ui.text, en && styles.ltr]}>{match.experience.message}</Text><Text style={[ui.note, en && styles.ltr]}>{t('استكمل تواريخ خبرتك الفعلية، وابحث عن تدريب أو مهام مرتبطة بالمجال. المشروع والدورة لا يُحسبان سنوات خبرة وظيفية.', 'Add accurate dates for your experience and look for relevant internships or tasks. A project or course does not count as years of work experience.')}</Text></> : null}
    {match.education.state === 'gap' || match.education.state === 'unknown' ? <><Text style={[ui.heading, en && styles.ltr]}>{t('المؤهل والتخصص', 'Education and major')}</Text><Text style={[ui.text, en && styles.ltr]}>{match.education.message}</Text><Text style={[ui.note, en && styles.ltr]}>{t('راجع بيانات تعليمك وشروط البدائل في الإعلان؛ الدورات القصيرة لا تعوّض مؤهلًا جامعيًا مطلوبًا.', 'Review your education details and accepted alternatives in the listing; short courses do not replace a required degree.')}</Text></> : null}
    {match.preferredMissing.length ? <Text style={[ui.note, en && styles.ltr]}>{t('بعد المتطلبات الأساسية، طوّر المفضّل:', 'After required skills, consider developing:')} {match.preferredMissing.map(item => item.name).join(en ? ', ' : '، ')}.</Text> : null}
    {progress.error ? <Text style={ui.note}>{progress.error}</Text> : null}
  </View>;
}

const styles = createAdaptiveStyles(() => ({ ltr: { textAlign: 'left', writingDirection: 'ltr' } }));
