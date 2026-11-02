import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { colors, ui, createAdaptiveStyles } from '../constants/design';
import { academicPrograms } from '../constants/academic-programs';
import { useAuth } from '../contexts/auth-context';
import { emptyPersonalProfile, readPersonalProfile, savePersonalProfile, type PersonalProfile } from '../utils/personal-profile';
import { readSkillProfile } from '../utils/skill-profile';
import { careerTitles } from '../utils/career-matches';
import { jobPaths } from '../constants/job-paths';
import { mergeCvEducation } from '../utils/profile-education';
import { DisclosureCard } from './disclosure-card';
import { useAppPreferences } from '../contexts/app-preferences-context';

const splitList = (text: string) => [...new Set(text.split(/[,،;؛\n]/).map(item => item.trim()).filter(Boolean))];
type PersonalProfileFormProps = { startEditing?: boolean; onEdit?: () => void; onSaved?: (profile: PersonalProfile) => void };
export function PersonalProfileForm({ startEditing = false, onEdit, onSaved }: PersonalProfileFormProps) {
  const auth = useAuth();
  const { language } = useAppPreferences();
  const en = language === 'en';
  const accountName = typeof auth.session?.user.user_metadata?.display_name === 'string' ? auth.session.user.user_metadata.display_name.slice(0, 80) : '';
  const [profile, setProfile] = useState<PersonalProfile>(emptyPersonalProfile);
  const [interests, setInterests] = useState(''); const [traits, setTraits] = useState('');
  const [gpaText, setGpaText] = useState('');
  const [ready, setReady] = useState(false); const [editing, setEditing] = useState(startEditing);
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState(''); const [error, setError] = useState('');
  const locked = useRef(false); const active = useRef(true);
  useFocusEffect(useCallback(() => {
    active.current = true; setReady(false);
    void readPersonalProfile().then(value => {
      if (!active.current) return;
      const initial = value ?? { ...emptyPersonalProfile(), name: accountName };
      setProfile(initial); setGpaText(initial.gpa === null ? '' : String(initial.gpa)); setInterests(initial.interests.join(en ? ', ' : '، ')); setTraits(initial.traits.join(en ? ', ' : '، ')); setError('');
    }).catch(() => { if (active.current) setError(en ? 'Could not read your profile. Reopen this page before editing.' : 'تعذر قراءة الملف. أعد فتح الصفحة قبل تعديل بياناته.'); }).finally(() => { if (active.current) setReady(true); });
    return () => { active.current = false; };
  }, [accountName, en]));
  async function save() {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError(''); setMessage('');
    try {
      const lists = { interests: splitList(interests), traits: splitList(traits) };
      if (Object.values(lists).some(list => list.length > 30 || list.some(value => value.length > 100))) throw new Error(en ? 'Enter up to 30 interests or traits, with at most 100 characters per item.' : 'اكتب حتى 30 اهتمامًا أو سمة، وبحد 100 حرف لكل عنصر.');
      const normalizedGpa = gpaText.trim().replace(',', '.');
      const gpa = normalizedGpa ? Number(normalizedGpa) : null;
      if ((gpa !== null && (!profile.gpaScale || !Number.isFinite(gpa) || gpa < 0 || gpa > profile.gpaScale)) || (!normalizedGpa && profile.gpaScale !== null)) throw new Error(en ? `Enter a valid GPA from 0 to ${profile.gpaScale ?? 5}, or clear the GPA and select “No GPA”.` : `أدخل معدلًا صحيحًا من 0 إلى ${profile.gpaScale ?? 5}، أو امسح المعدل واختر «بدون معدل».`);
      const value = await savePersonalProfile({ ...profile, gpa, ...lists });
      if (active.current) { setProfile(value); setEditing(false); setMessage(en ? 'Your profile was saved on this device. Cloud sync status appears below.' : 'حُفظت بيانات ملفك على الجهاز. حالة الحفظ السحابي تظهر أدناه.'); onSaved?.(value); }
    } catch (failure) { if (active.current) setError(failure instanceof Error && (failure.message.startsWith(en ? 'Enter' : 'اكتب') || failure.message.startsWith(en ? 'Enter a valid' : 'أدخل معدلًا')) ? failure.message : en ? 'Could not save your profile. Your previous data is still available; try again.' : 'تعذر حفظ الملف. بياناتك السابقة باقية؛ حاول مجددًا.'); }
    finally { locked.current = false; if (active.current) setBusy(false); }
  }
  async function importEducation() {
    setError('');
    try {
      const saved = await readSkillProfile(); const degree = saved?.cv?.education?.[0];
      if (!active.current) return;
      if (!degree) { setError(en ? 'Review your CV education first, or enter it here.' : 'اعتمد معلومات التعليم من السيرة أولًا، أو أدخلها هنا.'); return; }
      setProfile(p => mergeCvEducation(p, degree));
      setMessage(en ? 'The first qualification was copied from your reviewed CV. Check the fields and save.' : 'نُقل أول مؤهل من سيرتك المعتمدة. راجع الحقول ثم احفظها.');
    } catch { if (active.current) setError(en ? 'Could not read CV education. You can enter it manually.' : 'تعذر قراءة تعليم السيرة. يمكنك إدخاله يدويًا.'); }
  }
  const fields: { key: 'name' | 'institution' | 'college' | 'education' | 'studyStatus' | 'studyDates'; label: string; placeholder: string }[] = [
    { key: 'name', label: en ? 'Name' : 'اسمك', placeholder: en ? 'Name shown on your profile' : 'الاسم الذي يظهر في ملفك' },
    { key: 'institution', label: en ? 'University or institution' : 'الجامعة أو الجهة التعليمية', placeholder: en ? 'Institution name' : 'اسم الجهة' },
    { key: 'college', label: en ? 'College' : 'الكلية', placeholder: en ? 'College name as written' : 'اسم الكلية كما ورد' },
    { key: 'education', label: en ? 'Qualification' : 'المؤهل الدراسي', placeholder: en ? 'For example, BSc in Computer Science' : 'مثل بكالوريوس علوم الحاسب' },
    { key: 'studyStatus', label: en ? 'Study status' : 'حالة الدراسة', placeholder: en ? 'For example, currently studying or graduated' : 'مثل أدرس حاليًا أو متخرج' },
    { key: 'studyDates', label: en ? 'Study dates' : 'فترة الدراسة', placeholder: en ? 'Dates as shown on your CV' : 'الفترة كما وردت في سيرتك' },
  ];
  const displayMajor = en ? academicPrograms.find(program => program.title === profile.major)?.englishTitle ?? profile.major : profile.major;
  const summary = [displayMajor, profile.institution, profile.studyStatus || profile.education].filter(Boolean).join(' · ') || (en ? 'Add your education and basic details when you are ready.' : 'أضيفي تعليمك وبياناتك الأساسية عند استعدادك.');
  const hasProfileDetails = Boolean(profile.name || profile.institution || profile.education || profile.major);
  return <DisclosureCard title={en ? 'Personal profile' : 'ملفي الشخصي'} subtitle={en ? 'Education and interests' : 'التعليم والاهتمامات'} summary={ready ? summary : en ? 'Loading profile' : 'جارٍ تحميل الملف'} status={ready ? hasProfileDetails ? en ? 'Added' : 'مضاف' : en ? 'Optional' : 'اختياري' : undefined} statusTone={hasProfileDetails ? 'success' : 'neutral'} actionLabel={ready && !editing ? en ? 'Edit' : 'تعديل' : undefined} onAction={() => { setMessage(''); if (onEdit) onEdit(); else setEditing(true); }} defaultExpanded={startEditing}>
    {!ready ? <ActivityIndicator color={colors.primary} /> : editing ? <>
      <Text style={[ui.note, en && styles.ltr]}>{en ? 'University major' : 'تخصصي الجامعي'}</Text>
      <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 }}>
        {academicPrograms.map(program => <Pressable key={program.id} disabled={busy} accessibilityRole="radio" accessibilityState={{ selected: profile.major === program.title }} style={[ui.outline, { minHeight: 44, padding: 11 }, profile.major === program.title && { backgroundColor: colors.mint }]} onPress={() => setProfile(p => ({ ...p, major: program.title, education: !p.education || academicPrograms.some(item => item.degree === p.education) ? program.degree : p.education }))}><Text style={[ui.outlineText, en && styles.ltr, { fontSize: 14 }]}>{profile.major === program.title ? '✓ ' : ''}{en ? program.englishTitle : program.title}</Text></Pressable>)}
      </View>
      <TextInput accessibilityLabel={en ? 'Other major' : 'تخصص آخر'} maxLength={300} editable={!busy} style={[ui.input, en && styles.ltr]} placeholderTextColor={colors.muted} placeholder={en ? 'Or enter another major' : 'أو اكتب تخصصًا آخر'} value={academicPrograms.some(program => program.title === profile.major) ? '' : profile.major} onChangeText={major => setProfile(p => ({ ...p, major }))} />
      {fields.map(field => <View key={field.key} style={{ gap: 7 }}><Text style={[ui.note, en && styles.ltr]}>{field.label}</Text><TextInput accessibilityLabel={field.label} maxLength={field.key === 'name' ? 80 : 300} editable={!busy} style={[ui.input, en && styles.ltr]} placeholderTextColor={colors.muted} placeholder={field.placeholder} value={profile[field.key]} onChangeText={value => setProfile(p => ({ ...p, [field.key]: value }))} /></View>)}
      <Text style={[ui.note, en && styles.ltr]}>{en ? 'GPA scale' : 'نظام المعدل التراكمي'}</Text>
      <View style={{ flexDirection: 'row-reverse', gap: 8 }}>
        {([5, 4] as const).map(scale => <Pressable key={scale} disabled={busy} accessibilityRole="radio" accessibilityState={{ selected: profile.gpaScale === scale }} style={[ui.outline, { flex: 1 }, profile.gpaScale === scale && { backgroundColor: colors.mint }]} onPress={() => setProfile(p => ({ ...p, gpaScale: scale }))}><Text style={[ui.outlineText, en && styles.ltr]}>{profile.gpaScale === scale ? '✓ ' : ''}{en ? `Out of ${scale}` : `من ${scale}`}</Text></Pressable>)}
        <Pressable disabled={busy} accessibilityRole="radio" accessibilityState={{ selected: profile.gpaScale === null }} style={[ui.outline, { flex: 1 }, profile.gpaScale === null && { backgroundColor: colors.mint }]} onPress={() => { setProfile(p => ({ ...p, gpa: null, gpaScale: null })); setGpaText(''); }}><Text style={[ui.outlineText, en && styles.ltr]}>{en ? 'No GPA' : 'بدون معدل'}</Text></Pressable>
      </View>
      {profile.gpaScale !== null ? <><Text style={[ui.note, en && styles.ltr]}>{en ? `GPA out of ${profile.gpaScale}` : `المعدل التراكمي من ${profile.gpaScale}`}</Text><TextInput accessibilityLabel={en ? 'GPA' : 'المعدل التراكمي'} keyboardType="decimal-pad" maxLength={5} editable={!busy} style={[ui.input, en && styles.ltr]} placeholder={en ? (profile.gpaScale === 5 ? 'Example: 4.50' : 'Example: 3.50') : `مثال: ${profile.gpaScale === 5 ? '4.50' : '3.50'}`} placeholderTextColor={colors.muted} value={gpaText} onChangeText={setGpaText} /><Text style={[ui.note, en && styles.ltr]}>{en ? 'Enter it as shown on your academic record. It has limited influence on readiness and is not an employment guarantee.' : 'أدخله بنفسك كما يظهر في سجلك. يُستخدم جزءًا محدودًا من الجاهزية ولا يُعرض كضمان توظيف.'}</Text></> : null}
      <Pressable disabled={busy} accessibilityRole="button" onPress={() => void importEducation()}><Text style={[ui.link, en && styles.ltr]}>{en ? 'Copy first qualification from reviewed CV' : 'نسخ أول مؤهل من السيرة المعتمدة'}</Text></Pressable>
      <Text style={[ui.note, en && styles.ltr]}>{en ? 'Interests — separate with commas' : 'اهتماماتك — افصل بينها بفاصلة'}</Text><TextInput accessibilityLabel={en ? 'My interests' : 'اهتماماتي'} editable={!busy} multiline maxLength={3100} style={[ui.input, en && styles.ltr]} placeholder={en ? 'For example, cybersecurity, app development' : 'مثل الأمن السيبراني، تطوير التطبيقات'} placeholderTextColor={colors.muted} value={interests} onChangeText={setInterests} />
      <Text style={[ui.note, en && styles.ltr]}>{en ? 'Personal traits — separate with commas' : 'سماتك الشخصية — افصل بينها بفاصلة'}</Text><TextInput accessibilityLabel={en ? 'My personal traits' : 'سماتي الشخصية'} editable={!busy} multiline maxLength={3100} style={[ui.input, en && styles.ltr]} placeholder={en ? 'For example, analysis, collaboration, curiosity' : 'مثل التحليل، التعاون، الفضول'} placeholderTextColor={colors.muted} value={traits} onChangeText={setTraits} />
      <Text style={[ui.note, en && styles.ltr]}>{en ? 'Your career goal is optional. You can explore paths without choosing one.' : 'هدفك المهني اختياري؛ يمكنك استكشاف المسارات دون تحديده.'}</Text>
      {[{ id: null, title: en ? 'I have not chosen a goal' : 'لم أحدد هدفًا بعد' }, ...jobPaths.map(career => ({ id: career.id, title: en ? career.title : careerTitles[career.id] ?? career.title }))].map(career => <Pressable key={career.id ?? 'none'} disabled={busy} accessibilityRole="radio" accessibilityState={{ selected: profile.careerGoal === career.id }} style={[ui.outline, profile.careerGoal === career.id && { backgroundColor: colors.mint }]} onPress={() => setProfile(p => ({ ...p, careerGoal: career.id }))}><Text style={[ui.outlineText, en && styles.ltr]}>{profile.careerGoal === career.id ? '✓ ' : ''}{career.title}</Text></Pressable>)}
      <Pressable disabled={busy} accessibilityRole="button" style={ui.button} onPress={() => void save()}><Text style={ui.buttonText}>{busy ? en ? 'Saving…' : 'جارٍ الحفظ…' : en ? 'Save profile' : 'حفظ بيانات الملف'}</Text></Pressable>
      <Pressable disabled={busy} accessibilityRole="button" onPress={() => setEditing(false)}><Text style={[ui.link, en && styles.ltr]}>{en ? 'Close without saving' : 'إغلاق التعديل دون حفظ'}</Text></Pressable>
    </> : <>
      <Text style={[ui.text, en && styles.ltr]}>{[profile.name, displayMajor, profile.institution, profile.education, profile.studyStatus, profile.studyDates].filter(Boolean).join(' · ') || (en ? 'Add education and interests to build your professional profile.' : 'أضف تعليمك واهتماماتك لبناء ملفك المهني.')}</Text>
      {profile.gpa !== null && profile.gpaScale !== null ? <Text style={[ui.text, en && styles.ltr]}>{en ? `GPA: ${profile.gpa} out of ${profile.gpaScale}` : `المعدل التراكمي: ${profile.gpa} من ${profile.gpaScale}`}</Text> : null}
      {profile.interests.length > 0 && <Text style={[ui.text, en && styles.ltr]}>{en ? `Interests: ${profile.interests.join(', ')}` : `اهتماماتي: ${profile.interests.join('، ')}`}</Text>}
      {profile.traits.length > 0 && <Text style={[ui.text, en && styles.ltr]}>{en ? `Traits: ${profile.traits.join(', ')}` : `سماتي: ${profile.traits.join('، ')}`}</Text>}
      {!!profile.careerGoal && <Text style={[ui.text, en && styles.ltr]}>{en ? `Goal: ${careerTitles[profile.careerGoal]}` : `هدفي: ${careerTitles[profile.careerGoal]}`}</Text>}
      <Text style={[ui.note, en && styles.ltr]}>{en ? 'Education and GPA provide context for your profile. They are not included in the skill coverage score.' : 'المؤهل والمعدل يساعدان في توضيح ملفك، ولا يدخلان في نسبة تغطية المهارات.'}</Text>
    </>}
    {!!message && <Text style={ui.note}>{message}</Text>}
    {!!error && <Text accessibilityRole="alert" style={[ui.text, { color: colors.error }]}>{error}</Text>}
  </DisclosureCard>;
}

const styles = createAdaptiveStyles(() => ({ ltr: { textAlign: 'left' as const, writingDirection: 'ltr' as const } }));
