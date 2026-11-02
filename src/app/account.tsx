import { useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MasarakBrand } from '../components/masarak-brand';
import { MasarakIcon } from '../components/masarak-icon';
import { colors, ui, createAdaptiveStyles} from '../constants/design';
import { useAuth } from '../contexts/auth-context';
import { supabase } from '../utils/supabase';
import { AdminRequestError, adminRequest } from '../utils/admin-api';
import { authErrorMessage, validateAccount } from '../utils/auth-errors';
import { useAppPreferences } from '../contexts/app-preferences-context';
import { confirmSignupEmail, normalizeSignupCode, SIGNUP_CODE_LENGTH, SIGNUP_RESEND_DELAY_MS, signupCodeIsValid, signupResendSeconds } from '../utils/signup-confirmation';

export default function AccountScreen() {
  const router = useRouter();
  const auth = useAuth();
  const { language } = useAppPreferences();
  const en = language === 'en';
  const { mode, redirect } = useLocalSearchParams<{ mode?: string; redirect?: string }>();
  const signup = mode === 'signup';
  const explicitDestination = typeof redirect === 'string' && ['/admin', '/career-chat', '/interview', '/profile-setup', '/choose-goal'].includes(redirect) ? redirect : null;
  const loginDestination = explicitDestination ?? (signup ? '/profile-setup' : '/home');
  const [adminCheck, setAdminCheck] = useState<{ token: string; status: 'admin' | 'regular' | 'unavailable' } | null>(null);
  const [adminCheckAttempt, setAdminCheckAttempt] = useState(0);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [token, setToken] = useState('');
  const [verification, setVerification] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [resendAvailableAt, setResendAvailableAt] = useState(0);
  const [now, setNow] = useState(Date.now);
  const resendSeconds = signupResendSeconds(resendAvailableAt, now);
  const locked = useRef(false);
  const accessToken = auth.session?.access_token;
  const adminCheckStatus = !accessToken ? 'idle' : adminCheck?.token === accessToken ? adminCheck.status : 'checking';
  useEffect(() => {
    let active = true;
    if (!auth.ready || !accessToken || auth.callbackBusy || auth.recoveryPending) return () => { active = false; };
    void adminRequest<{ role: string }>('session', { signal: AbortSignal.timeout(5000) }, en ? 'en' : 'ar')
      .then(() => { if (active) setAdminCheck({ token: accessToken, status: 'admin' }); })
      .catch(failure => {
        if (!active) return;
        setAdminCheck({ token: accessToken, status: failure instanceof AdminRequestError && failure.status === 403 ? 'regular' : 'unavailable' });
      });
    return () => { active = false; };
  }, [auth.ready, accessToken, auth.callbackBusy, auth.recoveryPending, adminCheckAttempt, en]);
  useEffect(() => {
    if (!auth.ready || !auth.session || auth.callbackBusy || busy) return;
    if (auth.recoveryPending) router.replace('/reset-password');
    else if (adminCheckStatus === 'admin') router.replace('/admin' as never);
    else if (adminCheckStatus === 'regular') router.replace(loginDestination as never);
  }, [auth.ready, auth.session, auth.callbackBusy, auth.recoveryPending, busy, adminCheckStatus, loginDestination, router]);
  useEffect(() => {
    if (!verification) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [verification]);
  function beginResendDelay() {
    const current = Date.now();
    setNow(current);
    setResendAvailableAt(current + SIGNUP_RESEND_DELAY_MS);
  }
  async function submit() {
    if (locked.current || !supabase) return;
    const problem = validateAccount(email, password, signup, name, language);
    if (problem) { setError(problem); return; }
    locked.current = true; setBusy(true); setError(''); setMessage('');
    try {
      if (signup) {
        const result = await supabase.auth.signUp({ email: email.trim().toLowerCase(), password, options: { data: { display_name: name.trim() } } });
        if (result.error) throw result.error;
        setPassword('');
        if (result.data.session) auth.completeLogin(loginDestination);
        else {
          setVerification(true); setToken(''); beginResendDelay();
          setMessage(en ? 'We sent a 6-digit confirmation code to your email. Enter it here to finish creating your account. Check spam if you cannot find it.' : 'أرسلنا رمز تأكيد من ٦ أرقام إلى بريدك. أدخله هنا لإكمال إنشاء الحساب، وتحقق من الرسائل غير المرغوبة إذا لم تجده.');
        }
      } else {
        const result = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
        if (result.error) throw result.error;
        if (!result.data?.session) throw new Error('No authenticated session returned');
        setPassword('');
      }
    } catch (failure) {
      if (!signup && failure && typeof failure === 'object' && 'code' in failure && failure.code === 'email_not_confirmed') {
        setPassword(''); setToken(''); setVerification(true); setResendAvailableAt(0);
        setMessage(en ? 'Your email is not confirmed. Enter the 6-digit code or request a new one.' : 'بريدك لم يُؤكّد بعد. أدخل رمز التأكيد من ٦ أرقام، أو اطلب إعادة إرساله.');
      } else setError(authErrorMessage(failure, language));
    }
    finally { locked.current = false; setBusy(false); }
  }
  async function verify() {
    if (locked.current || !supabase) return;
    if (!signupCodeIsValid(token)) { setError(en ? 'Enter the 6-digit confirmation code.' : 'أدخل رمز التأكيد المكوّن من ٦ أرقام.'); return; }
    locked.current = true; setBusy(true); setError('');
    try {
      await confirmSignupEmail(supabase.auth, email, token);
      setToken(''); auth.completeLogin(loginDestination);
    } catch (failure) { setError(authErrorMessage(failure, language)); }
    finally { locked.current = false; setBusy(false); }
  }
  async function resend() {
    if (locked.current || !supabase || signupResendSeconds(resendAvailableAt, Date.now()) > 0) return;
    locked.current = true; setBusy(true); setError('');
    try {
      const result = await supabase.auth.resend({ type: 'signup', email: email.trim().toLowerCase() });
      if (result.error) throw result.error;
      setToken(''); beginResendDelay();
      setMessage(en ? 'If your account needs confirmation, a new 6-digit code will arrive. Use the code in the latest message.' : 'إذا كان الحساب بحاجة للتأكيد، سيصلك رمز جديد من ٦ أرقام. استخدم الرمز الموجود في أحدث رسالة.');
    } catch (failure) { setError(authErrorMessage(failure, language)); }
    finally { locked.current = false; setBusy(false); }
  }
  function switchMode() {
    setPassword(''); setToken(''); setVerification(false); setResendAvailableAt(0); setMessage(''); setError('');
    router.replace({ pathname: '/account', params: { mode: signup ? 'login' : 'signup', ...(explicitDestination ? { redirect: explicitDestination } : {}) } });
  }
  return <SafeAreaView style={ui.screen}><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
    <Pressable accessibilityRole="button" accessibilityLabel={en ? 'Back' : 'العودة'} disabled={busy} onPress={() => router.canGoBack() ? router.back() : router.replace('/')} style={styles.back}><MasarakIcon name="arrow" /></Pressable>
    <View style={styles.logo}><MasarakBrand large /></View>
    <Text style={[ui.title, en && styles.ltr]}>{verification ? en ? 'Confirm your email.' : 'أكد بريدك الإلكتروني.' : signup ? en ? 'Start your journey.' : 'ابدأ رحلتك معنا.' : en ? 'Welcome back.' : 'أهلًا بعودتك.'}</Text>
    <Text style={[ui.text, en && styles.ltr]}>{verification ? email.trim() : signup ? en ? 'Create your account and start your path.' : 'أنشئ حسابك وابدأ مسارك.' : en ? 'Sign in to your Masarak account.' : 'سجّل الدخول إلى حسابك في مسارك.'}</Text>
    {!auth.configured && <Text style={styles.error}>{en ? 'Account services are unavailable right now. You can continue without an account.' : 'تسجيل الحسابات غير متاح حاليًا. يمكنك المتابعة دون حساب.'}</Text>}
    {auth.session && adminCheckStatus === 'checking' ? <View style={styles.notice}><Text style={[ui.text, en && styles.ltr]}>{en ? 'Signed in. Checking admin access…' : 'تم تسجيل الدخول. جارٍ التحقق من صلاحية لوحة الإدارة…'}</Text></View> : null}
    {auth.session && adminCheckStatus === 'unavailable' ? <View style={styles.notice}>
      <Text style={[ui.text, en && styles.ltr]}>{en ? 'You are signed in, but we could not verify your account access. Check your connection and try again.' : 'تم تسجيل الدخول، لكن تعذر التحقق من صلاحية الحساب. تحققي من الاتصال ثم أعيدي المحاولة.'}</Text>
      <Pressable accessibilityRole="button" onPress={() => setAdminCheckAttempt(value => value + 1)}><Text style={[ui.link, en && styles.ltr]}>{en ? 'Check again' : 'إعادة التحقق'}</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={() => router.replace('/home')}><Text style={[ui.link, en && styles.ltr]}>{en ? 'Continue to Masarak' : 'المتابعة إلى مسارك'}</Text></Pressable>
    </View> : null}
    <Pressable accessibilityRole="link" onPress={() => router.push('/privacy')}><Text style={[ui.link, en && styles.ltr]}>{en ? 'How your data is stored' : 'كيف نحفظ بياناتك؟'}</Text></Pressable>
    {message ? <View style={styles.notice}><Text style={[ui.text, en && styles.ltr]}>{message}</Text></View> : null}
    <View style={ui.card}>
      {verification ? <>
        <Text style={[ui.note, en && styles.ltr]}>{en ? 'Email confirmation code — 6 digits' : 'رمز تأكيد البريد — ٦ أرقام'}</Text><TextInput accessibilityLabel={en ? '6-digit email confirmation code' : 'رمز تأكيد البريد المكوّن من ستة أرقام'} keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="one-time-code" autoCapitalize="none" autoCorrect={false} maxLength={SIGNUP_CODE_LENGTH} style={[ui.input, styles.code]} placeholder="000000" placeholderTextColor={colors.muted} value={token} editable={!busy && auth.configured} onChangeText={value => { setToken(normalizeSignupCode(value).replace(/\D/g, '').slice(0, SIGNUP_CODE_LENGTH)); setError(''); }} onSubmitEditing={() => void verify()} />
        <Pressable disabled={busy || !auth.configured || !signupCodeIsValid(token)} accessibilityRole="button" accessibilityState={{ disabled: busy || !auth.configured || !signupCodeIsValid(token) }} onPress={() => void verify()} style={[ui.button, (busy || !auth.configured || !signupCodeIsValid(token)) && styles.disabled]}><Text style={ui.buttonText}>{busy ? en ? 'Continuing…' : 'جارٍ المتابعة…' : en ? 'Confirm email' : 'تأكيد البريد'}</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy || !auth.configured || resendSeconds > 0 }} disabled={busy || !auth.configured || resendSeconds > 0} onPress={() => void resend()}><Text style={[ui.link, en && styles.ltr, resendSeconds > 0 && styles.disabled]}>{resendSeconds > 0 ? en ? `Resend code in ${resendSeconds}s` : `إعادة إرسال الرمز بعد ${resendSeconds} ثانية` : en ? 'Resend code' : 'إعادة إرسال الرمز'}</Text></Pressable>
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => { setPassword(''); setToken(''); setVerification(false); setResendAvailableAt(0); setMessage(''); setError(''); }}><Text style={[ui.link, en && styles.ltr]}>{signup ? en ? 'Edit email address' : 'تعديل البريد الإلكتروني' : en ? 'Back to sign in' : 'العودة لتسجيل الدخول'}</Text></Pressable>
      </> : <>
        {signup && <><Text style={[ui.note, en && styles.ltr]}>{en ? 'Name' : 'الاسم'}</Text><TextInput accessibilityLabel={en ? 'Name' : 'الاسم'} style={[ui.input, en && styles.ltr]} value={name} onChangeText={setName} editable={!busy && auth.configured} placeholder={en ? 'Your name' : 'اسمك'} placeholderTextColor={colors.muted} maxLength={80} textContentType="name" autoComplete="name" /></>}
        <Text style={[ui.note, en && styles.ltr]}>{en ? 'Email address' : 'البريد الإلكتروني'}</Text><TextInput accessibilityLabel={en ? 'Email address' : 'البريد الإلكتروني'} style={[ui.input, styles.ltr]} value={email} onChangeText={setEmail} editable={!busy && auth.configured} placeholder="name@example.com" placeholderTextColor={colors.muted} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} textContentType="emailAddress" autoComplete="email" maxLength={254} />
        <Text style={[ui.note, en && styles.ltr]}>{en ? 'Password' : 'كلمة المرور'}</Text><TextInput accessibilityLabel={en ? 'Password' : 'كلمة المرور'} style={[ui.input, styles.ltr]} value={password} onChangeText={setPassword} editable={!busy && auth.configured} placeholder={signup ? en ? 'At least 8 characters' : '8 أحرف على الأقل' : en ? 'Password' : 'كلمة المرور'} placeholderTextColor={colors.muted} secureTextEntry={!showPassword} autoCapitalize="none" autoCorrect={false} textContentType={signup ? 'newPassword' : 'password'} autoComplete={signup ? 'new-password' : 'current-password'} maxLength={256} />
        <Pressable accessibilityRole="button" accessibilityLabel={showPassword ? (en ? 'Hide password' : 'إخفاء كلمة المرور') : (en ? 'Show password' : 'إظهار كلمة المرور')} onPress={() => setShowPassword(value => !value)}><Text style={[ui.link, en && styles.ltr]}>{showPassword ? en ? 'Hide password' : 'إخفاء كلمة المرور' : en ? 'Show password' : 'إظهار كلمة المرور'}</Text></Pressable>
        {!signup && <Pressable accessibilityRole="button" disabled={busy} onPress={() => router.push('/reset-password')}><Text style={[ui.link, en && styles.ltr]}>{en ? 'Forgot password?' : 'نسيت كلمة المرور؟'}</Text></Pressable>}
        <Pressable disabled={busy || !auth.configured} accessibilityRole="button" accessibilityState={{ disabled: busy || !auth.configured }} onPress={() => void submit()} style={[ui.button, (busy || !auth.configured) && styles.disabled]}><Text style={ui.buttonText}>{busy ? en ? 'Continuing…' : 'جارٍ المتابعة…' : signup ? en ? 'Create account' : 'إنشاء حساب' : en ? 'Sign in' : 'تسجيل الدخول'}</Text></Pressable>
      </>}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    </View>
    <Text style={[ui.note, en && styles.ltr]}>{en ? 'Manage your profile and data from Settings.' : 'يمكنك إدارة ملفك وبياناتك من الإعدادات.'}</Text>
    <Pressable accessibilityRole="button" disabled={busy} style={ui.outline} onPress={() => router.replace('/home')}><Text style={ui.outlineText}>{en ? 'Continue as guest' : 'متابعة دون حساب'}</Text></Pressable>
    {!verification && <Pressable accessibilityRole="button" disabled={busy} onPress={switchMode}><Text style={styles.switch}>{signup ? en ? 'Already have an account? Sign in' : 'لديك حساب؟ تسجيل الدخول' : en ? 'New to Masarak? Create an account' : 'جديد في مسارك؟ إنشاء حساب'}</Text></Pressable>}
  </ScrollView></KeyboardAvoidingView></SafeAreaView>;
}
const styles = createAdaptiveStyles(() => ({ content: { width: '100%', maxWidth: 460, alignSelf: 'center', flexGrow: 1, padding: 26, gap: 16 }, back: { width: 44, height: 44, borderRadius: 14, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-end' }, logo: { marginVertical: 12 }, notice: { backgroundColor: colors.mint, borderRadius: 16, padding: 16 }, disabled: { opacity: 0.5 }, ltr: { textAlign: 'left', writingDirection: 'ltr' }, code: { textAlign: 'center', writingDirection: 'ltr', fontSize: 26, letterSpacing: 8 }, error: { color: colors.error, fontSize: 14, lineHeight: 24, textAlign: 'right' }, switch: { color: colors.primary, fontSize: 14, textAlign: 'center', padding: 10 } }));
