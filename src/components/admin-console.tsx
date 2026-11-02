import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/auth-context';
import { useAppPreferences } from '../contexts/app-preferences-context';
import { adminRequest } from '../utils/admin-api';
import { createAdaptiveStyles, getDesignScheme } from '../constants/design';

const palettes = {
  light: {
    navy: '#102541', heading: '#102541', navySoft: '#1C3657', canvas: '#F3F6F4', white: '#FFFFFF', ink: '#193C3B', muted: '#6E817C', teal: '#12635E', mint: '#E6F0EB', border: '#DCE6E0', amber: '#F4EBD9', red: '#9B3B32', green: '#2F7D68',
    brandMark: '#D9EEE7', brandMarkInk: '#102541', sidebarText: '#D5DFE9', sidebarOn: '#FFFFFF', sidebarMuted: '#91A4B9', sidebarBorder: '#304663', sidebarIndex: '#213A58', sidebarActive: '#D8EEE6', selection: '#F1F7F3', inputBackground: '#FEFFFD', successSurface: '#E2F2EC', successInk: '#205B4A', warningInk: '#735920', errorSurface: '#FAE7E4', errorInk: '#9B3B32', neutralSurface: '#E9EFEB', onTeal: '#FFFFFF', footer: '#85938F',
  },
  dark: {
    navy: '#0D1929', heading: '#D5E2EF', navySoft: '#1A2A3B', canvas: '#101817', white: '#192321', ink: '#E5F0EB', muted: '#A7B8B1', teal: '#70C5B9', mint: '#243A35', border: '#354640', amber: '#3B3220', red: '#F09188', green: '#63C6A2',
    brandMark: '#243A35', brandMarkInk: '#D5EDE4', sidebarText: '#D5DFE9', sidebarOn: '#F4F8FF', sidebarMuted: '#9FB0C2', sidebarBorder: '#2C4056', sidebarIndex: '#1D3044', sidebarActive: '#244239', selection: '#20332E', inputBackground: '#14201D', successSurface: '#203B34', successInk: '#9DDEC7', warningInk: '#E8CF8D', errorSurface: '#3A2523', errorInk: '#F09188', neutralSurface: '#26332F', onTeal: '#102522', footer: '#8FA39B',
  },
} as const;
type AdminPalette = typeof palettes.light;
const palette = new Proxy({} as AdminPalette, {
  get: (_target, key: string | symbol) => typeof key === 'string' && key in palettes[getDesignScheme()]
    ? palettes[getDesignScheme()][key as keyof AdminPalette]
    : undefined,
});
const pages = [
  { id: 'overview', route: '/admin', title: 'مراقبة النظام', titleEn: 'System overview', hint: 'حالة الخدمات والكتالوج', hintEn: 'Service and catalog status', icon: '01' },
  { id: 'sources', route: '/admin/sources', title: 'مصادر الوظائف', titleEn: 'Job sources', hint: 'Headcount Labs', hintEn: 'Headcount Labs', icon: '02' },
  { id: 'resources', route: '/admin/learning-resources', title: 'موارد التعلّم', titleEn: 'Learning resources', hint: 'محتوى المسارات', hintEn: 'Career path content', icon: '03' },
] as const;

export type AdminPage = (typeof pages)[number]['id'];

export function AdminFrame({ active, title, titleEn, children }: { active: AdminPage; title?: string; titleEn?: string; children: ReactNode }) {
  const auth = useAuth();
  const router = useRouter();
  const en = useAppPreferences().language === 'en';
  const narrow = useWindowDimensions().width < 860;
  const [checkResult, setCheckResult] = useState<{ token: string; allowed: boolean; error: string } | null>(null);
  const [checkVersion, setCheckVersion] = useState(0);
  const token = auth.session?.access_token ?? '';
  useEffect(() => {
    let live = true;
    if (!auth.ready || !token) return () => { live = false; };
    void adminRequest<{ role: string }>('session', {}, en ? 'en' : 'ar').then(() => { if (live) setCheckResult({ token, allowed: true, error: '' }); }).catch(error => {
      if (!live) return;
      const message = error instanceof Error ? error.message : 'تعذر التحقق من صلاحيات الحساب.';
      setCheckResult({ token, allowed: false, error: message });
    });
    return () => { live = false; };
  }, [auth.ready, token, checkVersion, en]);
  const gate = !auth.ready ? 'checking' : !token ? 'denied' : checkResult?.token !== token ? 'checking' : checkResult.allowed ? 'allowed' : 'error';
  const gateError = checkResult?.token === token ? checkResult.error : '';

  if (!auth.ready || gate === 'checking') return <GatePanel title="جارٍ التحقق" titleEn="Checking access" body="نتحقق من جلسة الحساب وصلاحية الإدارة…" bodyEn="Checking your account session and admin permissions…" />;
  if (!auth.session) return <GatePanel title="تسجيل دخول الإدارة" titleEn="Admin sign in" body="تحتاج هذه الصفحة إلى حساب مشرف مضاف في إعدادات الخادم." bodyEn="This page requires an admin account added to the server allowlist." action="تسجيل الدخول" actionEn="Sign in" onAction={() => router.push({ pathname: '/account', params: { mode: 'login', redirect: '/admin' } })} />;
  if (gate !== 'allowed') {
    const unauthorized = gate === 'error' && gateError.includes('غير مخول');
    return <GatePanel title={gate === 'denied' ? 'تسجيل دخول الإدارة' : unauthorized ? 'لا توجد صلاحية إدارة' : 'تعذر التحقق من لوحة الإدارة'} titleEn={gate === 'denied' ? 'Admin sign in' : unauthorized ? 'Admin access denied' : 'Could not verify admin access'} body={gateError || 'تأكدي من اتصال الخادم وإعداد حساب المشرف.'} bodyEn={gateError ? translateAdminError(gateError) : 'Check the server connection and admin account configuration.'} action={gate === 'error' ? 'إعادة التحقق' : undefined} actionEn={gate === 'error' ? 'Retry' : undefined} onAction={() => setCheckVersion(value => value + 1)} />;
  }

  const current = pages.find(page => page.id === active)!;
  const currentTitle = en && titleEn ? titleEn : title ?? current.title;
  const currentTitleEn = titleEn ?? current.titleEn;
  return <SafeAreaView style={styles.safe} edges={['top', 'bottom']}><View style={[styles.app, narrow && { flexDirection: 'column' }]}>
    <View style={[styles.sidebar, narrow && { width: '100%', paddingHorizontal: 14, paddingVertical: 12, gap: 12 }]}>
      <View style={[styles.brand, en && styles.row]}><View style={styles.brandMark}><Text style={styles.brandMarkText}>م</Text></View><View><Text style={styles.brandName}>MASARAK</Text><Text style={[styles.brandSub, en && styles.ltr]}>{en ? 'Masarak · Admin' : 'مسارك · إدارة النظام'}</Text></View></View>
      {!narrow && <Text style={[styles.navLabel, en && styles.ltr]}>{en ? 'Administration' : 'مساحة الإدارة'}</Text>}
      <View style={[styles.nav, narrow && { flexDirection: en ? 'row' : 'row-reverse', marginTop: 0 }]}>{pages.map(page => <Pressable key={page.id} accessibilityRole="link" accessibilityState={{ selected: active === page.id }} accessibilityLabel={en ? page.titleEn : page.title} onPress={() => router.replace(page.route as never)} style={[styles.navItem, en && styles.row, narrow && { flex: 1, paddingHorizontal: 5, paddingVertical: 8, justifyContent: 'center' }, active === page.id && styles.navItemActive]}>
        <View style={[styles.navIndex, active === page.id && styles.navIndexActive, narrow && { display: 'none' }]}><Text style={[styles.navIndexText, active === page.id && styles.navIndexTextActive]}>{page.icon}</Text></View>
        <View style={styles.navCopy}><Text style={[styles.navTitle, en && styles.ltr, active === page.id && styles.navTitleActive]} numberOfLines={1}>{en ? page.titleEn : page.title}</Text>{!narrow && <Text style={[styles.navHint, en && styles.ltr]}>{en ? page.hintEn : page.hint}</Text>}</View>
      </Pressable>)}</View>
      {!narrow && <View style={[styles.sidebarBottom, en && styles.row]}><View style={styles.userDot}><Text style={styles.userDotText}>{auth.session?.user.email?.slice(0, 1).toUpperCase() ?? 'م'}</Text></View><View style={styles.navCopy}><Text style={[styles.navTitle, en && styles.ltr]}>{en ? 'Admin account' : 'حساب مشرف'}</Text><Text style={[styles.navHint, en && styles.ltr]}>{auth.session?.user.email ?? 'مسارك'}</Text></View></View>}
    </View>
    <ScrollView style={styles.mainScroll} contentContainerStyle={[styles.mainContent, narrow && { paddingHorizontal: 14, paddingTop: 19 }]}>
      <View style={[styles.topbar, en && styles.row]}>
        <View>
          <Text style={[styles.eyebrow, en && styles.ltr]}>{en ? `Admin console / ${currentTitleEn}` : `لوحة التحكم / ${currentTitle}`}</Text>
          <Text style={[styles.pageTitle, en && styles.ltr]}>{currentTitle}</Text>
        </View>
        <View style={[styles.topActions, en && styles.row]}>
          <Pressable accessibilityRole="button" accessibilityLabel={en ? 'Return to the Masarak app' : 'العودة إلى تطبيق مسارك'} onPress={() => router.replace('/home' as never)} style={({ pressed }) => [styles.returnButton, en && styles.row, pressed && styles.returnButtonPressed]}>
            <Text style={[styles.returnIcon, en && styles.ltr]}>{en ? '←' : '↗'}</Text>
            <Text style={[styles.returnText, en && styles.ltr]}>{en ? 'Open user app' : 'العودة إلى التطبيق'}</Text>
          </Pressable>
          <View style={[styles.adminBadge, en && styles.row]}><View style={styles.liveDot} /><Text style={[styles.adminBadgeText, en && styles.ltr]}>{en ? 'Protected admin area' : 'مساحة إدارية محمية'}</Text></View>
        </View>
      </View>
      {children}
      <Text style={styles.footer}>{en ? 'Masarak · Internal administration · CV data is not shown' : 'مسارك · لوحة إدارة داخلية · لا تعرض بيانات السير الذاتية'}</Text>
    </ScrollView>
  </View></SafeAreaView>;
}

export function AdminCard({ children, style }: { children: ReactNode; style?: object }) { return <View style={[styles.card, style]}>{children}</View>; }
export function AdminHeading({ title, hint }: { title: string; hint?: string }) {
  const en = !/[\u0600-\u06FF]/.test(`${title} ${hint ?? ''}`);
  const ltr = en ? styles.ltr : undefined;
  return <View style={[styles.sectionHeading, en && styles.row]}><Text style={[styles.sectionTitle, ltr]}>{title}</Text>{hint ? <Text style={[styles.sectionHint, ltr]}>{hint}</Text> : null}</View>;
}
export function AdminPill({ children, tone = 'neutral' }: { children: string; tone?: 'neutral' | 'success' | 'warning' | 'error' }) {
  const toneStyle = tone === 'success' ? styles.pillSuccess : tone === 'warning' ? styles.pillWarning : tone === 'error' ? styles.pillError : styles.pillNeutral;
  const textStyle = tone === 'success' ? styles.pillSuccessText : tone === 'warning' ? styles.pillWarningText : tone === 'error' ? styles.pillErrorText : styles.pillNeutralText;
  return <View style={[styles.pill, toneStyle]}><Text style={[styles.pillText, textStyle]}>{children}</Text></View>;
}
export function AdminButton({ title, onPress, disabled, secondary }: { title: string; onPress: () => void; disabled?: boolean; secondary?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: Boolean(disabled) }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, secondary && styles.buttonSecondary, (disabled || pressed) && styles.buttonMuted]}><Text style={[styles.buttonText, secondary && styles.buttonTextSecondary]}>{title}</Text></Pressable>;
}
export function AdminError({ children }: { children: string }) { const en = !/[\u0600-\u06FF]/.test(children); return children ? <View style={styles.errorBox}><Text style={[styles.errorText, en && styles.ltr]}>{children}</Text></View> : null; }
export function AdminLoading({ text }: { text?: string }) { const en = useAppPreferences().language === 'en'; return <AdminCard><Text style={[styles.bodyText, en && styles.ltr]}>{text ?? (en ? 'Loading data…' : 'جارٍ تحميل البيانات…')}</Text></AdminCard>; }
export function adminStyles() { return styles; }
export { palette as adminPalette };

function GatePanel({ title, titleEn, body, bodyEn, action, actionEn, onAction }: { title: string; titleEn: string; body: string; bodyEn: string; action?: string; actionEn?: string; onAction?: () => void }) {
  const en = useAppPreferences().language === 'en';
  return <SafeAreaView style={styles.gate}><View style={[styles.gateCard, en && { alignItems: 'flex-start' }]}><View style={styles.brandMark}><Text style={styles.brandMarkText}>م</Text></View><Text style={[styles.pageTitle, en && styles.ltr]}>{en ? titleEn : title}</Text><Text style={[styles.bodyText, en && styles.ltr]}>{en ? bodyEn : body}</Text>{action && onAction ? <AdminButton title={en ? actionEn ?? action : action} onPress={onAction} /> : null}</View></SafeAreaView>;
}

function translateAdminError(message: string) {
  if (message.includes('غير مخول')) return 'This account is not authorized to access the admin console.';
  if (message.includes('تعذر الاتصال')) return 'Could not reach the Masarak server. Start it and retry.';
  if (message.includes('سجّل الدخول')) return 'Sign in with the admin account and retry.';
  if (message.includes('ترحيل')) return 'Apply the admin database migration, then retry.';
  return 'Admin access could not be verified. Check the server and retry.';
}

const styles = createAdaptiveStyles(() => ({
  safe: { flex: 1, backgroundColor: palette.canvas }, app: { flex: 1, flexDirection: 'row', backgroundColor: palette.canvas },
  ltr: { textAlign: 'left', writingDirection: 'ltr' }, row: { flexDirection: 'row' },
  sidebar: { width: 258, backgroundColor: palette.navy, paddingHorizontal: 18, paddingVertical: 24, gap: 28 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 8 }, brandMark: { width: 42, height: 42, borderRadius: 13, backgroundColor: palette.brandMark, alignItems: 'center', justifyContent: 'center' }, brandMarkText: { fontSize: 21, color: palette.brandMarkInk, fontWeight: '800' }, brandName: { color: palette.sidebarOn, fontSize: 16, fontWeight: '800', letterSpacing: 1.4 }, brandSub: { color: '#BCC9D7', fontSize: 11, marginTop: 3 },
  navLabel: { color: '#96A9BD', fontSize: 11, fontWeight: '700', paddingHorizontal: 10, textAlign: 'right' }, nav: { gap: 8, marginTop: -18 }, navItem: { flexDirection: 'row-reverse', alignItems: 'center', gap: 11, padding: 11, borderRadius: 13 }, navItemActive: { backgroundColor: palette.navySoft }, navIndex: { width: 33, height: 33, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.sidebarIndex }, navIndexActive: { backgroundColor: palette.sidebarActive }, navIndexText: { color: '#CFD9E4', fontSize: 10, fontWeight: '700' }, navIndexTextActive: { color: palette.teal }, navCopy: { flex: 1, gap: 3 }, navTitle: { color: palette.sidebarText, fontSize: 13, fontWeight: '600', textAlign: 'right' }, navTitleActive: { color: palette.sidebarOn }, navHint: { color: palette.sidebarMuted, fontSize: 10, textAlign: 'right' }, sidebarBottom: { marginTop: 'auto', borderTopWidth: 1, borderColor: palette.sidebarBorder, paddingTop: 17, flexDirection: 'row-reverse', alignItems: 'center', gap: 10 }, userDot: { backgroundColor: '#365273', borderRadius: 20, width: 34, height: 34, alignItems: 'center', justifyContent: 'center' }, userDotText: { color: palette.sidebarOn, fontWeight: '700' },
  mainScroll: { flex: 1 }, mainContent: { width: '100%', maxWidth: 1320, alignSelf: 'center', paddingHorizontal: 36, paddingTop: 30, paddingBottom: 36, gap: 22 }, topbar: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14, marginBottom: 6 }, topActions: { flexDirection: 'row-reverse', alignItems: 'center', flexWrap: 'wrap', gap: 9 }, eyebrow: { textAlign: 'right', color: palette.muted, fontSize: 12, marginBottom: 7 }, pageTitle: { color: palette.heading, textAlign: 'right', fontSize: 25, fontWeight: '800' }, returnButton: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 40, paddingVertical: 8, paddingHorizontal: 13, backgroundColor: palette.mint, borderColor: palette.border, borderWidth: 1, borderRadius: 20 }, returnButtonPressed: { opacity: 0.72 }, returnIcon: { color: palette.teal, fontSize: 17, fontWeight: '700' }, returnText: { color: palette.teal, fontSize: 12, fontWeight: '700' }, adminBadge: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, paddingVertical: 9, paddingHorizontal: 12, backgroundColor: palette.white, borderColor: palette.border, borderWidth: 1, borderRadius: 20 }, liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: palette.green }, adminBadgeText: { color: palette.muted, fontSize: 11 },
  card: { backgroundColor: palette.white, borderRadius: 18, borderColor: palette.border, borderWidth: 1, padding: 21, gap: 15 }, sectionHeading: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 1 }, sectionTitle: { color: palette.ink, textAlign: 'right', fontSize: 17, fontWeight: '700' }, sectionHint: { color: palette.muted, textAlign: 'right', fontSize: 12 }, bodyText: { color: palette.muted, textAlign: 'right', fontSize: 14, lineHeight: 23 }, footer: { textAlign: 'center', color: palette.footer, fontSize: 11, marginTop: 5 },
  pill: { borderRadius: 20, paddingVertical: 6, paddingHorizontal: 10, alignSelf: 'flex-start' }, pillText: { fontSize: 11, fontWeight: '700' }, pillSuccess: { backgroundColor: palette.successSurface }, pillSuccessText: { color: palette.successInk }, pillWarning: { backgroundColor: palette.amber }, pillWarningText: { color: palette.warningInk }, pillError: { backgroundColor: palette.errorSurface }, pillErrorText: { color: palette.errorInk }, pillNeutral: { backgroundColor: palette.neutralSurface }, pillNeutralText: { color: palette.ink }, button: { minHeight: 42, borderRadius: 11, paddingHorizontal: 17, backgroundColor: palette.teal, alignItems: 'center', justifyContent: 'center' }, buttonSecondary: { backgroundColor: palette.white, borderWidth: 1, borderColor: palette.border }, buttonMuted: { opacity: 0.58 }, buttonText: { color: palette.onTeal, fontSize: 13, fontWeight: '700' }, buttonTextSecondary: { color: palette.teal },
  errorBox: { backgroundColor: palette.errorSurface, borderColor: palette.border, borderWidth: 1, borderRadius: 12, padding: 13 }, errorText: { color: palette.red, textAlign: 'right', fontSize: 13, lineHeight: 20 }, gate: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.canvas, padding: 24 }, gateCard: { width: '100%', maxWidth: 540, borderRadius: 22, backgroundColor: palette.white, borderColor: palette.border, borderWidth: 1, padding: 28, alignItems: 'flex-end', gap: 16 },
}));
