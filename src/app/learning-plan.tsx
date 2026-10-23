import { useRouter } from 'expo-router';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import dataset from '../masarak_dataset.json';
import { getLearningSteps } from '../constants/learning-steps';
import { getLearningResources } from '../constants/learning-resources';
import { useLearningPlan } from '../hooks/use-learning-plan';
import { useLearningProgress } from '../hooks/use-learning-progress';
import { useSkillProfile } from '../hooks/use-skill-profile';
import { usePersonalProfile } from '../hooks/use-personal-profile';
import { useProfessionalCertifications } from '../hooks/use-professional-certifications';
import { jobPathById } from '../constants/job-paths';
import { jobPathRequirementProfile, requirementsForCareerPath } from '../constants/job-path-requirements';
import { certificationsByIds } from '../constants/professional-certifications';
import { displaySkillName } from '../utils/skill-labels';
import { certificationPlanId, experiencePlanId, projectPlanId } from '../utils/learning-plan';
import { isRelevantEvidence } from '../utils/evidence-keywords';
import { DataSourceNotice } from '../components/data-source-notice';
import { DisclosureCard } from '../components/disclosure-card';

export default function LearningPlanScreen() {
  const router = useRouter();
  const learning = useLearningPlan();
  const courseProgress = useLearningProgress();
  const profileState = useSkillProfile();
  const personalState = usePersonalProfile();
  const certificationState = useProfessionalCertifications();
  const selectedPath = jobPathById(personalState.personal?.careerGoal);
  const roleProfile = jobPathRequirementProfile(selectedPath?.id ?? '');
  const roleCertifications = certificationsByIds(roleProfile?.certificationIds ?? []);
  const requirements = requirementsForCareerPath(selectedPath?.id ?? '');
  const skills = learning.plan.flatMap((id) => {
    const skill = dataset.skills.find((item) => item.skill_id === id);
    return skill ? [skill] : [];
  });
  const plannedCertifications = roleCertifications.filter(item => learning.plan.includes(certificationPlanId(item.id)));
  const hasPlannedExperience = Boolean(selectedPath && learning.plan.includes(experiencePlanId(selectedPath.id)));
  const plannedProjects = roleProfile && selectedPath ? roleProfile.projects.flatMap((project, index) => learning.plan.includes(projectPlanId(selectedPath.id, index)) ? [{ project, index }] : []) : [];
  const relevant = (value: unknown) => isRelevantEvidence(value, roleProfile?.evidenceKeywords ?? []);
  const relevantExperiences = profileState.profile?.cv?.experiences.filter(relevant).length ?? 0;
  const relevantProjects = profileState.profile?.cv?.projects?.filter(relevant).length ?? 0;
  const skillProgress = (skillId: string) => {
    if (profileState.profile?.skill_ids.includes(skillId)) return 100;
    const resources = getLearningResources(skillId);
    const completed = resources.filter(resource => courseProgress.progress[resource.id]).length;
    return resources.length ? Math.round(100 * completed / resources.length) : 0;
  };
  const progressItems = [
    ...skills.map(skill => skillProgress(skill.skill_id)),
    ...plannedCertifications.map(item => certificationState.achieved.includes(item.id) ? 100 : 0),
    ...(hasPlannedExperience ? [relevantExperiences ? 100 : 0] : []),
    ...plannedProjects.map(item => relevantProjects > item.index ? 100 : 0),
  ];
  const overallProgress = progressItems.length ? Math.round(progressItems.reduce((sum, value) => sum + value, 0) / progressItems.length) : 0;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable accessibilityRole="button" onPress={() => router.canGoBack() ? router.back() : router.replace('/home')}>
          <Text style={styles.link}>العودة</Text>
        </Pressable>
        <Text style={styles.title}>خطة تعلمي</Text>
        <DataSourceNotice />
        <Text style={styles.note}>النسب تمثل إكمال العناصر بإقرارك أو وجود دليل مرتبط، ولا تختبر إتقانك. الإضافة إلى الخطة لا تمنح أي تقدم. المسار المقترح يبنى من الفجوات ولا يحذف خططك السابقة.</Text>
        {profileState.error ? <Text style={styles.note}>{profileState.error}</Text> : null}
        <Text style={styles.text}>الخطة مفصّلة إلى مهارات، شهادة مهنية اختيارية، مؤهل جامعي، وخبرة عملية. كل قسم يُحسب مستقلًا في الجاهزية.</Text>
        {!selectedPath ? (
          <View style={styles.card}>
            <Text style={styles.heading}>حددي هدفك الوظيفي أولًا</Text>
            <Text style={styles.text}>اختاري مسمى وظيفيًا من «بياناتي» حتى نعرض الشهادة والخبرة والمشاريع الخاصة به.</Text>
            <Pressable accessibilityRole="button" onPress={() => router.push('/profile')}><Text style={styles.link}>فتح بياناتي</Text></Pressable>
          </View>
        ) : roleProfile ? (
          <>
            <View style={styles.card}>
              <Text style={styles.heading}>هدفك: {selectedPath.title}</Text>
              <Text style={styles.progressNumber}>{overallProgress}%</Text>
              <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${overallProgress}%` }]} /></View>
              <Text style={styles.note}>تقدم خطتك: {progressItems.length} عناصر مختارة. هذه النسبة تقيس الإنجاز والدليل، وليست اختبارًا لمستوى الاحتراف.</Text>
            </View>
            <DisclosureCard title="المؤهل الجامعي" subtitle="المعلومات المطلوبة للمسار" summary={roleProfile.education} status="متطلب أساسي">
              <Text style={styles.text}>{roleProfile.education}</Text>
              <Text style={styles.note}>هذا البند يُقرأ من تخصصك ومؤهلك ومعدلك في «بياناتي». لا تضيفيه كمهارة أو شهادة مهنية.</Text>
            </DisclosureCard>
            <DisclosureCard title="الشهادات المهنية" subtitle="اختيارية" summary={plannedCertifications.length ? `${plannedCertifications.length} شهادة في الخطة` : 'لا توجد شهادة في الخطة'} status={plannedCertifications.length ? 'للتعلم' : 'اختياري'} statusTone={plannedCertifications.length ? 'warning' : 'neutral'}>
              <Text style={styles.note}>{roleCertifications.length ? 'يكفي اختيار الشهادة الأنسب لبيئة العمل المستهدفة. لا يلزم جمع جميع الخيارات، ولا تضعي علامة إلا بعد صدور الشهادة باسمك.' : 'لا توجد شهادة مهنية عامة ذات أولوية للخريج في هذا المسار؛ ركزي على المهارات والمشروع.'}</Text>
              {certificationState.error ? <Text style={styles.note}>{certificationState.error}</Text> : null}
              {plannedCertifications.length === 0 ? <Text style={styles.note}>لم تضيفي شهادة مهنية إلى خطتك. أضيفي الأنسب من صفحة تفاصيل المسار أو الـRoadmap.</Text> : null}
              {plannedCertifications.map(certificate => {
                const achieved = certificationState.achieved.includes(certificate.id);
                return <View key={certificate.id} style={styles.resource}>
                  <Text style={styles.resourceTitle}>{certificate.title}</Text>
                  <Text style={styles.note}>{certificate.provider} · {certificate.level}</Text>
                  <Text style={styles.note}>{certificate.cost}</Text>
                  <Text style={styles.note}>{certificate.note}</Text>
                  <Text style={styles.progressLabel}>{achieved ? 'مكتملة بإقرارك · 100%' : 'مخطط لها · 0%'}</Text>
                  <View style={styles.progressTrack}><View style={[styles.progressFill, { width: achieved ? '100%' : '0%' }]} /></View>
                  <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(certificate.url)}><Text style={styles.link}>صفحة الشهادة الرسمية</Text></Pressable>
                  <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: achieved, disabled: !certificationState.ready || certificationState.busy }} disabled={!certificationState.ready || certificationState.busy} style={[styles.checkButton, achieved && styles.checkButtonDone]} onPress={() => void certificationState.change(certificate.id, !achieved)}><Text style={styles.checkText}>{achieved ? '✓ حصلت على الشهادة' : '□ حصلت على الشهادة'}</Text></Pressable>
                  <Pressable accessibilityRole="button" onPress={() => void learning.change(certificationPlanId(certificate.id), false)}><Text style={styles.link}>إزالة الشهادة من خطتي</Text></Pressable>
                </View>;
              })}
            </DisclosureCard>
            <DisclosureCard title="الخبرة والمشاريع" subtitle="تطبيق عملي للمسار" summary={`${hasPlannedExperience ? 'خبرة واحدة' : 'دون خبرة'} · ${plannedProjects.length} مشاريع`} status={hasPlannedExperience || plannedProjects.length ? 'في الخطة' : 'اختياري'} statusTone={hasPlannedExperience || plannedProjects.length ? 'warning' : 'neutral'}>
              {!hasPlannedExperience && plannedProjects.length === 0 ? <Text style={styles.note}>لم تضيفي خبرة أو مشروعًا إلى خطتك. اختاريها من تفاصيل المسار أو الـRoadmap.</Text> : null}
              {hasPlannedExperience ? <View style={styles.resource}><Text style={styles.resourceTitle}>الخبرة العملية المستهدفة</Text><Text style={styles.text}>{roleProfile.experience}</Text><Text style={styles.progressLabel}>{relevantExperiences ? 'ظهر دليل مرتبط في سيرتك · 100%' : 'مخطط لها · 0%'}</Text><View style={styles.progressTrack}><View style={[styles.progressFill, { width: relevantExperiences ? '100%' : '0%' }]} /></View><Pressable onPress={() => void learning.change(experiencePlanId(selectedPath.id), false)}><Text style={styles.link}>إزالة الخبرة من خطتي</Text></Pressable></View> : null}
              {plannedProjects.map(({ project, index }) => <View key={project} style={styles.resource}><Text style={styles.resourceTitle}>مشروع تطبيقي</Text><Text style={styles.text}>• {project}</Text><Text style={styles.progressLabel}>{relevantProjects > index ? 'ظهر دليل مرتبط في سيرتك · 100%' : 'مخطط له · 0%'}</Text><View style={styles.progressTrack}><View style={[styles.progressFill, { width: relevantProjects > index ? '100%' : '0%' }]} /></View><Pressable onPress={() => void learning.change(projectPlanId(selectedPath.id, index), false)}><Text style={styles.link}>إزالة المشروع من خطتي</Text></Pressable></View>)}
              <Text style={styles.note}>أنجزي المشروع ثم اكتبيه داخل السيرة أو الخبرات وأعيدي تحليلها؛ عندها فقط يستطيع التطبيق احتساب دليله للمسار.</Text>
              <Pressable accessibilityRole="button" onPress={() => router.push('/upload-cv')}><Text style={styles.link}>تحديث السيرة وإعادة التحليل</Text></Pressable>
            </DisclosureCard>
            <Text style={styles.heading}>4. المهارات والدورات</Text>
          </>
        ) : null}
        {learning.error ? (
          <Pressable accessibilityRole="button" onPress={() => void learning.reload()}>
            <Text style={styles.note}>{learning.error} اضغط لإعادة التحميل.</Text>
          </Pressable>
        ) : null}
        {courseProgress.error ? (
          <Pressable accessibilityRole="button" onPress={() => void courseProgress.reload()}>
            <Text style={styles.note}>{courseProgress.error} اضغط لإعادة التحميل.</Text>
          </Pressable>
        ) : null}
        {!learning.ready ? (
          !learning.error ? <Text style={styles.text}>جارٍ تحميل خطة تعلمك…</Text> : null
        ) : progressItems.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.heading}>خطتك فارغة حاليًا</Text>
            <Text style={styles.text}>افتح تفاصيل وظيفة، ثم خطوات التعلم المقترحة، واضغط «أضف إلى خطة تعلمي» عند المهارة التي تريد تطويرها.</Text>
            <Pressable accessibilityRole="button" onPress={() => router.replace('/home')}>
              <Text style={styles.link}>استكشف المسارات</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Text style={styles.heading}>مهارات اخترت تطويرها: {skills.length}</Text>
            {skills.map((skill) => {
              const resources = getLearningResources(skill.skill_id);
              const progress = skillProgress(skill.skill_id);
              const row = requirements.find(item => item.skill_id === skill.skill_id);
              const priority = row && 'priority_rank' in row ? row.priority_rank : null;
              return (
              <DisclosureCard key={skill.skill_id} title={displaySkillName(skill.name)} subtitle={resources.length ? `${resources.length} موارد للتعلم` : 'خطوات تطبيقية'} summary={`${progress === 100 ? 'موثقة في ملفك' : progress >= 60 ? 'قيد التطبيق' : 'مبتدئ'} · ${progress}%${priority ? ` · أولوية ${priority}` : ''}`} status={`${progress}%`} statusTone={progress === 100 ? 'success' : 'neutral'}>
                <Text style={styles.progressLabel}>{progress === 100 ? 'موثقة في ملفك' : progress >= 60 ? 'قيد التطبيق' : 'مبتدئ'} · {progress}%{priority ? ` · أولوية ${priority}` : ''}</Text><View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progress}%` }]} /></View>
                {profileState.ready && !profileState.error && profileState.profile?.skill_ids.includes(skill.skill_id) ? <Text style={styles.note}>✓ أصبحت ضمن مهارات ملفك المعتمد. يمكنك إبقاؤها للتدريب أو إزالتها من الخطة.</Text> : null}
                {getLearningSteps(skill.name).map((step, index) => (
                  <Text key={index} style={styles.text}>{index + 1}. {step}</Text>
                ))}
                <Text style={styles.subheading}>دورات وموارد مرتبطة</Text>
                {resources.length === 0 ? (
                  <Text style={styles.note}>لم نراجع موردًا محددًا لهذه المهارة بعد.</Text>
                ) : resources.map(resource => {
                  const completed = Boolean(courseProgress.progress[resource.id]);
                  return (
                    <View key={resource.id} style={styles.resource}>
                      <Text style={styles.resourceTitle}>{resource.title}</Text>
                      <Text style={styles.note}>{resource.provider} · {resource.level}</Text>
                      <Text style={styles.note}>{resource.duration}</Text>
                      <Text style={styles.note}>{resource.access}</Text>
                      <Text style={styles.note}>{resource.language}</Text>
                      <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(resource.url)}>
                        <Text style={styles.link}>فتح صفحة المورد الرسمية</Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: completed, disabled: !courseProgress.ready || courseProgress.busy }}
                        disabled={!courseProgress.ready || courseProgress.busy}
                        style={[styles.checkButton, completed && styles.checkButtonDone]}
                        onPress={() => void courseProgress.change(resource.id, !completed)}>
                        <Text style={styles.checkText}>{completed ? '✓ أكملت هذا المورد' : '□ وضع علامة كمكتمل'}</Text>
                      </Pressable>
                    </View>
                  );
                })}
                <Pressable accessibilityRole="button" disabled={learning.busy}
                  accessibilityState={{ disabled: learning.busy }}
                  onPress={() => void learning.change(skill.skill_id, false)}>
                  <Text style={styles.link}>{learning.busy ? 'جارٍ الحفظ…' : 'إزالة من خطة تعلمي'}</Text>
                </Pressable>
              </DisclosureCard>
            );})}
            <Text style={styles.note}>إنجاز المورد يرفع جزء التعلم المحدود في الجاهزية المركبة، لكنه لا يضيف المهارة تلقائيًا. بعد التطبيق العملي، راجع دليلك ثم حدّث ملف مهاراتك بنفسك ليرتفع جزء المهارات.</Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: '#F8F9F5' },
    content: {
        width: '100%',
        maxWidth: 650,
        alignSelf: 'center',
        padding: 24,
        paddingBottom: 60,
        gap: 20,
    },
    title: {
        color: '#12635E',
        fontSize: 28,
        fontWeight: '700',
        textAlign: 'right',
    },
    heading: {
        color: '#12635E',
        fontSize: 18,
        textAlign: 'right',
    },
    subheading: { color: '#193C3B', fontSize: 17, fontWeight: '700', textAlign: 'right', marginTop: 6 },
    card: {
        backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DDE6E0',
        padding: 22,
        borderRadius: 18,
        gap: 14,
    },
    skill: {
        color: '#193C3B',
        fontSize: 20,
        fontWeight: '600',
    },
    english: {
        color: '#617570',
        fontSize: 15,
        lineHeight: 25,
    },
    text: {
        color: '#425F57',
        fontSize: 16,
        lineHeight: 28,
        textAlign: 'right',
    },
    link: {
        color: '#12635E',
        fontSize: 17,
        paddingVertical: 10,
        textAlign: 'right',
    },
    note: {
        color: '#617570',
        fontSize: 14,
        lineHeight: 24,
        textAlign: 'right',
    },
    resource: { backgroundColor: '#F8F9F5', borderWidth: 1, borderColor: '#DDE6E0', borderRadius: 14, padding: 16, gap: 6 },
    resourceTitle: { color: '#193C3B', fontSize: 17, fontWeight: '700', textAlign: 'right' },
    checkButton: { borderWidth: 1, borderColor: '#12635E', borderRadius: 12, padding: 12, minHeight: 46, justifyContent: 'center' },
    checkButtonDone: { backgroundColor: '#E5F3EE' },
    checkText: { color: '#12635E', fontSize: 15, fontWeight: '600', textAlign: 'center' },
    progressNumber: { color: '#12635E', fontSize: 32, fontWeight: '800', textAlign: 'right' },
    progressLabel: { color: '#12635E', fontSize: 15, fontWeight: '700', textAlign: 'right' },
    progressTrack: { height: 10, backgroundColor: '#E2E8E3', borderRadius: 999, overflow: 'hidden' },
    progressFill: { height: '100%', backgroundColor: '#12635E', borderRadius: 999 },
});
