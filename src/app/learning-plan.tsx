import { colors, createAdaptiveStyles } from '../constants/design';
import { useRouter } from 'expo-router';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import dataset from '../masarak_dataset.json';
import { getLearningSteps, getLearningStepsEnglish } from '../constants/learning-steps';
import { getLearningResources } from '../constants/learning-resources';
import { useLearningPlan } from '../hooks/use-learning-plan';
import { useLearningProgress } from '../hooks/use-learning-progress';
import { useSkillProfile } from '../hooks/use-skill-profile';
import { usePersonalProfile } from '../hooks/use-personal-profile';
import { useProfessionalCertifications } from '../hooks/use-professional-certifications';
import { jobPathById } from '../constants/job-paths';
import { careerTitles } from '../utils/career-matches';
import { jobPathRequirementProfile, requirementsForCareerPath } from '../constants/job-path-requirements';
import { certificationsByIds, professionalCertificationCopy } from '../constants/professional-certifications';
import { displaySkillName } from '../utils/skill-labels';
import { certificationPlanId, experiencePlanId, projectPlanId } from '../utils/learning-plan';
import { isRelevantEvidence } from '../utils/evidence-keywords';
import { DataSourceNotice } from '../components/data-source-notice';
import { DisclosureCard } from '../components/disclosure-card';
import { useJobTarget } from '../hooks/use-job-target';
import { useMarketJobs } from '../hooks/use-market-jobs';
import { matchMarketJob } from '../utils/job-matching';
import { JobGapPlan } from '../components/job-gap-plan';
import { useLearningResources } from '../hooks/use-learning-resources';
import { useAppPreferences } from '../contexts/app-preferences-context';

export default function LearningPlanScreen() {
  useLearningResources();
  const router = useRouter();
  const { language } = useAppPreferences(); const en = language === 'en';
  const t = (ar: string, english: string) => en ? english : ar;
  const learning = useLearningPlan();
  const courseProgress = useLearningProgress();
  const profileState = useSkillProfile();
  const personalState = usePersonalProfile();
  const certificationState = useProfessionalCertifications();
  const targetState = useJobTarget();
  const market = useMarketJobs(en);
  const targetJob = targetState.target ? market.data?.jobs.find(job => job.id === targetState.target!.job.id) ?? targetState.target.job : null;
  const targetMatch = targetJob && profileState.ready && personalState.ready && !profileState.error && !personalState.error ? matchMarketJob(targetJob, profileState.profile, personalState.personal) : null;
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
          <Text style={[styles.link, en && styles.ltr]}>{t('العودة', 'Back')}</Text>
        </Pressable>
        <View style={[styles.headerRow, en && styles.headerRowLtr]}><Text style={[styles.title, en && styles.ltr]}>{t('خطة تعلمي', 'My learning plan')}</Text><Pressable accessibilityRole="button" onPress={() => router.push('/progress' as never)}><Text style={[styles.link, en && styles.ltr]}>{t('تقدّمي ←', 'Progress →')}</Text></Pressable></View>
        {targetMatch ? <><Text style={[styles.heading, en && styles.ltr]}>{t('هدفك من إعلانات الوظائف', 'Your target job')}</Text><Text style={[styles.note, en && styles.ltr]}>{t('التوافق الحالي:', 'Current match:')} {targetMatch.score === null ? t('غير محسوب', 'not calculated') : `${targetMatch.score}%`}. {t('تتغير المقارنة مع تحديث ملفك؛ إكمال الدورات وحده لا يثبت المهارة.', 'The match changes when your profile changes; completing courses alone does not prove a skill.')}</Text>
          {!market.data?.jobs.some(job => job.id === targetJob?.id) ? <Text style={[styles.note, en && styles.ltr]}>{t('نعرض نسخة إعلانك المحفوظة؛ لم يظهر في العينة الحالية. هذا لا يثبت إغلاقه، راجع المصدر.', 'Showing the saved listing; it is not in the current sample. This does not prove it has closed. Check the source.')}</Text> : null}
          <JobGapPlan match={targetMatch} /><Pressable accessibilityRole="button" onPress={() => router.push('/jobs')}><Text style={[styles.link, en && styles.ltr]}>{t('راجع الوظيفة وتحديثاتها أو غيّر هدفك', 'Review the job, updates, or change your target')}</Text></Pressable></> : null}
        {targetState.error ? <Text style={styles.note}>{targetState.error}</Text> : null}
        <DataSourceNotice />
        <Text style={[styles.note, en && styles.ltr]}>{t('النسب تمثل إكمال العناصر بإقرارك أو وجود دليل مرتبط، ولا تختبر إتقانك. الإضافة إلى الخطة لا تمنح أي تقدم. المسار المقترح يبنى من الفجوات ولا يحذف خططك السابقة.', 'Progress reflects self-reported completion or linked evidence; it does not test proficiency. Adding an item does not increase progress. Suggested paths use your gaps and keep your existing plan.')}</Text>
        {profileState.error ? <Text style={styles.note}>{profileState.error}</Text> : null}
        <Text style={[styles.text, en && styles.ltr]}>{t('الخطة تجمع مهارات ومشاريع وخبرة وشهادات اختيارية بحسب هدفك. تقدّم العناصر لا يغيّر نسبة تغطية المهارات تلقائيًا.', 'Your plan groups skills, projects, experience and optional certifications for your goal. Progress does not automatically change skill coverage.')}</Text>
        {!selectedPath ? (
          <View style={styles.card}>
            <Text style={[styles.heading, en && styles.ltr]}>{t('حددي هدفك الوظيفي أولًا', 'Choose a career goal first')}</Text>
            <Text style={[styles.text, en && styles.ltr]}>{t('اختاري مسمى وظيفيًا من «بياناتي» حتى نعرض الشهادة والخبرة والمشاريع الخاصة به.', 'Choose a role in your profile to see its certifications, experience and project suggestions.')}</Text>
            <Pressable accessibilityRole="button" onPress={() => router.push('/profile')}><Text style={[styles.link, en && styles.ltr]}>{t('فتح بياناتي', 'Open my profile')}</Text></Pressable>
          </View>
        ) : roleProfile ? (
          <>
            <View style={styles.card}>
              <Text style={[styles.heading, en && styles.ltr]}>{t('هدفك:', 'Your goal:')} {en ? selectedPath.title : careerTitles[selectedPath.id] ?? selectedPath.title}</Text>
              <Text style={styles.progressNumber}>{overallProgress}%</Text>
              <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${overallProgress}%` }]} /></View>
              <Text style={[styles.note, en && styles.ltr]}>{en ? `Plan progress: ${progressItems.length} selected items. This reflects completion and evidence, not proficiency.` : `تقدم خطتك: ${progressItems.length} عناصر مختارة. هذه النسبة تقيس الإنجاز والدليل، وليست اختبارًا لمستوى الاحتراف.`}</Text>
            </View>
            <DisclosureCard title={t('المؤهل الجامعي', 'Education')} subtitle={t('المعلومات المطلوبة للمسار', 'Requirements for this path')} summary={en ? roleProfile.educationEn : roleProfile.education} status={t('متطلب أساسي', 'Core requirement')}>
              <Text style={[styles.text, en && styles.ltr]}>{en ? roleProfile.educationEn : roleProfile.education}</Text>
              <Text style={[styles.note, en && styles.ltr]}>{t('هذا البند يُقرأ من تخصصك ومؤهلك ومعدلك في «بياناتي». لا تضيفيه كمهارة أو شهادة مهنية.', 'This uses your major, qualification and GPA from your profile. Do not add it as a skill or professional certification.')}</Text>
            </DisclosureCard>
            <DisclosureCard title={t('الشهادات المهنية', 'Professional certifications')} subtitle={t('اختيارية', 'Optional')} summary={plannedCertifications.length ? `${plannedCertifications.length} ${t('شهادة في الخطة', 'certifications in your plan')}` : t('لا توجد شهادة في الخطة', 'No certification in plan')} status={plannedCertifications.length ? t('للتعلم', 'Planned') : t('اختياري', 'Optional')} statusTone={plannedCertifications.length ? 'warning' : 'neutral'}>
              <Text style={[styles.note, en && styles.ltr]}>{roleCertifications.length ? t('يكفي اختيار الشهادة الأنسب لبيئة العمل المستهدفة. لا يلزم جمع جميع الخيارات، ولا تضعي علامة إلا بعد صدور الشهادة باسمك.', 'Choose the certification best suited to your target environment. You do not need all options; mark it earned only after it is issued in your name.') : t('لا توجد شهادة مهنية عامة ذات أولوية للخريج في هذا المسار؛ ركزي على المهارات والمشروع.', 'No general certification is a priority for this entry-level path; focus on skills and projects.')}</Text>
              {certificationState.error ? <Text style={styles.note}>{certificationState.error}</Text> : null}
              {plannedCertifications.length === 0 ? <Text style={[styles.note, en && styles.ltr]}>{t('لم تضيفي شهادة مهنية إلى خطتك. أضيفي الأنسب من صفحة تفاصيل المسار أو الـRoadmap.', 'No professional certification is in your plan. Add one from the path details or roadmap.')}</Text> : null}
              {plannedCertifications.map(certificate => {
                const achieved = certificationState.achieved.includes(certificate.id);
                const display = professionalCertificationCopy(certificate, en);
                return <View key={certificate.id} style={styles.resource}>
                  <Text style={[styles.resourceTitle, en && styles.ltr]}>{display.title}</Text>
                  <Text style={[styles.note, en && styles.ltr]}>{display.provider} · {display.level}</Text>
                  <Text style={[styles.note, en && styles.ltr]}>{display.cost}</Text>
                  <Text style={[styles.note, en && styles.ltr]}>{display.note}</Text>
                  <Text style={[styles.progressLabel, en && styles.ltr]}>{achieved ? t('مكتملة بإقرارك · 100%', 'Marked complete · 100%') : t('مخطط لها · 0%', 'Planned · 0%')}</Text>
                  <View style={styles.progressTrack}><View style={[styles.progressFill, { width: achieved ? '100%' : '0%' }]} /></View>
                  <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(certificate.url)}><Text style={[styles.link, en && styles.ltr]}>{t('صفحة الشهادة الرسمية', 'Official certification page')}</Text></Pressable>
                  <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: achieved, disabled: !certificationState.ready || certificationState.busy }} disabled={!certificationState.ready || certificationState.busy} style={[styles.checkButton, achieved && styles.checkButtonDone]} onPress={() => void certificationState.change(certificate.id, !achieved)}><Text style={styles.checkText}>{achieved ? `✓ ${t('حصلت على الشهادة', 'Certification earned')}` : `□ ${t('حصلت على الشهادة', 'Mark as earned')}`}</Text></Pressable>
                  <Pressable accessibilityRole="button" onPress={() => void learning.change(certificationPlanId(certificate.id), false)}><Text style={[styles.link, en && styles.ltr]}>{t('إزالة الشهادة من خطتي', 'Remove certification from plan')}</Text></Pressable>
                </View>;
              })}
            </DisclosureCard>
            <DisclosureCard title={t('الخبرة والمشاريع', 'Experience and projects')} subtitle={t('تطبيق عملي للمسار', 'Practical work for your path')} summary={`${hasPlannedExperience ? t('خبرة واحدة', 'One experience item') : t('دون خبرة', 'No experience item')} · ${plannedProjects.length} ${t('مشاريع', 'projects')}`} status={hasPlannedExperience || plannedProjects.length ? t('في الخطة', 'In plan') : t('اختياري', 'Optional')} statusTone={hasPlannedExperience || plannedProjects.length ? 'warning' : 'neutral'}>
              {!hasPlannedExperience && plannedProjects.length === 0 ? <Text style={[styles.note, en && styles.ltr]}>{t('لم تضيفي خبرة أو مشروعًا إلى خطتك. اختاريها من تفاصيل المسار أو الـRoadmap.', 'No experience or project is in your plan. Add one from path details or the roadmap.')}</Text> : null}
              {hasPlannedExperience ? <View style={styles.resource}><Text style={[styles.resourceTitle, en && styles.ltr]}>{t('الخبرة العملية المستهدفة', 'Suggested experience')}</Text><Text style={[styles.text, en && styles.ltr]}>{en ? roleProfile.experienceEn : roleProfile.experience}</Text><Text style={[styles.progressLabel, en && styles.ltr]}>{relevantExperiences ? t('ظهر دليل مرتبط في سيرتك · 100%', 'Related CV evidence found · 100%') : t('مخطط لها · 0%', 'Planned · 0%')}</Text><View style={styles.progressTrack}><View style={[styles.progressFill, { width: relevantExperiences ? '100%' : '0%' }]} /></View><Pressable onPress={() => void learning.change(experiencePlanId(selectedPath.id), false)}><Text style={[styles.link, en && styles.ltr]}>{t('إزالة الخبرة من خطتي', 'Remove experience from plan')}</Text></Pressable></View> : null}
              {plannedProjects.map(({ project, index }) => <View key={index} style={styles.resource}><Text style={[styles.resourceTitle, en && styles.ltr]}>{t('مشروع تطبيقي', 'Practical project')}</Text><Text style={[styles.text, en && styles.ltr]}>• {en ? roleProfile.projectsEn[index] : project}</Text><Text style={[styles.progressLabel, en && styles.ltr]}>{relevantProjects > index ? t('ظهر دليل مرتبط في سيرتك · 100%', 'Related CV evidence found · 100%') : t('مخطط له · 0%', 'Planned · 0%')}</Text><View style={styles.progressTrack}><View style={[styles.progressFill, { width: relevantProjects > index ? '100%' : '0%' }]} /></View><Pressable onPress={() => void learning.change(projectPlanId(selectedPath.id, index), false)}><Text style={[styles.link, en && styles.ltr]}>{t('إزالة المشروع من خطتي', 'Remove project from plan')}</Text></Pressable></View>)}
              <Text style={[styles.note, en && styles.ltr]}>{t('أنجزي المشروع ثم اكتبيه داخل السيرة أو الخبرات وأعيدي تحليلها؛ عندها فقط يستطيع التطبيق احتساب دليله للمسار.', 'Complete the project, document it in your CV or experience, then reanalyze the CV. The app can count evidence for this path only after that.')}</Text>
              <Pressable accessibilityRole="button" onPress={() => router.push('/upload-cv')}><Text style={[styles.link, en && styles.ltr]}>{t('تحديث السيرة وإعادة التحليل', 'Update CV and reanalyze')}</Text></Pressable>
            </DisclosureCard>
            <Text style={[styles.heading, en && styles.ltr]}>4. {t('المهارات والدورات', 'Skills and courses')}</Text>
          </>
        ) : null}
        {learning.error ? (
          <Pressable accessibilityRole="button" onPress={() => void learning.reload()}>
            <Text style={[styles.note, en && styles.ltr]}>{learning.error} {t('اضغط لإعادة التحميل.', 'Tap to reload.')}</Text>
          </Pressable>
        ) : null}
        {courseProgress.error ? (
          <Pressable accessibilityRole="button" onPress={() => void courseProgress.reload()}>
            <Text style={[styles.note, en && styles.ltr]}>{courseProgress.error} {t('اضغط لإعادة التحميل.', 'Tap to reload.')}</Text>
          </Pressable>
        ) : null}
        {!learning.ready ? (
          !learning.error ? <Text style={[styles.text, en && styles.ltr]}>{t('جارٍ تحميل خطة تعلمك…', 'Loading your learning plan…')}</Text> : null
        ) : progressItems.length === 0 ? (
          <View style={styles.card}>
            <Text style={[styles.heading, en && styles.ltr]}>{t('خطتك فارغة حاليًا', 'Your plan is empty')}</Text>
            <Text style={[styles.text, en && styles.ltr]}>{t('افتح تفاصيل وظيفة، ثم خطوات التعلم المقترحة، واضغط «أضف إلى خطة تعلمي» عند المهارة التي تريد تطويرها.', 'Open a career path, view its learning steps, then add the skills you want to develop to your plan.')}</Text>
            <Pressable accessibilityRole="button" onPress={() => router.replace('/home')}>
              <Text style={[styles.link, en && styles.ltr]}>{t('استكشف المسارات', 'Explore career paths')}</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Text style={[styles.heading, en && styles.ltr]}>{t('مهارات اخترت تطويرها:', 'Skills in your plan:')} {skills.length}</Text>
            {skills.map((skill) => {
              const resources = getLearningResources(skill.skill_id);
              const progress = skillProgress(skill.skill_id);
              const row = requirements.find(item => item.skill_id === skill.skill_id);
              const priority = row && 'priority_rank' in row ? row.priority_rank : null;
              return (
              <DisclosureCard key={skill.skill_id} title={en ? skill.name : displaySkillName(skill.name)} subtitle={resources.length ? `${resources.length} ${t('موارد للتعلم', 'learning resources')}` : t('خطوات تطبيقية', 'Practice steps')} summary={`${progress === 100 ? t('موثقة في ملفك', 'In profile') : progress >= 60 ? t('قيد التطبيق', 'In progress') : t('مبتدئ', 'Getting started')} · ${progress}%${priority ? ` · ${t('أولوية', 'Priority')} ${priority}` : ''}`} status={`${progress}%`} statusTone={progress === 100 ? 'success' : 'neutral'}>
                <Text style={[styles.progressLabel, en && styles.ltr]}>{progress === 100 ? t('موثقة في ملفك', 'Documented in profile') : progress >= 60 ? t('قيد التطبيق', 'In progress') : t('مبتدئ', 'Getting started')} · {progress}%{priority ? ` · ${t('أولوية', 'Priority')} ${priority}` : ''}</Text><View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progress}%` }]} /></View>
                {profileState.ready && !profileState.error && profileState.profile?.skill_ids.includes(skill.skill_id) ? <Text style={[styles.note, en && styles.ltr]}>✓ {t('أصبحت ضمن مهارات ملفك المعتمد. يمكنك إبقاؤها للتدريب أو إزالتها من الخطة.', 'This is now in your approved profile. Keep it for practice or remove it from the plan.')}</Text> : null}
                {(en ? getLearningStepsEnglish(skill.name) : getLearningSteps(skill.name)).map((step, index) => (
                  <Text key={index} style={[styles.text, en && styles.ltr]}>{index + 1}. {step}</Text>
                ))}
                <Text style={[styles.subheading, en && styles.ltr]}>{t('دورات وموارد مرتبطة', 'Related courses and resources')}</Text>
                {resources.length === 0 ? (
                  <Text style={[styles.note, en && styles.ltr]}>{t('لم نراجع موردًا محددًا لهذه المهارة بعد.', 'No resource has been reviewed for this skill yet.')}</Text>
                ) : resources.map(resource => {
                  const completed = Boolean(courseProgress.progress[resource.id]);
                  return (
                    <View key={resource.id} style={styles.resource}>
                      <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/course-details' as never, params: { id: resource.id } } as never)}><Text style={[styles.resourceTitle, en && styles.ltr]}>{resource.title} · {t('التفاصيل', 'Details')}</Text></Pressable>
                      <Text style={styles.note}>{resource.provider} · {resource.level}</Text>
                      <Text style={styles.note}>{resource.duration}</Text>
                      <Text style={styles.note}>{resource.access}</Text>
                      <Text style={styles.note}>{resource.language}</Text>
                      <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(resource.url)}>
                        <Text style={[styles.link, en && styles.ltr]}>{t('فتح صفحة المورد الرسمية', 'Open official resource page')}</Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: completed, disabled: !courseProgress.ready || courseProgress.busy }}
                        disabled={!courseProgress.ready || courseProgress.busy}
                        style={[styles.checkButton, completed && styles.checkButtonDone]}
                        onPress={() => void courseProgress.change(resource.id, !completed)}>
                        <Text style={styles.checkText}>{completed ? `✓ ${t('أكملت هذا المورد', 'Marked complete')}` : `□ ${t('وضع علامة كمكتمل', 'Mark complete')}`}</Text>
                      </Pressable>
                    </View>
                  );
                })}
                <Pressable accessibilityRole="button" disabled={learning.busy}
                  accessibilityState={{ disabled: learning.busy }}
                  onPress={() => void learning.change(skill.skill_id, false)}>
                  <Text style={[styles.link, en && styles.ltr]}>{learning.busy ? t('جارٍ الحفظ…', 'Saving…') : t('إزالة من خطة تعلمي', 'Remove from my plan')}</Text>
                </Pressable>
              </DisclosureCard>
            );})}
            <Text style={[styles.note, en && styles.ltr]}>{t('إنجاز المورد يُسجّل في تقدّم التعلم، لكنه لا يضيف المهارة تلقائيًا إلى نسبة تغطيتها. بعد التطبيق العملي، راجع دليلك ثم حدّث ملف مهاراتك بنفسك.', 'Completing a resource updates learning progress but does not automatically add the skill to coverage. After practice, review your evidence and update your profile.')}</Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = createAdaptiveStyles(() => ({
    screen: { flex: 1, backgroundColor: colors.background },
    content: {
        width: '100%',
        maxWidth: 650,
        alignSelf: 'center',
        padding: 24,
        paddingBottom: 60,
        gap: 20,
    },
    title: {
        color: colors.primary,
        fontSize: 28,
        fontWeight: '700',
        textAlign: 'right',
    },
    heading: {
        color: colors.primary,
        fontSize: 18,
        textAlign: 'right',
    },
    subheading: { color: colors.ink, fontSize: 17, fontWeight: '700', textAlign: 'right', marginTop: 6 },
    card: {
        backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
        padding: 22,
        borderRadius: 18,
        gap: 14,
    },
    skill: {
        color: colors.ink,
        fontSize: 20,
        fontWeight: '600',
    },
    english: {
        color: colors.muted,
        fontSize: 15,
        lineHeight: 25,
    },
    text: {
        color: colors.muted,
        fontSize: 16,
        lineHeight: 28,
        textAlign: 'right',
    },
    link: {
        color: colors.primary,
        fontSize: 17,
        paddingVertical: 10,
        textAlign: 'right',
    },
    note: {
        color: colors.muted,
        fontSize: 14,
        lineHeight: 24,
        textAlign: 'right',
    },
    resource: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 16, gap: 6 },
    resourceTitle: { color: colors.ink, fontSize: 17, fontWeight: '700', textAlign: 'right' },
    checkButton: { borderWidth: 1, borderColor: colors.primary, borderRadius: 12, padding: 12, minHeight: 46, justifyContent: 'center' },
    checkButtonDone: { backgroundColor: colors.mint },
    checkText: { color: colors.primary, fontSize: 15, fontWeight: '600', textAlign: 'center' },
    progressNumber: { color: colors.primary, fontSize: 32, fontWeight: '800', textAlign: 'right' },
    progressLabel: { color: colors.primary, fontSize: 15, fontWeight: '700', textAlign: 'right' },
    progressTrack: { height: 10, backgroundColor: colors.track, borderRadius: 999, overflow: 'hidden' },
    progressFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 999 },
    headerRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
    headerRowLtr: { flexDirection: 'row' },
    ltr: { textAlign: 'left', writingDirection: 'ltr' },
}));
