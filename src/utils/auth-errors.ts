export function authErrorMessage(error: unknown): string {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  const status = error && typeof error === 'object' && 'status' in error ? Number(error.status) : 0;
  const messages: Record<string, string> = {
    invalid_credentials: 'البريد أو كلمة المرور غير صحيحة.',
    email_not_confirmed: 'أكد بريدك الإلكتروني أولًا، ثم سجّل الدخول.',
    user_already_exists: 'البريد مسجل مسبقًا. جرّب تسجيل الدخول أو استعادة كلمة المرور.',
    email_exists: 'البريد مسجل مسبقًا. جرّب تسجيل الدخول.',
    weak_password: 'كلمة المرور ضعيفة. اختر كلمة أطول ومتنوعة.',
    validation_failed: 'راجع البريد وكلمة المرور وحاول مجددًا.',
    over_email_send_rate_limit: 'وصل البريد لحد الإرسال. انتظر قليلًا قبل المحاولة مجددًا.',
    over_request_rate_limit: 'محاولات كثيرة. انتظر قليلًا ثم حاول مجددًا.',
    email_address_not_authorized: 'خدمة البريد التجريبية لا تسمح بهذا البريد حاليًا. يحتاج التطبيق إعداد إرسال البريد.',
    email_address_invalid: 'أدخل بريدًا إلكترونيًا صالحًا.',
    otp_expired: 'الرمز غير صحيح أو انتهت صلاحيته. اطلب رمزًا جديدًا.',
    otp_disabled: 'تأكيد البريد غير متاح حاليًا. حاول لاحقًا.',
    signup_disabled: 'إنشاء الحسابات غير متاح حاليًا.',
    same_password: 'اختر كلمة مرور مختلفة عن السابقة.',
    session_not_found: 'انتهت جلسة الدخول. سجّل الدخول مجددًا.',
  };
  if (messages[code]) return messages[code];
  if (status === 429) return 'محاولات كثيرة. انتظر قليلًا ثم حاول مجددًا.';
  if (error instanceof Error && /fetch|network|timeout/i.test(error.message)) return 'تعذر الاتصال. تأكد من الإنترنت وحاول مجددًا.';
  return 'تعذر إكمال العملية. حاول مجددًا.';
}
export function validateAccount(email: string, password: string, signup: boolean, name = '') {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'أدخل بريدًا إلكترونيًا صالحًا.';
  if (!password) return 'أدخل كلمة المرور.';
  if (signup && (name.trim().length < 2 || name.trim().length > 80)) return 'اكتب اسمًا من حرفين إلى 80 حرفًا.';
  if (signup && password.length < 8) return 'استخدم كلمة مرور من 8 أحرف على الأقل.';
  if (password.length > 256) return 'كلمة المرور طويلة جدًا.';
  return null;
}
