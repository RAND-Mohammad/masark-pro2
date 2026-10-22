import { useLocalSearchParams, useRouter } from 'expo-router';
import {
    Linking,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSkillProfile } from '../hooks/use-skill-profile';
import { usePersonalProfile } from '../hooks/use-personal-profile';
import { useLearningProgress } from '../hooks/use-learning-progress';
import { useProfessionalCertifications } from '../hooks/use-professional-certifications';
import { useLearningPlan } from '../hooks/use-learning-plan';
import dataset from '../masarak_dataset.json';
import { getSkillGapReport, readinessLabels, readinessLevel } from '../utils/skill-gap';
import { certificationsByIds } from '../constants/professional-certifications';
import { calculateCareerReadiness } from '../utils/career-readiness';
import { personalLearningPlan } from '../utils/personal-learning-plan';
import { saveCareerGoal } from '../utils/personal-profile';
import { useState } from 'react';
import { displaySkillName } from '../utils/skill-labels';
import { jobPathById } from '../constants/job-paths';
import { jobPathRequirementProfile, requirementsForCareerPath } from '../constants/job-path-requirements';
import { certificationPlanId, experiencePlanId, projectPlanId } from '../utils/learning-plan';

export default function CareerScreen() {
    const [planning, setPlanning] = useState(false);
    const [planMessage, setPlanMessage] = useState('');
    const router = useRouter();
    const { profile, ready: profileLoaded, error: profileError } = useSkillProfile();
    const personalState = usePersonalProfile();
    const learningProgress = useLearningProgress();
    const certificationState = useProfessionalCertifications();
    const learningPlan = useLearningPlan();
    const savedSkills = profile?.skill_ids ?? null;
    const cvSkills = new Set(profile?.cv?.skills.flatMap(skill => skill.mapped_skill_id && !profile.excluded_cv_skill_ids.includes(skill.mapped_skill_id) ? [skill.mapped_skill_id] : []) ?? []);
    const params = useLocalSearchParams<{ id?: string }>();
    const career = jobPathById(params.id);

    if (!career) {
        return (
            <SafeAreaView style={styles.screen}>
                <View style={styles.content}>
                    <Text style={styles.title}>لم يتم العثور على الوظيفة</Text>
                    <Pressable onPress={() => router.replace('/home')}>
                        <Text style={styles.link}>العودة للرئيسية</Text>
                    </Pressable>
                </View>
            </SafeAreaView>
        );
    }

    const requirements = requirementsForCareerPath(career.id);
    const roleProfile = jobPathRequirementProfile(career.id);
    const roleCertifications = certificationsByIds(roleProfile?.certificationIds ?? []);
    // An empty skill list means no saved skills, same as the home screen.
    const gap = getSkillGapReport(career.id, savedSkills?.length ? savedSkills : null);
    const readiness = calculateCareerReadiness(career.id, {
        skillProfile: profile,
        personal: personalState.personal,
        learningProgress: learningProgress.progress,
        professionalCertifications: certificationState.achieved,
    });
    const readinessLoaded = profileLoaded && personalState.ready && learningProgress.ready && certificationState.ready;
    const level = readinessLevel(readiness.score);
    async function generatePlan() {
        if (planning || !career) return;
        setPlanning(true); setPlanMessage('');
        try {
            await saveCareerGoal(career.id);
            const saved = await learningPlan.addItems(personalLearningPlan(career.id, profile, certificationState.achieved));
            if (saved) setPlanMessage('حُفظ الهدف وأضيفت فجواته إلى خطتك دون حذف العناصر السابقة. راجع خطتك وحالة المزامنة.');
        } catch { setPlanMessage('تعذر حفظ الهدف أو الخطة. راجع ملفك وأعد المحاولة.'); }
        finally { setPlanning(false); }
    }

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

                <Text style={styles.title}>
                    {career.title}
                </Text>
                <Text style={styles.english}>{career.majors.join(' · ')}</Text>
                <Text style={styles.note}>متطلبات إرشادية منتقاة محليًا، وليست إعلان وظيفة حية أو ضمان توظيف. الشهادات والدورات تتطلب مراجعة شروط المزود.</Text>
                <Pressable accessibilityRole="button" disabled={!readinessLoaded || !learningPlan.ready || learningPlan.busy || planning} onPress={() => void generatePlan()}><Text style={styles.link}>{learningPlan.busy || planning ? 'جارٍ الحفظ…' : 'اعتمد هذا الهدف وأضف خارطة شخصية من فجواتي'}</Text></Pressable>
                {planMessage ? <Text style={styles.note}>{planMessage}</Text> : null}
                {learningPlan.error ? <Text style={styles.note}>{learningPlan.error}</Text> : null}
                <Pressable accessibilityRole="button" onPress={() => router.push('/learning-plan')}><Text style={styles.link}>مراجعة خطتي المحفوظة</Text></Pressable>
                <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/interview', params: { careerId: career.id } })}><Text style={styles.link}>تدريب المقابلة لهذا المسار</Text></Pressable>
                <Pressable
                    accessibilityRole="button"
                    onPress={() =>
                        router.push({
                            pathname: '/roadmap',
                            params: { id: career.id },
                        })
                    }
                >
                    <Text style={styles.link}>عرض خطوات التعلم المقترحة</Text>
                </Pressable>

                <View style={styles.card}>
                    <Text style={styles.heading}>جاهزيتك المركبة لهذا المسار</Text>

                    {!readinessLoaded ? (
                        <Text style={styles.note}>جارٍ جمع أدلة ملفك…</Text>
                    ) : readiness.score === null || level === null ? (
                        <Text style={styles.note}>
                            أضف بياناتك أو اعتمد سيرتك لنحسب الجاهزية
                        </Text>
                    ) : (
                        <>
                            <Text style={styles.title}>{readiness.score}%</Text>
                            <Text style={styles.skillName}>
                                {readinessLabels[level]}
                            </Text>
                            {([
                                ['المهارات الموثقة', readiness.breakdown.skills, readiness.weights.skills],
                                ['المشاريع والخبرة', readiness.breakdown.practical, readiness.weights.practical],
                                ['الشهادات المهنية', readiness.breakdown.certifications, readiness.weights.certifications],
                                ['المؤهل والمعدل', readiness.breakdown.academic, readiness.weights.academic],
                                ['الدورات المكتملة', readiness.breakdown.learning, readiness.weights.learning],
                            ] as const).map(([label, earned, maximum]) => <View key={label} style={styles.breakdown}><Text style={styles.note}>{label}</Text><Text style={styles.points}>{earned} / {maximum}</Text></View>)}
                            <Text style={styles.note}>وثّقت {gap.matchedCore.length} من {gap.matchedCore.length + gap.missingCore.length} مهارة أساسية. الدورات والشهادات المعلّمة مكتملة ذاتيًا، وتحتاج مستندًا عند التقديم الفعلي.</Text>
                            <Text style={styles.note}>احتسبنا للمسار {readiness.evidence.projects} من {readiness.evidence.totalProjects} مشاريع، و{readiness.evidence.experiences} من {readiness.evidence.totalExperiences} خبرات؛ لأن الحسبة تقبل الدليل المرتبط بكلمات ومهام هذا المسار فقط.</Text>

                            {gap.missingCore.length > 0 && (
                                <>
                                    <Text style={styles.skillName}>مهارات أساسية لم تُوثّق بعد</Text>
                                    {gap.missingCore.map((skill) => (
                                        <Text key={skill.skill_id} style={styles.note}>
                                            • {displaySkillName(skill.name)}
                                        </Text>
                                    ))}
                                </>
                            )}
                        </>
                    )}
                </View>

                <View style={styles.card}>
                    <Text style={styles.heading}>الشهادات المهنية المقترحة</Text>
                    <Text style={styles.note}>هذه خيارات بديلة؛ تكفي شهادة واحدة مرتبطة بالمسار لنقاط الشهادات. اختر «حصلت عليها» فقط بعد اجتياز الاختبار وصدور الشهادة باسمك. التحضير أو إكمال دورة لا يعني الحصول على الشهادة.</Text>
                    {certificationState.error ? <Pressable onPress={() => void certificationState.reload()}><Text style={styles.link}>{certificationState.error} اضغط لإعادة التحميل.</Text></Pressable> : null}
                    {roleCertifications.map(certificate => {
                        const achieved = certificationState.achieved.includes(certificate.id);
                        return <View key={certificate.id} style={styles.certificate}>
                            <Text style={styles.skillName}>{certificate.title}</Text>
                            <Text style={styles.note}>{certificate.provider} · {certificate.level}</Text>
                            <Text style={styles.note}>{certificate.cost}</Text>
                            <Text style={styles.note}>{certificate.note}</Text>
                            <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(certificate.url)}><Text style={styles.link}>صفحة الشهادة الرسمية</Text></Pressable>
                            <Pressable accessibilityRole="button" disabled={!learningPlan.ready || learningPlan.busy} style={styles.certButton} onPress={() => void learningPlan.change(certificationPlanId(certificate.id), !learningPlan.plan.includes(certificationPlanId(certificate.id)))}><Text style={styles.certButtonText}>{learningPlan.plan.includes(certificationPlanId(certificate.id)) ? '✓ في خطة تعلمي — إزالة' : '＋ أضف الشهادة إلى خطة تعلمي'}</Text></Pressable>
                            <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: achieved, disabled: !certificationState.ready || certificationState.busy }} disabled={!certificationState.ready || certificationState.busy} style={[styles.certButton, achieved && styles.certButtonDone]} onPress={() => void certificationState.change(certificate.id, !achieved)}><Text style={styles.certButtonText}>{achieved ? '✓ حصلت على هذه الشهادة' : '□ حصلت على هذه الشهادة'}</Text></Pressable>
                        </View>;
                    })}
                </View>

                {roleProfile ? (
                    <View style={styles.card}>
                        <Text style={styles.heading}>ما يحتاجه هذا المسمى تحديدًا</Text>
                        <Text style={styles.skillName}>المؤهل الجامعي المناسب</Text>
                        <Text style={styles.note}>{roleProfile.education}</Text>
                        <Text style={styles.skillName}>الخبرة العملية</Text>
                        <Text style={styles.note}>{roleProfile.experience}</Text>
                        <Pressable accessibilityRole="button" disabled={!learningPlan.ready || learningPlan.busy} style={styles.certButton} onPress={() => void learningPlan.change(experiencePlanId(career.id), !learningPlan.plan.includes(experiencePlanId(career.id)))}><Text style={styles.certButtonText}>{learningPlan.plan.includes(experiencePlanId(career.id)) ? '✓ الخبرة في خطتي — إزالة' : '＋ أضف الخبرة المطلوبة إلى خطتي'}</Text></Pressable>
                        <Text style={styles.skillName}>مشاريع تثبت الجاهزية</Text>
                        {roleProfile.projects.map((project, index) => <View key={project} style={styles.certificate}><Text style={styles.note}>• {project}</Text><Pressable accessibilityRole="button" disabled={!learningPlan.ready || learningPlan.busy} style={styles.certButton} onPress={() => void learningPlan.change(projectPlanId(career.id, index), !learningPlan.plan.includes(projectPlanId(career.id, index)))}><Text style={styles.certButtonText}>{learningPlan.plan.includes(projectPlanId(career.id, index)) ? '✓ المشروع في خطتي — إزالة' : '＋ أضف المشروع إلى خطتي'}</Text></Pressable></View>)}
                        <Text style={styles.skillName}>الشهادة المهنية</Text>
                        <Text style={styles.note}>{roleCertifications.length ? 'اختيارية ومساندة. اختاري واحدة مرتبطة بالأداة أو البيئة التي تستهدفينها؛ لا يلزم جمعها كلها.' : 'لا توجد شهادة مهنية عامة ذات أولوية لهذا المسمى في مرحلة الخريج؛ المشروع العملي أقوى.'}</Text>
                        {roleProfile.sources.map(source => (
                            <Pressable key={source.url} accessibilityRole="link" onPress={() => void Linking.openURL(source.url)}>
                                <Text style={styles.link}>{source.label}</Text>
                            </Pressable>
                        ))}
                        <Text style={styles.note}>هذه معلومات إرشادية عامة، وإعلان الوظيفة المستهدف هو المرجع النهائي. الشهادة والدليل العملي يدخلان في الجاهزية المركبة كبندين منفصلين، ولا يغيران نسبة تغطية المهارات الأساسية.</Text>
                    </View>
                ) : null}

                {(['core', 'additional'] as const).map((priority) => (
                    <View key={priority} style={styles.section}>
                        <Text style={styles.heading}>
                            {priority === 'core'
                                ? 'المهارات الأساسية للتجربة'
                                : 'المهارات الإضافية'}
                        </Text>

                        {requirements
                            .filter((item) => item.priority === priority)
                            .map((item) => {
                                const skill = dataset.skills.find(
                                    (entry) => entry.skill_id === item.skill_id
                                );

                                return (
                                    <View key={item.skill_id} style={styles.card}>
                                        <Text style={styles.skillName}>{displaySkillName(item.name)}</Text>
                                        <Text style={styles.note}>{priority === 'core' && 'priority_rank' in item ? (item.priority_rank <= 2 ? 'أولوية مرتفعة في هذا المسمى' : item.priority_rank <= 4 ? 'أولوية أساسية' : 'أساسية بعد إتقان الأولويات الأعلى') : 'مهارة إضافية بعد الأساسيات'}</Text>
                                        <Text style={styles.note}>
                                            {!profileLoaded
                                                ? 'جارٍ تحميل ملف مهاراتك…'
                                                : profileError
                                                    ? profileError
                                                    : savedSkills === null
                                                        ? 'اعتمد سيرتك أو أضف مهاراتك من ملفك'
                                                        : savedSkills.includes(item.skill_id)
                                                            ? cvSkills.has(item.skill_id) ? '✓ من سيرتك الذاتية المعتمدة' : '✓ أضفتها يدويًا في ملفك'
                                                            : 'لم تحددها في ملف مهاراتك'}
                                        </Text>

                                        <Text style={styles.english}>
                                            {skill?.description ?? 'الوصف غير متوفر'}
                                        </Text>
                                        {!savedSkills?.includes(item.skill_id) ? <Pressable accessibilityRole="button" disabled={!learningPlan.ready || learningPlan.busy} style={styles.certButton} onPress={() => void learningPlan.change(item.skill_id, !learningPlan.plan.includes(item.skill_id))}><Text style={styles.certButtonText}>{learningPlan.plan.includes(item.skill_id) ? '✓ المهارة في خطتي — إزالة' : '＋ أضف المهارة إلى خطة تعلمي'}</Text></Pressable> : null}
                                        <Pressable
                                            accessibilityRole="link"
                                            onPress={() => {
                                                Linking.openURL(item.evidence_url).catch(
                                                    () => { }
                                                );
                                            }}
                                        >
                                            <Text style={styles.link}>المصدر المهني</Text>
                                        </Pressable>
                                    </View>
                                );
                            })}
                    </View>
                ))}

                <View style={styles.card}>
                    <Text style={styles.heading}>كيف اخترنا المهارات؟</Text>
                    <Text style={styles.note}>
                        أسماء المهارات وأوصافها من إطار المهارات السعودي.
                        ربطها بهذه الوظيفة تفسير للمصادر المهنية المكملة،
                        وليس ربطًا رسميًا. تصنيف الأساسية والإضافية قرار
                        لنسخة Masarak التجريبية، ولا يحدد مستوى إتقان مطلوبًا.
                    </Text>
                    <Text style={styles.note}>
                        المهارات الإضافية لا تدخل في نسبة التغطية.
                        الأوصاف الإنجليزية معروضة كما وردت في البيانات.
                    </Text>
                </View>
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
        gap: 20,
        paddingBottom: 60,
    },
    title: {
        color: '#12635E',
        fontSize: 28,
        fontWeight: '700',
        textAlign: 'right',
    },
    heading: {
        color: '#193C3B',
        fontSize: 21,
        fontWeight: '700',
        textAlign: 'right',
    },
    section: { gap: 14 },
    card: {
        backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DDE6E0',
        padding: 20,
        borderRadius: 16,
        gap: 12,
    },
    skillName: {
        color: '#193C3B',
        fontSize: 18,
        fontWeight: '600',
    },
    english: {
        color: '#617570',
        fontSize: 15,
        lineHeight: 25,
    },
    link: {
        color: '#12635E',
        fontSize: 17,
        textAlign: 'right',
        paddingVertical: 8,
    },
    note: {
        color: '#617570',
        fontSize: 15,
        lineHeight: 27,
        textAlign: 'right',
    },
    breakdown: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
    points: { color: '#12635E', fontSize: 15, fontWeight: '700' },
    certificate: { backgroundColor: '#F8F9F5', borderWidth: 1, borderColor: '#DDE6E0', borderRadius: 14, padding: 16, gap: 7 },
    certButton: { borderWidth: 1, borderColor: '#12635E', borderRadius: 12, padding: 12, minHeight: 46, justifyContent: 'center' },
    certButtonDone: { backgroundColor: '#E5F3EE' },
    certButtonText: { color: '#12635E', fontSize: 15, fontWeight: '600', textAlign: 'center' },
});
