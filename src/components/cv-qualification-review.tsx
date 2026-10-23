import { Pressable, Text } from 'react-native';
import { useSkillProfile } from '../hooks/use-skill-profile';
import { useProfessionalCertifications } from '../hooks/use-professional-certifications';
import { useLearningProgress } from '../hooks/use-learning-progress';
import { qualificationMatches } from '../utils/qualification-matches';
import { ui } from '../constants/design';
import { DisclosureCard } from './disclosure-card';

export function CvQualificationReview() {
  const profile = useSkillProfile();
  const certifications = useProfessionalCertifications();
  const learning = useLearningProgress();
  if (!profile.profile?.cv) return null;
  const matches = qualificationMatches(profile.profile.cv);
  const total = matches.certificates.length + matches.courses.length;
  return <DisclosureCard title="تأكيد الشهادات والدورات" subtitle="يُستخدم إقرارك لتحديث التقدم" summary={total ? `${matches.certificates.length} شهادة · ${matches.courses.length} دورة` : 'لا توجد عناصر مطابقة تحتاج إلى تأكيد'} status={total ? 'بحاجة لإقرارك' : 'لا إجراء'} statusTone={total ? 'warning' : 'neutral'}>
    <Text style={ui.note}>هذه مطابقة أسماء فقط. أقرّي بالحصول أو الإكمال إذا كان ذلك صحيحًا؛ الدورة ليست شهادة مهنية.</Text>
    {certifications.error ? <Text style={ui.note}>{certifications.error}</Text> : null}
    {learning.error ? <Text style={ui.note}>{learning.error}</Text> : null}
    {!matches.certificates.length && !matches.courses.length ? <Text style={ui.note}>لا توجد مطابقة حرفية في الكتالوج الإرشادي. معلومات السيرة محفوظة؛ لا نمنح نقاطًا لمؤهل مختلف بالتخمين.</Text> : null}
    {matches.certificates.map(item => <Pressable key={item.id} accessibilityRole="checkbox" accessibilityState={{ checked: certifications.achieved.includes(item.id) }} disabled={!certifications.ready || certifications.busy} onPress={() => void certifications.change(item.id, !certifications.achieved.includes(item.id))}><Text style={ui.link}>{certifications.achieved.includes(item.id) ? 'حصلت عليها — إلغاء الإقرار' : 'أقر بأنني حصلت عليها'}: {item.title}</Text></Pressable>)}
    {matches.courses.map(item => <Pressable key={item.id} accessibilityRole="checkbox" accessibilityState={{ checked: !!learning.progress[item.id] }} disabled={!learning.ready || learning.busy} onPress={() => void learning.change(item.id, !learning.progress[item.id])}><Text style={ui.link}>{learning.progress[item.id] ? 'مكتملة — إلغاء الإقرار' : 'أقر بأنني أكملتها'}: {item.title}</Text></Pressable>)}
  </DisclosureCard>;
}
