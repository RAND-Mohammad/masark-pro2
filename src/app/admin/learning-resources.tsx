import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { AdminButton, AdminCard, AdminError, AdminFrame, AdminHeading, AdminLoading, AdminPill, adminPalette, adminStyles } from '../../components/admin-console';
import { useAppPreferences } from '../../contexts/app-preferences-context';
import { adminRequest } from '../../utils/admin-api';
import { refreshLearningResources } from '../../utils/learning-resource-sync';

type LearningResource = { id: string; title: string; provider: string; url: string; skillIds: string[]; level: string; duration: string; access: string; language: string; isVisible: boolean; linkStatus: 'reviewed' | 'needs_review'; linkCheckStatus: 'reachable' | 'not_checked'; linkCheckedAt: string | null; updatedAt: string | null; isDefault: boolean };
type Draft = Omit<LearningResource, 'isVisible' | 'linkStatus' | 'linkCheckStatus' | 'linkCheckedAt' | 'updatedAt' | 'isDefault'>;
const blank = (en: boolean): Draft => ({ id: '', title: '', provider: '', url: '', skillIds: [], level: en ? 'Beginner' : 'مبتدئ', duration: '', access: '', language: en ? 'English' : 'الإنجليزية' });
const labelNamesAr: Record<keyof Draft, string> = { id: 'معرّف ثابت', title: 'اسم المورد', provider: 'الجهة أو المنصة', url: 'الرابط الرسمي', skillIds: 'معرّفات المهارات المرتبطة', level: 'المستوى', duration: 'المدة التقريبية', access: 'طريقة الوصول أو التكلفة', language: 'اللغة' };
const labelNamesEn: Record<keyof Draft, string> = { id: 'Stable ID', title: 'Resource name', provider: 'Provider or platform', url: 'Official URL', skillIds: 'Related skill IDs', level: 'Level', duration: 'Estimated duration', access: 'Access or cost', language: 'Language' };

export default function AdminLearningResourcesScreen() {
  const en = useAppPreferences().language === 'en';
  const t = useCallback((ar: string, english: string) => en ? english : ar, [en]);
  const labelNames = en ? labelNamesEn : labelNamesAr;
  const [resources, setResources] = useState<LearningResource[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [draft, setDraft] = useState<Draft>(() => blank(en));
  const [visible, setVisible] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [linkCheckToken, setLinkCheckToken] = useState<string | null>(null);
  const [linkCheckedUrl, setLinkCheckedUrl] = useState('');
  const [linkCheckedAt, setLinkCheckedAt] = useState<string | null>(null);
  const [redirectDestination, setRedirectDestination] = useState('');
  const [isNew, setIsNew] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const styles = adminStyles();
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const list = await adminRequest<LearningResource[]>('resources', {}, en ? 'en' : 'ar');
      setResources(list);
      return list;
    } catch (failure) { setError(failure instanceof Error ? failure.message : t('تعذر تحميل كتالوج التعلّم.', 'Could not load the learning catalog.')); return []; }
    finally { setLoading(false); }
  }, [t, en]);
  useEffect(() => { const timer = setTimeout(() => { void load(); }, 0); return () => clearTimeout(timer); }, [load]);
  function choose(item: LearningResource) {
    setSelectedId(item.id); setDraft({ id: item.id, title: item.title, provider: item.provider, url: item.url, skillIds: [...item.skillIds], level: item.level, duration: item.duration, access: item.access, language: item.language });
    setVisible(item.isVisible); setReviewed(item.linkStatus === 'reviewed'); setLinkCheckToken(null);
    setLinkCheckedUrl(item.linkCheckStatus === 'reachable' ? item.url : ''); setLinkCheckedAt(item.linkCheckedAt);
    setRedirectDestination('');
    setIsNew(false); setNotice('');
  }
  function addNew() { setSelectedId(''); setDraft(blank(en)); setVisible(false); setReviewed(false); setLinkCheckToken(null); setLinkCheckedUrl(''); setLinkCheckedAt(null); setRedirectDestination(''); setIsNew(true); setError(''); setNotice(''); }
  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft(current => ({ ...current, [key]: value }));
    if (key !== 'id') setReviewed(false);
    if (key === 'url') { setLinkCheckToken(null); setLinkCheckedUrl(''); setLinkCheckedAt(null); setRedirectDestination(''); }
  }
  async function checkLink() {
    setBusy(true); setError(''); setNotice(''); setLinkCheckToken(null); setRedirectDestination('');
    try {
      const result = await adminRequest<{ token?: string; checkedAt?: string; statusCode: number; redirected: boolean; destination?: string }>('resources/check-link', { method: 'POST', body: JSON.stringify({ url: draft.url }) }, en ? 'en' : 'ar');
      if (result.redirected) {
        setReviewed(false); setLinkCheckedUrl(''); setLinkCheckedAt(null); setRedirectDestination(result.destination ?? '');
        setNotice(t('الرابط يحول إلى وجهة أخرى. راجعي الوجهة الظاهرة، حدّثي حقل الرابط إلى الرابط الرسمي ثم افحصيه مجددًا.', 'This link redirects elsewhere. Review the destination below, replace the URL with the official destination, then check it again.'));
        return;
      }
      if (!result.token || !result.checkedAt) throw new Error(t('لم يصل إثبات فحص صالح من الخادم.', 'The server did not return a valid link-check proof.'));
      setLinkCheckToken(result.token); setLinkCheckedUrl(draft.url); setLinkCheckedAt(result.checkedAt);
      setNotice(t(`الرابط يستجيب (HTTP ${result.statusCode}). راجعي بيانات المورد ثم وافقي على نشره.`, `Link responds (HTTP ${result.statusCode}). Review the resource details, then approve it for publishing.`));
    } catch (failure) { setLinkCheckedUrl(''); setLinkCheckedAt(null); setError(failure instanceof Error ? failure.message : t('تعذر فحص الرابط.', 'Could not check the link.')); }
    finally { setBusy(false); }
  }
  async function save() {
    if (visible && !reviewed) { setError(t('راجعي الرابط والمعلومات أولًا قبل إظهار المورد للمستخدمين.', 'Review the URL and details before making the resource visible to users.')); return; }
    if (visible && (!linkCheckToken || linkCheckedUrl !== draft.url)) { setError(t('تحققي من الرابط الحالي قبل النشر.', 'Check the current link before publishing.')); return; }
    setBusy(true); setError(''); setNotice('');
    try {
      await adminRequest<{ resource: Draft }>('resources', { method: 'POST', body: JSON.stringify({ resource: draft, visible, reviewed, linkCheckToken }) }, en ? 'en' : 'ar');
      setSelectedId(draft.id);
      const list = await load();
      const updated = list.find(item => item.id === draft.id);
      if (updated) choose(updated);
      await refreshLearningResources();
      setNotice(visible ? t('حُفظ المورد وسيظهر للمستخدمين بعد تحديث قائمة موارد التعلّم.', 'Resource saved. It will appear after users refresh their learning catalog.') : t('حُفظ المورد كمسودة مخفية عن المستخدمين.', 'Resource saved as a draft hidden from users.'));
    } catch (failure) { setError(failure instanceof Error ? failure.message : t('تعذر حفظ المورد.', 'Could not save the resource.')); }
    finally { setBusy(false); }
  }
  const selected = selectedId ? resources.find(item => item.id === selectedId) : null;
  return <AdminFrame active="resources">
    <AdminError>{error}</AdminError>{notice ? <AdminCard><Text style={[styles.bodyText, en && styles.ltr]}>{notice}</Text></AdminCard> : null}
    {loading && !resources.length ? <AdminLoading text={t('جارٍ تحميل كتالوج التعلّم…', 'Loading learning catalog…')} /> : null}
    <View style={{ flexDirection: en ? 'row' : 'row-reverse', flexWrap: 'wrap', alignItems: 'flex-start', gap: 18 }}>
      <AdminCard style={{ flexGrow: 1, flexBasis: 300, maxWidth: 430 }}>
        <AdminHeading title={t('كتالوج الموارد', 'Resource catalog')} hint={`${resources.length} ${t('موردًا', 'resources')}`} />
        <AdminButton title={t('＋ إضافة مورد', '＋ Add resource')} onPress={addNew} secondary />
        <ScrollView style={{ maxHeight: 630 }} contentContainerStyle={{ gap: 8 }}>
          {resources.map(item => <Pressable key={item.id} accessibilityRole="button" accessibilityState={{ selected: item.id === selectedId }} onPress={() => choose(item)} style={{ borderWidth: 1, borderColor: selectedId === item.id ? adminPalette.teal : adminPalette.border, borderRadius: 12, padding: 12, gap: 8, backgroundColor: selectedId === item.id ? adminPalette.selection : adminPalette.white }}>
            <View style={{ flexDirection: en ? 'row' : 'row-reverse', alignItems: 'flex-start', gap: 8 }}><View style={{ flex: 1, gap: 4 }}><Text style={[styles.sectionTitle, en && styles.ltr, { fontSize: 13 }]}>{item.title}</Text><Text style={[styles.sectionHint, en && styles.ltr]}>{item.provider}</Text></View><AdminPill tone={item.isVisible ? 'success' : 'warning'}>{item.isVisible ? t('ظاهر', 'Visible') : t('مسودة', 'Draft')}</AdminPill></View>
            <Text style={[styles.sectionHint, en && styles.ltr]}>{item.linkStatus === 'reviewed' ? t('تمت مراجعة البيانات', 'Details reviewed') : t('تحتاج البيانات إلى مراجعة', 'Details need review')}{item.isDefault ? t(' · مورد أساسي', ' · Built-in resource') : t(' · مورد مضاف', ' · Added resource')}</Text>
            <Text style={[styles.sectionHint, en && styles.ltr]}>{item.linkCheckStatus === 'reachable' ? t('الرابط يستجيب', 'Link reachable') : t('لم يُفحص الرابط', 'Link not checked')}</Text>
          </Pressable>)}
          {!resources.length && !loading ? <Text style={[styles.bodyText, en && styles.ltr]}>{t('لا توجد موارد متاحة الآن. أعيدي تحميل القائمة أو راجعي إعداد لوحة الإدارة.', 'No resources are available right now. Reload the list or check the admin setup.')}</Text> : null}
        </ScrollView>
      </AdminCard>
      <AdminCard style={{ flexGrow: 2, flexBasis: 540 }}>
        <AdminHeading title={isNew ? t('إضافة مورد تعلّم', 'Add learning resource') : selected ? t('تعديل المورد', 'Edit resource') : t('اختاري موردًا', 'Choose a resource')} hint={t('المعلومات الظاهرة هنا تصل إلى خطط التعلّم وفجوات المهارات.', 'Approved resources are used in learning plans and skill gap guidance.')} />
        {selected && !isNew ? <AdminPill tone={selected.isDefault ? 'neutral' : 'success'}>{selected.isDefault ? t('مورد أساسي في كتالوج مسارك', 'Built-in Masarak resource') : t('مورد أضافه المشرف', 'Admin-added resource')}</AdminPill> : null}
        {(isNew || selected) ? <>
          <View style={{ gap: 13 }}>
            {(Object.keys(labelNames) as (keyof Draft)[]).map(key => <View key={key} style={{ gap: 6 }}>
              <Text style={[styles.sectionHint, en && styles.ltr, { color: adminPalette.ink, fontWeight: '700' }]}>{labelNames[key]}</Text>
              <TextInput accessibilityLabel={labelNames[key]} value={key === 'skillIds' ? draft.skillIds.join(', ') : draft[key] as string} onChangeText={value => update(key, key === 'skillIds' ? value.split(',').map(id => id.trim()).filter(Boolean) as Draft[typeof key] : value as Draft[typeof key])} placeholder={key === 'id' ? 'Example: google-data-analytics' : key === 'skillIds' ? 'Example: T0217, T0255' : labelNames[key]} placeholderTextColor={adminPalette.muted} editable={!busy && (key !== 'id' || isNew)} autoCapitalize={key === 'url' || key === 'id' ? 'none' : 'sentences'} keyboardType={key === 'url' ? 'url' : 'default'} multiline={['access', 'language'].includes(key)} style={[{ borderWidth: 1, borderColor: adminPalette.border, borderRadius: 11, paddingHorizontal: 13, paddingVertical: 11, color: adminPalette.ink, textAlign: key === 'id' || key === 'url' || key === 'skillIds' || en ? 'left' : 'right', backgroundColor: adminPalette.inputBackground, fontSize: 14, minHeight: ['access', 'language'].includes(key) ? 66 : 45, writingDirection: key === 'id' || key === 'url' || key === 'skillIds' || en ? 'ltr' : 'rtl' }]} />
            </View>)}
          </View>
          <View style={{ flexDirection: en ? 'row' : 'row-reverse', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <AdminButton title={busy ? t('جارٍ فحص الرابط…', 'Checking link…') : t('فحص رابط HTTPS', 'Check HTTPS link')} onPress={() => void checkLink()} disabled={busy || !draft.url.trim()} secondary />
            {linkCheckedUrl === draft.url && linkCheckToken ? <AdminPill tone="success">{linkCheckedAt ? `${t('الرابط يستجيب ·', 'Link reachable ·')} ${new Date(linkCheckedAt).toLocaleString(en ? 'en' : 'ar')}` : t('الرابط يستجيب', 'Link reachable')}</AdminPill> : null}
            {!linkCheckToken && linkCheckedAt && linkCheckedUrl === draft.url ? <AdminPill tone="neutral">{t('أعيدي الفحص قبل الحفظ', 'Recheck before saving')}</AdminPill> : null}
            {redirectDestination ? <AdminPill tone="warning">{`${t('وجهة التحويل:', 'Redirect destination:')} ${redirectDestination}`}</AdminPill> : null}
          </View>
          <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: reviewed }} onPress={() => setReviewed(value => !value)} style={{ flexDirection: en ? 'row' : 'row-reverse', alignItems: 'center', gap: 10, paddingVertical: 6 }}><View style={{ width: 21, height: 21, borderRadius: 6, borderWidth: 1, borderColor: reviewed ? adminPalette.teal : adminPalette.border, backgroundColor: reviewed ? adminPalette.teal : adminPalette.white, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: adminPalette.onTeal, fontWeight: '800', fontSize: 13 }}>{reviewed ? '✓' : ''}</Text></View><Text style={[styles.bodyText, en && styles.ltr, { flex: 1 }]}>{t('راجعت محتوى المورد وتأكدت من صحة تفاصيله', 'I reviewed the resource content and confirmed its details')}</Text></Pressable>
          <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: visible, disabled: !reviewed }} disabled={!reviewed} onPress={() => setVisible(value => !value)} style={{ flexDirection: en ? 'row' : 'row-reverse', alignItems: 'center', gap: 10, paddingVertical: 6, opacity: reviewed ? 1 : 0.55 }}><View style={{ width: 21, height: 21, borderRadius: 6, borderWidth: 1, borderColor: visible ? adminPalette.teal : adminPalette.border, backgroundColor: visible ? adminPalette.teal : adminPalette.white, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: adminPalette.onTeal, fontWeight: '800', fontSize: 13 }}>{visible ? '✓' : ''}</Text></View><Text style={[styles.bodyText, en && styles.ltr, { flex: 1 }]}>{t('إظهار المورد في تطبيق المستخدم', 'Show this resource to app users')}</Text></Pressable>
          {!reviewed || !linkCheckToken ? <Text style={[styles.sectionHint, en && styles.ltr]}>{t('لا يُنشر المورد حتى ينجح فحص الرابط وتراجعي تفاصيله. تغيير الرابط يتطلب فحصًا جديدًا.', 'A resource cannot be published until its link check succeeds and its details are reviewed. Changing the URL requires another check.')}</Text> : null}
          <AdminButton title={busy ? t('جارٍ الحفظ…', 'Saving…') : t('حفظ التغييرات', 'Save changes')} onPress={() => void save()} disabled={busy || (visible && (!reviewed || !linkCheckToken || linkCheckedUrl !== draft.url))} />
        </> : <Text style={[styles.bodyText, en && styles.ltr]}>{t('اختاري موردًا من القائمة لتعديل بياناته، أو أضيفي موردًا جديدًا. لا يظهر أي مورد جديد للمستخدمين قبل مراجعة رابطه.', 'Choose a resource to edit or add a new one. New resources stay hidden until their link is reviewed.')}</Text>}
      </AdminCard>
    </View>
    <AdminCard><AdminHeading title={t('طريقة النشر', 'Publishing process')} /><Text style={[styles.bodyText, en && styles.ltr]}>{t('العناصر الأساسية تبقى في كتالوج التطبيق. يمكن إخفاء عنصر أو تعديل محتواه، وإضافة موارد جديدة. لا يُنشر المورد حتى يفحص الخادم رابط HTTPS العام ويعتمد المشرف تفاصيله.', 'Built-in items stay in the app catalog. Admins can hide or edit an item and add new resources. A resource is published only after the server checks its public HTTPS link and an admin reviews its details.')}</Text></AdminCard>
  </AdminFrame>;
}
