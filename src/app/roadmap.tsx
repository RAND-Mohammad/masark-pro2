import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DisclosureCard } from '../components/disclosure-card';
import { MasarakIcon } from '../components/masarak-icon';
import { colors, createAdaptiveStyles, ui } from '../constants/design';
import { useAppPreferences } from '../contexts/app-preferences-context';
import { jobPathById, jobPaths } from '../constants/job-paths';
import { jobPathRequirementProfile, requirementsForCareerPath } from '../constants/job-path-requirements';
import { getLearningResources } from '../constants/learning-resources';
import { getLearningSteps, getLearningStepsEnglish } from '../constants/learning-steps';
import dataset from '../masarak_dataset.json';
import { useLearningPlan } from '../hooks/use-learning-plan';
import { useLearningProgress } from '../hooks/use-learning-progress';
import { useLearningResources } from '../hooks/use-learning-resources';
import { usePersonalProfile } from '../hooks/use-personal-profile';
import { useSkillProfile } from '../hooks/use-skill-profile';
import { getCareerMatches } from '../utils/career-matching';
import { careerTitles } from '../utils/career-matches';
import { displaySkillName } from '../utils/skill-labels';

const ROADMAP_WEEKS = 6;

export default function RoadmapScreen() {
  useLearningResources();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const requestedId = Array.isArray(params.id) ? params.id[0] : params.id;
  const { language } = useAppPreferences();
  const en = language === 'en';
  const t = (ar: string, english: string) => en ? english : ar;
  const skillState = useSkillProfile();
  const personalState = usePersonalProfile();
  const learning = useLearningPlan();
  const progress = useLearningProgress();
  const matches = getCareerMatches({ skillProfile: skillState.profile, personal: personalState.personal });
  const career = jobPathById(requestedId)
    ?? jobPaths.find(path => path.baseCareerId === requestedId)
    ?? jobPathById(personalState.personal?.careerGoal)
    ?? jobPaths.find(path => path.baseCareerId === personalState.personal?.careerGoal)
    ?? jobPathById(matches[0]?.career_id)
    ?? jobPaths.find(path => path.baseCareerId === matches[0]?.career_id)
    ?? jobPaths[0]
    ?? null;
  const roleProfile = career ? jobPathRequirementProfile(career.id) : null;
  const coreSkills = career
    ? requirementsForCareerPath(career.id)
      .filter(item => item.priority === 'core')
      .sort((a, b) => ('priority_rank' in a ? a.priority_rank : 99) - ('priority_rank' in b ? b.priority_rank : 99))
      .slice(0, ROADMAP_WEEKS)
    : [];
  const usedResourceIds = new Set<string>();
  const weekResources = coreSkills.map(skill => {
    const resource = getLearningResources(skill.skill_id).find(item => !usedResourceIds.has(item.id)) ?? null;
    if (resource) usedResourceIds.add(resource.id);
    return resource;
  });
  const completedCourses = weekResources.filter(resource => resource && Boolean(progress.progress[resource.id])).length;
  const totalLinkedCourses = weekResources.filter(Boolean).length;
  const nextWeekIndex = coreSkills.findIndex((skill, index) => {
    const resource = weekResources[index];
    return !resource || !progress.progress[resource.id];
  });
  const title = career ? (en ? career.title : careerTitles[career.id] ?? career.title) : '';
  const nextSkill = nextWeekIndex >= 0 ? coreSkills[nextWeekIndex] : null;
  const nextSkillName = nextSkill ? (en ? nextSkill.name : displaySkillName(nextSkill.name)) : '';
  const nextResource = nextWeekIndex >= 0 ? weekResources[nextWeekIndex] : null;

  return <SafeAreaView edges={['top', 'left', 'right']} style={ui.screen}>
    <ScrollView contentContainerStyle={styles.content}>
      <View style={[styles.topBar, en && styles.rowLtr]}>
        <Pressable accessibilityRole="button" onPress={() => router.canGoBack() ? router.back() : router.replace('/home')} style={styles.backButton}>
          <MasarakIcon name="arrow" size={19} color={colors.ink} />
          <Text style={[styles.topBarTitle, en && styles.ltr]}>{t('خارطة التعلم', 'Your learning roadmap')}</Text>
        </Pressable>
        <Text style={styles.more}>···</Text>
      </View>

      <Text style={[styles.pageTitle, en && styles.ltr]}>{t('ستة أسابيع. اتجاه أوضح.', 'Six weeks. One clearer direction.')}</Text>
      <Text style={[ui.text, en && styles.ltr]}>{title} · {t('وتيرة مرنة · نحو 3 ساعات أسبوعيًا', 'Flexible pace · about 3 hours/week')}</Text>

      {!skillState.ready || !personalState.ready || !learning.ready || !progress.ready ? <View style={ui.card}><Text style={[ui.text, en && styles.ltr]}>{t('جارٍ تجهيز خطتك من ملفك…', 'Building your plan from your profile…')}</Text></View> : null}
      {skillState.error || personalState.error || learning.error || progress.error ? <View style={styles.errorBox}>
        <Text accessibilityRole="alert" style={[styles.errorText, en && styles.ltr]}>{skillState.error || personalState.error || learning.error || progress.error}</Text>
        {learning.error ? <Pressable accessibilityRole="button" onPress={() => void learning.reload()}><Text style={[ui.link, en && styles.ltr]}>{t('إعادة تحميل الخطة', 'Reload plan')}</Text></Pressable> : null}
      </View> : null}

      {coreSkills.length ? <>
        <View style={styles.progressCard}>
          <View style={[styles.progressTop, en && styles.rowLtr]}>
            <View style={styles.progressCopy}>
              <Text style={[styles.progressTitle, en && styles.ltr]}>{totalLinkedCourses ? t(`${completedCourses} من ${totalLinkedCourses} موارد تعليمية مكتملة`, `${completedCourses} of ${totalLinkedCourses} linked resources complete`) : t('خطة التعلم جاهزة بخطوات تطبيق ذاتي', 'Your plan is ready with self-guided steps')}</Text>
              <Pressable accessibilityRole="button" onPress={() => router.push('/learning-plan' as never)}><Text style={[styles.progressText, en && styles.ltr]}>{t('تعديل وتيرة الخطة', 'Adjust pace')}</Text></Pressable>
            </View>
            <Text style={styles.progressNumber}>{totalLinkedCourses ? `${completedCourses}/${totalLinkedCourses}` : '—'}</Text>
          </View>
          <View style={styles.track}><View style={[styles.fill, { width: `${totalLinkedCourses ? Math.round(completedCourses * 100 / totalLinkedCourses) : 0}%` }]} /></View>
          <Text style={[styles.progressText, en && styles.ltr]}>{t('تقدير إرشادي قابل للتعديل؛ إكمال المورد لا يثبت إتقان المهارة.', 'Suggested pacing can be adjusted. Completing a resource does not prove skill proficiency.')}</Text>
        </View>

        {coreSkills.map((skill, index) => {
          const resource = weekResources[index];
          const skillData = dataset.skills.find(item => item.skill_id === skill.skill_id);
          const documented = Boolean(skillState.profile?.skill_ids.includes(skill.skill_id));
          const completed = Boolean(resource && progress.progress[resource.id]);
          const isNext = index === nextWeekIndex;
          const skillName = en ? skill.name : displaySkillName(skill.name);
          const status = completed ? t('مكتمل', 'Complete') : documented ? t('موثقة في ملفك', 'In your profile') : isNext ? t('الخطوة التالية', 'Next') : t('مخطط', 'Planned');
          const statusTone = completed ? 'success' as const : 'neutral' as const;
          const summary = resource ? `${resource.provider} · ${resource.duration}` : t('خطوات تطبيق ذاتي', 'Self-guided practice steps');
          return <View key={skill.skill_id} style={[styles.weekWrap, isNext && styles.nextWeek]}>
            <View style={[styles.weekHeading, en && styles.rowLtr]}>
              <Text style={[styles.weekNumber, en && styles.ltr]}>{String(index + 1).padStart(2, '0')}</Text>
              <View style={styles.weekCopy}>
                <Text style={[styles.weekLabel, en && styles.ltr]}>{t(`الأسبوع ${index + 1}`, `Week ${index + 1}`)} · {index === 0 ? t('ابدئي من هنا', 'Start here') : t('خطوة تالية', 'Next step')}</Text>
                <Text style={[styles.weekTitle, en && styles.ltr]}>{resource?.title ?? skillName}</Text>
                <Text style={[styles.weekMeta, en && styles.ltr]}>{summary}</Text>
              </View>
              <View style={[styles.statusPill, completed && styles.statusDone]}><Text style={[styles.statusText, completed && styles.statusTextDone]}>{completed ? '✓ ' : ''}{status}</Text></View>
            </View>

            <DisclosureCard title={resource?.title ?? t(`تفاصيل الأسبوع ${index + 1}`, `Week ${index + 1} details`)} subtitle={skillName} summary={resource ? `${summary} · ${resource.level}` : t('لا يوجد مورد خارجي محدد لهذه المهارة؛ اتبعي خطوات التطبيق أدناه.', 'No linked external course for this skill; use the practice steps below.')} status={status} statusTone={statusTone} defaultExpanded={false}>
              <Text style={[styles.skillDescription, en && styles.ltr]}>{skillData?.description ?? t('مهارة أساسية مرتبطة بالمسار.', 'A core skill for this career path.')}</Text>
              {(en ? getLearningStepsEnglish(skill.name) : getLearningSteps(skill.name)).map((step, stepIndex) => <View key={stepIndex} style={[styles.stepRow, en && styles.rowLtr]}>
                <Text style={styles.stepIndex}>{stepIndex + 1}</Text>
                <Text style={[styles.stepText, en && styles.ltr]}>{step}</Text>
              </View>)}
              {resource ? <>
                <View style={styles.resourceInfo}>
                  <Text style={[styles.resourceMeta, en && styles.ltr]}>{t('المستوى واللغة', 'Level & language')}: {resource.level} · {resource.language}</Text>
                  <Text style={[styles.resourceMeta, en && styles.ltr]}>{t('طريقة الوصول', 'Access')}: {resource.access}</Text>
                </View>
                <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/course-details', params: { id: resource.id } } as never)} style={styles.courseButton}>
                  <Text style={styles.courseButtonText}>{completed ? t('مراجعة المورد وتقدمي', 'Review resource and progress') : t('افتحي المورد التعليمي', 'Open learning resource')}  →</Text>
                </Pressable>
              </> : <Text style={[styles.note, en && styles.ltr]}>{t('استخدمي خطوات التطبيق أعلاه مع مشروع أو تمرين صغير، ثم حدّثي المهارة في ملفك بعد توفر دليل عليها.', 'Use the practice steps above with a small project, then update your profile when you have evidence for the skill.')}</Text>}
              <Pressable accessibilityRole="button" accessibilityState={{ disabled: !learning.ready || learning.busy, checked: learning.plan.includes(skill.skill_id) }} disabled={!learning.ready || learning.busy} style={[styles.planButton, learning.plan.includes(skill.skill_id) && styles.planButtonAdded]} onPress={() => void learning.change(skill.skill_id, !learning.plan.includes(skill.skill_id))}>
                <Text style={styles.planButtonText}>{learning.plan.includes(skill.skill_id) ? `✓ ${t('في خطتي المحفوظة — إزالة', 'In my saved plan — remove')}` : `＋ ${t('أضيفي المهارة إلى خطتي', 'Add skill to my learning plan')}`}</Text>
              </Pressable>
            </DisclosureCard>
          </View>;
        })}

        <View style={styles.footerNote}>
          <MasarakIcon name="info" size={20} color={colors.primary} />
          <Text style={[styles.note, en && styles.ltr]}>{t('الموارد روابط لجهات خارجية وقد تتغير شروطها أو مدتها. إذا لم يظهر مورد لمهارة، فستجدين خطوات تعلم عملية بدل اختراع رابط دورة.', 'Resources link to external providers and their availability may change. When no course is linked to a skill, the plan gives practice steps instead of inventing a course.')}</Text>
        </View>

        {roleProfile?.projects.length ? <DisclosureCard title={t('مشروع تطبيقي اختياري', 'Optional portfolio project')} subtitle={t('اجمعي المهارات في عمل واحد', 'Bring the skills together')} summary={en ? roleProfile.projectsEn[0] : roleProfile.projects[0]}>
          <Text style={[styles.skillDescription, en && styles.ltr]}>{en ? roleProfile.projectsEn[0] : roleProfile.projects[0]}</Text>
          <Text style={[styles.note, en && styles.ltr]}>{t('هذا اقتراح إضافي؛ لا يغيّر نسبة الجاهزية أو يثبت امتلاك المهارة حتى توثّقي دليل العمل في ملفك.', 'This is optional guidance. It does not change readiness or prove a skill until you document evidence in your profile.')}</Text>
        </DisclosureCard> : null}

        <Pressable accessibilityRole="button" style={styles.continueButton} onPress={() => {
          if (nextResource) router.push({ pathname: '/course-details', params: { id: nextResource.id } } as never);
          else router.push('/learning-plan' as never);
        }}>
          <Text style={styles.continueButtonText}>{nextWeekIndex >= 0 ? `${t(`متابعة الأسبوع ${nextWeekIndex + 1}`, `Continue Week ${nextWeekIndex + 1}`)} · ${nextResource?.title ?? nextSkillName}` : t('مراجعة خطة التعلم', 'Review learning plan')}  →</Text>
        </Pressable>
      </> : <View style={ui.card}>
        <Text style={[ui.heading, en && styles.ltr]}>{t('لم نتمكن من تكوين خارطة لهذا المسار', 'Could not build a roadmap for this path')}</Text>
        <Text style={[ui.text, en && styles.ltr]}>{t('اختاري مسارًا مهنيًا أولًا أو أعيدي تحميل ملفك.', 'Choose a career path first or reload your profile.')}</Text>
        <Pressable accessibilityRole="button" style={ui.button} onPress={() => router.push('/careers' as never)}><Text style={ui.buttonText}>{t('استكشاف المسارات', 'Explore career paths')}</Text></Pressable>
      </View>}
    </ScrollView>
  </SafeAreaView>;
}

const styles = createAdaptiveStyles(() => ({
  content: { width: '100%', maxWidth: 660, alignSelf: 'center', paddingHorizontal: 22, paddingTop: 10, paddingBottom: 46, gap: 15 },
  topBar: { minHeight: 46, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { minHeight: 44, flexDirection: 'row-reverse', alignItems: 'center', gap: 10 },
  topBarTitle: { color: colors.ink, fontSize: 17, fontWeight: '700' },
  more: { minWidth: 32, color: colors.muted, fontSize: 24, lineHeight: 28, textAlign: 'left' },
  pageTitle: { color: colors.navy, fontSize: 31, lineHeight: 39, fontWeight: '800', textAlign: 'right', marginTop: 5 },
  progressCard: { backgroundColor: colors.contrastPanel, borderRadius: 21, padding: 17, gap: 11 },
  progressTop: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  progressCopy: { flex: 1, gap: 4 },
  progressTitle: { color: colors.contrastOnPanel, fontSize: 18, lineHeight: 25, fontWeight: '700', textAlign: 'right' },
  progressText: { color: colors.contrastOnPanel, opacity: 0.83, fontSize: 12, lineHeight: 19, textAlign: 'right' },
  progressNumber: { color: colors.contrastAccent, fontSize: 26, lineHeight: 32, fontWeight: '800' },
  track: { height: 8, borderRadius: 999, backgroundColor: colors.track, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 999, backgroundColor: colors.contrastAccent },
  weekWrap: { gap: 9 },
  nextWeek: { borderColor: colors.primary, borderRadius: 17 },
  weekHeading: { minHeight: 78, flexDirection: 'row-reverse', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 17, padding: 13 },
  weekNumber: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.mint, color: colors.primary, textAlign: 'center', textAlignVertical: 'center', fontSize: 18, lineHeight: 42, fontWeight: '800', overflow: 'hidden' },
  weekCopy: { flex: 1, gap: 3 },
  weekLabel: { color: colors.primary, fontSize: 11, lineHeight: 16, fontWeight: '700', textAlign: 'right' },
  weekTitle: { color: colors.ink, fontSize: 15, lineHeight: 21, fontWeight: '700', textAlign: 'right' },
  weekMeta: { color: colors.muted, fontSize: 11, lineHeight: 17, textAlign: 'right' },
  statusPill: { backgroundColor: colors.soft, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6, maxWidth: 126 },
  statusDone: { backgroundColor: colors.mint },
  statusText: { color: colors.muted, fontSize: 10, lineHeight: 15, fontWeight: '700', textAlign: 'center' },
  statusTextDone: { color: colors.primary },
  skillDescription: { color: colors.ink, fontSize: 14, lineHeight: 22, textAlign: 'right' },
  stepRow: { flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 10 },
  stepIndex: { width: 22, height: 22, borderRadius: 11, overflow: 'hidden', backgroundColor: colors.mint, color: colors.primary, fontSize: 12, lineHeight: 22, textAlign: 'center', fontWeight: '800' },
  stepText: { flex: 1, color: colors.muted, fontSize: 13, lineHeight: 21, textAlign: 'right' },
  resourceInfo: { backgroundColor: colors.soft, borderRadius: 13, padding: 12, gap: 5 },
  resourceMeta: { color: colors.muted, fontSize: 11, lineHeight: 18, textAlign: 'right' },
  courseButton: { minHeight: 48, borderRadius: 13, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 12 },
  courseButtonText: { color: colors.onPrimary, fontSize: 14, fontWeight: '700', textAlign: 'center' },
  planButton: { minHeight: 44, borderWidth: 1, borderColor: colors.primary, borderRadius: 12, justifyContent: 'center', padding: 10 },
  planButtonAdded: { backgroundColor: colors.mint },
  planButtonText: { color: colors.primary, fontSize: 13, lineHeight: 19, fontWeight: '700', textAlign: 'center' },
  footerNote: { flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 10, backgroundColor: colors.mint, borderRadius: 15, padding: 13 },
  note: { flex: 1, color: colors.muted, fontSize: 12, lineHeight: 20, textAlign: 'right' },
  continueButton: { minHeight: 66, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.primary, borderRadius: 18, backgroundColor: colors.primary, paddingHorizontal: 16 },
  continueButtonText: { color: colors.onPrimary, fontSize: 17, lineHeight: 24, fontWeight: '700', textAlign: 'center' },
  errorBox: { borderRadius: 14, borderWidth: 1, borderColor: colors.errorBorder, backgroundColor: colors.errorSurface, padding: 13, gap: 4 },
  errorText: { color: colors.error, fontSize: 13, lineHeight: 20, textAlign: 'right' },
  rowLtr: { flexDirection: 'row' },
  ltr: { textAlign: 'left', writingDirection: 'ltr' },
}));
