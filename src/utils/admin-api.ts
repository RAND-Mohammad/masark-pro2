import { fetch } from 'expo/fetch';
import { serverUrl } from './cv-api';
import { supabase } from './supabase';

export class AdminRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'AdminRequestError';
  }
}

type AdminLanguage = 'ar' | 'en';
function adminErrorMessage(raw: string, status: number, language: AdminLanguage) {
  const en = language === 'en';
  if (status === 401) return en ? 'Sign in with your admin account and try again.' : 'سجّل الدخول بحساب الإدارة ثم أعد المحاولة.';
  if (status === 403) return en ? 'This account is not authorized to use the admin console.' : 'هذا الحساب غير مخول للوصول إلى لوحة الإدارة.';
  if (status >= 500 && /supabase_service_role_key|admin role|صلاحيات الإدارة/iu.test(raw)) return en ? 'Admin server credentials are not configured correctly.' : 'إعداد صلاحيات الإدارة على الخادم غير مكتمل.';
  if (status >= 500 && /004|005|006|007|migration|ترحيل|schema|جدول الإدارة/iu.test(raw)) return en ? 'The admin database needs setup. Apply the required migrations from the admin setup guide.' : 'قاعدة بيانات الإدارة تحتاج إلى إعداد الترحيلات المطلوبة. راجعي دليل إعداد لوحة الإدارة.';
  if (status >= 500) return en ? 'The admin service is temporarily unavailable. Try again later.' : 'خدمة الإدارة غير متاحة الآن. حاولي مرة أخرى لاحقًا.';
  const translations: [RegExp, string, string][] = [
    [/اختر جدول تحديث صالحًا|invalid admin job schedule/iu, 'اختر جدول تحديث صالحًا.', 'Choose a valid job refresh schedule.'],
    [/اختر(?:ي)? مجالًا صحيحًا|اختاري مجالًا صحيحًا للتحديث/iu, 'اختاري مجالًا صحيحًا للتحديث.', 'Choose a valid job search category.'],
    [/أدخلي رابط المورد أولًا|enter a valid https url/iu, 'أدخلي رابط المورد أولًا.', 'Enter a valid HTTPS resource link.'],
    [/صيغة الرابط غير صالحة|invalid redirect|invalid resource/iu, 'تحققي من صيغة الرابط وبيانات المورد.', 'Check the link format and resource details.'],
    [/only public https resource urls|host does not resolve to a public address/iu, 'استخدمي رابط HTTPS عامًا ويمكن الوصول إليه.', 'Use a publicly reachable HTTPS link.'],
    [/الرابط لم يستجب بنجاح|resource link did not respond successfully/iu, 'الرابط لم يستجب بنجاح. تحققي منه ثم أعيدي الفحص.', 'The link did not respond successfully. Check it and run the link check again.'],
    [/تعذر التحقق من الرابط|resource link could not be checked|resource check timed out|resource link redirected too many times/iu, 'تعذر التحقق من الرابط. تأكدي أنه يعمل كرابط HTTPS عام ثم أعيدي المحاولة.', 'Could not verify the link. Make sure it is publicly reachable over HTTPS, then try again.'],
    [/انتهت صلاحية فحص الرابط|link check expired/iu, 'انتهت صلاحية فحص الرابط. افحصيه مرة أخرى قبل النشر.', 'The link check expired. Verify the link again before publishing.'],
    [/تغير الرابط بعد فحصه|link changed after verification/iu, 'تغير الرابط بعد فحصه. افحصي الرابط الحالي قبل النشر.', 'The link changed after verification. Check the current link before publishing.'],
    [/افحصي الرابط أولًا|must be reachable before publishing|must be reviewed before publishing/iu, 'افحصي الرابط وراجعي بيانات المورد قبل إظهاره للمستخدمين.', 'Check the link and review the resource details before publishing.'],
    [/تعذر قراءة طلب الإدارة|invalid admin database response|invalid admin resource list|invalid admin audit log/iu, 'تعذر قراءة بيانات لوحة الإدارة. حاولي تحديث الصفحة.', 'Could not read admin data. Try refreshing the page.'],
  ];
  const translated = translations.find(([pattern]) => pattern.test(raw));
  if (translated) return en ? translated[2] : translated[1];
  if (en && raw && !/[\u0600-\u06FF]/u.test(raw)) return raw;
  if (!en && raw && /[\u0600-\u06FF]/u.test(raw)) return raw;
  if (status === 422) return en ? 'The resource link could not be verified. Check it and try again.' : 'تعذر التحقق من رابط المورد. تحققي منه ثم أعيدي المحاولة.';
  return en ? 'Could not complete the admin request. Check the information and try again.' : 'تعذر إكمال طلب الإدارة. تحققي من البيانات ثم أعيدي المحاولة.';
}

export async function adminRequest<T>(path: string, init: RequestInit = {}, language: AdminLanguage = 'ar'): Promise<T> {
  if (!supabase) throw new Error(language === 'en' ? 'Sign-in is not configured.' : 'تسجيل الدخول غير مهيأ.');
  const session = await supabase.auth.getSession().catch(() => null);
  if (!session || session.error) throw new Error(language === 'en' ? 'Could not verify your sign-in. Check your connection and try again.' : 'تعذر التحقق من تسجيل الدخول. تحققي من الاتصال ثم أعيدي المحاولة.');
  if (!session.data.session?.access_token) throw new Error(language === 'en' ? 'Sign in with your admin account.' : 'سجّل الدخول بحساب الإدارة.');
  const token = session.data.session.access_token;
  let response: Response;
  try {
    response = await fetch(`${serverUrl()}/admin/${path.replace(/^\//, '')}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers },
      signal: init.signal ?? AbortSignal.timeout(20000),
    });
  } catch { throw new Error(language === 'en' ? 'Could not reach the Masarak server. Check the connection and try again.' : 'تعذر الاتصال بخادم مسارك. تحققي من تشغيل الخادم واتصال الشبكة.'); }
  let body: unknown;
  try { body = await response.json(); } catch { throw new Error(language === 'en' ? 'The server returned an invalid response.' : 'وصل رد غير صالح من الخادم.'); }
  if (!response.ok) {
    const raw = body && typeof body === 'object' && 'error' in body && typeof body.error === 'string' ? body.error : '';
    const message = adminErrorMessage(raw, response.status, language);
    throw new AdminRequestError(message, response.status);
  }
  return body as T;
}
