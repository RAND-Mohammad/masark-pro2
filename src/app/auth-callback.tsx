import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/auth-context';
import { colors, ui } from '../constants/design';
import { useAppPreferences } from '../contexts/app-preferences-context';

export default function AuthCallbackScreen() {
  const router = useRouter();
  const auth = useAuth();
  const { language } = useAppPreferences(); const en = language === 'en';
  return <SafeAreaView style={[ui.screen, { padding: 28, justifyContent: 'center', alignItems: 'center', gap: 20 }]}>
    <Text style={[ui.title, en && styles.ltr]}>{auth.callbackError ? (en ? 'Confirmation failed' : 'لم يكتمل التأكيد') : (en ? 'Confirm your account' : 'تأكيد حسابك')}</Text>
    {auth.callbackError ? <Text style={[ui.text, { color: colors.error }, en && styles.ltr]}>{auth.callbackError}</Text> : <><ActivityIndicator color={colors.primary} /><Text style={[ui.text, en && styles.ltr]}>{en ? 'Checking your link…' : 'جارٍ التحقق من الرابط…'}</Text></>}
    <Pressable accessibilityRole="button" style={ui.outline} onPress={() => router.replace({ pathname: '/account', params: { mode: 'login' } })}><Text style={ui.outlineText}>{en ? 'Back to sign in' : 'العودة لتسجيل الدخول'}</Text></Pressable>
  </SafeAreaView>;
}

const styles = { ltr: { textAlign: 'left' as const, writingDirection: 'ltr' as const } };
