import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { AdminButton, AdminCard, AdminError, AdminFrame, AdminHeading, AdminLoading, AdminPill, adminPalette, adminStyles } from '../../components/admin-console';
import { useAppPreferences } from '../../contexts/app-preferences-context';
import { adminRequest } from '../../utils/admin-api';

type Status = {
  service: { status: string; groqConfigured: boolean };
  adminStore: { configured: boolean; available: boolean; issue: 'schema' | 'credentials' | 'connection' | null; resources: number | null; visibleResources: number | null };
  jobs: { configured: boolean; lastAttemptAt: string | null; lastSuccessAt: string | null; lastErrorAt: string | null; categories: Record<string, { cached: boolean; fetchedAt: string | null; count: number; lastErrorAt: string | null; retryAt: string | null }> };
  scheduler: { enabled: boolean; intervalHours: number; configured: boolean; running: boolean; nextRunAt: string | null; lastRunAt: string | null; lastFinishedAt: string | null; lastResult: { succeeded: number; failed: number } };
};
type AuditEvent = { action: string; targetId: string; createdAt: string };
type RetryResult = { category: string; status: 'success' | 'backoff' | 'failed'; count?: number; retryAt: string | null };
const labels: Record<string, string> = { software: 'البرمجة', data: 'البيانات', security: 'الأمن والشبكات', cloud: 'السحابة وقواعد البيانات', graduates: 'الخريجون والتدريب' };
const labelsEn: Record<string, string> = { software: 'Software', data: 'Data', security: 'Security and networks', cloud: 'Cloud and databases', graduates: 'Graduates and training' };
const stamp = (value: string | null, en: boolean) => value ? new Date(value).toLocaleString(en ? 'en-US' : 'ar-SA', { dateStyle: 'medium', timeStyle: 'short' }) : en ? 'Not recorded yet' : 'لم يُسجّل بعد';

export default function AdminOverviewScreen() {
  const en = useAppPreferences().language === 'en';
  const router = useRouter();
  const t = useCallback((ar: string, english: string) => en ? english : ar, [en]);
  const [status, setStatus] = useState<Status | null>(null);
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [retrying, setRetrying] = useState(false);
  const styles = adminStyles();
  const failedCategories = Object.values(status?.jobs.categories ?? {}).filter(category => category.lastErrorAt).length;
  async function retryFailedSyncs() {
    setRetrying(true); setError(''); setNotice('');
    try {
      const result = await adminRequest<{ results: RetryResult[]; status: Status['jobs'] }>('sources/retry-failed', { method: 'POST', body: JSON.stringify({}) }, en ? 'en' : 'ar');
      const successes = result.results.filter(item => item.status === 'success').length;
      const waiting = result.results.filter(item => item.status === 'backoff').length;
      const failures = result.results.filter(item => item.status === 'failed').length;
      setNotice(result.results.length === 0
        ? t('لا توجد تحديثات فاشلة تحتاج إلى إعادة المحاولة.', 'There are no failed syncs to retry.')
        : en ? `Retried ${successes} failed syncs. ${waiting} are still in backoff; ${failures} remain unsuccessful.`
          : `أُعيدت محاولة ${successes} تحديثات. ${waiting} ما زالت ضمن مهلة الانتظار، و${failures} لم تنجح.`);
      const refreshed = await adminRequest<Status>('status', {}, en ? 'en' : 'ar');
      setStatus(refreshed);
      if (refreshed.adminStore.available) setAudit(await adminRequest<AuditEvent[]>('audit', {}, en ? 'en' : 'ar').catch(() => []));
    } catch (failure) { setError(failure instanceof Error ? failure.message : t('تعذرت إعادة محاولة التحديثات.', 'Could not retry failed syncs.')); }
    finally { setRetrying(false); }
  }
  useEffect(() => {
    void adminRequest<Status>('status', {}, en ? 'en' : 'ar').then(async result => {
      setStatus(result);
      if (result.adminStore.available) setAudit(await adminRequest<AuditEvent[]>('audit', {}, en ? 'en' : 'ar').catch(() => []));
    }).catch(failure => setError(failure instanceof Error ? failure.message : t('تعذر تحميل حالة النظام.', 'Could not load system status.')));
  }, [t, en]);
  return <AdminFrame active="overview">
    <AdminError>{error}</AdminError>
    {notice ? <AdminCard><Text style={[styles.bodyText, en && styles.ltr]}>{notice}</Text></AdminCard> : null}
    {!status && !error ? <AdminLoading text={t('جارٍ تحميل حالة النظام…', 'Loading system status…')} /> : null}
    {status ? <>
      <AdminCard><View style={{ flexDirection: en ? 'row' : 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <AdminButton title={t('إدارة الجدول', 'Manage schedule')} secondary onPress={() => router.push('/admin/schedule' as never)} />
        <AdminButton title={retrying ? t('جارٍ إعادة المحاولة…', 'Retrying…') : t('إعادة محاولة التحديثات الفاشلة', 'Retry failed syncs')} onPress={() => void retryFailedSyncs()} disabled={retrying || failedCategories === 0 || !status.jobs.configured} />
      </View></AdminCard>
      <View style={{ gap: 13 }}><AdminHeading title={t('ملخص حالة النظام', 'System status summary')} hint={t('تعرض هذه الصفحة حالة الخادم والتكاملات من إعدادها الفعلي.', 'This page reports live server and integration configuration.')} />
        <View style={{ flexDirection: en ? 'row' : 'row-reverse', flexWrap: 'wrap', gap: 14 }}>
          <AdminCard style={{ flexGrow: 1, flexBasis: 240 }}><AdminPill tone="success">{t('الخدمة متصلة', 'Service connected')}</AdminPill><Text style={[styles.sectionTitle, en && styles.ltr]}>{t('خدمة مسارك', 'Masarak service')}</Text><Text style={[styles.bodyText, en && styles.ltr]}>{t('واجهة الإدارة وخدمات مسارك تعمل.', 'The admin console and Masarak services are running.')}</Text></AdminCard>
          <AdminCard style={{ flexGrow: 1, flexBasis: 240 }}><AdminPill tone={status.jobs.configured ? 'success' : 'warning'}>{status.jobs.configured ? t('مهيأ', 'Configured') : t('يحتاج إعدادًا', 'Needs setup')}</AdminPill><Text style={[styles.sectionTitle, en && styles.ltr]}>{t('مصدر الوظائف', 'Job source')}</Text><Text style={[styles.bodyText, en && styles.ltr]}>Headcount Labs · {Object.keys(status.jobs.categories).length} {t('مجالات بحث معتمدة', 'configured search categories')}</Text></AdminCard>
          <AdminCard style={{ flexGrow: 1, flexBasis: 240 }}><AdminPill tone={status.adminStore.available ? 'success' : status.adminStore.issue === 'credentials' || status.adminStore.issue === 'connection' || !status.adminStore.configured ? 'error' : 'warning'}>{status.adminStore.available ? t('قاعدة البيانات جاهزة', 'Database ready') : status.adminStore.issue === 'credentials' ? t('تحققي من مفتاح الخادم', 'Check the server key') : status.adminStore.issue === 'connection' ? t('تعذر الاتصال بقاعدة البيانات', 'Database connection failed') : status.adminStore.issue === 'schema' ? t('تحتاج إلى الترحيلات', 'Migrations required') : t('إعداد الخادم ناقص', 'Server setup is incomplete')}</AdminPill><Text style={[styles.sectionTitle, en && styles.ltr]}>{t('موارد التعلّم', 'Learning resources')}</Text><Text style={[styles.bodyText, en && styles.ltr]}>{status.adminStore.available ? en ? `${status.adminStore.visibleResources} resources visible to users out of ${status.adminStore.resources}.` : `${status.adminStore.visibleResources} مورد ظاهر للمستخدمين من ${status.adminStore.resources} مورد.` : status.adminStore.issue === 'credentials' ? t('مفتاح الإدارة في server/.env لم يقبله Supabase. حدّثي مفتاح Secret للمشروع ثم أعيدي تشغيل الخادم.', 'Supabase rejected the admin server key in server/.env. Replace it with a valid project Secret key and restart the server.') : status.adminStore.issue === 'connection' ? t('تعذر الوصول إلى Supabase. تحققي من الاتصال ورابط المشروع في إعداد الخادم.', 'Supabase could not be reached. Check the network and project URL in the server configuration.') : t('تأكدي أولًا من تطبيق 004، ثم شغّلي ملف supabase/admin_remaining_setup.sql لتفعيل الحفظ وفحص الروابط والجدولة.', 'Confirm migration 004 is applied, then run supabase/admin_remaining_setup.sql to enable resource storage, link checks, and scheduling.')}</Text></AdminCard>
          <AdminCard style={{ flexGrow: 1, flexBasis: 240 }}><AdminPill tone={status.service.groqConfigured ? 'success' : 'warning'}>{status.service.groqConfigured ? t('الخدمة مهيأة', 'Service configured') : t('غير مهيأة', 'Not configured')}</AdminPill><Text style={[styles.sectionTitle, en && styles.ltr]}>{t('تحليل السير الذاتية', 'CV analysis')}</Text><Text style={[styles.bodyText, en && styles.ltr]}>{t('تظهر اللوحة حالة الإعداد فقط، ولا تعرض بيانات السير أو مفاتيح الخدمة.', 'The console shows configuration status only. It never displays CV data or service keys.')}</Text></AdminCard>
        </View>
      </View>
      <AdminCard><AdminHeading title={t('مزامنة الوظائف', 'Job synchronization')} hint={t('يعرض وقت الجلب وحجم الذاكرة المؤقتة الفعلي؛ لا توجد بيانات تجريبية.', 'Shows real fetch times and cached counts; no sample data is displayed.')} />
        <Text style={[styles.bodyText, en && styles.ltr]}>{status.scheduler.enabled ? `${t('التحديث التلقائي كل', 'Automatic refresh every')} ${status.scheduler.intervalHours} ${t('ساعات. التالي:', 'hours. Next:')} ${stamp(status.scheduler.nextRunAt, en)}` : t('التحديث التلقائي متوقف.', 'Automatic refresh is paused.')}</Text>
        <View style={{ gap: 8 }}>{Object.entries(status.jobs.categories).map(([id, category]) => <View key={id} style={{ flexDirection: en ? 'row' : 'row-reverse', alignItems: 'center', gap: 12, borderTopWidth: 1, borderColor: adminPalette.border, paddingVertical: 11 }}>
          <Text style={[styles.bodyText, en && styles.ltr, { flex: 1, color: adminPalette.ink, fontWeight: '600' }]}>{en ? labelsEn[id] ?? id : labels[id] ?? id}</Text><AdminPill tone={category.lastErrorAt ? 'error' : category.cached ? 'success' : 'neutral'}>{category.lastErrorAt ? t('تعذر آخر جلب', 'Last fetch failed') : category.cached ? en ? `${category.count} cached jobs` : `${category.count} وظيفة مؤقتة` : t('لم تُجلب بعد', 'Not fetched yet')}</AdminPill><Text style={[styles.sectionHint, en && styles.ltr, { minWidth: 185 }]}>{stamp(category.fetchedAt, en)}</Text>
        </View>)}</View>
        <Text style={[styles.bodyText, en && styles.ltr]}>{en ? 'Last attempt' : 'آخر محاولة'}: {stamp(status.jobs.lastAttemptAt, en)} · {en ? 'Last successful fetch' : 'آخر جلب ناجح'}: {stamp(status.jobs.lastSuccessAt, en)}{status.jobs.lastErrorAt ? ` · ${en ? 'Last error' : 'آخر إخفاق'}: ${stamp(status.jobs.lastErrorAt, en)}` : ''}</Text>
      </AdminCard>
      <AdminCard><AdminHeading title={t('حدود لوحة الإدارة', 'Admin console scope')} /><Text style={[styles.bodyText, en && styles.ltr]}>{t('إدارة مصدر الوظائف الحالي وكتالوج التعلّم فقط. لا وصول لسير الطلاب أو ملفاتهم، ولا تدير اللوحة حسابات الطلاب أو رسائلهم.', 'The console manages the current job source and learning catalog only. It has no access to student CVs or files, and does not manage student accounts or messages.')}</Text></AdminCard>
      <AdminCard><AdminHeading title={t('سجل الإدارة', 'Admin audit log')} hint={t('آخر عمليات حفظ الموارد وتحديث الوظائف', 'Recent resource saves and job refreshes')} />
        {!status.adminStore.available ? <Text style={[styles.bodyText, en && styles.ltr]}>{t('يظهر السجل بعد تطبيق ترحيل قاعدة بيانات الإدارة.', 'The log is available after applying the admin database migration.')}</Text> : !audit.length ? <Text style={[styles.bodyText, en && styles.ltr]}>{t('لا توجد عمليات إدارة مسجلة بعد.', 'No admin actions have been recorded yet.')}</Text> : audit.map((event, index) => <View key={`${event.createdAt}-${index}`} style={{ flexDirection: en ? 'row' : 'row-reverse', justifyContent: 'space-between', gap: 14, borderTopWidth: 1, borderColor: adminPalette.border, paddingTop: 11 }}>
          <Text style={[styles.bodyText, en && styles.ltr, { color: adminPalette.ink, flex: 1 }]}>{event.action === 'jobs_refresh_requested' ? en ? `Job listing refresh · ${labelsEn[event.targetId] ?? event.targetId}` : `تحديث إعلانات الوظائف · ${labels[event.targetId] ?? event.targetId}` : event.action === 'jobs_schedule_updated' ? t('تغيير جدول تحديث الوظائف', 'Job refresh schedule updated') : en ? `Learning resource saved · ${event.targetId}` : `حفظ مورد تعلّم · ${event.targetId}`}</Text><Text style={[styles.sectionHint, en && styles.ltr]}>{stamp(event.createdAt, en)}</Text>
        </View>)}
      </AdminCard>
    </> : null}
  </AdminFrame>;
}
