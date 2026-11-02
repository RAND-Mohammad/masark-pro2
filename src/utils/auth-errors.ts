export type AuthLanguage = 'ar' | 'en';
export function authErrorMessage(error: unknown, language: AuthLanguage = 'ar'): string {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  const status = error && typeof error === 'object' && 'status' in error ? Number(error.status) : 0;
  const messages: Record<string, { ar: string; en: string }> = {
    invalid_credentials: { ar: 'البريد أو كلمة المرور غير صحيحة.', en: 'The email or password is incorrect.' },
    email_not_confirmed: { ar: 'أكد بريدك الإلكتروني أولًا، ثم سجّل الدخول.', en: 'Confirm your email before signing in.' },
    user_already_exists: { ar: 'البريد مسجل مسبقًا. جرّب تسجيل الدخول أو استعادة كلمة المرور.', en: 'This email is already registered. Sign in or reset your password.' },
    email_exists: { ar: 'البريد مسجل مسبقًا. جرّب تسجيل الدخول.', en: 'This email is already registered. Try signing in.' },
    weak_password: { ar: 'كلمة المرور ضعيفة. اختر كلمة أطول ومتنوعة.', en: 'This password is too weak. Choose a longer, stronger password.' },
    validation_failed: { ar: 'راجع البريد وكلمة المرور وحاول مجددًا.', en: 'Check the email and password, then try again.' },
    over_email_send_rate_limit: { ar: 'وصل البريد لحد الإرسال. انتظر قليلًا قبل المحاولة مجددًا.', en: 'Email sending has reached its limit. Wait before trying again.' },
    over_request_rate_limit: { ar: 'محاولات كثيرة. انتظر قليلًا ثم حاول مجددًا.', en: 'Too many attempts. Wait a little and try again.' },
    email_address_not_authorized: { ar: 'خدمة البريد التجريبية لا تسمح بهذا البريد حاليًا. يحتاج التطبيق إعداد إرسال البريد.', en: 'The test email service does not allow this address yet. Email delivery needs to be configured.' },
    email_address_invalid: { ar: 'أدخل بريدًا إلكترونيًا صالحًا.', en: 'Enter a valid email address.' },
    otp_expired: { ar: 'الرمز غير صحيح أو انتهت صلاحيته. اطلب رمزًا جديدًا.', en: 'The code is invalid or expired. Request a new one.' },
    otp_disabled: { ar: 'تأكيد البريد غير متاح حاليًا. حاول لاحقًا.', en: 'Email confirmation is unavailable right now. Try again later.' },
    signup_disabled: { ar: 'إنشاء الحسابات غير متاح حاليًا.', en: 'New account registration is currently unavailable.' },
    same_password: { ar: 'اختر كلمة مرور مختلفة عن السابقة.', en: 'Choose a password different from your previous one.' },
    session_not_found: { ar: 'انتهت جلسة الدخول. سجّل الدخول مجددًا.', en: 'Your session ended. Sign in again.' },
  };
  if (messages[code]) return messages[code][language];
  if (status === 429) return language === 'en' ? 'Too many attempts. Wait a little and try again.' : 'محاولات كثيرة. انتظر قليلًا ثم حاول مجددًا.';
  if (error instanceof Error && /fetch|network|timeout/i.test(error.message)) return language === 'en' ? 'Connection failed. Check your internet and try again.' : 'تعذر الاتصال. تأكد من الإنترنت وحاول مجددًا.';
  return language === 'en' ? 'Could not complete the request. Try again.' : 'تعذر إكمال العملية. حاول مجددًا.';
}
export function validateAccount(email: string, password: string, signup: boolean, name = '', language: AuthLanguage = 'ar') {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return language === 'en' ? 'Enter a valid email address.' : 'أدخل بريدًا إلكترونيًا صالحًا.';
  if (!password) return language === 'en' ? 'Enter your password.' : 'أدخل كلمة المرور.';
  if (signup && (name.trim().length < 2 || name.trim().length > 80)) return language === 'en' ? 'Enter a name between 2 and 80 characters.' : 'اكتب اسمًا من حرفين إلى 80 حرفًا.';
  if (signup && password.length < 8) return language === 'en' ? 'Use a password with at least 8 characters.' : 'استخدم كلمة مرور من 8 أحرف على الأقل.';
  if (password.length > 256) return language === 'en' ? 'Password is too long.' : 'كلمة المرور طويلة جدًا.';
  return null;
}
