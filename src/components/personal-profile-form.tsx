import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { colors, ui } from '../constants/design';
import { academicPrograms } from '../constants/academic-programs';
import { useAuth } from '../contexts/auth-context';
import { emptyPersonalProfile, readPersonalProfile, savePersonalProfile, type PersonalProfile } from '../utils/personal-profile';
import { readSkillProfile } from '../utils/skill-profile';
import { careerTitles } from '../utils/career-matches';
import { jobPaths } from '../constants/job-paths';
import { mergeCvEducation } from '../utils/profile-education';
import { DisclosureCard } from './disclosure-card';

const splitList = (text: string) => [...new Set(text.split(/[,،;؛\n]/).map(item => item.trim()).filter(Boolean))];
export function PersonalProfileForm() {
  const auth = useAuth();
  const accountName = typeof auth.session?.user.user_metadata?.display_name === 'string' ? auth.session.user.user_metadata.display_name.slice(0, 80) : '';
  const [profile, setProfile] = useState<PersonalProfile>(emptyPersonalProfile);
  const [interests, setInterests] = useState(''); const [traits, setTraits] = useState('');
  const [gpaText, setGpaText] = useState('');
  const [ready, setReady] = useState(false); const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState(''); const [error, setError] = useState('');
  const locked = useRef(false); const active = useRef(true);
  useFocusEffect(useCallback(() => {
    active.current = true; setReady(false);
    void readPersonalProfile().then(value => {
      if (!active.current) return;
      const initial = value ?? { ...emptyPersonalProfile(), name: accountName };
      setProfile(initial); setGpaText(initial.gpa === null ? '' : String(initial.gpa)); setInterests(initial.interests.join('، ')); setTraits(initial.traits.join('، ')); setError('');
    }).catch(() => { if (active.current) setError('تعذر قراءة الملف. أعد فتح الصفحة قبل تعديل بياناته.'); }).finally(() => { if (active.current) setReady(true); });
    return () => { active.current = false; };
  }, [accountName]));
  async function save() {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError(''); setMessage('');
    try {
      const lists = { interests: splitList(interests), traits: splitList(traits) };
      if (Object.values(lists).some(list => list.length > 30 || list.some(value => value.length > 100))) throw new Error('اكتب حتى 30 اهتمامًا أو سمة، وبحد 100 حرف لكل عنصر.');
      const normalizedGpa = gpaText.trim().replace(',', '.');
      const gpa = normalizedGpa ? Number(normalizedGpa) : null;
      if ((gpa !== null && (!profile.gpaScale || !Number.isFinite(gpa) || gpa < 0 || gpa > profile.gpaScale)) || (!normalizedGpa && profile.gpaScale !== null)) throw new Error(`أدخل معدلًا صحيحًا من 0 إلى ${profile.gpaScale ?? 5}، أو امسح المعدل واختر «بدون معدل».`);
      const value = await savePersonalProfile({ ...profile, gpa, ...lists });
      if (active.current) { setProfile(value); setEditing(false); setMessage('حُفظت بيانات ملفك على الجهاز. حالة الحفظ السحابي تظهر أدناه.'); }
    } catch (failure) { if (active.current) setError(failure instanceof Error && (failure.message.startsWith('اكتب') || failure.message.startsWith('أدخل معدلًا')) ? failure.message : 'تعذر حفظ الملف. بياناتك السابقة باقية؛ حاول مجددًا.'); }
    finally { locked.current = false; if (active.current) setBusy(false); }
  }
  async function importEducation() {
    setError('');
    try {
      const saved = await readSkillProfile(); const degree = saved?.cv?.education?.[0];
      if (!active.current) return;
      if (!degree) { setError('اعتمد معلومات التعليم من السيرة أولًا، أو أدخلها هنا.'); return; }
      setProfile(p => mergeCvEducation(p, degree));
      setMessage('نُقل أول مؤهل من سيرتك المعتمدة. راجع الحقول ثم احفظها.');
    } catch { if (active.current) setError('تعذر قراءة تعليم السيرة. يمكنك إدخاله يدويًا.'); }
  }
  const fields: { key: 'name' | 'institution' | 'college' | 'education' | 'studyStatus' | 'studyDates'; label: string; placeholder: string }[] = [
    { key: 'name', label: 'اسمك', placeholder: 'الاسم الذي يظهر في ملفك' },
    { key: 'institution', label: 'الجامعة أو الجهة التعليمية', placeholder: 'اسم الجهة' },
    { key: 'college', label: 'الكلية', placeholder: 'اسم الكلية كما ورد' },
    { key: 'education', label: 'المؤهل الدراسي', placeholder: 'مثل بكالوريوس علوم الحاسب' },
    { key: 'studyStatus', label: 'حالة الدراسة', placeholder: 'مثل أدرس حاليًا أو متخرج' },
    { key: 'studyDates', label: 'فترة الدراسة', placeholder: 'الفترة كما وردت في سيرتك' },
  ];
  const summary = [profile.major, profile.institution, profile.studyStatus || profile.education].filter(Boolean).join(' · ') || 'أضيفي تعليمك وبياناتك الأساسية عند استعدادك.';
  const hasProfileDetails = Boolean(profile.name || profile.institution || profile.education || profile.major);
  return <DisclosureCard title="ملفي الشخصي" subtitle="التعليم والاهتمامات" summary={ready ? summary : 'جارٍ تحميل الملف'} status={ready ? hasProfileDetails ? 'مضاف' : 'اختياري' : undefined} statusTone={hasProfileDetails ? 'success' : 'neutral'} actionLabel={ready && !editing ? 'تعديل' : undefined} onAction={() => { setMessage(''); setEditing(true); }}>
    {!ready ? <ActivityIndicator color={colors.primary} /> : editing ? <>
      <Text style={ui.note}>تخصصي الجامعي</Text>
      <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 }}>
        {academicPrograms.map(program => <Pressable key={program.id} disabled={busy} accessibilityRole="radio" accessibilityState={{ selected: profile.major === program.title }} style={[ui.outline, { minHeight: 44, padding: 11 }, profile.major === program.title && { backgroundColor: colors.mint }]} onPress={() => setProfile(p => ({ ...p, major: program.title, education: !p.education || academicPrograms.some(item => item.degree === p.education) ? program.degree : p.education }))}><Text style={[ui.outlineText, { fontSize: 14 }]}>{profile.major === program.title ? '✓ ' : ''}{program.title}</Text></Pressable>)}
      </View>
      <TextInput accessibilityLabel="تخصص آخر" maxLength={300} editable={!busy} style={ui.input} placeholderTextColor={colors.muted} placeholder="أو اكتب تخصصًا آخر" value={academicPrograms.some(program => program.title === profile.major) ? '' : profile.major} onChangeText={major => setProfile(p => ({ ...p, major }))} />
      {fields.map(field => <View key={field.key} style={{ gap: 7 }}><Text style={ui.note}>{field.label}</Text><TextInput accessibilityLabel={field.label} maxLength={field.key === 'name' ? 80 : 300} editable={!busy} style={ui.input} placeholderTextColor={colors.muted} placeholder={field.placeholder} value={profile[field.key]} onChangeText={value => setProfile(p => ({ ...p, [field.key]: value }))} /></View>)}
      <Text style={ui.note}>نظام المعدل التراكمي</Text>
      <View style={{ flexDirection: 'row-reverse', gap: 8 }}>
        {([5, 4] as const).map(scale => <Pressable key={scale} disabled={busy} accessibilityRole="radio" accessibilityState={{ selected: profile.gpaScale === scale }} style={[ui.outline, { flex: 1 }, profile.gpaScale === scale && { backgroundColor: colors.mint }]} onPress={() => setProfile(p => ({ ...p, gpaScale: scale }))}><Text style={ui.outlineText}>{profile.gpaScale === scale ? '✓ ' : ''}من {scale}</Text></Pressable>)}
        <Pressable disabled={busy} accessibilityRole="radio" accessibilityState={{ selected: profile.gpaScale === null }} style={[ui.outline, { flex: 1 }, profile.gpaScale === null && { backgroundColor: colors.mint }]} onPress={() => { setProfile(p => ({ ...p, gpa: null, gpaScale: null })); setGpaText(''); }}><Text style={ui.outlineText}>بدون معدل</Text></Pressable>
      </View>
      {profile.gpaScale !== null ? <><Text style={ui.note}>المعدل التراكمي من {profile.gpaScale}</Text><TextInput accessibilityLabel="المعدل التراكمي" keyboardType="decimal-pad" maxLength={5} editable={!busy} style={ui.input} placeholder={`مثال: ${profile.gpaScale === 5 ? '4.50' : '3.50'}`} placeholderTextColor={colors.muted} value={gpaText} onChangeText={setGpaText} /><Text style={ui.note}>أدخله بنفسك كما يظهر في سجلك. يُستخدم جزءًا محدودًا من الجاهزية ولا يُعرض كضمان توظيف.</Text></> : null}
      <Pressable disabled={busy} accessibilityRole="button" onPress={() => void importEducation()}><Text style={ui.link}>نسخ أول مؤهل من السيرة المعتمدة</Text></Pressable>
      <Text style={ui.note}>اهتماماتك — افصل بينها بفاصلة</Text><TextInput accessibilityLabel="اهتماماتي" editable={!busy} multiline maxLength={3100} style={ui.input} placeholder="مثل الأمن السيبراني، تطوير التطبيقات" placeholderTextColor={colors.muted} value={interests} onChangeText={setInterests} />
      <Text style={ui.note}>سماتك الشخصية — افصل بينها بفاصلة</Text><TextInput accessibilityLabel="سماتي الشخصية" editable={!busy} multiline maxLength={3100} style={ui.input} placeholder="مثل التحليل، التعاون، الفضول" placeholderTextColor={colors.muted} value={traits} onChangeText={setTraits} />
      <Text style={ui.note}>هدفك المهني اختياري؛ يمكنك استكشاف المسارات دون تحديده.</Text>
      {[{ id: null, title: 'لم أحدد هدفًا بعد' }, ...jobPaths.map(career => ({ id: career.id, title: career.title }))].map(career => <Pressable key={career.id ?? 'none'} disabled={busy} accessibilityRole="radio" accessibilityState={{ selected: profile.careerGoal === career.id }} style={[ui.outline, profile.careerGoal === career.id && { backgroundColor: colors.mint }]} onPress={() => setProfile(p => ({ ...p, careerGoal: career.id }))}><Text style={ui.outlineText}>{profile.careerGoal === career.id ? '✓ ' : ''}{career.title}</Text></Pressable>)}
      <Pressable disabled={busy} accessibilityRole="button" style={ui.button} onPress={() => void save()}><Text style={ui.buttonText}>{busy ? 'جارٍ الحفظ…' : 'حفظ بيانات الملف'}</Text></Pressable>
      <Pressable disabled={busy} accessibilityRole="button" onPress={() => setEditing(false)}><Text style={ui.link}>إغلاق التعديل دون حفظ</Text></Pressable>
    </> : <>
      <Text style={ui.text}>{[profile.name, profile.major, profile.institution, profile.education, profile.studyStatus, profile.studyDates].filter(Boolean).join(' · ') || 'أضف تعليمك واهتماماتك لبناء ملفك المهني.'}</Text>
      {profile.gpa !== null && profile.gpaScale !== null ? <Text style={ui.text}>المعدل التراكمي: {profile.gpa} من {profile.gpaScale}</Text> : null}
      {profile.interests.length > 0 && <Text style={ui.text}>اهتماماتي: {profile.interests.join('، ')}</Text>}
      {profile.traits.length > 0 && <Text style={ui.text}>سماتي: {profile.traits.join('، ')}</Text>}
      {!!profile.careerGoal && <Text style={ui.text}>هدفي: {careerTitles[profile.careerGoal]}</Text>}
      <Text style={ui.note}>المؤهل والمعدل يدخلان بوزن محدود في الجاهزية المركبة، ويظهر تفصيل الوزن داخل كل مسار.</Text>
    </>}
    {!!message && <Text style={ui.note}>{message}</Text>}
    {!!error && <Text accessibilityRole="alert" style={[ui.text, { color: colors.error }]}>{error}</Text>}
  </DisclosureCard>;
}
