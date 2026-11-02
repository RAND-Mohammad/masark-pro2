import { Stack, usePathname, useRouter } from 'expo-router';
import { ActivityIndicator, Platform, Pressable, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { MasarakNav } from '../components/masarak-nav';
import { colors, ui } from '../constants/design';
import { AuthProvider, useAuth } from '../contexts/auth-context';
import { CloudProvider, useCloud } from '../contexts/cloud-context';
import { AppPreferencesProvider, useAppPreferences } from '../contexts/app-preferences-context';
import { refreshLearningResources } from '../utils/learning-resource-sync';
import { AdminRequestError, adminRequest } from '../utils/admin-api';

function AppScreens() {
  const pathname = usePathname();
  const router = useRouter();
  const auth = useAuth();
  const cloud = useCloud();
  const { language } = useAppPreferences();
  const en = language === 'en';
  const accessToken = auth.session?.access_token;
  const tablessRoutes = ['/', '/onboarding', '/account', '/auth-callback', '/reset-password', '/delete-account', '/profile-setup', '/choose-goal'];
  const [adminRouteCheck, setAdminRouteCheck] = useState<{ token: string; status: 'admin' | 'regular' | 'unavailable' } | null>(null);
  const [dismissedAdminNotice, setDismissedAdminNotice] = useState<string | null>(null);
  useEffect(() => { void refreshLearningResources(); }, []);
  useEffect(() => {
    let active = true;
    if (!auth.ready || !accessToken || auth.callbackBusy || auth.recoveryPending || pathname === '/account' || adminRouteCheck?.token === accessToken) {
      return () => { active = false; };
    }
    void adminRequest('session', { signal: AbortSignal.timeout(5000) }, en ? 'en' : 'ar')
      .then(() => { if (active) setAdminRouteCheck({ token: accessToken, status: 'admin' }); })
      .catch(failure => {
        if (!active) return;
        setAdminRouteCheck({ token: accessToken, status: failure instanceof AdminRequestError && failure.status === 403 ? 'regular' : 'unavailable' });
      });
    return () => { active = false; };
  }, [auth.ready, accessToken, auth.callbackBusy, auth.recoveryPending, pathname, adminRouteCheck, en]);
  useEffect(() => {
    if (!auth.ready || !accessToken || auth.callbackBusy || auth.recoveryPending || pathname === '/account' || pathname === '/reset-password' || adminRouteCheck?.token !== accessToken) return;
    const accountManagementRoute = ['/profile', '/edit-profile', '/settings', '/privacy', '/delete-account'].includes(pathname);
    if (adminRouteCheck.status === 'admin' && !pathname.startsWith('/admin') && !accountManagementRoute) router.replace('/admin' as never);
    else if (adminRouteCheck.status === 'regular' && pathname.startsWith('/admin')) router.replace('/home');
  }, [auth.ready, accessToken, auth.callbackBusy, auth.recoveryPending, pathname, adminRouteCheck, router]);
  if (!auth.ready) return <SafeAreaView style={[ui.screen, { alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 }]}>
    {auth.error ? <><Text style={ui.text}>{auth.error}</Text><Pressable accessibilityRole="button" onPress={auth.reload} style={ui.button}><Text style={ui.buttonText}>إعادة المحاولة</Text></Pressable></> : <><ActivityIndicator color={colors.primary} /><Text style={ui.text}>جارٍ فتح مسارك…</Text></>}
  </SafeAreaView>;
  const adminUnavailable = Boolean(auth.session && accessToken && adminRouteCheck?.token === accessToken && adminRouteCheck.status === 'unavailable' && !pathname.startsWith('/admin'));
  return <View key={(auth.session?.user.id ?? 'guest') + ':' + cloud.restoreVersion} style={{ flex: 1 }}>
    {adminUnavailable && dismissedAdminNotice !== accessToken ? <View accessibilityRole="alert" style={{ backgroundColor: colors.errorSurface, borderBottomWidth: 1, borderColor: colors.errorBorder, paddingHorizontal: 16, paddingVertical: 11, gap: 8 }}>
      <Text style={[ui.text, { color: colors.error, fontSize: 13, lineHeight: 20, textAlign: en ? 'left' : 'right', writingDirection: en ? 'ltr' : 'rtl' }]}>{en ? 'Could not verify account access. Start the app and Node.js server with npm.cmd start, then retry. Admin accounts open the console automatically.' : 'تعذر التحقق من صلاحية الحساب. شغّلي التطبيق وخادم Node.js بالأمر npm.cmd start ثم أعيدي المحاولة. ينتقل حساب الإدارة تلقائيًا إلى اللوحة.'}</Text>
      <View style={{ flexDirection: en ? 'row' : 'row-reverse', gap: 18 }}>
        <Pressable accessibilityRole="button" onPress={() => { setDismissedAdminNotice(null); setAdminRouteCheck(null); }}><Text style={[ui.link, { fontSize: 14, paddingVertical: 2 }]}>{en ? 'Retry' : 'إعادة المحاولة'}</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={() => setDismissedAdminNotice(accessToken ?? null)}><Text style={[ui.link, { fontSize: 14, paddingVertical: 2 }]}>{en ? 'Dismiss' : 'إخفاء'}</Text></Pressable>
      </View>
    </View> : null}
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
      {!pathname.startsWith('/admin') && !tablessRoutes.includes(pathname) && <MasarakNav />}
    </View>
    {(!cloud.ready || cloud.restoring) && <View style={{ position: 'absolute', top: 0, right: 0, left: 0, bottom: 0, zIndex: 100, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', gap: 16 }}><ActivityIndicator color={colors.primary} /><Text style={ui.text}>جارٍ استرجاع ملف حسابك…</Text></View>}
  </View>;
}
function AccountScreens() {
  const auth = useAuth();
  const preferences = useAppPreferences();
  if (!preferences.ready) return <SafeAreaView style={[ui.screen, { alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 }]}><ActivityIndicator color={colors.primary} /><Text style={ui.text}>{preferences.language === 'en' ? 'Loading preferences…' : 'جارٍ تحميل تفضيلاتك…'}</Text></SafeAreaView>;
  return <CloudProvider key={auth.session?.user.id ?? 'guest'}><StatusBar style={preferences.effectiveTheme === 'dark' ? 'light' : 'dark'} /><AppScreens key={preferences.effectiveTheme} /></CloudProvider>;
}
export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
    if (Platform.OS !== 'web') void import('expo-notifications').then(({ setNotificationHandler }) => {
      setNotificationHandler({
        handleNotification: async () => ({
          shouldPlaySound: false,
          shouldSetBadge: false,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });
    });
  }, []);
  return <SafeAreaProvider><AppPreferencesProvider><AuthProvider><AccountScreens /></AuthProvider></AppPreferencesProvider></SafeAreaProvider>;
}
