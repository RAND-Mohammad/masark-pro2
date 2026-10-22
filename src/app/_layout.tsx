import { Stack } from 'expo-router';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { MasarakNav } from '../components/masarak-nav';
import { colors, ui } from '../constants/design';
import { AuthProvider, useAuth } from '../contexts/auth-context';
import { CloudProvider, useCloud } from '../contexts/cloud-context';

function AppScreens() {
  const auth = useAuth();
  const cloud = useCloud();
  if (!auth.ready) return <SafeAreaView style={[ui.screen, { alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 }]}>
    {auth.error ? <><Text style={ui.text}>{auth.error}</Text><Pressable accessibilityRole="button" onPress={auth.reload} style={ui.button}><Text style={ui.buttonText}>إعادة المحاولة</Text></Pressable></> : <><ActivityIndicator color={colors.primary} /><Text style={ui.text}>جارٍ فتح مسارك…</Text></>}
  </SafeAreaView>;
  return <View key={(auth.session?.user.id ?? 'guest') + ':' + cloud.restoreVersion} style={{ flex: 1 }}>
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
    <MasarakNav />
    {(!cloud.ready || cloud.restoring) && <View style={{ position: 'absolute', top: 0, right: 0, left: 0, bottom: 0, zIndex: 100, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', gap: 16 }}><ActivityIndicator color={colors.primary} /><Text style={ui.text}>جارٍ استرجاع ملف حسابك…</Text></View>}
  </View>;
}
function AccountScreens() {
  const auth = useAuth();
  return <CloudProvider key={auth.session?.user.id ?? 'guest'}><StatusBar style="dark" /><AppScreens /></CloudProvider>;
}
export default function RootLayout() {
  useEffect(() => { SplashScreen.hideAsync().catch(() => {}); }, []);
  return <SafeAreaProvider><AuthProvider><AccountScreens /></AuthProvider></SafeAreaProvider>;
}
