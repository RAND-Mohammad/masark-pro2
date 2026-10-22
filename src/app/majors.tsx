import { useRouter } from 'expo-router';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { academicPrograms } from '../constants/academic-programs';
import { professionalCertifications } from '../constants/professional-certifications';
import { colors, ui } from '../constants/design';
import { useSkillProfile } from '../hooks/use-skill-profile';
import { jobPathForTitle } from '../constants/job-paths';

function BulletList({ items }: { items: string[] }) {
  return <View style={{ gap: 7 }}>{items.map(item => <Text key={item} style={ui.text}>• {item}</Text>)}</View>;
}

export default function MajorsScreen() {
  const router = useRouter();
  const { profile, ready } = useSkillProfile();
  const skillCount = profile?.skill_ids.length ?? 0;
  const experienceCount = profile?.cv?.experiences.length ?? 0;
  const projectCount = profile?.cv?.projects?.length ?? 0;
  const stage = experienceCount >= 2 || (skillCount >= 10 && projectCount >= 2) ? 'experienced' : experienceCount >= 1 || skillCount >= 4 || projectCount >= 1 ? 'developing' : 'beginner';
  const stageTitle = stage === 'experienced' ? 'لديك أدلة تؤهلك لمسارات أوسع' : stage === 'developing' ? 'أنت في مرحلة بناء الخبرة' : 'أنت في بداية المسار';
  const stageText = stage === 'experienced' ? 'يمكنك استكشاف المسميات التي تحتاج خبرة أقوى، مع مراجعة متطلبات كل إعلان.' : stage === 'developing' ? 'ركّز على إكمال المهارات الأساسية وإضافة مشروع أو تجربة عملية مرتبطة بهدفك.' : 'ابدأ بالمسميات المناسبة للبداية، ثم استخدم خطة التعلم لبناء المهارات والمشاريع المطلوبة.';
  return <SafeAreaView edges={['top', 'left', 'right']} style={ui.screen}><ScrollView contentContainerStyle={ui.content}>
    <Text style={ui.eyebrow}>تخصصات الحاسب</Text><Text style={ui.title}>من التخصص إلى الوظيفة</Text>
    <Text style={ui.text}>المسميات الوظيفية بالإنجليزية كما تظهر عادة في الإعلانات. التصنيف تقدير إرشادي؛ وجود كلمة Engineer لا يعني أن الوظيفة متقدمة دائمًا.</Text>
    <View style={[ui.card, { backgroundColor: colors.mint }]}>
      <Text style={ui.eyebrow}>تقدير مرحلتك من ملفك</Text><Text style={ui.heading}>{ready ? stageTitle : 'جارٍ قراءة ملفك…'}</Text>
      {ready && <><Text style={ui.text}>{stageText}</Text><Text style={ui.note}>اعتمدنا على {skillCount} مهارة معتمدة، {projectCount} مشروع، و{experienceCount} خبرة في سيرتك. هذا توجيه تعليمي وليس حكم توظيف.</Text>
      {stage !== 'experienced' && <Pressable accessibilityRole="button" style={ui.button} onPress={() => router.push('/learning-plan')}><Text style={ui.buttonText}>فتح خطة التعلم المناسبة لي</Text></Pressable>}</>}
    </View>
    <View style={ui.card}><Text style={ui.heading}>معنى العلامات</Text><Text style={ui.text}>● مناسب للبداية: يمكن استهدافه بعد الأساسيات ومشاريع جيدة.</Text><Text style={ui.text}>◆ يحتاج أساسًا أو خبرة أقوى: غالبًا يتطلب نطاق مهارات أوسع أو خبرة عملية، وقد توجد وظائف Junior منه.</Text></View>
    {academicPrograms.map(program => {
      const certifications = program.recommendedCertificationIds.map(id => professionalCertifications.find(item => item.id === id)).filter((item): item is NonNullable<typeof item> => !!item);
      return <View key={program.id} style={ui.card}>
        <Text style={ui.eyebrow}>{program.englishTitle}</Text><Text style={ui.heading}>{program.title}</Text><Text style={styles.degree}>{program.degree}</Text><Text style={ui.text}>{program.summary}</Text>
        <Text style={styles.section}>Common Job Titles</Text>
        <View style={styles.jobs}>{program.commonTitles.map(job => { const path = jobPathForTitle(job.title); return <Pressable accessibilityRole="button" key={job.title} style={[styles.job, job.stage === 'experienced' && styles.jobExperienced]} onPress={() => path && router.push(`/career?id=${path.id}`)}><Text style={styles.jobTitle}>{job.stage === 'entry' ? '●' : '◆'} {job.title}</Text><Text style={ui.note}>{job.stage === 'entry' ? 'مناسب للبداية — افتح الجاهزية' : 'يحتاج أساسًا أو خبرة أقوى — افتح الجاهزية'}</Text></Pressable>; })}</View>
        <Text style={styles.section}>المهارات الأساسية</Text><BulletList items={program.academicSkills} />
        <Text style={styles.section}>أفكار لبناء الخبرة</Text><BulletList items={program.portfolioIdeas} />
        <Text style={styles.section}>شهادات احترافية اختيارية</Text>
        {certifications.map(certificate => <View key={certificate.id} style={styles.certificate}><Text style={styles.certificateTitle}>{certificate.title}</Text><Text style={ui.text}>{certificate.provider} · {certificate.level}</Text><Text style={styles.cost}>{certificate.cost}</Text><Text style={ui.note}>{certificate.note}</Text><Pressable accessibilityRole="link" onPress={() => void Linking.openURL(certificate.url)}><Text style={ui.link}>فتح الصفحة الرسمية</Text></Pressable></View>)}
        <Text style={styles.section}>المراجع</Text>{program.sources.map(source => <Pressable key={source.url} accessibilityRole="link" onPress={() => void Linking.openURL(source.url)}><Text style={ui.link}>{source.label}</Text></Pressable>)}
      </View>;
    })}
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  degree: { color: colors.primary, fontSize: 15, fontWeight: '600', textAlign: 'right' },
  section: { color: colors.ink, fontSize: 17, lineHeight: 26, fontWeight: '600', textAlign: 'right', marginTop: 7 },
  jobs: { gap: 8 }, job: { backgroundColor: colors.mint, borderRadius: 14, padding: 12 }, jobExperienced: { backgroundColor: colors.soft, borderWidth: 1, borderColor: colors.border },
  jobTitle: { color: colors.ink, fontSize: 15, fontWeight: '600', textAlign: 'right' },
  certificate: { backgroundColor: colors.soft, borderRadius: 16, padding: 15, gap: 4 }, certificateTitle: { color: colors.ink, fontSize: 15, fontWeight: '600', textAlign: 'right' }, cost: { color: colors.error, fontSize: 12, lineHeight: 20, textAlign: 'right' },
});
