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
import { useAppPreferences } from '../contexts/app-preferences-context';

const ltr = { textAlign: 'left' as const, writingDirection: 'ltr' as const };

const RECOVERY_RESEND_DELAY_MS = 60000;

export default function ResetPasswordScreen() {
  const router = useRouter();
  const auth = useAuth();
  const { language } = useAppPreferences();
  const en = language === 'en';
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
    if (stage === 'change' && !auth.session) { setError(en ? 'The recovery session expired. Request a new email.' : 'انتهت جلسة الاستعادة. اطلب رسالة جديدة.'); return; }
    if (stage === 'send' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError(en ? 'Enter a valid email address.' : 'أدخل بريدًا إلكترونيًا صالحًا.'); return; }
    if (stage === 'verify' && !/^\d{6,10}$/.test(token.trim())) { setError(en ? 'Enter the code from your email.' : 'أدخل الرمز الموجود في البريد.'); return; }
    if (stage === 'change' && (password.length < 8 || password !== confirmation)) { setError(en ? 'Use at least 8 characters and make sure both passwords match.' : 'استخدم 8 أحرف على الأقل وتأكد من تطابق كلمتي المرور.'); return; }
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
    } catch (failure) { setError(authErrorMessage(failure, language)); }
    finally { locked.current = false; setBusy(false); }
  }
  return <SafeAreaView style={ui.screen}><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={ui.content}>
    <Pressable accessibilityRole="button" disabled={busy} onPress={() => router.canGoBack() ? router.back() : router.replace('/')}><Text style={[ui.link, en && ltr]}>{en ? 'Back' : 'العودة'}</Text></Pressable>
    <Text style={[ui.title, en && ltr]}>{stage === 'done' ? en ? 'Password updated.' : 'تم تحديث كلمة المرور.' : en ? 'Reset your password' : 'استعادة كلمة المرور'}</Text>
    {stage === 'send' && <><Text style={[ui.text, en && ltr]}>{en ? 'Enter your account email and we will send a password reset link.' : 'أدخل بريد حسابك لتصلك رسالة استعادة كلمة المرور.'}</Text><TextInput accessibilityLabel={en ? 'Email address' : 'البريد الإلكتروني'} style={[ui.input, ltr]} placeholder="name@example.com" placeholderTextColor={colors.muted} value={email} onChangeText={setEmail} editable={!busy} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="emailAddress" maxLength={254} /></>}
    {stage === 'verify' && <>
      <Text style={[ui.text, en && ltr]}>{en ? 'If this email belongs to an account, you will receive a message. Open the reset link to set a new password. You do not need a code when the email contains a link.' : 'إذا كان البريد مرتبطًا بحساب، ستصلك رسالة. افتح رابط الاستعادة لفتح صفحة كلمة المرور الجديدة. لا تحتاج لإدخال رمز إذا كانت الرسالة تحتوي على رابط.'}</Text>
      {codeEntry ? <TextInput accessibilityLabel={en ? 'Password recovery code' : 'رمز استعادة كلمة المرور'} style={[ui.input, ltr]} value={token} onChangeText={value => setToken(normalizeSignupCode(value).replace(/\D/g, '').slice(0, 10))} editable={!busy} keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode" maxLength={10} placeholder={en ? 'Recovery code, if provided' : 'رمز الاستعادة إن وصل'} placeholderTextColor={colors.muted} /> : <Pressable accessibilityRole="button" disabled={busy} onPress={() => { setCodeEntry(true); setError(''); }}><Text style={[ui.link, en && ltr]}>{en ? 'I received a code instead' : 'وصلني رمز بدل رابط'}</Text></Pressable>}
      <Pressable accessibilityRole="button" disabled={busy || resendSeconds > 0} accessibilityState={{ disabled: busy || resendSeconds > 0 }} onPress={() => { setEmailSent(false); setError(''); setToken(''); setCodeEntry(false); }}><Text style={[ui.link, en && ltr]}>{resendSeconds > 0 ? en ? `Request a new email in ${resendSeconds}s` : `طلب رسالة جديدة بعد ${resendSeconds} ثانية` : en ? 'Request a new email' : 'طلب رسالة جديدة'}</Text></Pressable>
    </>}
    {stage === 'change' && <><Text style={[ui.note, ltr]}>{auth.session?.user.email ?? ''}</Text><Text style={[ui.text, en && ltr]}>{en ? 'Choose a new password with at least 8 characters.' : 'اختر كلمة مرور جديدة من 8 أحرف على الأقل.'}</Text><TextInput accessibilityLabel={en ? 'New password' : 'كلمة المرور الجديدة'} style={[ui.input, ltr]} value={password} onChangeText={setPassword} editable={!busy} secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="new-password" textContentType="newPassword" maxLength={256} placeholder={en ? 'New password' : 'كلمة المرور الجديدة'} placeholderTextColor={colors.muted} /><TextInput accessibilityLabel={en ? 'Confirm new password' : 'تأكيد كلمة المرور الجديدة'} style={[ui.input, ltr]} value={confirmation} onChangeText={setConfirmation} editable={!busy} secureTextEntry autoCapitalize="none" autoCorrect={false} maxLength={256} placeholder={en ? 'Confirm password' : 'تأكيد كلمة المرور'} placeholderTextColor={colors.muted} /></>}
    {error ? <Text accessibilityRole="alert" style={[ui.text, en && ltr, { color: colors.error }]}>{error}</Text> : null}
    {stage !== 'done' && (stage !== 'verify' || codeEntry) ? <Pressable accessibilityRole="button" disabled={busy || !auth.configured || !auth.ready || (stage === 'send' && resendSeconds > 0)} accessibilityState={{ disabled: busy || !auth.configured || !auth.ready || (stage === 'send' && resendSeconds > 0) }} style={[ui.button, (busy || !auth.configured || !auth.ready) && ui.pressed]} onPress={() => void perform()}><Text style={ui.buttonText}>{busy ? en ? 'Continuing…' : 'جارٍ المتابعة…' : stage === 'send' ? en ? 'Send reset email' : 'إرسال رسالة الاستعادة' : stage === 'verify' ? en ? 'Verify code' : 'تأكيد الرمز' : en ? 'Save password' : 'حفظ كلمة المرور'}</Text></Pressable> : stage === 'done' ? <Pressable accessibilityRole="button" style={ui.button} onPress={() => router.replace('/home')}><Text style={ui.buttonText}>{en ? 'Continue to Masarak' : 'متابعة إلى مسارك'}</Text></Pressable> : null}
  </ScrollView></KeyboardAvoidingView></SafeAreaView>;
}
