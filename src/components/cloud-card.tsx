import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useAuth } from '../contexts/auth-context';
import { useCloud } from '../contexts/cloud-context';
import { colors, ui } from '../constants/design';

export function CloudCard({ language = 'ar' }: { language?: 'ar' | 'en' } = {}) {
  const auth = useAuth(); const cloud = useCloud();
  const t = (ar: string, en: string) => language === 'en' ? en : ar;
  const direction = { textAlign: language === 'en' ? 'left' as const : 'right' as const, writingDirection: language === 'en' ? 'ltr' as const : 'rtl' as const };
  if (!auth.session) return <View style={ui.card}><Text style={[ui.heading, direction]}>{t('حفظ ملفي', 'Save my profile')}</Text><Text style={[ui.text, direction]}>{t('ملف الضيف محفوظ على هذا الجهاز. سجّل الدخول لتفعيل نسخة خاصة بحسابك في السحابة.', 'Guest data stays on this device. Sign in to enable your private account backup.')}</Text></View>;
  const enabled = cloud.enabled;
  const statuses: Record<string, string> = {
    synced: t('نسخة ملفك متزامنة مع السحابة.', 'Your profile is synced with the cloud.'),
    paused: t('المزامنة متوقفة على هذا الجهاز؛ النسخة السابقة تبقى في السحابة.', 'Sync is paused on this device; the previous cloud copy remains.'),
    conflict: t('يوجد اختلاف بين نسخة الجهاز والسحابة. اختر النسخة التي تريد الاحتفاظ بها؛ الاختيار يستبدل النسخة الأخرى.', 'Device and cloud copies differ. Choose which one to keep; your choice replaces the other copy.'),
    removed: t('النسخة السحابية لم تعد موجودة. احتفظنا ببيانات جهازك؛ فعّل الحفظ مجددًا إذا أردت رفعها.', 'The cloud copy is missing. Device data is preserved; enable backup again to upload it.'),
    pending: t('بيانات الجهاز محفوظة، وهناك تحديث يحتاج إلى مزامنة.', 'Saved on this device; changes still need to sync.'),
  };
  return <View style={ui.card}>
    <Text style={[ui.heading, direction]}>{t('الحفظ السحابي', 'Cloud backup')}</Text>
    <Text style={[ui.text, direction]}>{t('نحفظ بيانات ملفك ومهاراتك وخطتك ونتائج المقابلات وملف السيرة في Supabase بصلاحيات خاصة بحسابك، لتسترجعها من جهاز آخر. بيانات الضيف لا تُرفع تلقائيًا.', 'Back up your profile, skills, plan, interview results and resume in your private Supabase account. Guest data is not uploaded automatically.')}</Text>
    {cloud.busy ? <><ActivityIndicator color={colors.primary} /><Text style={[ui.note, direction]}>{t('جارٍ مزامنة ملفك…', 'Syncing your profile…')}</Text></> : <Text style={[ui.note, direction]}>{statuses[cloud.status] ?? t('الحفظ الحالي على الجهاز فقط. يمكنك تفعيل الحفظ السحابي الآن.', 'Saved on this device only. Enable cloud backup to sync.')}</Text>}
    {!!cloud.lastSynced && <Text style={[ui.note, direction]}>{t('آخر مزامنة:', 'Last synced:')} {new Date(cloud.lastSynced).toLocaleString(language === 'en' ? 'en-US' : 'ar-SA')}</Text>}
    {!!cloud.error && <Text style={[ui.text, { color: colors.error }]} accessibilityRole="alert">{cloud.error}</Text>}
    {cloud.status === 'conflict' ? <>
      <Pressable disabled={cloud.busy} accessibilityRole="button" style={ui.outline} onPress={() => void cloud.synchronize('cloud')}><Text style={ui.outlineText}>{t('استخدام نسخة السحابة على هذا الجهاز', 'Use the cloud copy on this device')}</Text></Pressable>
      <Pressable disabled={cloud.busy} accessibilityRole="button" style={ui.outline} onPress={() => void cloud.synchronize('local', true)}><Text style={ui.outlineText}>{t('رفع نسخة هذا الجهاز بدل نسخة السحابة', 'Replace the cloud copy with this device')}</Text></Pressable>
    </> : <Pressable disabled={cloud.busy} accessibilityRole="button" style={ui.button} onPress={() => void cloud.synchronize('auto', !enabled)}><Text style={ui.buttonText}>{enabled ? t('مزامنة الآن', 'Sync now') : t('تفعيل الحفظ السحابي', 'Enable cloud backup')}</Text></Pressable>}
    {enabled && <Pressable disabled={cloud.busy} accessibilityRole="button" onPress={() => void cloud.pause()}><Text style={ui.link}>{t('إيقاف المزامنة على هذا الجهاز', 'Pause sync on this device')}</Text></Pressable>}
  </View>;
}
