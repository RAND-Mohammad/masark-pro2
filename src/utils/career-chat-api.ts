import { fetch } from 'expo/fetch';
import { supabase } from './supabase';
import { serverUrl } from './cv-api';
import { captureDataScope } from './scoped-storage';

export type CareerChatMessage = { role: 'user' | 'assistant'; content: string };

export async function sendCareerChat(messages: CareerChatMessage[], language: 'ar' | 'en', consent: boolean): Promise<string> {
  const scope = captureDataScope();
  if (!consent) throw new Error(language === 'en' ? 'Consent is required before sending chat messages.' : 'وافقي قبل إرسال رسائل المحادثة.');
  if (!supabase) throw new Error(language === 'en' ? 'Sign-in is not configured.' : 'تسجيل الدخول غير مهيأ.');
  const { data, error } = await supabase.auth.getSession();
  scope.assertCurrent();
  if (error || !data.session) throw new Error(language === 'en' ? 'Sign in to use career chat.' : 'سجّلي الدخول لاستخدام الدردشة المهنية.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(`${serverUrl()}/career-chat`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${data.session.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, language, consent }),
      signal: controller.signal,
    });
    const result = await response.json();
    scope.assertCurrent();
    if (!response.ok) throw new Error(typeof result?.error === 'string' ? result.error : language === 'en' ? 'Career chat is unavailable.' : 'الدردشة المهنية غير متاحة الآن.');
    if (typeof result?.reply !== 'string' || !result.reply.trim() || result.reply.length > 2400) {
      throw new Error(language === 'en' ? 'The chat reply was invalid.' : 'وصل رد غير صالح من الدردشة.');
    }
    return result.reply.trim();
  } catch (failure) {
    scope.assertCurrent();
    if (failure instanceof TypeError || (failure instanceof Error && failure.name === 'AbortError')) {
      throw new Error(language === 'en' ? 'Could not reach the server. Check the connection and retry.' : 'تعذر الاتصال بالخادم. تحققي من الاتصال ثم أعيدي المحاولة.');
    }
    throw failure;
  } finally { clearTimeout(timeout); }
}
