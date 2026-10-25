import { ActivityIndicator, Pressable, Text } from 'react-native';
import { useAuth } from '../contexts/auth-context';
import { useCloud } from '../contexts/cloud-context';
import { colors, ui } from '../constants/design';
import { DisclosureCard } from './disclosure-card';

export function CloudCard({ language = 'ar' }: { language?: 'ar' | 'en' } = {}) {
  const auth = useAuth(); const cloud = useCloud();
  const t = (ar: string, en: string) => language === 'en' ? en : ar;
  const direction = { textAlign: language === 'en' ? 'left' as const : 'right' as const, writingDirection: language === 'en' ? 'ltr' as const : 'rtl' as const };
  if (!auth.session) return <DisclosureCard title={t('حفظ ملفي', 'Save my profile')} summary={t('بيانات الضيف محلية ومنفصلة', 'Guest data stays local and separate')} status={t('على الجهاز', 'On device')} subtitle={t('الحفظ والخصوصية', 'Backup and privacy')}>
    <Text style={[ui.text, direction]}>{t('تُحفظ بيانات الحساب تلقائياً بعد تسجيل الدخول. لا تُرفع بيانات الضيف أو تُدمج تلقائياً.', 'Account data saves automatically after sign-in. Guest data is never uploaded or merged automatically.')}</Text>
  </DisclosureCard>;
  const saved = !cloud.busy && !cloud.error && cloud.status === 'synced';
  const status = cloud.busy || cloud.status === 'checking' ? t('جارٍ الحفظ…', 'Saving…')
    : cloud.error ? t('تعذر الحفظ', 'Saving failed') : saved ? t('تم الحفظ', 'Saved') : t('بانتظار المزامنة', 'Pending sync');
  const summary = cloud.status === 'conflict'
    ? t('تختلف نسخة الجهاز عن السحابة. اختر النسخة التي تريد الاحتفاظ بها؛ اختيارك يستبدل النسخة الأخرى.', 'Device and cloud copies differ. Choose which to keep; your choice replaces the other.')
    : cloud.status === 'removed' ? t('النسخة السحابية غير موجودة. بيانات الجهاز محفوظة؛ يمكنك إعادة رفعها صراحةً.', 'Cloud copy is missing. Device data is preserved; you can explicitly upload it again.')
    : saved ? t('تم تأكيد حفظ بيانات حسابك في السحابة.', 'Your account data was confirmed saved in the cloud.')
    : t('تغييرات الحساب محفوظة على الجهاز. تُعاد محاولة المزامنة تلقائياً عند عودة الاتصال.', 'Account changes stay on this device. Sync retries automatically when connectivity returns.');
  return <DisclosureCard title={t('الحفظ التلقائي', 'Automatic saving')} subtitle={t('نسخة خاصة بحسابك', 'Private account copy')} summary={summary} status={status} statusTone={saved ? 'success' : 'neutral'}>
    <Text style={[ui.text, direction]}>{t('تُسترجع بيانات الحساب قبل مزامنة تغييراتك تلقائياً مع Supabase. تبقى بيانات الضيف منفصلة على الجهاز.', 'Account data is restored before changes sync automatically with Supabase. Guest data stays separate on this device.')}</Text>
    {cloud.busy && <ActivityIndicator color={colors.primary} />}
    <Text style={[ui.note, direction]}>{status}</Text>
    {!!cloud.lastSynced && <Text style={[ui.note, direction]}>{t('آخر مزامنة مؤكدة:', 'Last confirmed sync:')} {new Date(cloud.lastSynced).toLocaleString(language === 'en' ? 'en-US' : 'ar-SA')}</Text>}
    {!!cloud.error && <Text style={[ui.text, { color: colors.error }]} accessibilityRole="alert">{cloud.error}</Text>}
    {cloud.status === 'conflict' ? <>
      <Pressable disabled={cloud.busy} accessibilityRole="button" style={ui.outline} onPress={() => void cloud.synchronize('cloud')}><Text style={ui.outlineText}>{t('استخدام نسخة السحابة على هذا الجهاز', 'Use the cloud copy on this device')}</Text></Pressable>
      <Pressable disabled={cloud.busy} accessibilityRole="button" style={ui.outline} onPress={() => void cloud.synchronize('local', true)}><Text style={ui.outlineText}>{t('استبدال نسخة السحابة بنسخة الجهاز', 'Replace the cloud copy with this device')}</Text></Pressable>
    </> : !saved && <Pressable disabled={cloud.busy} accessibilityRole="button" style={ui.button} onPress={() => void cloud.synchronize('auto', cloud.status === 'removed')}><Text style={ui.buttonText}>{t('إعادة المحاولة', 'Retry')}</Text></Pressable>}
  </DisclosureCard>;
}
