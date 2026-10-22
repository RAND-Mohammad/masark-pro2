import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/auth-context';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { MasarakBrand } from '../components/masarak-brand';
import { colors, ui } from '../constants/design';

export default function WelcomeScreen() {
  const router = useRouter();
  const auth = useAuth();
  return <SafeAreaView style={ui.screen}><ScrollView contentContainerStyle={styles.content}>
    <Text style={styles.eyebrow}>مستقبلك يبدأ من هنا</Text><View style={styles.logo}><MasarakBrand large /></View>
    <Text style={styles.title}>اكتشف مسارك.{ '\n' }وابنِ مستقبلك.</Text><Text style={styles.description}>رفيقك المهني في عالم التقنية.{ '\n' }من مهاراتك اليوم، إلى فرصك بكرة.</Text>
    <View style={styles.art} accessible={false}><Svg width="100%" height="145" viewBox="0 0 340 145"><Path d="M15 118 C78 147 86 41 165 82 S224 25 322 28" fill="none" stroke="#DCEAE0" strokeWidth="35" /><Path d="M15 118 C78 147 86 41 165 82 S224 25 322 28" fill="none" stroke="#8CB49A" strokeWidth="1.4" strokeDasharray="3 5" /><Circle cx="100" cy="88" r="7" fill={colors.primary} stroke={colors.surface} strokeWidth="3" /><Circle cx="245" cy="53" r="7" fill={colors.gold} stroke={colors.surface} strokeWidth="3" /></Svg></View>
    <View style={styles.actions}>{!auth.session && <><Pressable accessibilityRole="button" style={({ pressed }) => [ui.button, pressed && ui.pressed]} onPress={() => router.push({ pathname: '/account', params: { mode: 'login' } })}><Text style={ui.buttonText}>تسجيل دخول</Text></Pressable><Pressable accessibilityRole="button" style={({ pressed }) => [ui.outline, pressed && ui.pressed]} onPress={() => router.push({ pathname: '/account', params: { mode: 'signup' } })}><Text style={ui.outlineText}>تسجيل جديد</Text></Pressable></>}<Pressable accessibilityRole="button" onPress={() => router.replace('/home')}><Text style={styles.skip}>{auth.session ? 'متابعة إلى حسابي ←' : 'متابعة دون حساب ←'}</Text></Pressable></View>
    <Text style={styles.note}>اكتشف مهاراتك. اختر اتجاهك. ابدأ رحلتك.</Text>
  </ScrollView></SafeAreaView>;
}
const styles = StyleSheet.create({ content: { width: '100%', maxWidth: 460, alignSelf: 'center', flexGrow: 1, padding: 28, paddingTop: 38, justifyContent: 'center', gap: 22 }, eyebrow: { color: colors.muted, fontSize: 11, textAlign: 'center', letterSpacing: 2 }, logo: { marginVertical: 22 }, title: { color: colors.ink, fontSize: 32, lineHeight: 45, fontWeight: '700', textAlign: 'center' }, description: { color: colors.muted, fontSize: 15, lineHeight: 25, textAlign: 'center' }, art: { marginVertical: 0 }, actions: { gap: 12 }, skip: { color: colors.primary, fontSize: 14, textAlign: 'center', padding: 12 }, note: { color: colors.muted, fontSize: 11, lineHeight: 20, textAlign: 'center' } });
