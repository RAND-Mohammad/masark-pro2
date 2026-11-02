import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { AdminButton, AdminCard, AdminError, AdminFrame, AdminHeading, AdminLoading, AdminPill, adminPalette, adminStyles } from '../../components/admin-console';
import { useAppPreferences } from '../../contexts/app-preferences-context';
import { adminRequest } from '../../utils/admin-api';

type Category = { id: string; query: string };
type SourceData = { sources: { id: string; name: string; supported: boolean; configured: boolean; refreshIntervalHours: number; categories: Category[] }[]; schedule: { enabled: boolean; intervalHours: number; nextRunAt: string | null }; status: { configured: boolean; lastAttemptAt: string | null; lastSuccessAt: string | null; lastErrorAt: string | null; categories: Record<string, { cached: boolean; fetchedAt: string | null; count: number; lastErrorAt?: string | null; retryAt?: string | null; retryBlocked?: boolean }> } };
const labels: Record<string, string> = { software: 'البرمجة', data: 'البيانات', security: 'الأمن والشبكات', cloud: 'السحابة وقواعد البيانات', graduates: 'الخريجون والتدريب' };
const labelsEn: Record<string, string> = { software: 'Software', data: 'Data', security: 'Security and networks', cloud: 'Cloud and databases', graduates: 'Graduates and training' };
const date = (value: string | null, en: boolean) => value ? new Date(value).toLocaleString(en ? 'en-US' : 'ar-SA', { dateStyle: 'medium', timeStyle: 'short' }) : en ? 'Not fetched yet' : 'لم يحدث جلب بعد';

export default function AdminSourcesScreen() {
  const en = useAppPreferences().language === 'en';
  const router = useRouter();
  const t = useCallback((ar: string, english: string) => en ? english : ar, [en]);
  const [data, setData] = useState<SourceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const styles = adminStyles();
  const load = useCallback(async () => { setLoading(true); setError(''); try { setData(await adminRequest<SourceData>('sources', {}, en ? 'en' : 'ar')); } catch (failure) { setError(failure instanceof Error ? failure.message : t('تعذر تحميل المصدر.', 'Could not load the job source.')); } finally { setLoading(false); } }, [t, en]);
  useEffect(() => { const timer = setTimeout(() => { void load(); }, 0); return () => clearTimeout(timer); }, [load]);
  async function refresh(category: string) {
    setBusy(category); setError(''); setMessage('');
    try {
      const result = await adminRequest<{ source: string; category: string; fetchedAt: string; count: number; auditSaved: boolean }>('sources/refresh', { method: 'POST', body: JSON.stringify({ category }) }, en ? 'en' : 'ar');
      setMessage(en ? `Fetched ${result.count} listings from ${result.source} for ${labelsEn[result.category] ?? result.category}. ${result.auditSaved ? 'The refresh was recorded.' : 'The refresh could not be recorded until the admin database is configured.'}` : `اكتمل الجلب من ${result.source}: ${result.count} إعلانًا في مجال ${labels[result.category] ?? result.category}. ${result.auditSaved ? 'سُجل طلب التحديث.' : 'تعذر تسجيله في سجل الإدارة حتى يكتمل إعداد قاعدة البيانات.'}`);
      await load();
    } catch (failure) { setError(failure instanceof Error ? failure.message : t('تعذر جلب الوظائف.', 'Could not fetch jobs.')); }
    finally { setBusy(''); }
  }
  const source = data?.sources[0];
  return <AdminFrame active="sources">
    <AdminError>{error}</AdminError>{message ? <AdminCard><Text style={[styles.bodyText, en && styles.ltr]}>{message}</Text></AdminCard> : null}
    {loading && !data ? <AdminLoading text={t('جارٍ تحميل مصادر الوظائف…', 'Loading job sources…')} /> : null}
    {source ? <>
      <AdminCard><AdminHeading title={t('مصدر الوظائف الفعلي', 'Active job source')} hint={t('لا نعرض شركاء أو مصادر غير موصولة بالخادم.', 'Only sources connected to the server are listed.')} />
        <View style={{ flexDirection: en ? 'row' : 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <View style={{ gap: 9, alignItems: en ? 'flex-start' : 'flex-end' }}><Text style={[styles.pageTitle, en && styles.ltr, { fontSize: 20 }]}>{source.name}</Text><Text style={[styles.bodyText, en && styles.ltr]}>{en ? `Saudi jobs · listings are fetched on request and cached for ${source.refreshIntervalHours} hours.` : `وظائف من السعودية · الإعلانات تُجلب عند الطلب وتُخزن مؤقتًا ${source.refreshIntervalHours} ساعات.`}</Text></View>
          <AdminPill tone={source.configured ? 'success' : 'error'}>{source.configured ? t('مفتاح المصدر مضبوط على الخادم', 'Provider key configured on server') : 'HEADCOUNT_API_KEY missing'}</AdminPill>
        </View>
        <View style={{ flexDirection: en ? 'row' : 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <Text style={[styles.sectionHint, en && styles.ltr]}>{data.schedule.enabled ? t(`التحديث التلقائي كل ${data.schedule.intervalHours} ساعات`, `Automatic refresh every ${data.schedule.intervalHours} hours`) : t('التحديث التلقائي متوقف', 'Automatic refresh is paused')}{data.schedule.nextRunAt ? ` · ${date(data.schedule.nextRunAt, en)}` : ''}</Text>
          <AdminButton title={t('إدارة الجدول', 'Manage schedule')} secondary onPress={() => router.push('/admin/schedule' as never)} />
        </View>
        <View style={{ backgroundColor: adminPalette.mint, borderRadius: 12, padding: 14, gap: 5 }}><Text style={[styles.sectionTitle, en && styles.ltr, { fontSize: 14 }]}>{t('بيانات الاعتماد محفوظة بأمان', 'Credentials are stored securely')}</Text><Text style={[styles.bodyText, en && styles.ltr]}>{t('لا نعرض المفتاح هنا. لإضافته أو تحديثه، راجعي مسؤولة إعداد الخدمة.', 'The key is never shown here. Contact the service administrator to add or update it.')}</Text></View>
      </AdminCard>
      <AdminCard><AdminHeading title={t('مجالات البحث', 'Search categories')} hint={t('اختاري المجال الذي تريدين تحديث إعلاناته.', 'Choose a category to refresh its listings.')} />
        {!source.configured ? <AdminError>{t('لا يمكن التحديث قبل ضبط المفتاح في متغيرات بيئة الخادم.', 'Set the provider key in the server environment before refreshing.')}</AdminError> : null}
        {source.categories.map(category => {
          const cached = data?.status.categories[category.id];
          const isBusy = busy === category.id;
          const inBackoff = Boolean(cached?.retryBlocked);
          return <View key={category.id} style={{ borderTopWidth: 1, borderColor: adminPalette.border, paddingTop: 15, gap: 9, flexDirection: en ? 'row' : 'row-reverse', alignItems: 'center', flexWrap: 'wrap' }}>
            <View style={{ flex: 1, minWidth: 210, gap: 4 }}><Text style={[styles.sectionTitle, en && styles.ltr, { fontSize: 15 }]}>{en ? labelsEn[category.id] ?? category.id : labels[category.id] ?? category.id}</Text><Text style={[styles.sectionHint, en && styles.ltr]}>{cached?.lastErrorAt ? `${t('فشل آخر جلب', 'Last fetch failed')} · ${inBackoff ? `${t('إعادة المحاولة بعد', 'Retry after')} ${date(cached.retryAt ?? null, en)}` : t('يمكن إعادة المحاولة الآن', 'Retry is available now')}` : cached?.cached ? en ? `${cached.count} listings · last fetched ${date(cached.fetchedAt, en)}` : `${cached.count} إعلانًا · آخر جلب ${date(cached.fetchedAt, en)}` : t('لا توجد بيانات مخزنة مؤقتًا لهذا المجال.', 'No cached listings for this category.')}</Text></View>
            <AdminButton title={isBusy ? t('جارٍ التحديث…', 'Refreshing…') : cached?.lastErrorAt ? t('إعادة المحاولة', 'Retry sync') : t('جلب الوظائف الآن', 'Fetch jobs now')} disabled={!source.configured || Boolean(busy) || inBackoff} onPress={() => void refresh(category.id)} />
          </View>;
        })}
        <Text style={[styles.bodyText, en && styles.ltr]}>{data.schedule.enabled ? t(`تُحدّث الخدمة تلقائيًا كل ${data.schedule.intervalHours} ساعات ما دام الخادم يعمل. تحديث المجال يدويًا يستهلك طلبًا من حصة مزود الوظائف.`, `The service refreshes automatically every ${data.schedule.intervalHours} hours while the server is running. A manual refresh uses the provider quota.`) : t('التحديث التلقائي متوقف. يمكن جلب أي مجال يدويًا من هنا.', 'Automatic refresh is paused. You can fetch a category manually here.')}</Text>
      </AdminCard>
    </> : null}
  </AdminFrame>;
}
