import { useSkillProfile } from '../hooks/use-skill-profile';
import { usePersonalProfile } from '../hooks/use-personal-profile';
import { useLearningProgress } from '../hooks/use-learning-progress';
import { useProfessionalCertifications } from '../hooks/use-professional-certifications';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import dataset from '../masarak_dataset.json';
import { getLearningSteps } from '../constants/learning-steps';
import { useLearningPlan } from '../hooks/use-learning-plan';
import { displaySkillName } from '../utils/skill-labels';
import { jobPathById } from '../constants/job-paths';
import { jobPathRequirementProfile, requirementsForCareerPath } from '../constants/job-path-requirements';
import { certificationsByIds } from '../constants/professional-certifications';
import { calculateCareerReadiness } from '../utils/career-readiness';
import { readinessLabels, readinessLevel } from '../utils/skill-gap';
import { certificationPlanId, experiencePlanId, projectPlanId } from '../utils/learning-plan';
import { getLearningResources } from '../constants/learning-resources';
import { DisclosureCard } from '../components/disclosure-card';

export default function RoadmapScreen() {
    const router = useRouter();
    const learning = useLearningPlan();
    const personalState = usePersonalProfile();
    const progressState = useLearningProgress();
    const certificationState = useProfessionalCertifications();
    const { id } = useLocalSearchParams<{ id?: string }>();

    const { profile, ready: loaded, error } = useSkillProfile();
    const savedSkills = profile?.skill_ids ?? null;

    const career = jobPathById(id);
    const requirements = requirementsForCareerPath(id ?? '');
    const roleProfile = jobPathRequirementProfile(id ?? '');
    const roleCertifications = certificationsByIds(roleProfile?.certificationIds ?? []);
    const missing = requirements.filter(
        (item) =>
            item.priority === 'core' &&
            !savedSkills?.includes(item.skill_id)
    );
    const highPriority = missing.filter(item => 'priority_rank' in item && item.priority_rank <= 2);
    const nextPriority = missing.filter(item => !highPriority.some(high => high.skill_id === item.skill_id));
    const readiness = career ? calculateCareerReadiness(career.id, { skillProfile: profile, personal: personalState.personal, learningProgress: progressState.progress, professionalCertifications: certificationState.achieved }) : null;
    const level = readinessLevel(readiness?.score ?? null);
    const progressForSkill = (skillId: string) => {
        if (savedSkills?.includes(skillId)) return 100;
        const resources = getLearningResources(skillId);
        const completed = resources.filter(resource => progressState.progress[resource.id]).length;
        return resources.length ? Math.round(100 * completed / resources.length) : 0;
    };
    const renderSkill = (item: (typeof missing)[number], index: number) => {
        const skill = dataset.skills.find(entry => entry.skill_id === item.skill_id);
        const progress = progressForSkill(item.skill_id);
        const priority = 'priority_rank' in item ? item.priority_rank : index + 1;
        return <DisclosureCard key={item.skill_id} title={displaySkillName(item.name)} subtitle={`مهارة ${priority} · أولوية ${priority}`} summary={`${progress >= 60 ? 'قيد التطبيق' : 'مبتدئ'} · ${progress}%`} status={`${progress}%`} statusTone={progress === 100 ? 'success' : 'neutral'}>
            <Text style={styles.progressLabel}>{progress >= 60 ? 'قيد التطبيق' : 'مبتدئ'} · {progress}% · أولوية {priority}</Text>
            <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progress}%` }]} /></View>
            <Text style={styles.english}>{skill?.description ?? 'الوصف غير متوفر'}</Text>
            {getLearningSteps(item.name).map((step, stepIndex) => <Text key={stepIndex} style={styles.text}>{stepIndex + 1}. {step}</Text>)}
            <Pressable accessibilityRole="button" accessibilityState={{ disabled: !learning.ready || learning.busy }} disabled={!learning.ready || learning.busy} style={styles.action} onPress={() => void learning.change(item.skill_id, !learning.plan.includes(item.skill_id))}><Text style={styles.actionText}>{!learning.ready ? 'جارٍ تحميل الخطة…' : learning.plan.includes(item.skill_id) ? '✓ في خطتي — إزالة' : '＋ أضف المهارة إلى خطتي'}</Text></Pressable>
            <Text style={styles.note}>ترتفع إلى 100% هنا عندما توثّقين المهارة في ملفك بعد التطبيق، وليس بمجرد فتح المورد.</Text>
        </DisclosureCard>;
    };

    return (
        <SafeAreaView style={styles.screen}>
            <ScrollView contentContainerStyle={styles.content}>
                <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                        if (router.canGoBack()) router.back();
                        else router.replace('/home');
                    }}
                >
                    <Text style={styles.link}>العودة</Text>
                </Pressable>

                <Pressable accessibilityRole="button" onPress={() => router.push('/learning-plan')}>
                    <Text style={styles.link}>خطة تعلمي</Text>
                </Pressable>
                {learning.error ? (
                    <Pressable accessibilityRole="button" onPress={() => void learning.reload()}>
                        <Text style={styles.note}>{learning.error} اضغط لإعادة التحميل.</Text>
                    </Pressable>
                ) : null}
                <Text style={styles.title}>خطوات التعلم المقترحة</Text>
                <Text style={styles.english}>
                    {career?.title ?? ''}
                </Text>
                {readiness && level ? <View style={styles.card}><Text style={styles.heading}>مستواك الحالي في المسار</Text><Text style={styles.progressNumber}>{readiness.score}%</Text><View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${readiness.score ?? 0}%` }]} /></View><Text style={styles.text}>{readinessLabels[level]}</Text><Text style={styles.note}>هذه جاهزية مركبة من المهارات والمشروع والشهادة والمؤهل والدورات، وليست درجة اختبار مهني.</Text></View> : null}

                {!career ? (
                    <Text style={styles.text}>لم يتم العثور على الوظيفة.</Text>
                ) : !loaded ? (
                    <Text style={styles.text}>جارٍ تحميل مهاراتك…</Text>
                ) : error ? (
                    <Text style={styles.text}>{error}</Text>
                ) : savedSkills === null ? (
                    <View style={styles.card}>
                        <Text style={styles.text}>
                            اعتمد مهارات سيرتك أو أضفها يدويًا حتى نعرض اقتراحات مرتبطة بملفك.
                        </Text>
                        <Pressable onPress={() => router.replace('/home')}>
                            <Text style={styles.link}>فتح الصفحة الرئيسية</Text>
                        </Pressable>
                    </View>
                ) : (
                    <>
                        <Text style={styles.text}>
                            هذه الفجوات مرتبة حسب الأولوية لهذا المسمى. أضيفي ما تريدين إلى خطتك، ثم تابعي تقدم الدليل في كل مرحلة.
                        </Text>

                        {missing.length === 0 ? (
                            <View style={styles.card}>
                                <Text style={styles.text}>
                                    حددت جميع المهارات الأساسية في هذه النسخة.
                                    يمكنك مراجعة مستوى إتقانك أو استكشاف المهارات
                                    الإضافية في تفاصيل الوظيفة.
                                </Text>
                            </View>
                        ) : (
                            <>
                                {highPriority.length ? <><Text style={styles.stage}>المرحلة 1 — أعلى أولوية</Text>{highPriority.map(renderSkill)}</> : null}
                                {nextPriority.length ? <><Text style={styles.stage}>المرحلة 2 — أكمل المهارات الأساسية</Text>{nextPriority.map(renderSkill)}</> : null}
                            </>
                        )}

                        <Text style={styles.stage}>المرحلة 3 — شهادة مهنية اختيارية</Text>
                        {roleCertifications.length ? roleCertifications.map(certificate => { const planId = certificationPlanId(certificate.id); const achieved = certificationState.achieved.includes(certificate.id); return <View key={certificate.id} style={styles.card}><Text style={styles.skill}>{certificate.title}</Text><Text style={styles.progressLabel}>{achieved ? 'موثقة · 100%' : learning.plan.includes(planId) ? 'مخطط لها · 20%' : 'غير مضافة · 0%'}</Text><View style={styles.progressTrack}><View style={[styles.progressFill, { width: achieved ? '100%' : learning.plan.includes(planId) ? '20%' : '0%' }]} /></View><Text style={styles.note}>{certificate.note}</Text><Pressable style={styles.action} onPress={() => void learning.change(planId, !learning.plan.includes(planId))}><Text style={styles.actionText}>{learning.plan.includes(planId) ? '✓ في خطتي — إزالة' : '＋ أضف الشهادة إلى خطتي'}</Text></Pressable></View>; }) : <Text style={styles.note}>لا توجد شهادة مهنية ذات أولوية لهذا المسار في مرحلة الخريج.</Text>}
                        {roleProfile && career ? <><Text style={styles.stage}>المرحلة 4 — الخبرة والمشروع</Text><View style={styles.card}><Text style={styles.skill}>الخبرة العملية المستهدفة</Text><Text style={styles.text}>{roleProfile.experience}</Text><Pressable style={styles.action} onPress={() => void learning.change(experiencePlanId(career.id), !learning.plan.includes(experiencePlanId(career.id)))}><Text style={styles.actionText}>{learning.plan.includes(experiencePlanId(career.id)) ? '✓ في خطتي — إزالة' : '＋ أضف الخبرة إلى خطتي'}</Text></Pressable></View>{roleProfile.projects.map((project, index) => <View key={project} style={styles.card}><Text style={styles.skill}>مشروع تطبيقي {index + 1}</Text><Text style={styles.text}>{project}</Text><Pressable style={styles.action} onPress={() => void learning.change(projectPlanId(career.id, index), !learning.plan.includes(projectPlanId(career.id, index)))}><Text style={styles.actionText}>{learning.plan.includes(projectPlanId(career.id, index)) ? '✓ في خطتي — إزالة' : '＋ أضف المشروع إلى خطتي'}</Text></Pressable></View>)}</> : null}

                        <Text style={styles.note}>
                            بعض المهارات لها تمارين ومصادر مخصصة، والبقية تعرض خطوات عامة.
                            إكمال التمرين وحده لا يثبت امتلاك المهارة.
                        </Text>
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
    stage: { color: '#D97706', fontSize: 16, fontWeight: '800', textAlign: 'right', marginTop: 8 },
    progressNumber: { color: '#12635E', fontSize: 34, fontWeight: '800', textAlign: 'right' },
    progressLabel: { color: '#12635E', fontSize: 15, fontWeight: '700', textAlign: 'right' },
    progressTrack: { height: 10, backgroundColor: '#E2E8E3', borderRadius: 999, overflow: 'hidden' },
    progressFill: { height: '100%', backgroundColor: '#12635E', borderRadius: 999 },
    action: { backgroundColor: '#12635E', borderRadius: 14, padding: 14, minHeight: 48, justifyContent: 'center' },
    actionText: { color: '#FFFFFF', textAlign: 'center', fontWeight: '700', fontSize: 16 },
});
