import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MasarakIcon } from '../components/masarak-icon';
import { colors, createAdaptiveStyles, ui } from '../constants/design';
import { useAppPreferences } from '../contexts/app-preferences-context';
import { useAuth } from '../contexts/auth-context';
import { usePersonalProfile } from '../hooks/use-personal-profile';
import { useSkillProfile } from '../hooks/use-skill-profile';
import { getCareerMatches } from '../utils/career-matching';
import { careerTitles } from '../utils/career-matches';
import { resolveBaseCareerId } from '../constants/job-paths';

export default function ProfileScreen() {
  const router = useRouter();
  const auth = useAuth();
  const { language } = useAppPreferences();
  const en = language === 'en';
  const text = (ar: string, english: string) => en ? english : ar;
  const personalState = usePersonalProfile();
  const profileState = useSkillProfile();
  const matches = getCareerMatches({ skillProfile: profileState.profile, personal: personalState.personal });
  const requestedGoal = personalState.personal?.careerGoal;
  const career = requestedGoal
    ? matches.find(item => item.career_id === requestedGoal || resolveBaseCareerId(item.career_id) === resolveBaseCareerId(requestedGoal)) ?? matches[0]
    : matches[0];
  const savedName = personalState.personal?.name.trim()
    || (typeof auth.session?.user.user_metadata?.display_name === 'string' ? auth.session.user.user_metadata.display_name.trim() : '');
  const name = savedName || text('ملفي المهني', 'Professional profile');
  const initials = name.trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toLocaleUpperCase() ?? '').join('') || 'M';
  const studentSummary = [personalState.personal?.studyStatus, personalState.personal?.major, personalState.personal?.city]
    .map(value => value?.trim()).filter(Boolean).join(' · ');
  const educationSummary = [
    personalState.personal?.institution?.trim(),
    personalState.personal?.graduationYear ? text(`دفعة ${personalState.personal.graduationYear}`, `Class of ${personalState.personal.graduationYear}`) : '',
  ].filter(Boolean).join(' · ');
  const reviewedSkills = profileState.profile?.skill_ids.length ?? 0;
  const hasCv = Boolean(profileState.profile?.cv);
  return <SafeAreaView edges={['top', 'left', 'right']} style={ui.screen}>
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.profileHeader}>
        <Pressable accessibilityRole="button" accessibilityLabel={text('الإعدادات', 'Settings')} onPress={() => router.push('/settings' as never)} style={styles.settingsButton}><MasarakIcon name="settings" /></Pressable>
        <View style={styles.avatar}><Text style={styles.initials}>{initials}</Text></View>
        <Text style={[styles.name, en && styles.ltr]}>{name}</Text>
        <Text style={[styles.email, en && styles.ltr]}>{auth.session?.user.email ?? text('تستخدم مسارك دون حساب', 'Using Masarak without an account')}</Text>
        {studentSummary ? <Text style={[styles.academic, en && styles.ltr]}>{studentSummary}</Text> : null}
        {educationSummary ? <Text style={[styles.educationSummary, en && styles.ltr]}>{educationSummary}</Text> : null}
      </View>

      {!personalState.ready || !profileState.ready ? <View style={ui.card}><Text style={[ui.text, en && styles.ltr]}>{text('جارٍ تحميل ملفك…', 'Loading your profile…')}</Text></View> : null}
      {personalState.error || profileState.error ? <View style={styles.errorCard}><Text accessibilityRole="alert" style={[styles.error, en && styles.ltr]}>{personalState.error || profileState.error}</Text></View> : null}

      {personalState.ready && profileState.ready && !personalState.error && !profileState.error ? <>
        <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/readiness', params: career ? { id: career.career_id } : {} } as never)} style={({ pressed }) => [styles.direction, pressed && ui.pressed]}>
          <View style={styles.directionTop}>
            <Text style={[styles.directionLabel, en && styles.ltr]}>{text('مساري المهني', 'MY CAREER DIRECTION')}</Text>
            <Text style={styles.directionAction}>{text('عرض الجاهزية ←', 'Readiness →')}</Text>
          </View>
          <View style={[styles.directionContent, en && styles.directionLtr]}>
            <View style={styles.directionCopy}>
              <Text style={[styles.directionTitle, en && styles.ltr]}>{career ? (en ? career.title : careerTitles[career.career_id] ?? career.title) : text('اختاري مسارًا', 'Choose a path')}</Text>
              <Text style={[styles.directionNote, en && styles.ltr]}>{text('افتحي تفاصيل الجاهزية', 'OPEN READINESS DETAILS')}</Text>
            </View>
          </View>
        </Pressable>

        <View style={styles.actionsCard}>
          <ProfileRow icon="profile" title={text('تعديل الملف الشخصي', 'Edit profile')} subtitle={text('المعلومات الشخصية والتعليمية', 'Personal and academic details')} onPress={() => router.push('/edit-profile' as never)} english={en} />
          <ProfileRow icon="upload" title={text('سيرتي ومهاراتي المراجعة', 'My CV & reviewed skills')} subtitle={hasCv ? text(`${reviewedSkills} مهارات موثقة · راجعي أو حدّثي السيرة`, `${reviewedSkills} reviewed skills · review or update your CV`) : text('ارفعِي سيرة اختيارية أو أضيفي معلوماتك يدويًا', 'Upload an optional CV or add your information manually')} onPress={() => router.push('/upload-cv' as never)} english={en} />
          <ProfileRow icon="careers" title={text('هدفي المهني', 'My career goal')} subtitle={career ? (en ? `Explore or change · ${career.title}` : `استكشفي أو غيّري · ${careerTitles[career.career_id] ?? career.title}`) : text('استكشفي المسارات أو حددي هدفًا', 'Explore paths or choose a goal')} onPress={() => router.push({ pathname: '/choose-goal', params: { source: 'profile' } } as never)} english={en} last />
        </View>

        <View style={[styles.footerLinks, en && styles.footerLinksLtr]}>
          <Pressable accessibilityRole="button" onPress={() => router.push('/settings' as never)} style={styles.footerLink}><MasarakIcon name="settings" size={15} /><Text style={styles.footerText}>{text('الإعدادات', 'Settings')}</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={() => router.push('/privacy' as never)} style={styles.footerLink}><MasarakIcon name="profile" size={15} /><Text style={styles.footerText}>{text('الخصوصية والبيانات', 'Privacy & data')}</Text></Pressable>
        </View>
        <Text style={[ui.note, en && styles.ltr]}>{text('ملفك خاص. حدّثي معلوماتك بعد اكتساب دليل جديد.', 'Your profile is private. Update it when you have new evidence.')}</Text>
        {!auth.session ? <Pressable accessibilityRole="button" style={ui.outline} onPress={() => router.push({ pathname: '/account', params: { mode: 'login' } })}><Text style={ui.outlineText}>{text('تسجيل الدخول لمزامنة بيانات حسابك', 'Sign in to sync account data')}</Text></Pressable> : null}
      </> : null}
    </ScrollView>
  </SafeAreaView>;
}

function ProfileRow({ icon, title, subtitle, onPress, english, last = false }: { icon: 'profile' | 'upload' | 'careers'; title: string; subtitle: string; onPress: () => void; english: boolean; last?: boolean }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.row, english && styles.rowLtr, !last && styles.rowBorder, pressed && ui.pressed]}>
    <View style={styles.rowIcon}><MasarakIcon name={icon} color={colors.primary} size={19} /></View>
    <View style={styles.rowCopy}><Text style={[styles.rowTitle, english && styles.ltr]}>{title}</Text><Text style={[styles.rowSubtitle, english && styles.ltr]}>{subtitle}</Text></View>
    <Text style={styles.chevron}>{english ? '›' : '‹'}</Text>
  </Pressable>;
}

const styles = createAdaptiveStyles(() => ({
  content: { width: '100%', maxWidth: 620, alignSelf: 'center', padding: 22, paddingBottom: 28, gap: 16 },
  profileHeader: { alignItems: 'center', gap: 5, paddingTop: 6, paddingBottom: 8 },
  settingsButton: { alignSelf: 'flex-end', width: 40, height: 40, borderRadius: 14, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 76, height: 76, borderRadius: 38, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center', marginTop: -28, marginBottom: 5 },
  initials: { color: colors.primary, fontSize: 24, fontWeight: '800' },
  name: { color: colors.ink, fontSize: 23, fontWeight: '800', textAlign: 'center' },
  email: { color: colors.muted, fontSize: 14, textAlign: 'center' },
  academic: { color: colors.muted, fontSize: 12, textAlign: 'center', marginTop: 2 },
  educationSummary: { color: colors.muted, fontSize: 11, textAlign: 'center' },
  direction: { backgroundColor: colors.contrastPanel, borderRadius: 20, padding: 18, gap: 13 },
  directionTop: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  directionLabel: { color: colors.contrastOnPanel, opacity: 0.78, fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textAlign: 'right' },
  directionAction: { color: colors.contrastAccent, fontSize: 11, fontWeight: '700' },
  directionContent: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  directionLtr: { flexDirection: 'row' },
  directionCopy: { flex: 1, gap: 5 },
  directionTitle: { color: colors.contrastOnPanel, fontSize: 20, lineHeight: 26, fontWeight: '800', textAlign: 'right' },
  directionNote: { color: colors.contrastOnPanel, opacity: 0.78, fontSize: 11, lineHeight: 17, fontWeight: '600', textAlign: 'right' },
  actionsCard: { backgroundColor: colors.surface, borderRadius: 19, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 15 },
  row: { minHeight: 76, flexDirection: 'row-reverse', alignItems: 'center', gap: 11, paddingVertical: 12 },
  rowLtr: { flexDirection: 'row' },
  rowBorder: { borderBottomWidth: 1, borderColor: colors.border },
  rowIcon: { width: 38, height: 38, borderRadius: 13, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  rowCopy: { flex: 1, gap: 3 },
  rowTitle: { color: colors.ink, fontSize: 14, fontWeight: '700', textAlign: 'right' },
  rowSubtitle: { color: colors.muted, fontSize: 11, lineHeight: 17, textAlign: 'right' },
  chevron: { color: colors.muted, fontSize: 23, lineHeight: 26 },
  footerLinks: { flexDirection: 'row-reverse', gap: 16, flexWrap: 'wrap' },
  footerLinksLtr: { flexDirection: 'row' },
  footerLink: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5, minHeight: 32 },
  footerText: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  errorCard: { backgroundColor: colors.errorSurface, borderColor: colors.errorBorder, borderWidth: 1, borderRadius: 16, padding: 14 },
  error: { color: colors.error, fontSize: 13, lineHeight: 20, textAlign: 'right' },
  ltr: { textAlign: 'left', writingDirection: 'ltr' },
}));
