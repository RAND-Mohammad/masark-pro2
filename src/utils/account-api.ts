import { fetch } from 'expo/fetch';
import { serverUrl } from './cv-api';
import { supabase } from './supabase';

export class AccountDeletionError extends Error {
  constructor(message: string, readonly deletionStarted: boolean) {
    super(message);
    this.name = 'AccountDeletionError';
  }
}

export async function requestAccountDeletion(): Promise<void> {
  const client = supabase;
  if (!client) throw new AccountDeletionError('خدمة الحسابات غير مهيأة.', false);
  let sessionResult: Awaited<ReturnType<typeof client.auth.getSession>>;
  try { sessionResult = await client.auth.getSession(); }
  catch { throw new AccountDeletionError('تعذر التحقق من الجلسة. سجّلي الدخول مجددًا ثم أعيدي المحاولة.', false); }
  const { data, error } = sessionResult;
  const token = data.session?.access_token;
  if (error || !token) throw new AccountDeletionError('انتهت الجلسة. سجّلي الدخول مجددًا ثم أعيدي المحاولة.', false);
  let baseUrl: string;
  try { baseUrl = serverUrl(); }
  catch (failure) { throw new AccountDeletionError(failure instanceof Error ? failure.message : 'عنوان خادم مسارك غير مضبوط.', false); }
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/account/delete`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmation: 'DELETE' }),
      signal: AbortSignal.timeout(120000),
    });
  } catch {
    throw new AccountDeletionError('تعذر تأكيد نتيجة الطلب. أبقينا مزامنة الحساب متوقفة؛ أعيدي المحاولة لإكمال الحذف.', true);
  }
  let result: { error?: unknown; deleted?: unknown; deletionStarted?: unknown };
  try { result = await response.json() as typeof result; }
  catch { throw new AccountDeletionError('وصل رد غير صالح. أبقينا مزامنة الحساب متوقفة؛ أعيدي المحاولة لإكمال الحذف.', true); }
  if (!response.ok || result.deleted !== true) {
    throw new AccountDeletionError(
      typeof result.error === 'string' ? result.error : 'تعذر حذف الحساب. حاولي مجددًا.',
      result.deletionStarted === true,
    );
  }
}
