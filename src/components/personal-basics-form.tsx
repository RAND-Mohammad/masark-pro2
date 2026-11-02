import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { academicPrograms } from '../constants/academic-programs';
import { colors, createAdaptiveStyles, ui } from '../constants/design';
import { useAppPreferences } from '../contexts/app-preferences-context';
import { useAuth } from '../contexts/auth-context';
import { emptyPersonalProfile, readPersonalProfile, savePersonalProfile, type PersonalProfile } from '../utils/personal-profile';

type PersonalBasicsFormProps = { email?: string | null; submitLabel?: { ar: string; en: string }; onSaved?: (profile: PersonalProfile) => void };

export function PersonalBasicsForm({ email, submitLabel, onSaved }: PersonalBasicsFormProps) {
  const auth = useAuth();
  const { language } = useAppPreferences();
  const en = language === 'en';
  const accountName = typeof auth.session?.user.user_metadata?.display_name === 'string' ? auth.session.user.user_metadata.display_name.slice(0, 80) : '';
  const text = (ar: string, english: string) => en ? english : ar;
  const [profile, setProfile] = useState<PersonalProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [majorOpen, setMajorOpen] = useState(false);
  const [majorSearch, setMajorSearch] = useState('');
  const active = useRef(false);
  const locked = useRef(false);

  useFocusEffect(useCallback(() => {
    active.current = true;
    setLoading(true);
    void readPersonalProfile().then(value => {
      if (active.current) { setProfile(value ?? { ...emptyPersonalProfile(), name: accountName }); setError(''); }
    }).catch(() => {
      if (active.current) setError(en ? 'Could not load the profile. Reopen this page before saving changes.' : 'تعذر تحميل الملف. أعد فتح الصفحة قبل حفظ تعديلاتك.');
    }).finally(() => { if (active.current) setLoading(false); });
    return () => { active.current = false; };
  }, [accountName, en]));

  function update<K extends keyof PersonalProfile>(key: K, value: PersonalProfile[K]) {
    setSaved(false); setError('');
    setProfile(current => current ? { ...current, [key]: value } : current);
  }

  async function save() {
    if (!profile || locked.current) return;
    if (profile.graduationYear && !/^\d{4}$/u.test(profile.graduationYear.trim())) {
      setError(text('اكتب سنة التخرج بأربعة أرقام، أو اتركها فارغة.', 'Enter a four-digit graduation year or leave it blank.'));
      return;
    }
    locked.current = true; setBusy(true); setError(''); setSaved(false);
    try {
      const result = await savePersonalProfile(profile);
      if (active.current) { setProfile(result); setSaved(true); onSaved?.(result); }
    } catch {
      if (active.current) setError(text('تعذر حفظ الملف. بقيت البيانات السابقة كما هي؛ أعد المحاولة.', 'Could not save your profile. Your previous data is unchanged; try again.'));
    } finally {
      locked.current = false;
      if (active.current) setBusy(false);
    }
  }

  const filteredPrograms = academicPrograms.filter(program => {
    const query = majorSearch.trim().toLocaleLowerCase();
    return !query || program.title.toLocaleLowerCase().includes(query) || program.englishTitle.toLocaleLowerCase().includes(query);
  });
  const statuses = en
    ? ['Student', 'Final-year student', 'Graduated']
    : ['طالبة', 'طالبة في السنة الأخيرة', 'متخرجة'];

  if (loading) return <View style={styles.loading}><ActivityIndicator color={colors.primary} /><Text style={[ui.note, en && styles.ltr]}>{text('جارٍ تحميل الملف…', 'Loading your profile…')}</Text></View>;
  if (!profile) return <Text accessibilityRole="alert" style={[styles.error, en && styles.ltr]}>{error || text('تعذر فتح الملف.', 'Could not open your profile.')}</Text>;

  return <View style={styles.form}>
    <Field label={text('الاسم الكامل', 'Full name')} en={en}>
      <TextInput accessibilityLabel={text('الاسم الكامل', 'Full name')} value={profile.name} onChangeText={value => update('name', value)} editable={!busy} maxLength={80} autoComplete="name" textContentType="name" placeholder={text('اسمك كما ترغبين أن يظهر', 'Name shown on your profile')} placeholderTextColor={colors.muted} style={[ui.input, en && styles.ltr]} />
    </Field>
    {email ? <Field label={text('البريد الإلكتروني', 'Email address')} en={en}>
      <Text accessibilityRole="text" style={[styles.readOnly, en && styles.ltr]}>{email}</Text>
    </Field> : null}
    <Field label={text('الجامعة', 'University')} en={en}>
      <TextInput accessibilityLabel={text('الجامعة', 'University')} value={profile.institution} onChangeText={value => update('institution', value)} editable={!busy} maxLength={300} placeholder={text('اسم الجامعة', 'University name')} placeholderTextColor={colors.muted} style={[ui.input, en && styles.ltr]} />
    </Field>
    <Field label={text('التخصص', 'Major')} en={en}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: majorOpen }} disabled={busy} onPress={() => { setMajorOpen(true); setMajorSearch(''); }} style={[ui.input, styles.dropdown, en && styles.dropdownLtr]}>
        <Text style={[styles.dropdownText, en && styles.ltr]}>{profile.major ? en ? academicPrograms.find(program => program.title === profile.major)?.englishTitle ?? profile.major : profile.major : text('اختاري تخصصك', 'Choose your major')}</Text>
        <Text style={styles.chevron}>⌄</Text>
      </Pressable>
    </Field>
    <Field label={text('حالة الدراسة', 'Study status')} en={en}>
      <View style={[styles.statusOptions, en && styles.statusOptionsLtr]}>
        {statuses.map(status => {
          const selected = profile.studyStatus === status;
          return <Pressable key={status} accessibilityRole="radio" accessibilityState={{ selected, disabled: busy }} disabled={busy} onPress={() => update('studyStatus', status)} style={[styles.statusChip, selected && styles.statusChipSelected]}>
            <Text style={[styles.statusText, selected && styles.statusTextSelected]}>{status}</Text>
          </Pressable>;
        })}
      </View>
    </Field>
    <View style={[styles.splitFields, en && styles.splitFieldsLtr]}>
      <View style={styles.splitField}>
        <Field label={text('المدينة', 'City')} en={en}>
          <TextInput accessibilityLabel={text('المدينة', 'City')} value={profile.city} onChangeText={value => update('city', value)} editable={!busy} maxLength={100} placeholder={text('مثال: الرياض', 'e.g. Riyadh')} placeholderTextColor={colors.muted} style={[ui.input, en && styles.ltr]} />
        </Field>
      </View>
      <View style={styles.splitField}>
        <Field label={text('سنة التخرج', 'Graduation year')} en={en}>
          <TextInput accessibilityLabel={text('سنة التخرج', 'Graduation year')} value={profile.graduationYear} onChangeText={value => update('graduationYear', value.replace(/\D/gu, '').slice(0, 4))} editable={!busy} maxLength={4} keyboardType="number-pad" placeholder="2027" placeholderTextColor={colors.muted} style={[ui.input, styles.yearInput]} />
        </Field>
      </View>
    </View>

    {error ? <Text accessibilityRole="alert" style={[styles.error, en && styles.ltr]}>{error}</Text> : null}
    {saved ? <Text accessibilityRole="status" style={[styles.success, en && styles.ltr]}>{text('حُفظت التعديلات.', 'Changes saved.')}</Text> : null}
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy }} disabled={busy} onPress={() => void save()} style={[ui.button, busy && ui.pressed]}>
      <Text style={ui.buttonText}>{busy ? text('جارٍ الحفظ…', 'Saving…') : submitLabel ? en ? submitLabel.en : submitLabel.ar : text('حفظ ومتابعة', 'Save and continue')}</Text>
    </Pressable>

    <Modal visible={majorOpen} transparent animationType="fade" onRequestClose={() => setMajorOpen(false)}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modal}>
          <View style={ui.row}><Text style={[ui.heading, en && styles.ltr]}>{text('اختاري التخصص', 'Choose a major')}</Text><Pressable accessibilityRole="button" onPress={() => setMajorOpen(false)}><Text style={styles.close}>{text('إغلاق', 'Close')}</Text></Pressable></View>
          <TextInput accessibilityLabel={text('ابحثي عن تخصص', 'Search majors')} value={majorSearch} onChangeText={setMajorSearch} placeholder={text('ابحثي عن تخصص', 'Search majors')} placeholderTextColor={colors.muted} style={[ui.input, en && styles.ltr]} />
          <ScrollView keyboardShouldPersistTaps="handled" style={styles.majorList}>
            {filteredPrograms.map(program => <Pressable key={program.id} accessibilityRole="button" accessibilityState={{ selected: profile.major === program.title }} onPress={() => { update('major', program.title); setProfile(current => current ? { ...current, major: program.title, education: current.education || program.degree } : current); setMajorOpen(false); }} style={[styles.majorOption, profile.major === program.title && styles.majorOptionSelected]}>
              <Text style={[styles.majorText, en && styles.ltr]}>{en ? program.englishTitle : program.title}</Text>
            </Pressable>)}
            {filteredPrograms.length === 0 ? <Text style={[ui.note, en && styles.ltr]}>{text('لا توجد نتائج. يمكنك كتابة التخصص في خانة البحث.', 'No matches found.')}</Text> : null}
          </ScrollView>
          <Text style={[ui.note, en && styles.ltr]}>{text('إذا لم يظهر تخصصك، اكتبيه في ملفك لاحقًا.', 'If your major is not listed, you can add it to your profile later.')}</Text>
        </View>
      </View>
    </Modal>
  </View>;
}

function Field({ label, en, children }: { label: string; en: boolean; children: React.ReactNode }) {
  return <View style={styles.field}><Text style={[styles.label, en && styles.ltr]}>{label}</Text>{children}</View>;
}

const styles = createAdaptiveStyles(() => ({
  form: { gap: 14 },
  field: { gap: 6 },
  label: { color: colors.ink, fontSize: 13, fontWeight: '600', textAlign: 'right' },
  readOnly: { color: colors.muted, backgroundColor: colors.soft, borderWidth: 1, borderColor: colors.border, borderRadius: 13, paddingHorizontal: 14, paddingVertical: 15, minHeight: 52, textAlign: 'right', fontSize: 15 },
  dropdown: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  dropdownLtr: { flexDirection: 'row' },
  dropdownText: { color: colors.ink, fontSize: 15, textAlign: 'right' },
  chevron: { color: colors.muted, fontSize: 19, lineHeight: 20 },
  statusOptions: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 7 },
  statusOptionsLtr: { flexDirection: 'row' },
  statusChip: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 14, paddingHorizontal: 11, paddingVertical: 9 },
  statusChipSelected: { borderColor: colors.primary, backgroundColor: colors.mint },
  statusText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  statusTextSelected: { color: colors.primary },
  splitFields: { flexDirection: 'row-reverse', gap: 11 },
  splitFieldsLtr: { flexDirection: 'row' },
  splitField: { flex: 1 },
  yearInput: { textAlign: 'center', writingDirection: 'ltr' },
  loading: { minHeight: 100, alignItems: 'center', justifyContent: 'center', gap: 12 },
  error: { color: colors.error, fontSize: 13, lineHeight: 20, textAlign: 'right' },
  success: { color: colors.primary, fontSize: 13, textAlign: 'right' },
  modalBackdrop: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.45)', padding: 20 },
  modal: { width: '100%', maxWidth: 520, maxHeight: '85%', alignSelf: 'center', backgroundColor: colors.surface, borderRadius: 22, padding: 18, gap: 13 },
  close: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  majorList: { maxHeight: 420, borderWidth: 1, borderColor: colors.border, borderRadius: 14 },
  majorOption: { minHeight: 48, paddingHorizontal: 13, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  majorOptionSelected: { backgroundColor: colors.mint },
  majorText: { color: colors.ink, fontSize: 14, textAlign: 'right' },
  ltr: { textAlign: 'left', writingDirection: 'ltr' },
}));
