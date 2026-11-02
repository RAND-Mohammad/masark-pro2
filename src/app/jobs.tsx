import { useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, ui, createAdaptiveStyles } from '../constants/design';
import { useAppPreferences } from '../contexts/app-preferences-context';
import { useAuth } from '../contexts/auth-context';
import { jobCategories, type JobCategory } from '../utils/jobs-api';
import { rankMarketJobs, matchMarketJob } from '../utils/job-matching';
import { jobPlanSkillIds } from '../utils/job-learning-plan';
import { captureDataScope } from '../utils/scoped-storage';
import { useMarketJobs } from '../hooks/use-market-jobs';
import { useSkillProfile } from '../hooks/use-skill-profile';
import { usePersonalProfile } from '../hooks/use-personal-profile';
import { useLearningPlan } from '../hooks/use-learning-plan';
import { useJobTarget } from '../hooks/use-job-target';
import { useJobUpdates } from '../hooks/use-job-updates';
import { JobMatchCard } from '../components/job-match-card';
import { JobGapPlan } from '../components/job-gap-plan';
import type { JobMatch } from '../utils/job-matching';

const showDate = (value: string, locale: string) => new Date(value).toLocaleDateString(locale, { calendar: 'gregory' });
export default function JobsScreen() {
  const router = useRouter(); const auth = useAuth();
  const { language } = useAppPreferences(); const en = language === 'en';
  const t = (ar: string, english: string) => en ? english : ar;
  const market = useMarketJobs(en); const profile = useSkillProfile(); const personal = usePersonalProfile();
  const learning = useLearningPlan(); const target = useJobTarget(); const updates = useJobUpdates(market.data);
  const [category, setCategory] = useState<JobCategory | 'recommended'>('recommended');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [message, setMessage] = useState(''); const [actionError, setActionError] = useState('');
  const ready = profile.ready && personal.ready && !profile.error && !personal.error;
  const matches = market.data && ready ? rankMarketJobs(market.data.jobs, profile.profile, personal.personal) : [];
  const visible = category === 'recommended' ? matches.filter(match => match.requirements.careerId !== null)
    : matches.filter(match => market.data?.groupIds[category]?.includes(match.job.id));
  const currentTarget = target.target ? market.data?.jobs.find(job => job.id === target.target!.job.id) : null;
  const targetMatch = target.target && ready ? matchMarketJob(currentTarget ?? target.target.job, profile.profile, personal.personal) : null;
  const oldSnapshot = market.data && market.data.snapshots.some(date => Date.parse(market.data!.fetchedAt) - Date.parse(date) > 48 * 3600000);
  const openLink = async (url: string) => { try { await Linking.openURL(url); } catch { setActionError(t('تعذر فتح رابط الإعلان.', 'Could not open the listing link.')); } };
  async function choose(match: JobMatch) {
    const scope = captureDataScope(); setActionError(''); setMessage('');
    try {
      if (!(await target.choose(match.job))) return;
      scope.assertCurrent();
      const ids = jobPlanSkillIds(match, profile.profile);
      if (ids.length && !(await learning.addItems(ids))) { setActionError(t('تم حفظ الوظيفة المستهدفة، لكن تعذر إضافة المهارات لخطة التعلم. حاول مجددًا.', 'The job was saved, but its skills could not be added to your learning plan. Try again.')); return; }
      scope.assertCurrent(); setMessage(t('حفظنا الوظيفة وخطة فجواتها، وخطتك السابقة باقية. تقدر تتابعها من «خطة تعلمي».', 'Saved the job and its skill gaps. Your existing plan was kept. Review it in “My learning plan”.'));
    } catch { setActionError(t('تغيّر الحساب أو تعذر حفظ الهدف. أعد المحاولة.', 'Your account changed or the goal could not be saved. Try again.')); }
  }
  return <SafeAreaView edges={['top', 'left', 'right']} style={ui.screen}><ScrollView contentContainerStyle={ui.content}>
    <Pressable accessibilityRole="button" onPress={() => router.back()}><Text style={[ui.link, en && styles.ltr]}>{t('رجوع', 'Back')}</Text></Pressable>
    <Text style={[ui.eyebrow, en && styles.ltr]}>{t('من سيرتك إلى فرصتك', 'FROM YOUR PROFILE TO YOUR NEXT ROLE')}</Text><Text style={[ui.title, en && styles.ltr]}>{t('وظائف مناسبة لي', 'Jobs for me')}</Text>
    <Text style={[ui.text, en && styles.ltr]}>{t('نقارن مهارات ملفك المعتمد وخبرتك ومؤهلك بمتطلبات الإعلانات، ونرتب الأقرب مع توضيح الفجوات. المقارنة محلية؛ ما نرسل سيرتك لمصدر الوظائف.', 'We compare your approved skills, experience and education with listing requirements, then explain the closest matches and gaps. Matching happens on your device; your CV is not sent to job sources.' )}</Text>
    <Pressable accessibilityRole="button" style={ui.outline} onPress={() => router.push('/market' as never)}><Text style={ui.outlineText}>{t('فتح لوحة سوق الوظائف', 'Open job market snapshot')}</Text></Pressable>
    <Text style={[ui.note, en && styles.ltr]}>{t('نستخرج العبارات الصريحة من الإعلان. المتطلبات المفضلة منفصلة، وما لم نستطع تفسيره يظهر للمراجعة. عدم توثيق مهارة لا يعني أنك لا تمتلكها.', 'We extract explicit phrases from each listing. Preferred requirements are separate; anything we cannot interpret is shown for review. An undocumented skill does not mean you lack it.')}</Text>
    <View style={[styles.filters, en && styles.filtersLtr]}>{[{ id: 'recommended' as const, title: t('المقترحة لي', 'Recommended') }, ...jobCategories.map(item => ({ ...item, title: en ? ({ software: 'Software', data: 'Data', security: 'Security & networking', cloud: 'Cloud & databases', graduates: 'Graduate & internship' }[item.id]) : item.title }))].map(item =>
      <Pressable key={item.id} accessibilityRole="button" accessibilityState={{ selected: category === item.id }} onPress={() => { setCategory(item.id); setExpanded(null); setActionError(''); }}
        style={[ui.outline, { minHeight: 44, padding: 10, backgroundColor: category === item.id ? colors.mint : colors.surface }]}><Text style={ui.outlineText}>{item.title}</Text></Pressable>)}</View>
    {!auth.ready || market.loading || (auth.session && !ready && !profile.error && !personal.error) ? <><ActivityIndicator color={colors.primary} /><Text style={[ui.text, en && styles.ltr]}>{t('جارٍ مقارنة الإعلانات بملفك…', 'Matching listings to your profile…')}</Text></> : null}
    {!auth.session && auth.ready ? <><Text style={[ui.text, en && styles.ltr]}>{t('سجّل الدخول في مسارك لعرض الوظائف وحفظ هدفك.', 'Sign in to view jobs and save a target role.')}</Text><Pressable style={ui.button} onPress={() => router.push('/account')}><Text style={ui.buttonText}>{t('تسجيل الدخول', 'Sign in')}</Text></Pressable></> : null}
    {auth.session && !profile.profile?.cv ? <Pressable accessibilityRole="button" style={ui.outline} onPress={() => router.push('/profile')}><Text style={ui.outlineText}>{t('ارفع سيرتك واعتمد التحليل أو أكمل بياناتك', 'Upload your CV and approve the analysis, or complete your profile')}</Text></Pressable> : null}
    {[market.error, profile.error, personal.error, target.error, learning.error, updates.error, actionError].filter(Boolean).map((error, index) => <Text key={index} accessibilityRole="alert" style={[ui.text, { color: colors.error }]}>{error}</Text>)}
    {message ? <Text style={[ui.text, en && styles.ltr]}>{message}</Text> : null}
    {auth.session ? <Pressable accessibilityRole="button" style={ui.outline} onPress={() => void market.refresh()}><Text style={ui.outlineText}>{t('تحديث الإعلانات والمقارنة', 'Refresh listings and matches')}</Text></Pressable> : null}
    {market.data ? <>
      <Text style={[ui.note, en && styles.ltr]}>{en ? `Source snapshot: ${showDate(market.data.snapshots[0], 'en-US')} · Last fetched: ${showDate(market.data.fetchedAt, 'en-US')}. ${market.data.jobs.length} unique listings in this sample${market.data.partial ? '; some categories could not be loaded' : ''}${market.data.hasMore ? '; more listings are available from the source' : ''}.` : `تاريخ بيانات المصدر: ${showDate(market.data.snapshots[0], 'ar-SA')} · آخر جلب: ${showDate(market.data.fetchedAt, 'ar-SA')}. ${market.data.jobs.length} إعلانات فريدة في العينة${market.data.partial ? '؛ تعذر جلب بعض المجالات' : ''}${market.data.hasMore ? '؛ توجد إعلانات إضافية لدى المصدر' : ''}.`}</Text>
      {oldSnapshot ? <Text style={[ui.text, { color: colors.error }, en && styles.ltr]}>{t('بيانات المصدر أقدم من يومين. لا نقدر نؤكد أنها أحدث إعلانات السوق؛ راجع المصدر قبل التقديم.', 'The source snapshot is over two days old. We cannot confirm these are the latest listings; check the source before applying.')}</Text> : null}
      <Text style={[ui.text, en && styles.ltr]}>{en ? `Since your last visit on this device: ${updates.added.length} new listings and ${updates.changed.length} changed listings.` : `من آخر متابعة على هذا الجهاز: ${updates.added.length} إعلانات جديدة و${updates.changed.length} إعلانات تغيّر محتواها في العينة.`}</Text>
      {updates.added.length || updates.changed.length ? <Pressable accessibilityRole="button" onPress={() => void updates.markSeen()}><Text style={[ui.link, en && styles.ltr]}>{t('اعتبار التحديثات مقروءة', 'Mark updates as seen')}</Text></Pressable> : null}
    </> : null}
    {targetMatch ? <>
      <Text style={[ui.heading, en && styles.ltr]}>{t('وظيفتك المستهدفة', 'Your target job')}</Text>
      {!currentTarget ? <Text style={[ui.note, en && styles.ltr]}>{t('إعلانك المحفوظ غير موجود في العينة الحالية؛ هذا لا يثبت إغلاقه. راجع رابط المصدر.', 'Your saved listing is not in the current sample. This does not prove it has closed; check the source link.')}</Text> : currentTarget.description !== target.target!.job.description ? <Text style={[ui.text, en && styles.ltr]}>{t('تغيّر وصف وظيفتك. المقارنة والخطة أدناه من النص الجديد؛ اختَرها مجددًا لحفظ النسخة المحدّثة.', 'The job description changed. The comparison and plan use the latest text; select the job again to save the updated version.')}</Text> : null}
      <JobGapPlan match={targetMatch} />
      <Pressable accessibilityRole="button" disabled={target.busy} onPress={() => void target.choose(null)}><Text style={[ui.link, en && styles.ltr]}>{t('إلغاء استهداف الوظيفة مع إبقاء عناصر خطتي', 'Clear target job and keep my plan items')}</Text></Pressable>
    </> : null}
    {ready && market.data && !visible.length ? <Text style={[ui.text, en && styles.ltr]}>{t('ما لقينا إعلانات قابلة للتصنيف في هذا الاختيار. جرّب مجالًا ثانيًا أو أكمل ملفك.', 'No classifiable listings found for this selection. Try another category or complete your profile.')}</Text> : null}
    {visible.map(match => <View key={match.job.id} style={{ gap: 8 }}>
      {updates.added.includes(match.job.id) ? <Text style={[ui.eyebrow, en && styles.ltr]}>{t('إعلان جديد من آخر متابعة', 'New since your last visit')}</Text> : updates.changed.includes(match.job.id) ? <Text style={[ui.eyebrow, en && styles.ltr]}>{t('تغيّر محتوى الإعلان', 'Listing details changed')}</Text> : null}
      <JobMatchCard match={match} expanded={expanded === match.job.id} selected={target.target?.job.id === match.job.id}
        busy={!learning.ready || learning.busy || !target.ready || target.busy} onExpand={() => setExpanded(expanded === match.job.id ? null : match.job.id)}
        onChoose={() => void choose(match)} onOpen={url => void openLink(url)} />
    </View>)}
    <View style={ui.card}>
      <Text style={[ui.heading, en && styles.ltr]}>{t('تقييم جاهزيتك للمسار', 'Readiness for this path')}</Text>
      <Text style={[ui.note, en && styles.ltr]}>{t('بعد مراجعة الوظائف، اعرض نسبة المهارات الأساسية التي وثّقتها للمسار. هذه النسبة مستقلة عن توافقك مع إعلان بعينه.', 'See the share of core skills you have documented for a path. This is separate from your match to any single listing.')}</Text>
      <Pressable accessibilityRole="button" style={ui.button} onPress={() => router.push('/readiness' as never)}>
        <Text style={ui.buttonText}>{t('عرض تقييم الجاهزية', 'View readiness')}</Text>
      </Pressable>
    </View>
    <Text style={[ui.note, en && styles.ltr]}>{t('التوافق ليس احتمال قبول. الإعلانات عينة من المصدر، والحد الأدنى للخبرة والمؤهل لا يُعوّض بمجرد ارتفاع تطابق المهارات. متابعة التحديثات داخل التطبيق وعلى هذا الجهاز؛ ما فيه إشعارات خارج التطبيق حاليًا.', 'A match score is not a hiring probability. Listings are a source sample, and a high skill match does not replace required experience or education. Updates are tracked in this app on this device; external notifications are not available.')}</Text>
  </ScrollView></SafeAreaView>;
}

const styles = createAdaptiveStyles(() => ({ ltr: { textAlign: 'left', writingDirection: 'ltr' }, filters: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 }, filtersLtr: { flexDirection: 'row' } }));
