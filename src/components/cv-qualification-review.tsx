import { Pressable, Text, View } from 'react-native';
import { useSkillProfile } from '../hooks/use-skill-profile';
import { useProfessionalCertifications } from '../hooks/use-professional-certifications';
import { useLearningProgress } from '../hooks/use-learning-progress';
import { qualificationMatches } from '../utils/qualification-matches';
import { ui } from '../constants/design';

export function CvQualificationReview() {
  const profile = useSkillProfile();
  const certifications = useProfessionalCertifications();
  const learning = useLearningProgress();
  if (!profile.profile?.cv) return null;
  const matches = qualificationMatches(profile.profile.cv);
  return <View style={ui.card}>
    <Text style={ui.heading}>ربط مؤهلات ملفك بالجاهزية</Text>
    <Text style={ui.note}>هذه مطابقات أسماء من بياناتك المعتمدة (السيرة أو الإجابات)، وليست مصادقة من الجهة المانحة. أكد الحصول على الشهادة أو إكمال الدورة فقط إذا كان ذلك صحيحًا. لا تُحسب الدورة شهادة مهنية.</Text>
    {certifications.error ? <Text style={ui.note}>{certifications.error}</Text> : null}
    {learning.error ? <Text style={ui.note}>{learning.error}</Text> : null}
    {!matches.certificates.length && !matches.courses.length ? <Text style={ui.note}>لا توجد مطابقة حرفية في الكتالوج الإرشادي. معلومات السيرة محفوظة؛ لا نمنح نقاطًا لمؤهل مختلف بالتخمين.</Text> : null}
    {matches.certificates.map(item => <Pressable key={item.id} accessibilityRole="checkbox" accessibilityState={{ checked: certifications.achieved.includes(item.id) }} disabled={!certifications.ready || certifications.busy} onPress={() => void certifications.change(item.id, !certifications.achieved.includes(item.id))}><Text style={ui.link}>{certifications.achieved.includes(item.id) ? 'حصلت عليها — إلغاء الإقرار' : 'أقر بأنني حصلت عليها'}: {item.title}</Text></Pressable>)}
    {matches.courses.map(item => <Pressable key={item.id} accessibilityRole="checkbox" accessibilityState={{ checked: !!learning.progress[item.id] }} disabled={!learning.ready || learning.busy} onPress={() => void learning.change(item.id, !learning.progress[item.id])}><Text style={ui.link}>{learning.progress[item.id] ? 'مكتملة — إلغاء الإقرار' : 'أقر بأنني أكملتها'}: {item.title}</Text></Pressable>)}
  </View>;
}
