import { useState } from 'react';
import { useAuth } from '../contexts/auth-context';
import { authErrorMessage } from '../utils/auth-errors';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, ui } from '../constants/design';
import { MasarakIcon } from '../components/masarak-icon';
import { useSkillProfile } from '../hooks/use-skill-profile';
import { saveManualSkills } from '../utils/skill-profile';
import dataset from '../masarak_dataset.json';
import { PersonalProfileForm } from '../components/personal-profile-form';
import { CvQualificationReview } from '../components/cv-qualification-review';
import { CloudCard } from '../components/cloud-card';
import { usePersonalProfile } from '../hooks/use-personal-profile';
import { ProfileEntryChoices } from '../components/profile-entry-choices';

const skills = dataset.skills.filter(skill => dataset.career_skills.some(link => link.skill_id === skill.skill_id));
export default function ProfileScreen() {
  const router = useRouter();
  const auth = useAuth();
  const { personal } = usePersonalProfile();
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [accountError, setAccountError] = useState('');
  const displayName = personal?.name || (typeof auth.session?.user.user_metadata?.display_name === 'string' ? auth.session.user.user_metadata.display_name.trim().slice(0, 80) : 'ملفك المهني');
  async function leaveAccount() {
    setSigningOut(true); setAccountError('');
    try { await auth.signOut(); router.replace('/'); }
    catch (failure) { setAccountError(authErrorMessage(failure)); }
    finally { setSigningOut(false); }
  }
  const { profile, ready, error, setProfile } = useSkillProfile();
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState('');
  async function save() {
    setBusy(true);
    setSaveError('');
    try { const updated = await saveManualSkills(selected); setProfile(updated); setEditing(false); setSearch(''); }
    catch { setSaveError('تعذر حفظ التعديلات. جرّب مرة أخرى.'); }
    finally { setBusy(false); }
  }
  const visible = skills.filter(skill => skill.name.toLowerCase().includes(search.trim().toLowerCase()));
  const stats = [
    { title: 'مهارات مرتبطة', count: profile?.skill_ids.length ?? 0 },
    { title: 'شهادات ودورات', count: profile?.cv?.certificates.length ?? 0 },
    { title: 'مشاريع', count: profile?.cv?.projects?.length ?? 0 },
  ];
  return <SafeAreaView edges={['top', 'left', 'right']} style={ui.screen}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={ui.content}>
    <Text style={ui.eyebrow}>رحلتك، بطريقتك</Text><Text style={ui.title}>ملفي</Text>
    <View style={styles.header}><View style={styles.avatar}><MasarakIcon name="profile" size={32} /></View><Text style={ui.heading}>{auth.session ? displayName : 'ملفك المهني'}</Text><Text style={ui.note}>{auth.session?.user.email ?? 'تستخدم مسارك دون حساب'}</Text></View>
    {!ready ? <Text style={ui.text}>جارٍ تحميل ملفك…</Text> : error ? <Text style={styles.error}>{error}</Text> : <>
    <ProfileEntryChoices />
    <PersonalProfileForm />
    <CvQualificationReview />
    <Pressable accessibilityRole="link" onPress={() => router.push('/privacy')}><Text style={ui.link}>الخصوصية والحفظ وحدود الخدمات / Privacy</Text></Pressable>
      <CloudCard />
    {profile?.cv && <Pressable accessibilityRole="button" style={ui.outline} onPress={() => router.push('/resume-preview')}><Text style={ui.outlineText}>معاينة سيرتي / تصدير PDF</Text></Pressable>}
      <View style={styles.stats}>{stats.map(stat => <View key={stat.title} style={styles.stat}><Text style={styles.count}>{stat.count}</Text><Text style={styles.statTitle}>{stat.title}</Text></View>)}</View>
      <Pressable accessibilityRole="button" style={ui.card} onPress={() => router.push('/upload-cv')}><View style={ui.row}><Text style={ui.heading}>سيرتي الذاتية</Text><MasarakIcon name="upload" /></View><Text style={ui.text}>{profile?.cv ? 'التحليل المعتمد محفوظ. يمكنك مراجعة السيرة أو إعادة تحليلها.' : 'ارفع سيرتك واستخرج مهاراتك وخبراتك.'}</Text><Text style={ui.link}>فتح السيرة ←</Text></Pressable>
      <View style={ui.card}><View style={ui.row}><Text style={ui.heading}>ملف مهاراتي</Text><MasarakIcon name="careers" /></View><Text style={ui.text}>مهارات السيرة المعتمدة تدخل في النتائج تلقائيًا. يمكنك إضافة مهارات أخرى يدويًا؛ لتعديل مهارات السيرة افتح مراجعتها.</Text><Pressable accessibilityRole="button" style={ui.outline} onPress={() => { setSelected(profile?.manual_skill_ids ?? []); setEditing(value => !value); }}><Text style={ui.outlineText}>{editing ? 'إغلاق التعديل' : 'مهاراتي اليدوية'}</Text></Pressable></View>
      {editing && <View style={ui.card}><Text style={ui.heading}>أضف مهاراتك يدويًا</Text><Text style={ui.note}>هذا الاختيار اليدوي مستقل عن مهارات سيرتك. أسماء المهارات من القاموس الإنجليزي. المحدد يدويًا: {selected.length}</Text><TextInput accessibilityLabel="البحث عن مهارة" placeholder="ابحث باسم المهارة بالإنجليزية" placeholderTextColor={colors.muted} style={ui.input} value={search} onChangeText={setSearch} editable={!busy} />
        {visible.length === 0 && <Text style={ui.text}>لا توجد مهارات تطابق البحث.</Text>}
        {visible.map(skill => { const checked = selected.includes(skill.skill_id); return <Pressable key={skill.skill_id} accessibilityRole="checkbox" accessibilityState={{ checked, disabled: busy }} disabled={busy} style={[styles.skill, checked && styles.selected]} onPress={() => setSelected(previous => checked ? previous.filter(id => id !== skill.skill_id) : [...previous, skill.skill_id])}><Text style={styles.skillName}>{checked ? '✓ ' : ''}{skill.name}</Text><Text style={styles.skillDescription}>{skill.description}</Text></Pressable>; })}
        {saveError ? <Text style={styles.error}>{saveError}</Text> : null}
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy }} disabled={busy} onPress={() => void save()} style={[ui.button, busy && ui.pressed]}><Text style={ui.buttonText}>{busy ? 'جارٍ الحفظ…' : 'حفظ المهارات'}</Text></Pressable>
      </View>}
      <Pressable accessibilityRole="button" style={ui.card} onPress={() => router.push('/learning-plan')}><View style={ui.row}><Text style={ui.heading}>خطة تعلمي</Text><MasarakIcon name="plan" /></View><Text style={ui.text}>مهارات وشهادات وخبرات ومشاريع اخترت تطويرها، مع الأولوية ونسبة التقدم.</Text></Pressable>
    </>}
    {auth.session ? <View style={ui.card}><Text style={ui.text}>ملف هذا الحساب مستقل عن ملف الضيف. حالة النسخة السحابية تظهر في بطاقة الحفظ أعلاه.</Text><Pressable accessibilityRole="button" disabled={signingOut} onPress={() => router.push('/reset-password')}><Text style={ui.link}>تغيير كلمة المرور</Text></Pressable>{confirmSignOut ? <><Text style={ui.text}>تريد تسجيل الخروج؟ بيانات الحساب تبقى محفوظة على الجهاز، ويعود التطبيق إلى وضع الضيف.</Text><Pressable accessibilityRole="button" disabled={signingOut} onPress={() => void leaveAccount()} style={ui.outline}><Text style={ui.outlineText}>{signingOut ? 'جارٍ تسجيل الخروج…' : 'تأكيد تسجيل الخروج'}</Text></Pressable><Pressable accessibilityRole="button" disabled={signingOut} onPress={() => setConfirmSignOut(false)}><Text style={ui.link}>إلغاء</Text></Pressable></> : <Pressable accessibilityRole="button" onPress={() => setConfirmSignOut(true)}><Text style={ui.link}>تسجيل الخروج</Text></Pressable>}{accountError ? <Text style={styles.error}>{accountError}</Text> : null}</View> : <Pressable accessibilityRole="button" style={ui.outline} onPress={() => router.push({ pathname: '/account', params: { mode: 'login' } })}><Text style={ui.outlineText}>تسجيل الدخول أو إنشاء حساب</Text></Pressable>}
    <Pressable accessibilityRole="button" onPress={() => router.replace('/')}><Text style={ui.link}>العودة لشاشة البداية</Text></Pressable>
    <Text style={ui.note}>العربية والإنجليزية قريبًا. يبقى ملفك محفوظًا على الجهاز؛ تُزامن نسخته الخاصة بحسابك عند تفعيل الحفظ السحابي.</Text>
  </ScrollView></SafeAreaView>;
}
const styles = StyleSheet.create({ header: { alignItems: 'center', paddingVertical: 18, gap: 10 }, avatar: { padding: 24, borderRadius: 45, backgroundColor: colors.mint }, stats: { flexDirection: 'row-reverse', backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: colors.border, paddingVertical: 20 }, stat: { flex: 1, alignItems: 'center', gap: 6 }, count: { color: colors.primary, fontSize: 25, fontWeight: '700' }, statTitle: { color: colors.muted, fontSize: 11, textAlign: 'center' }, skill: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.soft, borderRadius: 14, padding: 16, gap: 8 }, selected: { backgroundColor: colors.mint, borderColor: colors.primary }, skillName: { color: colors.ink, fontSize: 16, fontWeight: '600' }, skillDescription: { color: colors.muted, fontSize: 13, lineHeight: 22 }, error: { color: colors.error, fontSize: 14, lineHeight: 23, textAlign: 'right' } });
