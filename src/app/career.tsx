import { colors, createAdaptiveStyles } from '../constants/design';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
    Linking,
    Pressable,
    ScrollView,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSkillProfile } from '../hooks/use-skill-profile';
import { usePersonalProfile } from '../hooks/use-personal-profile';
import { useProfessionalCertifications } from '../hooks/use-professional-certifications';
import { useLearningPlan } from '../hooks/use-learning-plan';
import dataset from '../masarak_dataset.json';
import { getSkillGapReport } from '../utils/skill-gap';
import { getCareerMatches } from '../utils/career-matching';
import { careerTitles } from '../utils/career-matches';
import { certificationsByIds, professionalCertificationCopy } from '../constants/professional-certifications';
import { useLearningResources } from '../hooks/use-learning-resources';
import { personalLearningPlan } from '../utils/personal-learning-plan';
import { saveCareerGoal } from '../utils/personal-profile';
import { useState } from 'react';
import { displaySkillName } from '../utils/skill-labels';
import { jobPathById } from '../constants/job-paths';
import { jobPathRequirementProfile, requirementsForCareerPath } from '../constants/job-path-requirements';
import { certificationPlanId, experiencePlanId, projectPlanId } from '../utils/learning-plan';
import { DisclosureCard } from '../components/disclosure-card';
import { MasarakIcon } from '../components/masarak-icon';
import { useAppPreferences } from '../contexts/app-preferences-context';

const roleStories: Record<string, { ar: string; en: string; tasksAr: string[]; tasksEn: string[] }> = {
    C01: { ar: 'حوّل احتياجات الناس إلى تطبيقات موثوقة وسهلة الاستخدام.', en: 'Turn user needs into reliable, useful software.', tasksAr: ['تحليل الاحتياج وتصميم الحل البرمجي', 'بناء التطبيقات واختبارها وتحسينها', 'التعاون مع الفريق وتوثيق العمل'], tasksEn: ['Translate needs into software designs', 'Build, test and improve applications', 'Work with a team and document decisions'] },
    C02: { ar: 'حوّل البيانات الخام إلى معلومات تساعد على اتخاذ القرار.', en: 'Turn raw data into insights that support decisions.', tasksAr: ['تنظيف البيانات واستكشافها', 'إنشاء التقارير ولوحات المؤشرات', 'شرح النتائج لأصحاب القرار'], tasksEn: ['Clean and explore datasets', 'Build reports and dashboards', 'Explain findings to decision makers'] },
    C03: { ar: 'استخدم التحليل والإحصاء لبناء نماذج تجيب عن أسئلة معقدة.', en: 'Use analytics and statistics to answer complex questions.', tasksAr: ['تهيئة البيانات وتحليلها', 'تطوير النماذج ومقارنة نتائجها', 'عرض النتائج وحدودها بوضوح'], tasksEn: ['Prepare and analyze data', 'Develop models and compare results', 'Communicate findings and limitations'] },
    C04: { ar: 'طوّر حلولًا ذكية مسؤولة انطلاقًا من البيانات والمشكلة.', en: 'Build responsible AI solutions around real problems and data.', tasksAr: ['إعداد البيانات واختيار المنهج المناسب', 'تدريب النماذج وتقييمها', 'توثيق الأداء والقيود ومراقبتها'], tasksEn: ['Prepare data and select an approach', 'Train and evaluate models', 'Document, monitor and explain limitations'] },
    C05: { ar: 'ساعد على حماية الأنظمة واكتشاف المخاطر والاستجابة لها.', en: 'Help protect systems by finding risks and responding to incidents.', tasksAr: ['مراجعة الأنظمة والسجلات الأمنية', 'تحليل التنبيهات وتحديد الأولوية', 'توثيق المخاطر والإجراءات المقترحة'], tasksEn: ['Review systems and security logs', 'Analyze alerts and prioritize incidents', 'Document risks and recommended actions'] },
    C06: { ar: 'صمّم الشبكات وراقبها وحافظ على اتصالها وأمنها.', en: 'Design, monitor and secure reliable networks.', tasksAr: ['إعداد مكونات الشبكة واختبارها', 'تشخيص مشكلات الاتصال والأداء', 'تطبيق ضوابط الشبكة وتوثيقها'], tasksEn: ['Configure and test network components', 'Troubleshoot connectivity and performance', 'Apply and document network controls'] },
    C07: { ar: 'نظّم البيانات في قواعد موثوقة وسهلة الإدارة والاسترجاع.', en: 'Organize data in dependable, maintainable databases.', tasksAr: ['تصميم هياكل البيانات والاستعلامات', 'حماية البيانات ومتابعة أدائها', 'التحقق من النسخ الاحتياطي والاستعادة'], tasksEn: ['Design data structures and queries', 'Protect data and monitor performance', 'Verify backups and recovery procedures'] },
    C08: { ar: 'شغّل الأنظمة والخدمات التقنية وحافظ على استقرارها.', en: 'Operate technology services and keep them dependable.', tasksAr: ['إعداد الأنظمة والصلاحيات', 'متابعة الأعطال والاستجابة لها', 'تحسين التوثيق والنسخ الاحتياطي'], tasksEn: ['Configure systems and access', 'Monitor and respond to incidents', 'Improve documentation and backups'] },
    C09: { ar: 'اربط احتياج العمل بالحلول والأنظمة المناسبة.', en: 'Connect business needs to practical systems and solutions.', tasksAr: ['جمع المتطلبات من أصحاب المصلحة', 'تحليل العمليات وتحديد فرص التحسين', 'توثيق الحل ومتابعة تنفيذه'], tasksEn: ['Gather stakeholder requirements', 'Analyze processes and identify improvements', 'Document solutions and support delivery'] },
};

export default function CareerScreen() {
    useLearningResources();
    const [planning, setPlanning] = useState(false);
    const [showMatchExplanation, setShowMatchExplanation] = useState(false);
    const [planMessage, setPlanMessage] = useState('');
    const [gapPlanMessage, setGapPlanMessage] = useState('');
    const router = useRouter();
    const { profile, ready: profileLoaded, error: profileError } = useSkillProfile();
    const personalState = usePersonalProfile();
    const certificationState = useProfessionalCertifications();
    const learningPlan = useLearningPlan();
    const { language } = useAppPreferences();
    const en = language === 'en';
    const t = (ar: string, english: string) => en ? english : ar;
    const savedSkills = profile?.skill_ids ?? null;
    const cvSkills = new Set(profile?.cv?.skills.flatMap(skill => skill.mapped_skill_id && !profile.excluded_cv_skill_ids.includes(skill.mapped_skill_id) ? [skill.mapped_skill_id] : []) ?? []);
    const params = useLocalSearchParams<{ id?: string }>();
    const career = jobPathById(params.id);
    const careerMatch = getCareerMatches({ skillProfile: profile, personal: personalState.personal }).find(item => item.career_id === career?.id);

    if (!career) {
        return (
            <SafeAreaView style={styles.screen}>
                <View style={styles.content}>
                    <Text style={[styles.title, en && styles.ltr]}>{t('لم يتم العثور على الوظيفة', 'Career path not found')}</Text>
                    <Pressable onPress={() => router.replace('/home')}>
                        <Text style={[styles.link, en && styles.ltr]}>{t('العودة للرئيسية', 'Back to home')}</Text>
                    </Pressable>
                </View>
            </SafeAreaView>
        );
    }

    const requirements = requirementsForCareerPath(career.id);
    const roleProfile = jobPathRequirementProfile(career.id);
    const roleCertifications = certificationsByIds(roleProfile?.certificationIds ?? []);
    const story = roleStories[career.baseCareerId] ?? roleStories.C01;
    // An empty skill list means no saved skills, same as the home screen.
    const gap = getSkillGapReport(career.id, savedSkills?.length ? savedSkills : null);
    async function generatePlan() {
        if (planning || !career) return;
        setPlanning(true); setPlanMessage('');
        try {
            await saveCareerGoal(career.id);
            const saved = await learningPlan.addItems(personalLearningPlan(career.id, profile, certificationState.achieved));
            if (saved) setPlanMessage(t('حُفظ الهدف وأضيفت فجواته إلى خطتك دون حذف العناصر السابقة. راجع خطتك وحالة المزامنة.', 'Goal saved and its gaps added to your plan. Existing items were kept. Review your plan and sync status.'));
        } catch { setPlanMessage(t('تعذر حفظ الهدف أو الخطة. راجع ملفك وأعد المحاولة.', 'Could not save the goal or plan. Check your profile and try again.')); }
        finally { setPlanning(false); }
    }

    return (
        <SafeAreaView style={styles.screen}>
            <ScrollView contentContainerStyle={styles.content}>
                <View style={[styles.topBar, en && styles.rowLtr]}>
                    <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                        if (router.canGoBack()) router.back();
                        else router.replace('/home');
                    }}
                    style={styles.backButton}
                    ><MasarakIcon name="arrow" size={20} color={colors.ink} /><Text style={[styles.topBarTitle, en && styles.ltr]}>{t('استكشف هذا المسار', 'Explore this path')}</Text></Pressable>
                    <Text style={styles.topBarMore}>···</Text>
                </View>
                <Text style={[styles.eyebrow, en && styles.ltr]}>{t('المسار المقترح لك', 'YOUR RECOMMENDED DIRECTION')}</Text>
                <Text style={styles.title}>
                    {en ? career.title : careerTitles[career.id] ?? career.title}
                </Text>
                <Text style={[styles.heroDescription, en && styles.ltr]}>{en ? story.en : story.ar}</Text>
                <View style={styles.scorePanel}>
                    <View style={styles.scoreMetric}>
                        <Text style={[styles.scoreNumber, en && styles.ltr, { color: colors.contrastAccent }]}>{careerMatch?.score === null || careerMatch?.score === undefined ? '—' : `${careerMatch.score}%`}</Text>
                        <Text style={[styles.scoreLabel, en && styles.ltr]}>{t('ملاءمة المسار', 'CAREER MATCH')}</Text>
                    </View>
                </View>
                <View style={styles.tasksSection}>
                    <Text style={[styles.sectionHeading, en && styles.ltr]}>{t('ماذا ستفعل؟', 'What you’ll do')}</Text>
                    {(en ? story.tasksEn : story.tasksAr).map(task => <View key={task} style={[styles.taskRow, en && styles.rowLtr]}><MasarakIcon name="check" size={18} color={colors.primary} /><Text style={[styles.taskText, en && styles.ltr]}>{task}</Text></View>)}
                </View>
                <View style={styles.fitSection}>
                    <View style={[styles.fitHeader, en && styles.rowLtr]}>
                        <Text style={[styles.skillName, en && styles.ltr]}>{t('لماذا يناسبك هذا المسار؟', 'Why this fits')}</Text>
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={t('شرح ملاءمة المسار الموزونة', 'Weighted career match explanation')}
                            accessibilityHint={t('يعرض عوامل حساب نسبة الملاءمة', 'Shows the factors used to calculate career match')}
                            accessibilityState={{ expanded: showMatchExplanation }}
                            hitSlop={8}
                            onPress={() => setShowMatchExplanation(value => !value)}
                            style={({ pressed }) => [styles.infoButton, pressed && styles.infoPressed]}
                        ><MasarakIcon name="info" size={16} color={colors.muted} /></Pressable>
                    </View>
                    {showMatchExplanation ? <View style={styles.fitDetails}>
                        <Text style={[styles.fitTitle, en && styles.ltr]}>{t('ملاءمة المسار الموزونة', 'Weighted career match')}</Text>
                        <Text style={[styles.note, en && styles.ltr]}>{t('تجمع النسبة أربعة عوامل بأوزانها. وهي إرشادية ولا تمثل احتمال قبول أو ضمان توظيف. أما تغطية المهارات الأساسية أعلاه فهي مقياس مستقل.', 'This score combines four weighted factors. It is guidance, not a hiring probability or guarantee. The core-skill coverage shown above is a separate measure.')}</Text>
                        {careerMatch ? (['skills', 'interests', 'personality', 'education'] as const).map(key => {
                            const labels = en ? { skills: 'Skills', interests: 'Interests', personality: 'Traits', education: 'Education' } : { skills: 'المهارات', interests: 'الاهتمامات', personality: 'السمات', education: 'التعليم' };
                            return <View key={key} style={styles.breakdown}><View style={{ flex: 1 }}><Text style={[styles.note, en && styles.ltr]}>{labels[key]} · {careerMatch.breakdown[key]}% × {careerMatch.weights[key]}%</Text><View style={styles.track}><View style={[styles.trackFill, { width: `${careerMatch.breakdown[key]}%` }]} /></View></View><Text style={[styles.points, en && styles.ltr]}>{careerMatch.weightedPoints[key]} {t('نقطة', 'pts')}</Text></View>;
                        }) : <Text style={[styles.note, en && styles.ltr]}>{t('أضيفي مهاراتك واهتماماتك وبيانات تعليمك لعرض العوامل.', 'Add your skills, interests and education to see the match factors.')}</Text>}
                        {careerMatch?.matchedInterests.length ? <Text style={[styles.note, en && styles.ltr]}>{t('اهتمامات مرتبطة:', 'Related interests:')} {careerMatch.matchedInterests.join(en ? ', ' : '، ')}</Text> : null}
                        {careerMatch?.matchedTraits.length ? <Text style={[styles.note, en && styles.ltr]}>{t('سمات مرتبطة:', 'Related traits:')} {careerMatch.matchedTraits.join(en ? ', ' : '، ')}</Text> : null}
                    </View> : null}
                </View>
                <View style={[styles.tagsRow, en && styles.rowLtr]}>
                    <View style={styles.tag}><Text style={[styles.tagText, en && styles.ltr]}>{career.stage === 'entry' ? t('توجيه للمبتدئين', 'Entry-level direction') : t('توجيه للمستوى المتقدم', 'Experienced direction')}</Text></View>
                    <View style={styles.tag}><Text style={[styles.tagText, en && styles.ltr]}>{t('إرشاد مهني عام', 'Career guidance')}</Text></View>
                </View>
                <DisclosureCard title={t('تحليل فجوة المهارات', 'Skill gap analysis')} summary={!profileLoaded ? t('جارٍ تحميل ملفك', 'Loading your profile') : profileError ? t('تعذر تحميل المهارات', 'Could not load skills') : gap.score === null ? t('أضيفي مهاراتك لعرض المقارنة', 'Add skills to see the comparison') : `${gap.matchedCore.length} ${t('مطابقة', 'matched')} · ${gap.missingCore.length} ${t('تحتاج إلى بناء', 'to build')}`}>
                    {!profileLoaded ? <Text style={[styles.note, en && styles.ltr]}>{t('جارٍ تحميل ملف مهاراتك…', 'Loading your skill profile…')}</Text> : profileError ? <Text style={[styles.note, en && styles.ltr]}>{profileError}</Text> : gap.score === null ? <Text style={[styles.note, en && styles.ltr]}>{t('أضيفي مهاراتك يدويًا أو اعتمدي نتيجة سيرتك من صفحة ملفي لتظهر المهارات المطابقة والفجوات.', 'Add skills manually or approve your CV results on the Profile screen to see matched skills and gaps.')}</Text> : <>
                        <View style={[styles.gapSummary, en && styles.rowLtr]}>
                            <View style={styles.gapSummaryItem}><Text style={[styles.gapSummaryNumber, en && styles.ltr]}>{gap.matchedCore.length} {t('مطابقة', 'matched')}</Text><Text style={[styles.gapSkillMeta, en && styles.ltr]}>{t('أساسيات مرتبطة بالمسار', 'Role-relevant foundations')}</Text></View>
                            <View style={styles.gapSummaryItem}><Text style={[styles.gapSummaryNumber, en && styles.ltr]}>{gap.missingCore.length} {t('للتطوير', 'to build')}</Text><Text style={[styles.gapSkillMeta, en && styles.ltr]}>{t('أولويات تعلم مركزة', 'Focused learning priorities')}</Text></View>
                        </View>
                        <Text style={[styles.skillName, en && styles.ltr]}>{t('مهاراتك المطابقة', 'Your matched skills')}</Text>
                        <View style={[styles.gapChipList, en && styles.rowLtr]}>
                            {gap.matchedCore.length ? gap.matchedCore.map(item => <View key={item.skill_id} style={styles.gapChip}><Text style={[styles.gapChipText, en && styles.ltr]}>{en ? item.name : displaySkillName(item.name)}  ✓</Text></View>) : <Text style={[styles.note, en && styles.ltr]}>{t('لا توجد مهارات أساسية موثقة لهذا المسار حتى الآن.', 'No core skills are documented for this path yet.')}</Text>}
                        </View>
                        <Text style={[styles.skillName, en && styles.ltr]}>{t('مهاراتك التالية', 'Your next skills')}</Text>
                        {gap.missingCore.length ? gap.missingCore.map(item => {
                            const requirement = requirements.find(row => row.skill_id === item.skill_id);
                            const rank = requirement && 'priority_rank' in requirement ? requirement.priority_rank : Number.MAX_SAFE_INTEGER;
                            const planned = learningPlan.plan.includes(item.skill_id);
                            return <View key={item.skill_id} style={[styles.gapSkillCard, en && styles.rowLtr]}>
                                <Pressable accessibilityRole="button" accessibilityLabel={`${planned ? t('إزالة من الخطة', 'Remove from plan') : t('إضافة إلى الخطة', 'Add to plan')}: ${en ? item.name : displaySkillName(item.name)}`} accessibilityState={{ disabled: !learningPlan.ready || learningPlan.busy, checked: planned }} disabled={!learningPlan.ready || learningPlan.busy} style={[styles.skillPill, planned && styles.certButtonDone]} onPress={() => void learningPlan.change(item.skill_id, !planned)}>
                                    <Text style={styles.skillPillText}>{en ? item.name : displaySkillName(item.name)}  {planned ? '✓' : '+'}</Text>
                                </Pressable>
                                <Text style={[styles.gapSkillMeta, en && styles.ltr]}>{rank <= 2 ? t('أولوية مرتفعة · مهارة أساسية', 'High priority · Core skill') : rank <= 4 ? t('أولوية أساسية', 'Core priority') : t('خطوة تعلم تالية', 'Build next')}</Text>
                            </View>;
                        }) : <Text style={[styles.note, en && styles.ltr]}>{t('كل المهارات الأساسية لهذا المسار موثقة في ملفك.', 'All core skills for this path are documented in your profile.')}</Text>}
                        <Text style={[styles.note, en && styles.ltr]}>{t('المهارات الداعمة تبقى في ملفك لكنها لا تُحسب ضمن مطابقة مهارات المسار. المقارنة تعرض ما هو موثق فقط.', 'Supporting skills remain in your profile but do not count as core role matches. This comparison shows documented skills only.')}</Text>
                        {learningPlan.error ? <Text accessibilityRole="alert" style={[styles.note, en && styles.ltr]}>{learningPlan.error}</Text> : null}
                        {gapPlanMessage ? <Text style={[styles.note, en && styles.ltr]}>{gapPlanMessage}</Text> : null}
                        {gap.missingCore.length ? <Pressable accessibilityRole="button" disabled={!learningPlan.ready || learningPlan.busy} style={[styles.primaryButton, (!learningPlan.ready || learningPlan.busy) && styles.disabledButton]} onPress={() => router.push({ pathname: '/roadmap', params: { id: career.id } })}>
                            <Text style={styles.primaryButtonText}>{t('ابنِ خارطة تعلمي', 'Build my learning roadmap')}  ↗</Text>
                        </Pressable> : null}
                        {gap.missingCore.length ? <Pressable accessibilityRole="button" disabled={!learningPlan.ready || learningPlan.busy} style={[styles.certButton, (!learningPlan.ready || learningPlan.busy) && styles.disabledButton]} onPress={async () => {
                            const saved = await learningPlan.addItems(gap.missingCore.map(item => item.skill_id));
                            setGapPlanMessage(saved ? t('أُضيفت المهارات الناقصة إلى خطة التعلم مع الحفاظ على العناصر السابقة.', 'Missing skills were added to your learning plan. Existing items were kept.') : t('تعذر حفظ المهارات الآن. أعيدي المحاولة.', 'Could not save the skills right now. Please try again.'));
                        }}><Text style={styles.certButtonText}>{t('أضف كل الفجوات إلى خطة التعلم', 'Add all gaps to my learning plan')}</Text></Pressable> : null}
                    </>}
                </DisclosureCard>

                <Text style={[styles.note, en && styles.ltr]}>{t('ملاءمة المسار تقييم إرشادي موزون تشرح علامة المعلومات عوامل حسابه، ولا يمثل احتمال قبول أو ضمان توظيف. تظهر الجاهزية في صفحة مستقلة بعد استعراض الوظائف. راجعي مصدر الوظيفة والشهادة قبل التقديم.', 'Career match is a weighted guide explained by the info icon, not a hiring probability or guarantee. Readiness has a separate page after job listings. Check job and certification sources before applying.')}</Text>

                <DisclosureCard title={t('خطواتك التالية', 'Your next steps')} subtitle={t('احفظ المسار وواصل التعلم والتدرب', 'Save the path, keep learning and practice')} summary={t('الهدف وخطة التعلم والمقابلة', 'Goal, learning plan and interview practice')}>
                    <Pressable accessibilityRole="button" disabled={!profileLoaded || !learningPlan.ready || learningPlan.busy || planning} style={[styles.primaryButton, (!profileLoaded || !learningPlan.ready || learningPlan.busy || planning) && styles.disabledButton]} onPress={() => void generatePlan()}><Text style={styles.primaryButtonText}>{learningPlan.busy || planning ? t('جارٍ الحفظ…', 'Saving…') : t('اعتمد هذا الهدف وأضف خارطة شخصية', 'Set this as my goal and add a roadmap')}</Text></Pressable>
                    {planMessage ? <Text style={[styles.note, en && styles.ltr]}>{planMessage}</Text> : null}
                    {learningPlan.error ? <Text style={[styles.note, en && styles.ltr]}>{learningPlan.error}</Text> : null}
                    <Pressable accessibilityRole="button" style={styles.actionRow} onPress={() => router.push('/learning-plan')}><Text style={[styles.actionRowText, en && styles.ltr]}>{t('مراجعة خطة التعلم المحفوظة', 'Review my learning plan')}  ›</Text></Pressable>
                    <Pressable accessibilityRole="button" style={styles.actionRow} onPress={() => router.push({ pathname: '/interview', params: { careerId: career.id } })}><Text style={[styles.actionRowText, en && styles.ltr]}>{t('تدرّب على مقابلة لهذا المسار', 'Practice an interview for this path')}  ›</Text></Pressable>
                    <Pressable accessibilityRole="button" style={styles.actionRow} onPress={() => router.push({ pathname: '/roadmap', params: { id: career.id } })}><Text style={[styles.actionRowText, en && styles.ltr]}>{t('الاطلاع على خطوات التعلم المقترحة', 'View suggested learning steps')}  ›</Text></Pressable>
                </DisclosureCard>

                <DisclosureCard title={t('الشهادات المهنية', 'Professional certifications')} subtitle={t('اقتراحات اختيارية لهذا المسار', 'Optional suggestions for this path')} summary={roleCertifications.length ? `${roleCertifications.length} ${t('خيارات · تكفي شهادة واحدة', 'options · one is enough')}` : t('لا توجد شهادة ذات أولوية', 'No priority certification')} status={roleCertifications.length ? t('اختياري', 'Optional') : t('لا إجراء', 'None')}>
                    <Text style={[styles.note, en && styles.ltr]}>{t('هذه خيارات بديلة؛ تكفي شهادة واحدة مرتبطة بالمسار لنقاط الشهادات. اختر «حصلت عليها» فقط بعد اجتياز الاختبار وصدور الشهادة باسمك. التحضير أو إكمال دورة لا يعني الحصول على الشهادة.', 'These are alternatives; one relevant certification is enough. Mark it earned only after passing the exam and receiving the certificate in your name. Preparation or course completion is not certification.')}</Text>
                    {certificationState.error ? <Pressable onPress={() => void certificationState.reload()}><Text style={[styles.link, en && styles.ltr]}>{certificationState.error} {t('اضغط لإعادة التحميل.', 'Tap to reload.')}</Text></Pressable> : null}
                    {roleCertifications.map(certificate => {
                        const achieved = certificationState.achieved.includes(certificate.id);
                        const display = professionalCertificationCopy(certificate, en);
                        return <View key={certificate.id} style={styles.certificate}>
                            <Text style={[styles.skillName, en && styles.ltr]}>{display.title}</Text>
                            <Text style={[styles.note, en && styles.ltr]}>{display.provider} · {display.level}</Text>
                            <Text style={[styles.note, en && styles.ltr]}>{display.cost}</Text>
                            <Text style={[styles.note, en && styles.ltr]}>{display.note}</Text>
                            <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(certificate.url)}><Text style={[styles.link, en && styles.ltr]}>{t('صفحة الشهادة الرسمية', 'Official certification page')}</Text></Pressable>
                            <Pressable accessibilityRole="button" disabled={!learningPlan.ready || learningPlan.busy} style={styles.certButton} onPress={() => void learningPlan.change(certificationPlanId(certificate.id), !learningPlan.plan.includes(certificationPlanId(certificate.id)))}><Text style={styles.certButtonText}>{learningPlan.plan.includes(certificationPlanId(certificate.id)) ? `✓ ${t('في خطة تعلمي — إزالة', 'In my plan — remove')}` : `＋ ${t('أضف الشهادة إلى خطة تعلمي', 'Add certification to my plan')}`}</Text></Pressable>
                            <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: achieved, disabled: !certificationState.ready || certificationState.busy }} disabled={!certificationState.ready || certificationState.busy} style={[styles.certButton, achieved && styles.certButtonDone]} onPress={() => void certificationState.change(certificate.id, !achieved)}><Text style={styles.certButtonText}>{achieved ? `✓ ${t('حصلت على هذه الشهادة', 'Certification earned')}` : `□ ${t('حصلت على هذه الشهادة', 'Mark certification earned')}`}</Text></Pressable>
                        </View>;
                    })}
                </DisclosureCard>

                {roleProfile ? (
                    <DisclosureCard title={t('متطلبات هذا المسار', 'Path requirements')} subtitle={t('التعليم والخبرة والمشاريع', 'Education, experience and projects')} summary={`${en ? roleProfile.educationEn : roleProfile.education} · ${roleProfile.projects.length} ${t('أفكار مشاريع', 'project ideas')}`} status={t('دليل إرشادي', 'Guidance')}>
                        <Text style={[styles.skillName, en && styles.ltr]}>{t('المؤهل الجامعي المناسب', 'Relevant education')}</Text>
                        <Text style={[styles.note, en && styles.ltr]}>{en ? roleProfile.educationEn : roleProfile.education}</Text>
                        <Text style={[styles.skillName, en && styles.ltr]}>{t('الخبرة العملية', 'Relevant experience')}</Text>
                        <Text style={[styles.note, en && styles.ltr]}>{en ? roleProfile.experienceEn : roleProfile.experience}</Text>
                        <Pressable accessibilityRole="button" disabled={!learningPlan.ready || learningPlan.busy} style={styles.certButton} onPress={() => void learningPlan.change(experiencePlanId(career.id), !learningPlan.plan.includes(experiencePlanId(career.id)))}><Text style={styles.certButtonText}>{learningPlan.plan.includes(experiencePlanId(career.id)) ? `✓ ${t('الخبرة في خطتي — إزالة', 'Experience in plan — remove')}` : `＋ ${t('أضف الخبرة المطلوبة إلى خطتي', 'Add suggested experience to my plan')}`}</Text></Pressable>
                        <Text style={[styles.skillName, en && styles.ltr]}>{t('مشاريع تثبت الجاهزية', 'Projects to demonstrate readiness')}</Text>
                        {roleProfile.projects.map((project, index) => <View key={project} style={styles.certificate}><Text style={[styles.note, en && styles.ltr]}>• {en ? roleProfile.projectsEn[index] : project}</Text><Pressable accessibilityRole="button" disabled={!learningPlan.ready || learningPlan.busy} style={styles.certButton} onPress={() => void learningPlan.change(projectPlanId(career.id, index), !learningPlan.plan.includes(projectPlanId(career.id, index)))}><Text style={styles.certButtonText}>{learningPlan.plan.includes(projectPlanId(career.id, index)) ? `✓ ${t('المشروع في خطتي — إزالة', 'Project in plan — remove')}` : `＋ ${t('أضف المشروع إلى خطتي', 'Add project to my plan')}`}</Text></Pressable></View>)}
                        <Text style={[styles.skillName, en && styles.ltr]}>{t('الشهادة المهنية', 'Professional certification')}</Text>
                        <Text style={[styles.note, en && styles.ltr]}>{roleCertifications.length ? t('اختيارية ومساندة. اختاري واحدة مرتبطة بالأداة أو البيئة التي تستهدفينها؛ لا يلزم جمعها كلها.', 'Optional support. Choose one related to the tools or environment you are targeting; you do not need all of them.') : t('لا توجد شهادة مهنية عامة ذات أولوية لهذا المسمى في مرحلة الخريج؛ المشروع العملي أقوى.', 'No general certification is a priority for this entry-level path; a practical project is stronger.')}</Text>
                        {roleProfile.sources.map(source => (
                            <Pressable key={source.url} accessibilityRole="link" onPress={() => void Linking.openURL(source.url)}>
                                <Text style={[styles.link, en && styles.ltr]}>{en ? source.labelEn : source.label}</Text>
                            </Pressable>
                        ))}
                        <Text style={[styles.note, en && styles.ltr]}>{t('هذه معلومات إرشادية عامة، وإعلان الوظيفة المستهدف هو المرجع النهائي. الشهادة والدليل العملي معلومات منفصلة، ولا يغيران نسبة تغطية المهارات الأساسية.', 'This is general guidance; the target job listing is the final reference. Certifications and project evidence are separate from core skill coverage.')}</Text>
                    </DisclosureCard>
                ) : null}

                {(['core', 'additional'] as const).map((priority) => (
                    <DisclosureCard key={priority} title={priority === 'core' ? t('المهارات الأساسية', 'Core skills') : t('المهارات الإضافية', 'Additional skills')} subtitle={priority === 'core' ? t('المهارات المطلوبة في المسار', 'Skills required for this path') : t('مهارات توسّع فرص التعلم', 'Skills that broaden learning options')} summary={`${requirements.filter(item => item.priority === priority).length} ${t('مهارات', 'skills')}`} status={priority === 'core' ? t('الأولوية', 'Priority') : t('اختياري', 'Optional')} statusTone={priority === 'core' ? 'warning' : 'neutral'}>

                        {requirements
                            .filter((item) => item.priority === priority)
                            .map((item) => {
                                const skill = dataset.skills.find(
                                    (entry) => entry.skill_id === item.skill_id
                                );

                                return (
                                    <View key={item.skill_id} style={styles.card}>
                                        <Text style={[styles.skillName, en && styles.ltr]}>{en ? item.name : displaySkillName(item.name)}</Text>
                                        <Text style={[styles.note, en && styles.ltr]}>{priority === 'core' && 'priority_rank' in item ? (item.priority_rank <= 2 ? t('أولوية مرتفعة في هذا المسمى', 'High priority for this role') : item.priority_rank <= 4 ? t('أولوية أساسية', 'Core priority') : t('أساسية بعد إتقان الأولويات الأعلى', 'Core after higher priorities')) : t('مهارة إضافية بعد الأساسيات', 'Additional skill after core skills')}</Text>
                                        <Text style={styles.note}>
                                            {!profileLoaded
                                                ? t('جارٍ تحميل ملف مهاراتك…', 'Loading your skill profile…')
                                                : profileError
                                                    ? profileError
                                                    : savedSkills === null
                                                        ? t('اعتمد سيرتك أو أضف مهاراتك من ملفك', 'Approve your CV or add skills in your profile')
                                                        : savedSkills.includes(item.skill_id)
                                                            ? cvSkills.has(item.skill_id) ? `✓ ${t('من سيرتك الذاتية المعتمدة', 'From your approved CV')}` : `✓ ${t('أضفتها يدويًا في ملفك', 'Added manually to your profile')}`
                                                            : t('لم تحددها في ملف مهاراتك', 'Not documented in your profile')}
                                        </Text>

                                        <Text style={styles.english}>
                                            {skill?.description ?? t('الوصف غير متوفر', 'Description unavailable')}
                                        </Text>
                                        {!savedSkills?.includes(item.skill_id) ? <Pressable accessibilityRole="button" disabled={!learningPlan.ready || learningPlan.busy} style={styles.certButton} onPress={() => void learningPlan.change(item.skill_id, !learningPlan.plan.includes(item.skill_id))}><Text style={styles.certButtonText}>{learningPlan.plan.includes(item.skill_id) ? `✓ ${t('المهارة في خطتي — إزالة', 'Skill in plan — remove')}` : `＋ ${t('أضف المهارة إلى خطة تعلمي', 'Add skill to learning plan')}`}</Text></Pressable> : null}
                                        <Pressable
                                            accessibilityRole="link"
                                            onPress={() => {
                                                Linking.openURL(item.evidence_url).catch(
                                                    () => { }
                                                );
                                            }}
                                        >
                                            <Text style={[styles.link, en && styles.ltr]}>{t('المصدر المهني', 'Career source')}</Text>
                                        </Pressable>
                                    </View>
                                );
                            })}
                    </DisclosureCard>
                ))}

                <DisclosureCard title={t('مصادر وتفسير المهارات', 'Skill sources and method')} subtitle={t('من أين جاءت المتطلبات؟', 'Where do these requirements come from?')} summary={t('تعريف مختصر لمصادر البيانات وطريقة التقدير', 'Brief explanation of the sources and scoring method')}>
                    <Text style={[styles.note, en && styles.ltr]}>
                        {t('أسماء المهارات وأوصافها من إطار المهارات السعودي. ربطها بهذه الوظيفة تفسير للمصادر المهنية المكملة، وليس ربطًا رسميًا. تصنيف الأساسية والإضافية قرار لنسخة مسارك التجريبية، ولا يحدد مستوى إتقان مطلوبًا.', 'Skill names and descriptions come from the Saudi Skills Framework. Their mapping to this career is an interpretation of supplementary career sources, not an official mapping. Core and additional labels are prototype classifications, not proficiency standards.')}
                    </Text>
                    <Text style={[styles.note, en && styles.ltr]}>
                        {t('المهارات الإضافية لا تدخل في نسبة التغطية. الأوصاف الإنجليزية معروضة كما وردت في البيانات.', 'Additional skills are excluded from coverage. English descriptions are shown as provided in the dataset.')}
                    </Text>
                </DisclosureCard>
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
        paddingHorizontal: 22,
        paddingTop: 10,
        gap: 15,
        paddingBottom: 44,
    },
    topBar: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
    backButton: { minHeight: 44, flexDirection: 'row-reverse', alignItems: 'center', gap: 11 },
    topBarTitle: { color: colors.ink, fontSize: 17, fontWeight: '700' },
    topBarMore: { color: colors.muted, fontSize: 25, lineHeight: 28, letterSpacing: 2 },
    eyebrow: { color: colors.primary, fontSize: 12, fontWeight: '800', letterSpacing: 0.6, textAlign: 'right', marginTop: 2 },
    title: {
        color: colors.navy,
        fontSize: 34,
        lineHeight: 42,
        fontWeight: '700',
        textAlign: 'right',
    },
    heroDescription: { color: colors.muted, fontSize: 18, lineHeight: 26, textAlign: 'right', marginTop: -8 },
    tasksSection: { gap: 12, paddingTop: 2, paddingBottom: 2 },
    sectionHeading: { color: colors.navy, fontSize: 21, lineHeight: 29, fontWeight: '700', textAlign: 'right' },
    taskRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, minHeight: 27 },
    taskText: { flex: 1, color: colors.ink, fontSize: 15, lineHeight: 23, textAlign: 'right' },
    heading: {
        color: colors.ink,
        fontSize: 21,
        fontWeight: '700',
        textAlign: 'right',
    },
    section: { gap: 14 },
    card: {
        backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
        padding: 20,
        borderRadius: 16,
        gap: 12,
    },
    skillName: {
        color: colors.ink,
        fontSize: 18,
        fontWeight: '600',
    },
    english: {
        color: colors.muted,
        fontSize: 15,
        lineHeight: 25,
    },
    link: {
        color: colors.primary,
        fontSize: 17,
        textAlign: 'right',
        paddingVertical: 8,
    },
    note: {
        color: colors.muted,
        fontSize: 15,
        lineHeight: 27,
        textAlign: 'right',
    },
    breakdown: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
    scorePanel: { minHeight: 96, backgroundColor: colors.contrastPanel, borderRadius: 18, padding: 16, alignItems: 'center', justifyContent: 'center' },
    scoreMetric: { alignItems: 'center', gap: 4 },
    scoreNumber: { color: colors.contrastOnPanel, fontSize: 34, lineHeight: 40, fontWeight: '800', textAlign: 'center' },
    scoreLabel: { color: colors.contrastOnPanel, opacity: 0.78, fontSize: 10, lineHeight: 15, fontWeight: '600', letterSpacing: 0.5, textAlign: 'center' },
    fitSection: { gap: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 17, paddingHorizontal: 16, paddingVertical: 12 },
    fitHeader: { minHeight: 44, flexDirection: 'row-reverse', alignItems: 'center', gap: 9 },
    infoButton: { padding: 2, opacity: 0.68 },
    infoPressed: { opacity: 0.42 },
    fitDetails: { gap: 9, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 11 },
    fitTitle: { color: colors.ink, fontSize: 15, lineHeight: 22, fontWeight: '700', textAlign: 'right' },
    tagsRow: { flexDirection: 'row-reverse', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
    tag: { backgroundColor: colors.mint, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7 },
    tagText: { color: colors.primary, fontSize: 12, lineHeight: 18, fontWeight: '600' },
    points: { color: colors.primary, fontSize: 15, fontWeight: '700' },
    track: { height: 5, borderRadius: 3, backgroundColor: colors.track, overflow: 'hidden', marginTop: 5 },
    trackFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 3 },
    certificate: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 16, gap: 7 },
    gapSummary: { flexDirection: 'row-reverse', alignItems: 'stretch', justifyContent: 'space-between', gap: 12, backgroundColor: colors.mint, borderRadius: 15, padding: 14 },
    gapSummaryItem: { flex: 1, gap: 4 },
    gapSummaryNumber: { color: colors.primary, fontSize: 20, lineHeight: 26, fontWeight: '800', textAlign: 'right' },
    gapChipList: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
    gapChip: { backgroundColor: colors.mint, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 },
    gapChipText: { color: colors.primary, fontSize: 14, lineHeight: 20, fontWeight: '600', textAlign: 'right' },
    gapSkillCard: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 13, padding: 10, gap: 12, minHeight: 54 },
    gapSkillHeading: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10 },
    rowLtr: { flexDirection: 'row' },
    gapCheck: { color: colors.primary, fontSize: 18, fontWeight: '800' },
    gapPlus: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.mint, color: colors.primary, textAlign: 'center', textAlignVertical: 'center', fontSize: 18, fontWeight: '700', overflow: 'hidden' },
    gapSkillName: { color: colors.ink, fontSize: 15, fontWeight: '700', textAlign: 'right' },
    gapSkillMeta: { color: colors.muted, fontSize: 13, lineHeight: 20, textAlign: 'right' },
    gapPlanButton: { borderWidth: 1, borderColor: colors.primary, borderRadius: 12, padding: 10, minHeight: 42, justifyContent: 'center' },
    skillPill: { borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.soft, paddingHorizontal: 12, paddingVertical: 8, maxWidth: '58%' },
    skillPillText: { color: colors.primary, fontSize: 14, lineHeight: 20, fontWeight: '600' },
    primaryButton: { minHeight: 52, borderRadius: 14, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', padding: 14 },
    primaryButtonText: { color: colors.onPrimary, fontSize: 16, lineHeight: 23, fontWeight: '700', textAlign: 'center' },
    actionRow: { minHeight: 44, borderBottomWidth: 1, borderBottomColor: colors.border, justifyContent: 'center', paddingVertical: 8 },
    actionRowText: { color: colors.primary, fontSize: 15, fontWeight: '600', textAlign: 'right' },
    disabledButton: { opacity: 0.55 },
    certButton: { borderWidth: 1, borderColor: colors.primary, borderRadius: 12, padding: 12, minHeight: 46, justifyContent: 'center' },
    certButtonDone: { backgroundColor: colors.mint },
    certButtonText: { color: colors.primary, fontSize: 15, fontWeight: '600', textAlign: 'center' },
    ltr: { textAlign: 'left', writingDirection: 'ltr' },
}));
