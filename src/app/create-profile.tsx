import { useCallback, useRef, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, ui } from '../constants/design';
import { StudentResumePreview } from '../components/student-resume-preview';
import { answersFromPersonal, buildStudentProfile, emptyStudentAnswers, loadStudentBase, saveStudentProfile, validateStudentAnswers, type StudentAnswers, type StudentBase } from '../utils/student-profile';
import { ResumeExportButton } from '../components/resume-export-button';
import dataset from '../masarak_dataset.json';
import { useAppPreferences } from '../contexts/app-preferences-context';

const stepsAr = ['التعليم', 'المهارات والاهتمامات', 'المشاريع', 'الدورات', 'الخبرة الاختيارية', 'المراجعة النهائية'];
const stepsEn = ['Education', 'Skills and interests', 'Projects', 'Courses', 'Optional experience', 'Final review'];
const fieldNames: Record<string, string> = { name: 'الاسم', institution: 'جهة التعليم', education: 'المؤهل', major: 'التخصص', studyDates: 'تواريخ الدراسة', studyStatus: 'حالة الدراسة' };
const fieldNamesEn: Record<string, string> = { name: 'Name', institution: 'Educational institution', education: 'Qualification', major: 'Major', studyDates: 'Study dates', studyStatus: 'Study status' };
const studentErrorsEn: Record<string, string> = {
  'أكمل جهة التعليم والمؤهل والتخصص وسنة التخرج المتوقعة.': 'Enter your institution, qualification, major, and expected graduation year.',
  'أدخل سنة التخرج المتوقعة بأربعة أرقام، مثل 2027.': 'Enter the expected graduation year using four digits, for example 2027.',
  'الحد الأقصى للحقل 300 حرف.': 'Each field can contain up to 300 characters.',
  'اذكر مهارة واحدة على الأقل؛ لا تحتاج إلى خبرة عمل.': 'Add at least one skill. Work experience is not required.',
  'اكتب حتى 80 مهارة، وبحد أقصى 100 حرف للمهارة.': 'Enter up to 80 skills, with a maximum of 100 characters per skill.',
  'اكتب حتى 30 اهتمامًا، وبحد أقصى 100 حرف للاهتمام.': 'Enter up to 30 interests, with a maximum of 100 characters per interest.',
  'يمكن إضافة حتى 20 بندًا في كل قسم.': 'You can add up to 20 items in each section.',
  'الحد الأقصى للنص في البند 2000 حرف.': 'Each item can contain up to 2,000 characters.',
  'أضف اسم المشروع أو احذف البند الفارغ.': 'Enter a project name or remove the empty item.',
  'أضف اسم الدورة أو احذف البند الفارغ.': 'Enter a course name or remove the empty item.',
  'أضف مسمى الخبرة أو احذف البند؛ الخبرة اختيارية.': 'Enter an experience title or remove the empty item. Experience is optional.',
  'تجاوز مجموع البنود الحد المتاح. لم تُحذف أو تُستبدل بياناتك؛ راجع البنود قبل الحفظ.': 'The total number of items exceeds the limit. Existing data was not deleted or replaced; review the items before saving.',
  'تغيّر ملفك أثناء الإجابة. لم نحفظ فوقه؛ أعد فتح المسار لمراجعة أحدث بياناتك.': 'Your profile changed while you were answering. We did not overwrite it. Reopen this flow to review the latest data.',
};
const ltr = { textAlign: 'left' as const, writingDirection: 'ltr' as const };
export default function CreateProfileScreen() {
  const router = useRouter();
  const { language } = useAppPreferences();
  const en = language === 'en';
  const steps = en ? stepsEn : stepsAr;
  const localize = (value: string) => en ? studentErrorsEn[value] ?? value : value;
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
    }).catch(() => { if (active) setError(en ? 'Could not load your current profile. Reopen this page; unreadable data will not be replaced.' : 'تعذر تحميل الملف الحالي. أعد فتح الصفحة؛ لن نستبدل بيانات تعذر قراءتها.'); });
    return () => { active = false; };
  }, [en]));
  function change<K extends keyof StudentAnswers>(key: K, value: StudentAnswers[K]) {
    if (busy) return;
    setAnswers(old => ({ ...old, [key]: value })); setError('');
  }
  function input(label: string, value: string, onChangeText: (v: string) => void, placeholder = '', multiline = false, maxLength = 300) {
    return <View style={{ gap: 6 }} key={label}><Text style={[ui.text, en && ltr]}>{label}</Text>
      <TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText} placeholder={placeholder}
        editable={!busy} maxLength={maxLength} multiline={multiline}
        style={[ui.input, en && ltr, multiline && { minHeight: 84, textAlignVertical: 'top' }]} /></View>;
  }
  function button(label: string, action: () => void, outline = false) {
    return <Pressable accessibilityRole="button" disabled={busy} onPress={action} style={outline ? ui.outline : ui.button}>
      <Text style={outline ? ui.outlineText : ui.buttonText}>{label}</Text></Pressable>;
  }
  function next() {
    const problem = step === 0
      ? validateStudentAnswers({ ...answers, skills: 'validation-only', projects: [], courses: [], experiences: [], interests: '' })
      : step === 1 ? validateStudentAnswers({ ...answers, projects: [], courses: [], experiences: [] })
      : step === 2 && answers.projects.some(p => !p.name.trim()) ? localize('أضف اسم المشروع أو احذف البند الفارغ.')
          : step === 3 && answers.courses.some(c => !c.name.trim()) ? localize('أضف اسم الدورة أو احذف البند الفارغ.')
            : step === 4 ? validateStudentAnswers(answers) : '';
    if (problem) { setError(localize(problem)); return; }
    setError(''); setStep(v => Math.min(v + 1, 5));
  }
  async function save() {
    if (!base || locked.current) return;
    locked.current = true; setBusy(true); setError('');
    try { const result = await saveStudentProfile(answers, base); base.scope.assertCurrent(); setSaved(result); }
    catch (failure) { setError(failure instanceof Error ? localize(failure.message) : en ? 'Could not save. Try again.' : 'تعذر الحفظ. أعد المحاولة.'); }
    finally { locked.current = false; setBusy(false); }
  }
  let preview: ReturnType<typeof buildStudentProfile> | null = saved;
  if (!preview && base && step === 5) {
    try { preview = buildStudentProfile(answers, base); } catch { /* Validation message shown below; saving remains disabled. */ }
  }
  return <SafeAreaView edges={['top', 'left', 'right']} style={ui.screen}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={ui.content}>
    <Text style={[ui.eyebrow, en && ltr]}>{en ? 'No CV or work experience is required to begin' : 'لا تحتاج إلى سيرة أو خبرة عمل لتبدأ'}</Text>
    <Text style={[ui.title, en && ltr]}>{en ? 'Build your profile with a few answers' : 'أنشئ ملفك بإجابات قصيرة'}</Text>
    <Text style={[ui.text, en && ltr]}>{en ? 'Create a starter profile from your answers, without AI or file upload. Review everything before saving.' : 'ملف أولي من أجوبتك، دون ذكاء اصطناعي أو رفع ملف. يمكنك تعديل الإجابات قبل اعتمادها.'}</Text>
    {error ? <Text accessibilityRole="alert" style={[ui.text, en && ltr, { color: colors.error }]}>{error}</Text> : null}
    {!base ? <Text style={[ui.note, en && ltr]}>{en ? 'Loading your current profile…' : 'جارٍ تحميل ملفك الحالي…'}</Text> : saved ? <>
      <Text accessibilityRole="alert" style={[ui.heading, en && ltr]}>{en ? 'Your profile was saved on this device' : 'تم حفظ ملفك على هذا الجهاز'}</Text>
      <Text style={[ui.note, en && ltr]}>{en ? 'Check your profile for data sync settings and status.' : 'راجعي «ملفي» لمعرفة إعدادات مزامنة البيانات وحالتها.'}</Text>
    </> : <View style={{ gap: 8 }}>
      <Text accessibilityRole="header" style={[ui.heading, en && ltr]}>{steps[step]}</Text>
      <View accessibilityRole="progressbar" accessibilityLabel={en ? 'Profile setup progress' : 'تقدم إنشاء الملف'} accessibilityValue={{ min: 0, max: steps.length, now: step + 1, text: en ? `${step + 1} of ${steps.length}` : `${step + 1} من ${steps.length}` }} style={{ height: 9, borderRadius: 99, backgroundColor: colors.soft, overflow: 'hidden' }}>
        <View style={{ width: `${((step + 1) / steps.length) * 100}%`, height: '100%', alignSelf: en ? 'flex-start' : 'flex-end', backgroundColor: colors.primary, borderRadius: 99 }} />
      </View>
      <Text style={[ui.note, en && ltr]}>{en ? `Step ${step + 1} of ${steps.length}` : `الخطوة ${step + 1} من ${steps.length}`}</Text>
    </View>}
    {base && !saved && <View style={ui.card}>
      {step === 0 && <>
        {input(en ? 'Name (optional)' : 'الاسم (اختياري)', answers.name, v => change('name', v))}
        {input(en ? 'University or educational institution' : 'الجامعة أو جهة التعليم', answers.institution, v => change('institution', v), en ? 'For example: Northfield University' : 'مثال: جامعة الاختبار')}
        {input(en ? 'Qualification' : 'المؤهل الدراسي', answers.degree, v => change('degree', v), 'Bachelor of Science')}
        {input(en ? 'Major' : 'التخصص', answers.major, v => change('major', v), 'Computer Science')}
        {input(en ? 'Expected graduation year' : 'سنة التخرج المتوقعة', answers.graduation, v => change('graduation', v), '2027')}
        <Text style={[ui.note, en && ltr]}>{en ? 'This is your expected year; it does not mean you have graduated.' : 'هذه سنة متوقعة كما أدخلتها؛ لا تعني أنك تخرجت بالفعل.'}</Text>
      </>}
      {step === 1 && <>
        {input(en ? 'Which skills do you have?' : 'ما المهارات التي لديك؟', answers.skills, v => change('skills', v), en ? 'Python, SQL — separate with commas or new lines' : 'Python، SQL — افصل بفاصلة أو سطر جديد', true, 8000)}
        {input(en ? 'What fields interest you? (optional)' : 'ما المجالات التي تهمك؟ (اختياري)', answers.interests, v => change('interests', v), en ? 'Data analysis, web development' : 'تحليل البيانات، تطوير الويب', true, 3000)}
        <Text style={[ui.note, en && ltr]}>{en ? 'Skills matched to Masarak’s catalog are included in current calculations. Interests are saved to your profile but do not currently change recommendation weights.' : 'المهارات المطابقة لقاموس مسارك تدخل في الحسابات الحالية. الاهتمامات تُحفظ في الملف ولا تغيّر أوزان التوصيات الحالية.'}</Text>
      </>}
      {step === 2 && <>
        <Text style={[ui.text, en && ltr]}>{en ? 'Do you have an academic or personal project? You can continue without one.' : 'هل لديك مشروع دراسي أو شخصي؟ يمكنك المتابعة بدونه.'}</Text>
        {answers.projects.map((p, i) => <View key={i} style={ui.card}>
          {input(en ? `Project name ${i + 1}` : `اسم المشروع ${i + 1}`, p.name, v => change('projects', answers.projects.map((r, n) => n === i ? { ...r, name: v } : r)))}
          {input(en ? `What did you build in project ${i + 1}?` : `ماذا نفذت في المشروع ${i + 1}؟`, p.description, v => change('projects', answers.projects.map((r, n) => n === i ? { ...r, description: v } : r)), en ? 'Describe what you actually did' : 'اذكر ما عملت عليه فعلًا', true, 2000)}
          {input(en ? `Project technologies ${i + 1} (optional)` : `تقنيات المشروع ${i + 1} (اختياري)`, p.technologies, v => change('projects', answers.projects.map((r, n) => n === i ? { ...r, technologies: v } : r)), 'Python, SQL')}
          {button(en ? `Remove project ${i + 1}` : `حذف المشروع ${i + 1}`, () => change('projects', answers.projects.filter((_, n) => n !== i)), true)}
        </View>)}
        {answers.projects.length < 20 && button(en ? 'Add project' : 'إضافة مشروع', () => change('projects', [...answers.projects, { name: '', description: '', technologies: '' }]), true)}
      </>}
      {step === 3 && <>
        <Text style={[ui.text, en && ltr]}>{en ? 'Which courses have you taken? Leave this section empty if you have none. Listing a course does not prove certification or mastery.' : 'ما الدورات التي درستها؟ اترك القسم فارغًا إن لم توجد. ذكر الدورة لا يثبت شهادة أو إتقانًا تلقائيًا.'}</Text>
        {answers.courses.map((c, i) => <View key={i} style={ui.card}>
          {input(en ? `Course name ${i + 1}` : `اسم الدورة ${i + 1}`, c.name, v => change('courses', answers.courses.map((r, n) => n === i ? { ...r, name: v } : r)))}
          {input(en ? `Course provider ${i + 1} (optional)` : `جهة الدورة ${i + 1} (اختياري)`, c.issuer, v => change('courses', answers.courses.map((r, n) => n === i ? { ...r, issuer: v } : r)))}
          {button(en ? `Remove course ${i + 1}` : `حذف الدورة ${i + 1}`, () => change('courses', answers.courses.filter((_, n) => n !== i)), true)}
        </View>)}
        {answers.courses.length < 20 && button(en ? 'Add course' : 'إضافة دورة', () => change('courses', [...answers.courses, { name: '', issuer: '' }]), true)}
      </>}
      {step === 4 && <>
        <Text style={[ui.text, en && ltr]}>{en ? 'Experience is completely optional. If you have not worked yet, continue without adding anything.' : 'الخبرة اختيارية تمامًا. إن لم تعمل بعد، اضغط «متابعة» دون إضافة أي شيء.'}</Text>
        {answers.experiences.map((e, i) => <View key={i} style={ui.card}>
          {input(en ? `Experience title ${i + 1}` : `مسمى الخبرة ${i + 1}`, e.role, v => change('experiences', answers.experiences.map((r, n) => n === i ? { ...r, role: v } : r)))}
          {input(en ? `Organization ${i + 1} (optional)` : `جهة الخبرة ${i + 1} (اختياري)`, e.organization, v => change('experiences', answers.experiences.map((r, n) => n === i ? { ...r, organization: v } : r)))}
          {input(en ? `Responsibilities ${i + 1} (optional)` : `مهام الخبرة ${i + 1} (اختياري)`, e.description, v => change('experiences', answers.experiences.map((r, n) => n === i ? { ...r, description: v } : r)), '', true, 2000)}
          {button(en ? `Remove experience ${i + 1}` : `حذف الخبرة ${i + 1}`, () => change('experiences', answers.experiences.filter((_, n) => n !== i)), true)}
        </View>)}
        {answers.experiences.length < 20 && button(en ? 'Add optional experience' : 'إضافة خبرة اختيارية', () => change('experiences', [...answers.experiences, { role: '', organization: '', description: '' }]), true)}
      </>}
      {step === 5 && <>
        <Text style={[ui.text, en && ltr]}>{en ? 'Review the preview, then save. No CV will be uploaded and no content will be sent to an AI provider.' : 'راجع المعاينة أدناه ثم اعتمد الحفظ. لن تُرفع سيرة ولن يُرسل محتوى إلى أي مزود AI.'}</Text>
        <Text style={[ui.note, en && ltr]}>{en ? 'New items are added while existing data is kept. If an item has the same name and context, its previous record is preserved in full. Edit existing information from My Profile or CV Review.' : 'نضيف البنود الجديدة ونُبقي البيانات السابقة. عند تطابق اسم وسياق بند، نحتفظ بالبند السابق كاملًا. لتغيير بند موجود استخدم تحرير «ملفي» أو مراجعة السيرة.'}</Text>
        {preview?.keptFields.length ? <Text style={[ui.note, en && ltr]}>{en ? `These different existing fields were preserved: ${preview.keptFields.map(k => fieldNamesEn[k] ?? k).join(', ')}. Your new education answer is also saved as an education item.` : `احتُفظ بهذه الحقول السابقة المختلفة: ${preview.keptFields.map(k => fieldNames[k] ?? k).join('، ')}. إجابة التعليم الجديدة محفوظة أيضًا كبند تعليم ضمن الملف.`}</Text> : null}
        {preview?.unmappedSkills.length ? <Text style={[ui.note, en && ltr]}>{en ? `These skills were saved as text but are not counted in the current catalog: ${preview.unmappedSkills.join(', ')}.` : `مهارات محفوظة نصيًا لكنها لا تُحتسب في القاموس الحالي: ${preview.unmappedSkills.join('، ')}.`}</Text> : null}
        {validateStudentAnswers(answers) ? <Text style={[ui.text, en && ltr]}>{localize(validateStudentAnswers(answers))}</Text> : null}
      </>}
      {step > 0 && button(en ? 'Previous: edit answers' : 'السابق وتعديل الإجابات', () => { setStep(v => v - 1); setError(''); }, true)}
      {step < 5 ? button(en ? 'Continue' : 'متابعة', next) : preview && <Pressable accessibilityRole="button" disabled={busy} onPress={() => void save()} style={ui.button}><Text style={ui.buttonText}>{busy ? en ? 'Saving…' : 'جارٍ الحفظ…' : en ? 'Approve and save profile' : 'اعتماد وحفظ الملف'}</Text></Pressable>}
    </View>}
    {preview && <StudentResumePreview personal={preview.personal} skills={preview.skills} />}
    {saved && <>
      {button(en ? 'Explore recommendations and skill gaps' : 'استكشاف توصياتي وفجوات المهارات', () => router.push('/careers'))}
      {button(en ? 'Open My Profile and cloud sync' : 'فتح ملفي والحفظ السحابي', () => router.push('/profile'), true)}
      <ResumeExportButton personal={saved.personal} skills={saved.skills} assertCurrent={base!.scope.assertCurrent} />
    </>}
    {button(en ? 'Return to My Profile' : 'العودة إلى ملفي دون حفظ جديد', () => router.push('/profile'), true)}
  </ScrollView></SafeAreaView>;
}
