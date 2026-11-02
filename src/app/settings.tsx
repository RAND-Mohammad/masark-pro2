import { useEffect, useState, type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MasarakIcon, type IconName } from '../components/masarak-icon';
import { useAuth } from '../contexts/auth-context';
import { useAppPreferences, type AppLanguage, type ThemeChoice } from '../contexts/app-preferences-context';
import { adminRequest } from '../utils/admin-api';
import { authErrorMessage } from '../utils/auth-errors';
import { LearningReminderError, readLearningReminderEnabled, setLearningReminderEnabled } from '../utils/learning-reminder';
import { colors, createAdaptiveStyles, ui } from '../constants/design';

export default function SettingsScreen() {
  const router = useRouter();
  const auth = useAuth();
  const preferences = useAppPreferences();
  const en = preferences.language === 'en';
  const [adminCheck, setAdminCheck] = useState<{ token: string; allowed: boolean } | null>(null);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [showLanguage, setShowLanguage] = useState(false);
  const [showTheme, setShowTheme] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderReady, setReminderReady] = useState(false);
  const [reminderBusy, setReminderBusy] = useState(false);

  const accessToken = auth.session?.access_token;
  const adminAllowed = Boolean(accessToken && adminCheck?.token === accessToken && adminCheck.allowed);
  useEffect(() => {
    let active = true;
    if (!accessToken) return () => { active = false; };
    void adminRequest('session', {}, en ? 'en' : 'ar').then(() => { if (active) setAdminCheck({ token: accessToken, allowed: true }); })
      .catch(() => { if (active) setAdminCheck({ token: accessToken, allowed: false }); });
    return () => { active = false; };
  }, [accessToken, en]);
  useEffect(() => {
    let active = true;
    void readLearningReminderEnabled()
      .then(value => { if (active) setReminderEnabled(value); })
      .catch(() => { if (active) setError(en ? 'Could not load the learning reminder.' : 'تعذر تحميل تذكير التعلم.'); })
      .finally(() => { if (active) setReminderReady(true); });
    return () => { active = false; };
  }, [en]);

  async function saveLanguage(language: AppLanguage) {
    setError(''); setSaved('');
    try { await preferences.setLanguage(language); setSaved(en ? 'Language preference saved.' : 'حُفظ تفضيل اللغة.'); }
    catch { setError(en ? 'Could not save the language preference.' : 'تعذر حفظ تفضيل اللغة.'); }
  }
  async function saveTheme(theme: ThemeChoice) {
    setError(''); setSaved('');
    try { await preferences.setTheme(theme); setSaved(en ? 'Theme preference saved.' : 'حُفظ تفضيل المظهر.'); }
    catch { setError(en ? 'Could not save the theme preference.' : 'تعذر حفظ تفضيل المظهر.'); }
  }
  async function updateLearningReminder(enabled: boolean) {
    setReminderBusy(true); setError(''); setSaved('');
    try {
      await setLearningReminderEnabled(enabled, preferences.language);
      setReminderEnabled(enabled);
      setSaved(enabled
        ? en ? 'Daily learning reminder set for 7:00 PM.' : 'تم ضبط تذكير التعلم يوميًا الساعة 7 مساءً.'
        : en ? 'Learning reminder turned off.' : 'تم إيقاف تذكير التعلم.');
    } catch (failure) {
      const code = failure instanceof LearningReminderError ? failure.code : 'schedule-failed';
      setError(code === 'permission-denied'
        ? en ? 'Allow notifications in your device settings to enable this reminder.' : 'اسمحي بالإشعارات من إعدادات الجهاز لتفعيل التذكير.'
        : code === 'unsupported'
          ? en ? 'Learning reminders are available in the iOS and Android app.' : 'تذكيرات التعلم متاحة في تطبيق iOS وAndroid.'
          : en ? 'Could not schedule the reminder. Try again.' : 'تعذر ضبط التذكير. حاولي مرة أخرى.');
    } finally { setReminderBusy(false); }
  }
  async function signOut() {
    setBusy(true); setError('');
    try { await auth.signOut(); router.replace('/'); }
    catch (failure) { setError(authErrorMessage(failure)); }
    finally { setBusy(false); setConfirmSignOut(false); }
  }

  const labels = en ? {
    back: 'Back', title: 'Settings', hero: 'Make space for what works for you.', account: 'Account & support', password: 'Change password', passwordHint: 'Keep your account secure', privacy: 'Privacy and data controls', privacyHint: 'How your data is stored and used', preferences: 'Preferences', reminder: 'Learning reminders', reminderHint: 'A gentle nudge to keep going', reminderWeb: 'Available in the iOS and Android app', language: 'App language', theme: 'Appearance', help: 'Help and feedback', helpHint: 'Answers about the main app features', admin: 'Admin console', logout: 'Sign out', logoutHint: 'Sign out from this account', confirm: 'Sign out now?', confirmAction: 'Confirm sign out', cancel: 'Cancel', deviceNote: 'Preferences are saved on this device.', helpAccount: 'Account and sync', helpAccountBody: 'Sign in to enable account sync. Guest data stays on this device and is not merged automatically.', helpCv: 'Resume analysis', helpCvBody: 'Analysis requires a text-based English PDF and starts only after you agree.', helpMarket: 'Jobs and market listings', helpMarketBody: 'Saudi listings come from the connected source and may change or expire. Open the employer link before applying.', version: 'MASARAK · Version 1.0 · Your path, your pace.', system: 'System', light: 'Light', dark: 'Dark', arabic: 'العربية', english: 'English', logoutError: 'Could not sign out.',
  } : {
    back: 'رجوع', title: 'الإعدادات', hero: 'اختاري ما يناسبك.', account: 'الحساب والدعم', password: 'تغيير كلمة المرور', passwordHint: 'حافظي على أمان حسابك', privacy: 'الخصوصية والتحكم بالبيانات', privacyHint: 'كيف تُحفظ بياناتك وتُستخدم', preferences: 'التفضيلات', reminder: 'تذكيرات التعلم', reminderHint: 'تذكير لطيف لمواصلة التعلّم', reminderWeb: 'متاح في تطبيق iOS وAndroid', language: 'لغة التطبيق', theme: 'المظهر', help: 'المساعدة والملاحظات', helpHint: 'إجابات عن أهم ميزات التطبيق', admin: 'لوحة الإدارة', logout: 'تسجيل الخروج', logoutHint: 'الخروج من هذا الحساب', confirm: 'هل تريدين تسجيل الخروج الآن؟', confirmAction: 'تأكيد تسجيل الخروج', cancel: 'إلغاء', deviceNote: 'تُحفظ التفضيلات على هذا الجهاز.', helpAccount: 'الحساب والمزامنة', helpAccountBody: 'سجّلي الدخول لتفعيل مزامنة الحساب. تبقى بيانات الضيف على هذا الجهاز ولا تُدمج تلقائيًا.', helpCv: 'تحليل السيرة', helpCvBody: 'يتطلب التحليل ملف PDF نصيًا باللغة الإنجليزية، ولا يبدأ إلا بعد موافقتك.', helpMarket: 'الوظائف والإعلانات', helpMarketBody: 'تُجلب الإعلانات السعودية من المصدر المتصل وقد تتغير أو تنتهي. افتحي رابط جهة العمل قبل التقديم.', version: 'مسارك · الإصدار 1.0 · مسارك على وتيرتك.', system: 'حسب الجهاز', light: 'فاتح', dark: 'داكن', arabic: 'العربية', english: 'English', logoutError: 'تعذر تسجيل الخروج.',
  };

  return <SafeAreaView edges={['top', 'left', 'right']} style={ui.screen}>
    <ScrollView contentContainerStyle={ui.content}>
      <View style={[styles.topBar, en && styles.rowLtr]}>
        <Pressable accessibilityRole="button" onPress={() => router.canGoBack() ? router.back() : router.replace('/profile')} style={styles.backButton}><Text style={[ui.link, en && styles.ltr]}>{labels.back}</Text></Pressable>
        <Text style={[styles.topBarTitle, en && styles.ltr]}>{labels.title}</Text>
        <Text style={styles.more}>···</Text>
      </View>
      <Text style={[styles.hero, en && styles.ltr]}>{labels.hero}</Text>

      <Text style={[ui.heading, en && styles.ltr]}>{labels.preferences}</Text>
      <View style={ui.card}>
        <View style={[styles.reminderRow, en && styles.rowLtr]}>
          <View style={styles.iconBadge}><MasarakIcon name="bell" size={21} /></View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[styles.rowTitle, en && styles.ltr]}>{labels.reminder}</Text>
            <Text style={[styles.rowHint, en && styles.ltr]}>{labels.reminderHint}{Platform.OS === 'web' ? ` · ${labels.reminderWeb}` : ''}</Text>
          </View>
          <Switch
            accessibilityLabel={labels.reminder}
            accessibilityState={{ checked: reminderEnabled, disabled: !reminderReady || reminderBusy || Platform.OS === 'web' }}
            value={reminderEnabled}
            onValueChange={value => void updateLearningReminder(value)}
            disabled={!reminderReady || reminderBusy || Platform.OS === 'web'}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={colors.surface}
          />
        </View>
        <View style={{ borderBottomWidth: 1, borderColor: colors.border }} />
        <PreferenceRow icon="globe" title={labels.language} value={preferences.language === 'en' ? labels.english : labels.arabic} english={en} expanded={showLanguage} onPress={() => setShowLanguage(value => !value)}>
          <View style={styles.choices}>
            <Choice label={labels.arabic} selected={preferences.language === 'ar'} onPress={() => void saveLanguage('ar')} />
            <Choice label={labels.english} selected={preferences.language === 'en'} onPress={() => void saveLanguage('en')} />
          </View>
        </PreferenceRow>
        <View style={{ borderBottomWidth: 1, borderColor: colors.border }} />
        <PreferenceRow icon="palette" title={labels.theme} value={labels[preferences.theme]} english={en} expanded={showTheme} onPress={() => setShowTheme(value => !value)}>
          <View style={styles.choices}>
            {([{ id: 'system', label: labels.system }, { id: 'light', label: labels.light }, { id: 'dark', label: labels.dark }] as const).map(item =>
              <Choice key={item.id} label={item.label} selected={preferences.theme === item.id} onPress={() => void saveTheme(item.id)} />)}
          </View>
        </PreferenceRow>
        <Text style={[ui.note, en && styles.ltr]}>{labels.deviceNote}</Text>
      </View>

      <Text style={[ui.heading, en && styles.ltr]}>{labels.account}</Text>
      <View style={ui.card}>
        <SettingRow icon="shield" title={labels.privacy} hint={labels.privacyHint} onPress={() => router.push('/privacy')} english={en} />
        <SettingRow icon="lock" title={labels.password} hint={labels.passwordHint} onPress={() => auth.session ? router.push('/reset-password') : router.push({ pathname: '/account', params: { mode: 'login' } })} english={en} />
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: showHelp }} onPress={() => setShowHelp(value => !value)} style={({ pressed }) => [styles.row, styles.rowBorder, en && styles.rowLtr, pressed && ui.pressed]}>
          <View style={styles.iconBadge}><MasarakIcon name="help" size={21} /></View>
          <View style={{ flex: 1, gap: 4 }}><Text style={[styles.rowTitle, en && styles.ltr]}>{labels.help}</Text><Text style={[styles.rowHint, en && styles.ltr]}>{labels.helpHint}</Text></View>
          <Text style={styles.chevron}>{showHelp ? '⌄' : en ? '›' : '‹'}</Text>
        </Pressable>
        {showHelp ? <View style={styles.helpBody}>
          <Text style={[styles.helpTitle, en && styles.ltr]}>{labels.helpAccount}</Text><Text style={[ui.text, en && styles.ltr]}>{labels.helpAccountBody}</Text>
          <Text style={[styles.helpTitle, en && styles.ltr]}>{labels.helpCv}</Text><Text style={[ui.text, en && styles.ltr]}>{labels.helpCvBody}</Text>
          <Text style={[styles.helpTitle, en && styles.ltr]}>{labels.helpMarket}</Text><Text style={[ui.text, en && styles.ltr]}>{labels.helpMarketBody}</Text>
        </View> : null}
      </View>

      {adminAllowed ? <Pressable accessibilityRole="button" style={ui.outline} onPress={() => router.push('/admin' as never)}><Text style={ui.outlineText}>{labels.admin}</Text></Pressable> : null}

      {auth.session ? <View style={styles.signOutSection}>
        <Pressable accessibilityRole="button" onPress={() => setConfirmSignOut(true)} style={[styles.signOutRow, en && styles.rowLtr]}>
          <MasarakIcon name="logout" size={21} />
          <Text style={[styles.signOutText, en && styles.ltr]}>{labels.logout}</Text>
        </Pressable>
        {confirmSignOut ? <><Text style={[ui.text, en && styles.ltr]}>{labels.confirm}</Text>
          <Pressable accessibilityRole="button" disabled={busy} style={ui.button} onPress={() => void signOut()}><Text style={ui.buttonText}>{busy ? (en ? 'Signing out…' : 'جارٍ تسجيل الخروج…') : labels.confirmAction}</Text></Pressable>
          <Pressable accessibilityRole="button" disabled={busy} onPress={() => setConfirmSignOut(false)}><Text style={[ui.link, en && styles.ltr]}>{labels.cancel}</Text></Pressable></> : null}
      </View> : <Pressable accessibilityRole="button" style={ui.outline} onPress={() => router.push({ pathname: '/account', params: { mode: 'login' } })}><Text style={ui.outlineText}>{en ? 'Sign in' : 'تسجيل الدخول'}</Text></Pressable>}

      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {saved ? <Text accessibilityRole="status" style={styles.saved}>{saved}</Text> : null}
      <Text style={[ui.note, en && styles.ltr]}>{labels.version}</Text>
    </ScrollView>
  </SafeAreaView>;
}

function SettingRow({ icon, title, hint, onPress, english, last = false }: { icon: IconName; title: string; hint: string; onPress: () => void; english: boolean; last?: boolean }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.row, english && styles.rowLtr, !last && styles.rowBorder, pressed && ui.pressed]}>
    <View style={styles.iconBadge}><MasarakIcon name={icon} size={21} /></View>
    <View style={{ flex: 1, gap: 4 }}><Text style={[styles.rowTitle, english && styles.ltr]}>{title}</Text><Text style={[styles.rowHint, english && styles.ltr]}>{hint}</Text></View>
    <Text style={styles.chevron}>{english ? '›' : '‹'}</Text>
  </Pressable>;
}

function Choice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="radio" accessibilityState={{ selected }} onPress={onPress} style={[styles.choice, selected && styles.choiceActive]}>
    <Text style={[styles.choiceText, selected && styles.choiceTextActive]}>{selected ? '✓  ' : ''}{label}</Text>
  </Pressable>;
}

function PreferenceRow({ icon, title, value, english, expanded, onPress, children }: { icon: IconName; title: string; value: string; english: boolean; expanded: boolean; onPress: () => void; children: ReactNode }) {
  return <View>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={onPress} style={({ pressed }) => [styles.preferenceHeading, english && styles.rowLtr, pressed && ui.pressed]}>
    <View style={styles.iconBadge}><MasarakIcon name={icon} size={21} /></View>
      <Text style={[styles.optionHeading, { flex: 1 }, english && styles.ltr]}>{title}</Text>
      <Text style={[styles.preferenceValue, english && styles.ltr]}>{value}</Text>
      <Text style={styles.chevron}>{expanded ? '⌄' : english ? '›' : '‹'}</Text>
    </Pressable>
    {expanded ? children : null}
  </View>;
}

const styles = createAdaptiveStyles(() => ({
  ltr: { textAlign: 'left', writingDirection: 'ltr' },
  topBar: { minHeight: 46, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { minWidth: 54, minHeight: 44, justifyContent: 'center' },
  topBarTitle: { color: colors.ink, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  more: { minWidth: 54, color: colors.muted, fontSize: 24, lineHeight: 27, textAlign: 'left' },
  hero: { color: colors.navy, fontSize: 31, lineHeight: 38, fontWeight: '800', textAlign: 'right', marginTop: 5, marginBottom: 2 },
  row: { minHeight: 74, flexDirection: 'row-reverse', alignItems: 'center', gap: 14, paddingVertical: 13 },
  iconBadge: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  preferenceHeading: { minHeight: 64, flexDirection: 'row-reverse', alignItems: 'center', gap: 12, paddingVertical: 8 },
  preferenceValue: { color: colors.primary, fontSize: 14, fontWeight: '700', textAlign: 'right' },
  helpBody: { borderTopWidth: 1, borderColor: colors.border, paddingVertical: 12, gap: 8 },
  signOutSection: { gap: 9, paddingVertical: 8 },
  signOutRow: { minHeight: 48, flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },
  signOutText: { color: colors.primary, fontSize: 16, fontWeight: '700', textAlign: 'right' },
  rowLtr: { flexDirection: 'row' },
  reminderRow: { minHeight: 58, flexDirection: 'row-reverse', alignItems: 'center', gap: 14 },
  rowBorder: { borderBottomWidth: 1, borderColor: colors.border },
  rowTitle: { color: colors.ink, fontSize: 15, fontWeight: '600', textAlign: 'right' },
  rowHint: { color: colors.muted, fontSize: 12, lineHeight: 19, textAlign: 'right' },
  chevron: { color: colors.muted, fontSize: 25, lineHeight: 28 },
  optionHeading: { color: colors.ink, fontSize: 15, fontWeight: '600', textAlign: 'right' },
  choices: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
  choice: { minHeight: 42, minWidth: 92, paddingHorizontal: 15, paddingVertical: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 22, backgroundColor: colors.surface },
  choiceActive: { backgroundColor: colors.mint, borderColor: colors.primary },
  choiceText: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  choiceTextActive: { color: colors.primary },
  helpTitle: { color: colors.ink, fontSize: 15, fontWeight: '600', textAlign: 'right', marginTop: 5 },
  error: { color: colors.error, fontSize: 14, textAlign: 'right' },
  saved: { color: colors.primary, fontSize: 13, textAlign: 'right' },
}));
