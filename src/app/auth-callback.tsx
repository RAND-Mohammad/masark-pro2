import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/auth-context';
import { colors, ui } from '../constants/design';

export default function AuthCallbackScreen() {
  const router = useRouter();
  const auth = useAuth();
  return <SafeAreaView style={[ui.screen, { padding: 28, justifyContent: 'center', alignItems: 'center', gap: 20 }]}>
    <Text style={ui.title}>{auth.callbackError ? 'لم يكتمل التأكيد' : 'تأكيد حسابك'}</Text>
    {auth.callbackError ? <Text style={[ui.text, { color: colors.error }]}>{auth.callbackError}</Text> : <><ActivityIndicator color={colors.primary} /><Text style={ui.text}>جارٍ التحقق من الرابط…</Text></>}
    <Pressable accessibilityRole="button" style={ui.outline} onPress={() => router.replace({ pathname: '/account', params: { mode: 'login' } })}><Text style={ui.outlineText}>العودة لتسجيل الدخول</Text></Pressable>
  </SafeAreaView>;
}
