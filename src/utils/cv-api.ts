import Constants from 'expo-constants';
import { fetch } from 'expo/fetch';
import { Platform } from 'react-native';
import type { DocumentPickerAsset } from 'expo-document-picker';
import { isCvAnalysis, type CvAnalysis } from './skill-profile';
import { supabase } from './supabase';
import { getValidatedCvFile } from './cv-upload-file';

export function serverUrl() {
  const configured = process.env.EXPO_PUBLIC_CV_API_URL;
  if (configured) {
    const base = configured.replace(/\/$/, '');
    // Web stays same-origin; native receives the absolute HTTPS origin from the launcher.
    if (Platform.OS === 'web' && base.startsWith(`${window.location.origin}/`)) {
      return base.slice(window.location.origin.length);
    }
    return base;
  }
  if (!__DEV__) throw new Error('خدمة تحليل السيرة لم تُضبط لهذه النسخة.');
  if (Platform.OS === 'web') return `http://${window.location.hostname}:3001`;
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const hostname = new URL(`http://${hostUri}`).hostname;
    if (!hostname.endsWith('.exp.direct')) return `http://${hostname}:3001`;
  }
  throw new Error('تعذر تحديد عنوان الكمبيوتر. شغّل Expo على الشبكة المحلية.');
}

export async function analyzeCv(file: DocumentPickerAsset): Promise<CvAnalysis> {
  if (!supabase) throw new Error('خدمة تسجيل الدخول غير مهيأة.');
  const { data, error } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (error || !token) throw new Error('سجّل الدخول لتحليل السيرة.');
  const content = await getValidatedCvFile(file);
  const form = new FormData();
  form.append('cv', content, file.name);
  form.append('consent', 'true');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90000);
  try {
    const response = await fetch(`${serverUrl()}/analyze-cv`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form, signal: controller.signal,
    });
    const body: unknown = await response.json();
    if (!response.ok) {
      const message = body && typeof body === 'object' && 'error' in body && typeof body.error === 'string' ? body.error : 'تعذر تحليل السيرة.';
      throw new Error(message);
    }
    if (!isCvAnalysis(body)) throw new Error('نتيجة التحليل غير صالحة. حاول مجددًا.');
    return body;
  } catch (error) {
    if (error instanceof TypeError || (error instanceof Error && error.name === 'AbortError')) throw new Error('تعذر الاتصال بالخادم أو انتهت مهلة التحليل. تأكد أنه يعمل وأن الجوال والكمبيوتر على نفس الشبكة.');
    throw error;
  } finally { clearTimeout(timeout); }
}

