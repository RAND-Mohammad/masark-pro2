import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, ui } from '../constants/design';
import { useAuth } from '../contexts/auth-context';
import { supabase } from '../utils/supabase';
import { authErrorMessage } from '../utils/auth-errors';
import { authRedirectUrl } from '../utils/auth-redirect';
import { normalizeSignupCode, signupResendSeconds } from '../utils/signup-confirmation';

const RECOVERY_RESEND_DELAY_MS = 60000;

export default function ResetPasswordScreen() {
  const router = useRouter();
  const auth = useAuth();
  const [emailSent, setEmailSent] = useState(false);
  const [completedOwner, setCompletedOwner] = useState<string | null>(null);
  const stage = auth.session ? (completedOwner === auth.session.user.id ? 'done' : 'change') : emailSent ? 'verify' : 'send';
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [codeEntry, setCodeEntry] = useState(false);
  const [resendAvailableAt, setResendAvailableAt] = useState(0);
  const [now, setNow] = useState(Date.now);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const locked = useRef(false);
  const resendSeconds = signupResendSeconds(resendAvailableAt, now);
  useEffect(() => {
    if (stage !== 'verify' && stage !== 'send') return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [stage]);
  async function perform() {
    if (!supabase || locked.current || !auth.ready || !auth.configured) return;
    if (stage === 'done') return;
    if (stage === 'send' && signupResendSeconds(resendAvailableAt, Date.now()) > 0) return;
    if (stage === 'verify' && !codeEntry) return;
    if (stage === 'change' && !auth.session) { setError('انتهت جلسة الاستعادة. اطلب رسالة جديدة.'); return; }
    if (stage === 'send' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError('أدخل بريدًا إلكترونيًا صالحًا.'); return; }
    if (stage === 'verify' && !/^\d{6,10}$/.test(token.trim())) { setError('أدخل الرمز الموجود في البريد.'); return; }
    if (stage === 'change' && (password.length < 8 || password !== confirmation)) { setError('استخدم 8 أحرف على الأقل وتأكد من تطابق كلمتي المرور.'); return; }
    locked.current = true; setBusy(true); setError('');
    try {
      if (stage === 'send') {
        const result = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: authRedirectUrl() });
        if (result.error) throw result.error;
        const current = Date.now();
        setNow(current); setResendAvailableAt(current + RECOVERY_RESEND_DELAY_MS);
        setToken(''); setCodeEntry(false);
        setEmailSent(true);
      } else if (stage === 'verify') {
        const result = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: normalizeSignupCode(token), type: 'recovery' });
        if (result.error) throw result.error;
        if (!result.data?.session) throw new Error('No recovery session returned');
        setToken('');
      } else if (stage === 'change') {
        const result = await supabase.auth.updateUser({ password });
        if (result.error) throw result.error;
        if (!result.data?.user || result.data.user.id !== auth.session?.user.id) throw new Error('Password change was not confirmed');
        setPassword(''); setConfirmation(''); auth.finishRecovery(); setCompletedOwner(result.data.user.id);
      }
    } catch (failure) { setError(authErrorMessage(failure)); }
    finally { locked.current = false; setBusy(false); }
  }
  return <SafeAreaView style={ui.screen}><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={ui.content}>
    <Pressable accessibilityRole="button" disabled={busy} onPress={() => router.canGoBack() ? router.back() : router.replace('/')}><Text style={ui.link}>العودة</Text></Pressable>
    <Text style={ui.title}>{stage === 'done' ? 'تم تحديث كلمة المرور.' : 'استعادة كلمة المرور'}</Text>
    {stage === 'send' && <><Text style={ui.text}>أدخل بريد حسابك لتصلك رسالة استعادة كلمة المرور.</Text><TextInput accessibilityLabel="البريد الإلكتروني" style={ui.input} placeholder="name@example.com" placeholderTextColor={colors.muted} value={email} onChangeText={setEmail} editable={!busy} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="emailAddress" maxLength={254} /></>}
    {stage === 'verify' && <>
      <Text style={ui.text}>إذا كان البريد مرتبطًا بحساب، ستصلك رسالة. افتح رابط الاستعادة لفتح صفحة كلمة المرور الجديدة. لا تحتاج لإدخال رمز إذا كانت الرسالة تحتوي على رابط.</Text>
      {codeEntry ? <TextInput accessibilityLabel="رمز استعادة كلمة المرور" style={ui.input} value={token} onChangeText={value => setToken(normalizeSignupCode(value).replace(/\D/g, '').slice(0, 10))} editable={!busy} keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode" maxLength={10} placeholder="رمز الاستعادة إن وصل" placeholderTextColor={colors.muted} /> : <Pressable accessibilityRole="button" disabled={busy} onPress={() => { setCodeEntry(true); setError(''); }}><Text style={ui.link}>وصلني رمز بدل رابط</Text></Pressable>}
      <Pressable accessibilityRole="button" disabled={busy || resendSeconds > 0} accessibilityState={{ disabled: busy || resendSeconds > 0 }} onPress={() => { setEmailSent(false); setError(''); setToken(''); setCodeEntry(false); }}><Text style={ui.link}>{resendSeconds > 0 ? `طلب رسالة جديدة بعد ${resendSeconds} ثانية` : 'طلب رسالة جديدة'}</Text></Pressable>
    </>}
    {stage === 'change' && <><Text style={ui.note}>{auth.session?.user.email ?? ''}</Text><Text style={ui.text}>اختر كلمة مرور جديدة من 8 أحرف على الأقل.</Text><TextInput accessibilityLabel="كلمة المرور الجديدة" style={ui.input} value={password} onChangeText={setPassword} editable={!busy} secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="new-password" textContentType="newPassword" maxLength={256} placeholder="كلمة المرور الجديدة" placeholderTextColor={colors.muted} /><TextInput accessibilityLabel="تأكيد كلمة المرور الجديدة" style={ui.input} value={confirmation} onChangeText={setConfirmation} editable={!busy} secureTextEntry autoCapitalize="none" autoCorrect={false} maxLength={256} placeholder="تأكيد كلمة المرور" placeholderTextColor={colors.muted} /></>}
    {error ? <Text accessibilityRole="alert" style={[ui.text, { color: colors.error }]}>{error}</Text> : null}
    {stage !== 'done' && (stage !== 'verify' || codeEntry) ? <Pressable accessibilityRole="button" disabled={busy || !auth.configured || !auth.ready || (stage === 'send' && resendSeconds > 0)} accessibilityState={{ disabled: busy || !auth.configured || !auth.ready || (stage === 'send' && resendSeconds > 0) }} style={[ui.button, (busy || !auth.configured || !auth.ready) && ui.pressed]} onPress={() => void perform()}><Text style={ui.buttonText}>{busy ? 'جارٍ المتابعة…' : stage === 'send' ? 'إرسال رسالة الاستعادة' : stage === 'verify' ? 'تأكيد الرمز' : 'حفظ كلمة المرور'}</Text></Pressable> : stage === 'done' ? <Pressable accessibilityRole="button" style={ui.button} onPress={() => router.replace('/home')}><Text style={ui.buttonText}>متابعة إلى مسارك</Text></Pressable> : null}
  </ScrollView></KeyboardAvoidingView></SafeAreaView>;
}
