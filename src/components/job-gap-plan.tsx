import { Linking, Pressable, Text, View } from 'react-native';
import { ui } from '../constants/design';
import { resourcesForJobRequirement } from '../utils/job-learning-plan';
import { useLearningProgress } from '../hooks/use-learning-progress';
import type { JobMatch } from '../utils/job-matching';

export function JobGapPlan({ match }: { match: JobMatch }) {
  const progress = useLearningProgress();
  return <View style={ui.card}>
    <Text style={ui.heading}>خطة الفجوات لهذه الوظيفة</Text>
    <Text style={ui.text}>{match.job.title} · {match.job.employer}</Text>
    <Text style={ui.note}>ابدأ بالمهارات المطلوبة، ثم وثّق تطبيقها في مشروع أو خبرة وراجع ملفك. إكمال مورد تعليمي وحده لا يضيف مهارة ولا يرفع نسبة التوافق.</Text>
    {match.missing.length === 0 ? <Text style={ui.text}>لا توجد فجوات في المهارات المطلوبة التي استخرجناها. راجع بقية شروط الإعلان قبل التقديم.</Text> : null}
    {match.missing.map((requirement, index) => {
      const resources = resourcesForJobRequirement(requirement);
      return <View key={requirement.key} style={{ gap: 10 }}>
        <Text style={ui.heading}>{index + 1}. {requirement.name}{requirement.alternatives.length ? ` أو ${requirement.alternatives.join(' أو ')}` : ''}</Text>
        <Text style={ui.text}>تعلم الأساسيات، ثم أنجز مثالًا أو مشروعًا تستخدم فيه المهارة وتوضح فيه قراراتك ونتائجك. أضف الدليل إلى ملفك بعد المراجعة.</Text>
        <Text selectable style={ui.note}>المتطلب في الإعلان: {requirement.evidence}</Text>
        {!resources.length ? <Text style={ui.note}>ما عندنا مورد محدد راجعناه لهذه المهارة حاليًا. نحتاج اختيار مصدر مناسب قبل إضافته.</Text> : null}
        {resources.map(resource => <View key={resource.id} style={{ gap: 6 }}>
          <Text style={ui.text}>{resource.title}</Text><Text style={ui.note}>{resource.provider} · {resource.level} · {resource.duration}</Text><Text style={ui.note}>{resource.access}</Text>
          <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(resource.url)}><Text style={ui.link}>فتح المورد الرسمي</Text></Pressable>
          <Pressable accessibilityRole="checkbox" disabled={!progress.ready || progress.busy} accessibilityState={{ checked: Boolean(progress.progress[resource.id]), disabled: !progress.ready || progress.busy }} onPress={() => void progress.change(resource.id, !progress.progress[resource.id])}>
            <Text style={ui.link}>{progress.progress[resource.id] ? '✓ أكملت المورد بإقراري' : '□ أكملت هذا المورد'}</Text>
          </Pressable>
        </View>)}
      </View>;
    })}
    {match.experience.state === 'gap' || match.experience.state === 'unknown' ? <><Text style={ui.heading}>الخبرة المرتبطة بالوظيفة</Text><Text style={ui.text}>{match.experience.message}</Text><Text style={ui.note}>استكمل تواريخ خبرتك الفعلية، وابحث عن تدريب أو مهام مرتبطة بالمجال. المشروع والدورة لا يُحسبان سنوات خبرة وظيفية.</Text></> : null}
    {match.education.state === 'gap' || match.education.state === 'unknown' ? <><Text style={ui.heading}>المؤهل والتخصص</Text><Text style={ui.text}>{match.education.message}</Text><Text style={ui.note}>راجع بيانات تعليمك وشروط البدائل في الإعلان؛ الدورات القصيرة لا تعوّض مؤهلًا جامعيًا مطلوبًا.</Text></> : null}
    {match.preferredMissing.length ? <Text style={ui.note}>بعد المتطلبات الأساسية، طوّر المفضّل: {match.preferredMissing.map(item => item.name).join('، ')}.</Text> : null}
    {progress.error ? <Text style={ui.note}>{progress.error}</Text> : null}
  </View>;
}
