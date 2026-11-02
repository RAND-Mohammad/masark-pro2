import { Pressable, Text } from 'react-native';
import { useSkillProfile } from '../hooks/use-skill-profile';
import { useProfessionalCertifications } from '../hooks/use-professional-certifications';
import { useLearningProgress } from '../hooks/use-learning-progress';
import { qualificationMatches } from '../utils/qualification-matches';
import { useLearningResources } from '../hooks/use-learning-resources';
import { createAdaptiveStyles, ui } from '../constants/design';
import { DisclosureCard } from './disclosure-card';
import { useAppPreferences } from '../contexts/app-preferences-context';

export function CvQualificationReview() {
  const { language } = useAppPreferences();
  const en = language === 'en';
  useLearningResources();
  const profile = useSkillProfile();
  const certifications = useProfessionalCertifications();
  const learning = useLearningProgress();
  if (!profile.profile?.cv) return null;
  const matches = qualificationMatches(profile.profile.cv);
  const total = matches.certificates.length + matches.courses.length;
  return <DisclosureCard title={en ? 'Confirm certificates and courses' : 'تأكيد الشهادات والدورات'} subtitle={en ? 'Your confirmation updates learning progress' : 'يُستخدم إقرارك لتحديث التقدم'} summary={total ? en ? `${matches.certificates.length} certificates · ${matches.courses.length} courses` : `${matches.certificates.length} شهادة · ${matches.courses.length} دورة` : en ? 'No matching items need confirmation' : 'لا توجد عناصر مطابقة تحتاج إلى تأكيد'} status={total ? en ? 'Needs your confirmation' : 'بحاجة لإقرارك' : en ? 'No action' : 'لا إجراء'} statusTone={total ? 'warning' : 'neutral'}>
    <Text style={[ui.note, en && styles.ltr]}>{en ? 'This matches names only. Confirm a certificate or course only if you actually earned or completed it. A course is not a professional certification.' : 'هذه مطابقة أسماء فقط. أقرّي بالحصول أو الإكمال إذا كان ذلك صحيحًا؛ الدورة ليست شهادة مهنية.'}</Text>
    {certifications.error ? <Text style={[ui.note, en && styles.ltr]}>{certifications.error}</Text> : null}
    {learning.error ? <Text style={[ui.note, en && styles.ltr]}>{learning.error}</Text> : null}
    {!matches.certificates.length && !matches.courses.length ? <Text style={[ui.note, en && styles.ltr]}>{en ? 'No exact match was found in the guidance catalog. Your CV information is saved; we do not award credit by guessing about a different qualification.' : 'لا توجد مطابقة حرفية في الكتالوج الإرشادي. معلومات السيرة محفوظة؛ لا نمنح نقاطًا لمؤهل مختلف بالتخمين.'}</Text> : null}
    {matches.certificates.map(item => <Pressable key={item.id} accessibilityRole="checkbox" accessibilityLabel={en ? `${certifications.achieved.includes(item.id) ? 'Undo earned confirmation' : 'Confirm earned'}: ${item.title}` : undefined} accessibilityState={{ checked: certifications.achieved.includes(item.id) }} disabled={!certifications.ready || certifications.busy} onPress={() => void certifications.change(item.id, !certifications.achieved.includes(item.id))}><Text style={[ui.link, en && styles.ltr]}>{certifications.achieved.includes(item.id) ? en ? 'Earned — undo confirmation' : 'حصلت عليها — إلغاء الإقرار' : en ? 'Confirm I earned this' : 'أقر بأنني حصلت عليها'}: {item.title}</Text></Pressable>)}
    {matches.courses.map(item => <Pressable key={item.id} accessibilityRole="checkbox" accessibilityLabel={en ? `${learning.progress[item.id] ? 'Undo completed confirmation' : 'Confirm completed'}: ${item.title}` : undefined} accessibilityState={{ checked: !!learning.progress[item.id] }} disabled={!learning.ready || learning.busy} onPress={() => void learning.change(item.id, !learning.progress[item.id])}><Text style={[ui.link, en && styles.ltr]}>{learning.progress[item.id] ? en ? 'Completed — undo confirmation' : 'مكتملة — إلغاء الإقرار' : en ? 'Confirm I completed this' : 'أقر بأنني أكملتها'}: {item.title}</Text></Pressable>)}
  </DisclosureCard>;
}

const styles = createAdaptiveStyles(() => ({ ltr: { textAlign: 'left' as const, writingDirection: 'ltr' as const } }));
