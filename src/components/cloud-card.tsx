import { ActivityIndicator, Pressable, Text } from 'react-native';
import { useAuth } from '../contexts/auth-context';
import { useCloud } from '../contexts/cloud-context';
import { colors, ui } from '../constants/design';
import { DisclosureCard } from './disclosure-card';

export function CloudCard({ language = 'ar' }: { language?: 'ar' | 'en' } = {}) {
  const auth = useAuth(); const cloud = useCloud();
  const t = (ar: string, en: string) => language === 'en' ? en : ar;
  const direction = { textAlign: language === 'en' ? 'left' as const : 'right' as const, writingDirection: language === 'en' ? 'ltr' as const : 'rtl' as const };
  if (!auth.session) return <DisclosureCard title={t('حفظ ملفي', 'Save my profile')} subtitle={t('الحفظ والخصوصية', 'Backup and privacy')} summary={t('ملف الضيف محفوظ على هذا الجهاز', 'Guest data stays on this device')} status={t('على الجهاز', 'On device')}>
    <Text style={[ui.text, direction]}>{t('سجّل الدخول لتفعيل نسخة خاصة بحسابك في السحابة.', 'Sign in to enable a private cloud copy for your account.')}</Text>
  </DisclosureCard>;
  const enabled = cloud.enabled;
  const statuses: Record<string, string> = {
    synced: t('نسخة ملفك متزامنة مع السحابة.', 'Your profile is synced with the cloud.'),
    paused: t('المزامنة متوقفة على هذا الجهاز؛ النسخة السابقة تبقى في السحابة.', 'Sync is paused on this device; the previous cloud copy remains.'),
    conflict: t('يوجد اختلاف بين نسخة الجهاز والسحابة. اختر النسخة التي تريد الاحتفاظ بها؛ الاختيار يستبدل النسخة الأخرى.', 'Device and cloud copies differ. Choose which one to keep; your choice replaces the other copy.'),
    removed: t('النسخة السحابية لم تعد موجودة. احتفظنا ببيانات جهازك؛ فعّل الحفظ مجددًا إذا أردت رفعها.', 'The cloud copy is missing. Device data is preserved; enable backup again to upload it.'),
    pending: t('بيانات الجهاز محفوظة، وهناك تحديث يحتاج إلى مزامنة.', 'Saved on this device; changes still need to sync.'),
  };
  return <DisclosureCard title={t('الحفظ السحابي', 'Cloud backup')} subtitle={t('نسخة خاصة بحسابك', 'Private account backup')} summary={statuses[cloud.status] ?? t('الحفظ على الجهاز فقط', 'Saved on this device only')} status={enabled ? t('مفعّل', 'On') : t('متوقف', 'Off')} statusTone={enabled ? 'success' : 'neutral'}>
    <Text style={[ui.text, direction]}>{t('نحفظ نسخة خاصة بحسابك في Supabase؛ بيانات الضيف لا تُرفع تلقائيًا.', 'We keep a private copy in Supabase; guest data is never uploaded automatically.')}</Text>
    {cloud.busy ? <><ActivityIndicator color={colors.primary} /><Text style={[ui.note, direction]}>{t('جارٍ مزامنة ملفك…', 'Syncing your profile…')}</Text></> : <Text style={[ui.note, direction]}>{statuses[cloud.status] ?? t('الحفظ الحالي على الجهاز فقط. يمكنك تفعيل الحفظ السحابي الآن.', 'Saved on this device only. Enable cloud backup to sync.')}</Text>}
    {!!cloud.lastSynced && <Text style={[ui.note, direction]}>{t('آخر مزامنة:', 'Last synced:')} {new Date(cloud.lastSynced).toLocaleString(language === 'en' ? 'en-US' : 'ar-SA')}</Text>}
    {!!cloud.error && <Text style={[ui.text, { color: colors.error }]} accessibilityRole="alert">{cloud.error}</Text>}
    {cloud.status === 'conflict' ? <>
      <Pressable disabled={cloud.busy} accessibilityRole="button" style={ui.outline} onPress={() => void cloud.synchronize('cloud')}><Text style={ui.outlineText}>{t('استخدام نسخة السحابة على هذا الجهاز', 'Use the cloud copy on this device')}</Text></Pressable>
      <Pressable disabled={cloud.busy} accessibilityRole="button" style={ui.outline} onPress={() => void cloud.synchronize('local', true)}><Text style={ui.outlineText}>{t('رفع نسخة هذا الجهاز بدل نسخة السحابة', 'Replace the cloud copy with this device')}</Text></Pressable>
    </> : <Pressable disabled={cloud.busy} accessibilityRole="button" style={ui.button} onPress={() => void cloud.synchronize('auto', !enabled)}><Text style={ui.buttonText}>{enabled ? t('مزامنة الآن', 'Sync now') : t('تفعيل الحفظ السحابي', 'Enable cloud backup')}</Text></Pressable>}
    {enabled && <Pressable disabled={cloud.busy} accessibilityRole="button" onPress={() => void cloud.pause()}><Text style={ui.link}>{t('إيقاف المزامنة على هذا الجهاز', 'Pause sync on this device')}</Text></Pressable>}
  </DisclosureCard>;
}
