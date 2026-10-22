export class EmailPayloadError extends Error {}

export interface EmailConfig {
  supabaseUrl: string;
  redirectUrls: string[];
}

export interface AuthEmail {
  to: { email: string }[];
  subject: string;
  textContent: string;
  htmlContent: string;
}

const emailPattern = /^[^\s@<>\r\n]+@[^\s@<>\r\n]+\.[^\s@<>\r\n]+$/;
const htmlEntities: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => htmlEntities[char]);
const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

function address(value: unknown): string {
  if (typeof value !== 'string' || value.length > 254 || !emailPattern.test(value)) throw new EmailPayloadError('Invalid recipient');
  return value;
}

function code(value: unknown): string {
  if (typeof value !== 'string' || !/^[0-9]{6}$/.test(value)) throw new EmailPayloadError('Expected a six-digit code');
  return value;
}

function message(recipient: unknown, subject: string, instruction: string, content: string, link = false): AuthEmail {
  const safe = escapeHtml(content);
  return {
    to: [{ email: address(recipient) }],
    subject,
    textContent: `${instruction}\n${content}\nلا تشارك الرمز أو الرابط مع أحد. إذا لم تطلب هذه العملية، تجاهل الرسالة.`,
    htmlContent: `<div dir="rtl" style="font-family:Arial,sans-serif;padding:24px;color:#193c3b"><h2>مسارك</h2><p>${instruction}</p>${link ? `<p><a href="${safe}">${subject}</a></p>` : `<p dir="ltr" style="font-size:32px;font-weight:bold;letter-spacing:5px">${safe}</p>`}<p>لا تشارك الرمز أو الرابط مع أحد. إذا لم تطلب هذه العملية، تجاهل الرسالة.</p></div>`,
  };
}

export function buildAuthEmails(payload: unknown, { supabaseUrl, redirectUrls }: EmailConfig): AuthEmail[] {
  if (!isRecord(payload) || !isRecord(payload.user) || !isRecord(payload.email_data)) throw new EmailPayloadError('Invalid hook payload');
  const user = payload.user;
  const data = payload.email_data;
  const action = data.email_action_type;
  if (typeof action !== 'string') throw new EmailPayloadError('Invalid email action');

  function verificationLink(hash: unknown, type: string): string {
    if (typeof hash !== 'string' || !/^[a-zA-Z0-9_-]{16,256}$/.test(hash)) throw new EmailPayloadError('Invalid token hash');
    const redirect = data.redirect_to || redirectUrls[0];
    if (typeof redirect !== 'string' || !redirectUrls.includes(redirect)) throw new EmailPayloadError('Redirect is not allowed');
    const url = new URL('/auth/v1/verify', supabaseUrl);
    url.searchParams.set('token', hash);
    url.searchParams.set('type', type);
    url.searchParams.set('redirect_to', redirect);
    return url.toString();
  }

  if (action === 'signup') {
    return [message(user.email, 'رمز تأكيد حسابك في مسارك', 'أدخل الرمز التالي في التطبيق لتأكيد بريدك وإكمال إنشاء الحساب:', code(data.token))];
  }
  if (action === 'reauthentication') {
    return [message(user.email, 'رمز التحقق لحساب مسارك', 'أدخل رمز التحقق التالي لإكمال العملية التي طلبتها:', code(data.token))];
  }
  const links: Record<string, [string, string]> = {
    recovery: ['استعادة كلمة مرور مسارك', 'استخدم الرابط التالي لاختيار كلمة مرور جديدة:'],
    magiclink: ['الدخول إلى مسارك', 'استخدم الرابط التالي لإكمال تسجيل الدخول الذي طلبته:'],
    invite: ['دعوة إلى مسارك', 'استخدم الرابط التالي لقبول الدعوة:'],
  };
  if (Object.hasOwn(links, action)) {
    const [subject, instruction] = links[action];
    return [message(user.email, subject, instruction, verificationLink(data.token_hash, action), true)];
  }
  if (action === 'email_change') {
    const subject = 'تأكيد تغيير البريد في مسارك';
    const instruction = 'استخدم الرابط التالي لتأكيد تغيير البريد الذي طلبته:';
    // Supabase's secure email-change payload reverses the hash field names.
    if (data.token_hash_new && data.token_new) {
      return [
        message(user.email, subject, instruction, verificationLink(data.token_hash_new, action), true),
        message(user.new_email, subject, instruction, verificationLink(data.token_hash, action), true),
      ];
    }
    return [message(user.new_email, subject, instruction, verificationLink(data.token_hash, action), true)];
  }
  throw new EmailPayloadError('Unsupported email action');
}
