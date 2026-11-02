import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { AdminButton, AdminCard, AdminError, AdminFrame, AdminHeading, AdminLoading, AdminPill, adminPalette, adminStyles } from '../../components/admin-console';
import { useAppPreferences } from '../../contexts/app-preferences-context';
import { adminRequest } from '../../utils/admin-api';

type Schedule = { enabled: boolean; intervalHours: 6 | 12 | 24; persisted: boolean; storageAvailable: boolean; updatedAt: string | null };
type Runtime = { configured: boolean; running: boolean; nextRunAt: string | null; lastRunAt: string | null; lastFinishedAt: string | null; lastResult: { succeeded: number; failed: number } } | null;
type ScheduleResponse = { schedule: Schedule; runtime: Runtime };
const intervals = [6, 12, 24] as const;

export default function AdminScheduleScreen() {
  const en = useAppPreferences().language === 'en';
  const t = useCallback((ar: string, english: string) => en ? english : ar, [en]);
  const [saved, setSaved] = useState<Schedule | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [intervalHours, setIntervalHours] = useState<6 | 12 | 24>(6);
  const [runtime, setRuntime] = useState<Runtime>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const styles = adminStyles();
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await adminRequest<ScheduleResponse>('schedule', {}, en ? 'en' : 'ar');
      setSaved(result.schedule);
      setEnabled(result.schedule.enabled);
      setIntervalHours(result.schedule.intervalHours);
      setRuntime(result.runtime);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : t('تعذر تحميل جدول التحديث.', 'Could not load the refresh schedule.'));
    } finally { setLoading(false); }
  }, [t, en]);
  useEffect(() => { const timer = setTimeout(() => { void load(); }, 0); return () => clearTimeout(timer); }, [load]);

  async function save() {
    if (!saved?.storageAvailable) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await adminRequest<ScheduleResponse>('schedule', {
        method: 'PUT', body: JSON.stringify({ enabled, intervalHours }),
      }, en ? 'en' : 'ar');
      setSaved(result.schedule); setRuntime(result.runtime);
      setNotice(t('حُفظ الجدول وبدأ تطبيقه على خادم الوظائف.', 'The schedule was saved and applied to the job server.'));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : t('تعذر حفظ جدول التحديث.', 'Could not save the refresh schedule.'));
    } finally { setBusy(false); }
  }

  const updatedAt = saved?.updatedAt ? new Date(saved.updatedAt).toLocaleString(en ? 'en-US' : 'ar-SA', { dateStyle: 'medium', timeStyle: 'short' }) : t('إعداد افتراضي', 'Default setting');
  const nextRunAt = runtime?.nextRunAt ? new Date(runtime.nextRunAt).toLocaleString(en ? 'en-US' : 'ar-SA', { dateStyle: 'medium', timeStyle: 'short' }) : null;
  return <AdminFrame active="overview" title="جدولة تحديث الوظائف" titleEn="Job refresh schedule">
    <AdminError>{error}</AdminError>
    {notice ? <AdminCard><Text style={[styles.bodyText, en && styles.ltr]}>{notice}</Text></AdminCard> : null}
    {loading ? <AdminLoading text={t('جارٍ تحميل إعداد الجدول…', 'Loading schedule settings…')} /> : null}
    {!loading && saved ? <>
      <AdminCard>
        <AdminHeading title={t('تحديث وظائف Headcount Labs', 'Headcount Labs job refresh')} hint={t('الإعداد يطبق على مجالات البحث الخمسة في المصدر الحالي.', 'This setting applies to all five search categories for the active provider.')} />
        <View style={{ flexDirection: en ? 'row' : 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
          <View style={{ flex: 1, gap: 5 }}>
            <Text style={[styles.sectionTitle, en && styles.ltr]}>{t('التحديث التلقائي', 'Automatic refresh')}</Text>
            <Text style={[styles.bodyText, en && styles.ltr]}>{enabled ? t('يحدّث الخادم قوائم الوظائف عند حلول الموعد ما دام يعمل ومفتاح المصدر مضبوطًا.', 'The server refreshes job listings when due while it is running and the provider key is configured.') : t('التحديث التلقائي متوقف. يظل الجلب اليدوي متاحًا من صفحة مصادر الوظائف.', 'Automatic refresh is paused. Manual fetching remains available from Job sources.')}</Text>
          </View>
          <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: enabled }} onPress={() => setEnabled(value => !value)} style={{ flexDirection: en ? 'row' : 'row-reverse', alignItems: 'center', gap: 9, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: enabled ? adminPalette.teal : adminPalette.border, backgroundColor: enabled ? adminPalette.mint : adminPalette.white }}>
            <View style={{ width: 20, height: 20, borderRadius: 6, borderWidth: 1, borderColor: enabled ? adminPalette.teal : adminPalette.border, backgroundColor: enabled ? adminPalette.teal : adminPalette.white, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: adminPalette.onTeal, fontSize: 13, fontWeight: '800' }}>{enabled ? '✓' : ''}</Text></View>
            <Text style={[styles.bodyText, en && styles.ltr, { color: adminPalette.ink, fontWeight: '700' }]}>{enabled ? t('مفعّل', 'Enabled') : t('متوقف', 'Paused')}</Text>
          </Pressable>
        </View>
      </AdminCard>

      <AdminCard>
        <AdminHeading title={t('الفاصل بين التحديثات', 'Refresh interval')} hint={t('اختر فاصلًا من 6 ساعات فأكثر لتجنب الطلبات المتكررة للمصدر.', 'Choose an interval of at least 6 hours to avoid frequent provider requests.')} />
        <View style={{ flexDirection: en ? 'row' : 'row-reverse', gap: 10, flexWrap: 'wrap' }}>
          {intervals.map(hours => {
            const selected = intervalHours === hours;
            return <Pressable key={hours} accessibilityRole="radio" accessibilityState={{ checked: selected }} onPress={() => setIntervalHours(hours)} style={{ minWidth: 120, flexGrow: 1, alignItems: 'center', gap: 6, borderRadius: 13, borderWidth: 1, borderColor: selected ? adminPalette.teal : adminPalette.border, paddingVertical: 16, paddingHorizontal: 12, backgroundColor: selected ? adminPalette.mint : adminPalette.white }}>
              <Text style={[styles.sectionTitle, en && styles.ltr, { color: selected ? adminPalette.teal : adminPalette.ink }]}>{hours} {t('ساعات', 'hours')}</Text>
              <Text style={[styles.sectionHint, en && styles.ltr]}>{hours === 6 ? t('الإعداد الحالي', 'Current default') : hours === 12 ? t('مرتان يوميًا', 'Twice daily') : t('مرة يوميًا', 'Once daily')}</Text>
            </Pressable>;
          })}
        </View>
        <AdminPill tone={saved.persisted ? 'success' : saved.storageAvailable ? 'warning' : 'error'}>{saved.persisted ? t('الإعداد محفوظ', 'Settings saved') : saved.storageAvailable ? t('لم يُحفظ إعداد بعد', 'No saved setting yet') : t('يتطلب إعداد قاعدة الإدارة', 'Admin database setup required')}</AdminPill>
        {!saved.storageAvailable ? <AdminError>{t('طبّقي supabase/admin_remaining_setup.sql بعد الترحيل 004 لحفظ إعداد الجدول.', 'Apply supabase/admin_remaining_setup.sql after migration 004 to persist the schedule.')}</AdminError> : null}
      </AdminCard>

      <AdminCard>
        <AdminHeading title={t('حالة التنفيذ', 'Runtime status')} />
        <Text style={[styles.bodyText, en && styles.ltr]}>{t('موعد التشغيل التالي:', 'Next run:')} {nextRunAt ?? t('غير مجدول الآن', 'Not scheduled now')}</Text>
        <Text style={[styles.bodyText, en && styles.ltr]}>{t('آخر تشغيل:', 'Last run:')} {runtime?.lastRunAt ? new Date(runtime.lastRunAt).toLocaleString(en ? 'en-US' : 'ar-SA', { dateStyle: 'medium', timeStyle: 'short' }) : t('لم يعمل بعد في هذه الجلسة', 'Not run in this server session yet')}</Text>
        <Text style={[styles.sectionHint, en && styles.ltr]}>{runtime?.configured ? t('مفتاح مصدر الوظائف مضبوط على الخادم.', 'The job provider key is configured on the server.') : t('مفتاح مصدر الوظائف غير مضبوط على الخادم.', 'The job provider key is not configured on the server.')}{saved.persisted ? ` · ${t('آخر حفظ', 'Last saved')}: ${updatedAt}` : ''}</Text>
        <AdminButton title={busy ? t('جارٍ الحفظ…', 'Saving…') : t('حفظ جدول التحديث', 'Save refresh schedule')} onPress={() => void save()} disabled={busy || !saved.storageAvailable} />
      </AdminCard>
    </> : null}
  </AdminFrame>;
}
