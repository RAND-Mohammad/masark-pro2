import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ui } from '../constants/design';
import { useSkillProfile } from '../hooks/use-skill-profile';
import { CareerCard } from '../components/career-card';
import { usePersonalProfile } from '../hooks/use-personal-profile';
import { useLearningProgress } from '../hooks/use-learning-progress';
import { useProfessionalCertifications } from '../hooks/use-professional-certifications';
import { getCareerReadinessMatches } from '../utils/career-readiness';
import { DataSourceNotice } from '../components/data-source-notice';

export default function CareersScreen() {
  const router = useRouter();
  const { profile, ready, error } = useSkillProfile();
  const personal = usePersonalProfile();
  const learning = useLearningProgress();
  const certifications = useProfessionalCertifications();
  const matches = getCareerReadinessMatches({ skillProfile: profile, personal: personal.personal, learningProgress: learning.progress, professionalCertifications: certifications.achieved });
  const allReady = ready && personal.ready && learning.ready && certifications.ready;
  return <SafeAreaView edges={['top', 'left', 'right']} style={ui.screen}><ScrollView contentContainerStyle={ui.content}>
    <Text style={ui.eyebrow}>اكتشف فرصتك القادمة</Text><Text style={ui.title}>مساراتك المهنية</Text><Text style={ui.text}>مرتبة حسب جاهزية مركبة من المهارات والتطبيق والشهادات والمعدل والتعلم. افتح المسار لرؤية التفصيل.</Text>
    <Pressable accessibilityRole="button" style={ui.outline} onPress={() => router.push('/majors')}><Text style={ui.outlineText}>دليل تخصصات جامعتنا ووظائفها</Text></Pressable>
    <DataSourceNotice />
    <Text style={ui.note}>الترتيب من أدلة مهاراتك وتعليمك ومشاريعك وشهاداتك وتعلمك. الاهتمامات والسمات معلومات للملف، ولا تدخل حاليًا في معادلة الترتيب.</Text>
    {!allReady ? <Text style={ui.text}>جارٍ جمع أدلة ملفك…</Text> : error ? <Text style={ui.text}>{error}</Text> : matches.map(career => <CareerCard key={career.career_id} career={career} />)}
    <Text style={ui.note}>الأوزان قرار تصميم موثق لمسارك وليست إحصائية قبول وظيفي. إعلان الوظيفة ودليل أعمالك يظلان المرجع النهائي.</Text>
  </ScrollView></SafeAreaView>;
}
