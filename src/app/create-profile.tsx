import { useCallback, useRef, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, ui } from '../constants/design';
import { StudentResumePreview } from '../components/student-resume-preview';
import { answersFromPersonal, buildStudentProfile, emptyStudentAnswers, loadStudentBase, saveStudentProfile, validateStudentAnswers, type StudentAnswers, type StudentBase } from '../utils/student-profile';
import { ResumeExportButton } from '../components/resume-export-button';
import dataset from '../masarak_dataset.json';

const steps = ['التعليم', 'المهارات والاهتمامات', 'المشاريع', 'الدورات', 'الخبرة الاختيارية', 'المراجعة النهائية'];
const fieldNames: Record<string, string> = { name: 'الاسم', institution: 'جهة التعليم', education: 'المؤهل', major: 'التخصص', studyDates: 'تواريخ الدراسة', studyStatus: 'حالة الدراسة' };
export default function CreateProfileScreen() {
  const router = useRouter();
  const [base, setBase] = useState<StudentBase | null>(null);
  const [answers, setAnswers] = useState<StudentAnswers>(emptyStudentAnswers);
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<ReturnType<typeof buildStudentProfile> | null>(null);
  const locked = useRef(false);
  useFocusEffect(useCallback(() => {
    let active = true;
    void loadStudentBase().then(value => {
      if (!active) return;
      setBase(value); setStep(0); setSaved(null); setError('');
      const existingNames = [...(value.skills?.cv?.skills.map(s => s.name) ?? []),
        ...dataset.skills.filter(s => value.skills?.manual_skill_ids.includes(s.skill_id)).map(s => s.name)];
      setAnswers({ ...answersFromPersonal(value.personal), skills: [...new Set(existingNames)].join('، ') });
    }).catch(() => { if (active) setError('تعذر تحميل الملف الحالي. أعد فتح الصفحة؛ لن نستبدل بيانات تعذر قراءتها.'); });
    return () => { active = false; };
  }, []));
  function change<K extends keyof StudentAnswers>(key: K, value: StudentAnswers[K]) {
    if (busy) return;
    setAnswers(old => ({ ...old, [key]: value })); setError('');
  }
  function input(label: string, value: string, onChangeText: (v: string) => void, placeholder = '', multiline = false, maxLength = 300) {
    return <View style={{ gap: 6 }} key={label}><Text style={ui.text}>{label}</Text>
      <TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText} placeholder={placeholder}
        editable={!busy} maxLength={maxLength} multiline={multiline}
        style={[ui.input, multiline && { minHeight: 84, textAlignVertical: 'top' }]} /></View>;
  }
  function button(label: string, action: () => void, outline = false) {
    return <Pressable accessibilityRole="button" disabled={busy} onPress={action} style={outline ? ui.outline : ui.button}>
      <Text style={outline ? ui.outlineText : ui.buttonText}>{label}</Text></Pressable>;
  }
  function next() {
    const problem = step === 0
      ? validateStudentAnswers({ ...answers, skills: 'validation-only', projects: [], courses: [], experiences: [], interests: '' })
      : step === 1 ? validateStudentAnswers({ ...answers, projects: [], courses: [], experiences: [] })
        : step === 2 && answers.projects.some(p => !p.name.trim()) ? 'أضف اسم المشروع أو احذف البند الفارغ.'
          : step === 3 && answers.courses.some(c => !c.name.trim()) ? 'أضف اسم الدورة أو احذف البند الفارغ.'
            : step === 4 ? validateStudentAnswers(answers) : '';
    if (problem) { setError(problem); return; }
    setError(''); setStep(v => Math.min(v + 1, 5));
  }
  async function save() {
    if (!base || locked.current) return;
    locked.current = true; setBusy(true); setError('');
    try { const result = await saveStudentProfile(answers, base); base.scope.assertCurrent(); setSaved(result); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'تعذر الحفظ. أعد المحاولة.'); }
    finally { locked.current = false; setBusy(false); }
  }
  let preview: ReturnType<typeof buildStudentProfile> | null = saved;
  if (!preview && base && step === 5) {
    try { preview = buildStudentProfile(answers, base); } catch { /* Validation message shown below; saving remains disabled. */ }
  }
  return <SafeAreaView edges={['top', 'left', 'right']} style={ui.screen}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={ui.content}>
    <Text style={ui.eyebrow}>لا تحتاج إلى سيرة أو خبرة عمل لتبدأ</Text>
    <Text style={ui.title}>أنشئ ملفك بإجابات قصيرة</Text>
    <Text style={ui.text}>ملف أولي من أجوبتك، دون ذكاء اصطناعي أو رفع ملف. يمكنك تعديل الإجابات قبل اعتمادها.</Text>
    {error ? <Text accessibilityRole="alert" style={[ui.text, { color: colors.error }]}>{error}</Text> : null}
    {!base ? <Text style={ui.note}>جارٍ تحميل ملفك الحالي…</Text> : saved ? <>
      <Text accessibilityRole="alert" style={ui.heading}>تم حفظ ملفك على هذا الجهاز</Text>
      <Text style={ui.note}>الحفظ السحابي يتبع خيار المزامنة الحالي في «ملفي»؛ هذه الرسالة لا تثبت اكتمال مزامنة Supabase.</Text>
    </> : <View style={{ gap: 8 }}>
      <Text accessibilityRole="header" style={ui.heading}>{steps[step]}</Text>
      <View accessibilityRole="progressbar" accessibilityLabel="تقدم إنشاء الملف" accessibilityValue={{ min: 0, max: steps.length, now: step + 1, text: `${step + 1} من ${steps.length}` }} style={{ height: 9, borderRadius: 99, backgroundColor: colors.soft, overflow: 'hidden' }}>
        <View style={{ width: `${((step + 1) / steps.length) * 100}%`, height: '100%', alignSelf: 'flex-end', backgroundColor: colors.primary, borderRadius: 99 }} />
      </View>
      <Text style={ui.note}>الخطوة {step + 1} من {steps.length}</Text>
    </View>}
    {base && !saved && <View style={ui.card}>
      {step === 0 && <>
        {input('الاسم (اختياري)', answers.name, v => change('name', v))}
        {input('الجامعة أو جهة التعليم', answers.institution, v => change('institution', v), 'مثال: جامعة الاختبار')}
        {input('المؤهل الدراسي', answers.degree, v => change('degree', v), 'مثال: Bachelor of Science')}
        {input('التخصص', answers.major, v => change('major', v), 'مثال: Computer Science')}
        {input('سنة التخرج المتوقعة', answers.graduation, v => change('graduation', v), '2027')}
        <Text style={ui.note}>هذه سنة متوقعة كما أدخلتها؛ لا تعني أنك تخرجت بالفعل.</Text>
      </>}
      {step === 1 && <>
        {input('ما المهارات التي لديك؟', answers.skills, v => change('skills', v), 'Python، SQL — افصل بفاصلة أو سطر جديد', true, 8000)}
        {input('ما المجالات التي تهمك؟ (اختياري)', answers.interests, v => change('interests', v), 'تحليل البيانات، تطوير الويب', true, 3000)}
        <Text style={ui.note}>المهارات المطابقة لقاموس مسارك تدخل في الحسابات الحالية. الاهتمامات تُحفظ في الملف ولا تغيّر أوزان التوصيات الحالية.</Text>
      </>}
      {step === 2 && <>
        <Text style={ui.text}>هل لديك مشروع دراسي أو شخصي؟ يمكنك المتابعة بدونه.</Text>
        {answers.projects.map((p, i) => <View key={i} style={ui.card}>
          {input(`اسم المشروع ${i + 1}`, p.name, v => change('projects', answers.projects.map((r, n) => n === i ? { ...r, name: v } : r)))}
          {input(`ماذا نفذت في المشروع ${i + 1}؟`, p.description, v => change('projects', answers.projects.map((r, n) => n === i ? { ...r, description: v } : r)), 'اذكر ما عملت عليه فعلًا', true, 2000)}
          {input(`تقنيات المشروع ${i + 1} (اختياري)`, p.technologies, v => change('projects', answers.projects.map((r, n) => n === i ? { ...r, technologies: v } : r)), 'Python، SQL')}
          {button(`حذف المشروع ${i + 1}`, () => change('projects', answers.projects.filter((_, n) => n !== i)), true)}
        </View>)}
        {answers.projects.length < 20 && button('إضافة مشروع', () => change('projects', [...answers.projects, { name: '', description: '', technologies: '' }]), true)}
      </>}
      {step === 3 && <>
        <Text style={ui.text}>ما الدورات التي درستها؟ اترك القسم فارغًا إن لم توجد. ذكر الدورة لا يثبت شهادة أو إتقانًا تلقائيًا.</Text>
        {answers.courses.map((c, i) => <View key={i} style={ui.card}>
          {input(`اسم الدورة ${i + 1}`, c.name, v => change('courses', answers.courses.map((r, n) => n === i ? { ...r, name: v } : r)))}
          {input(`جهة الدورة ${i + 1} (اختياري)`, c.issuer, v => change('courses', answers.courses.map((r, n) => n === i ? { ...r, issuer: v } : r)))}
          {button(`حذف الدورة ${i + 1}`, () => change('courses', answers.courses.filter((_, n) => n !== i)), true)}
        </View>)}
        {answers.courses.length < 20 && button('إضافة دورة', () => change('courses', [...answers.courses, { name: '', issuer: '' }]), true)}
      </>}
      {step === 4 && <>
        <Text style={ui.text}>الخبرة اختيارية تمامًا. إن لم تعمل بعد، اضغط «متابعة» دون إضافة أي شيء.</Text>
        {answers.experiences.map((e, i) => <View key={i} style={ui.card}>
          {input(`مسمى الخبرة ${i + 1}`, e.role, v => change('experiences', answers.experiences.map((r, n) => n === i ? { ...r, role: v } : r)))}
          {input(`جهة الخبرة ${i + 1} (اختياري)`, e.organization, v => change('experiences', answers.experiences.map((r, n) => n === i ? { ...r, organization: v } : r)))}
          {input(`مهام الخبرة ${i + 1} (اختياري)`, e.description, v => change('experiences', answers.experiences.map((r, n) => n === i ? { ...r, description: v } : r)), '', true, 2000)}
          {button(`حذف الخبرة ${i + 1}`, () => change('experiences', answers.experiences.filter((_, n) => n !== i)), true)}
        </View>)}
        {answers.experiences.length < 20 && button('إضافة خبرة اختيارية', () => change('experiences', [...answers.experiences, { role: '', organization: '', description: '' }]), true)}
      </>}
      {step === 5 && <>
        <Text style={ui.text}>راجع المعاينة أدناه ثم اعتمد الحفظ. لن تُرفع سيرة ولن يُرسل محتوى إلى أي مزود AI.</Text>
        <Text style={ui.note}>نضيف البنود الجديدة ونُبقي البيانات السابقة. عند تطابق اسم وسياق بند، نحتفظ بالبند السابق كاملًا. لتغيير بند موجود استخدم تحرير «ملفي» أو مراجعة السيرة.</Text>
        {preview?.keptFields.length ? <Text style={ui.note}>احتُفظ بهذه الحقول السابقة المختلفة: {preview.keptFields.map(k => fieldNames[k] ?? k).join('، ')}. إجابة التعليم الجديدة محفوظة أيضًا كبند تعليم ضمن الملف.</Text> : null}
        {preview?.unmappedSkills.length ? <Text style={ui.note}>مهارات محفوظة نصيًا لكنها لا تُحتسب في القاموس الحالي: {preview.unmappedSkills.join('، ')}.</Text> : null}
        {validateStudentAnswers(answers) ? <Text style={ui.text}>{validateStudentAnswers(answers)}</Text> : null}
      </>}
      {step > 0 && button('السابق وتعديل الإجابات', () => { setStep(v => v - 1); setError(''); }, true)}
      {step < 5 ? button('متابعة', next) : preview && <Pressable accessibilityRole="button" disabled={busy} onPress={() => void save()} style={ui.button}><Text style={ui.buttonText}>{busy ? 'جارٍ الحفظ…' : 'اعتماد وحفظ الملف'}</Text></Pressable>}
    </View>}
    {preview && <StudentResumePreview personal={preview.personal} skills={preview.skills} />}
    {saved && <>
      {button('استكشاف توصياتي وفجوات المهارات', () => router.push('/careers'))}
      {button('فتح ملفي والحفظ السحابي', () => router.push('/profile'), true)}
      <ResumeExportButton personal={saved.personal} skills={saved.skills} assertCurrent={base!.scope.assertCurrent} />
    </>}
    {button('العودة إلى ملفي دون حفظ جديد', () => router.push('/profile'), true)}
  </ScrollView></SafeAreaView>;
}
