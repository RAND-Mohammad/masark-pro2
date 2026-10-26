import { useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, ui } from '../constants/design';
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

const showDate = (value: string) => new Date(value).toLocaleDateString('ar-SA', { calendar: 'gregory' });
export default function JobsScreen() {
  const router = useRouter(); const auth = useAuth();
  const market = useMarketJobs(); const profile = useSkillProfile(); const personal = usePersonalProfile();
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
  const openLink = async (url: string) => { try { await Linking.openURL(url); } catch { setActionError('تعذر فتح رابط الإعلان.'); } };
  async function choose(match: JobMatch) {
    const scope = captureDataScope(); setActionError(''); setMessage('');
    try {
      if (!(await target.choose(match.job))) return;
      scope.assertCurrent();
      const ids = jobPlanSkillIds(match, profile.profile);
      if (ids.length && !(await learning.addItems(ids))) { setActionError('تم حفظ الوظيفة المستهدفة، لكن تعذر إضافة المهارات لخطة التعلم. حاول مجددًا.'); return; }
      scope.assertCurrent(); setMessage('حفظنا الوظيفة وخطة فجواتها، وخطتك السابقة باقية. تقدر تتابعها من «خطة تعلمي».');
    } catch { setActionError('تغيّر الحساب أو تعذر حفظ الهدف. أعد المحاولة.'); }
  }
  return <SafeAreaView edges={['top', 'left', 'right']} style={ui.screen}><ScrollView contentContainerStyle={ui.content}>
    <Pressable accessibilityRole="button" onPress={() => router.back()}><Text style={ui.link}>رجوع</Text></Pressable>
    <Text style={ui.eyebrow}>من سيرتك إلى فرصتك</Text><Text style={ui.title}>وظائف مناسبة لي</Text>
    <Text style={ui.text}>نقارن مهارات ملفك المعتمد وخبرتك ومؤهلك بمتطلبات الإعلانات، ونرتب الأقرب مع توضيح الفجوات. المقارنة محلية؛ ما نرسل سيرتك لمصدر الوظائف.</Text>
    <Text style={ui.note}>نستخرج العبارات الصريحة من الإعلان. المتطلبات المفضلة منفصلة، وما لم نستطع تفسيره يظهر للمراجعة. عدم توثيق مهارة لا يعني أنك لا تمتلكها.</Text>
    <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 }}>{[{ id: 'recommended' as const, title: 'المقترحة لي' }, ...jobCategories].map(item =>
      <Pressable key={item.id} accessibilityRole="button" accessibilityState={{ selected: category === item.id }} onPress={() => { setCategory(item.id); setExpanded(null); setActionError(''); }}
        style={[ui.outline, { minHeight: 44, padding: 10, backgroundColor: category === item.id ? colors.mint : colors.surface }]}><Text style={ui.outlineText}>{item.title}</Text></Pressable>)}</View>
    {!auth.ready || market.loading || (auth.session && !ready && !profile.error && !personal.error) ? <><ActivityIndicator color={colors.primary} /><Text style={ui.text}>جارٍ مقارنة الإعلانات بملفك…</Text></> : null}
    {!auth.session && auth.ready ? <><Text style={ui.text}>سجّل الدخول في مسارك لعرض الوظائف وحفظ هدفك.</Text><Pressable style={ui.button} onPress={() => router.push('/account')}><Text style={ui.buttonText}>تسجيل الدخول</Text></Pressable></> : null}
    {auth.session && !profile.profile?.cv ? <Pressable accessibilityRole="button" style={ui.outline} onPress={() => router.push('/profile')}><Text style={ui.outlineText}>ارفع سيرتك واعتمد التحليل أو أكمل بياناتك</Text></Pressable> : null}
    {[market.error, profile.error, personal.error, target.error, learning.error, updates.error, actionError].filter(Boolean).map((error, index) => <Text key={index} accessibilityRole="alert" style={[ui.text, { color: colors.error }]}>{error}</Text>)}
    {message ? <Text style={ui.text}>{message}</Text> : null}
    {auth.session ? <Pressable accessibilityRole="button" style={ui.outline} onPress={() => void market.refresh()}><Text style={ui.outlineText}>تحديث الإعلانات والمقارنة</Text></Pressable> : null}
    {market.data ? <>
      <Text style={ui.note}>تاريخ بيانات المصدر: {showDate(market.data.snapshots[0])} · آخر جلب: {showDate(market.data.fetchedAt)}. {market.data.jobs.length} إعلانات فريدة في العينة{market.data.partial ? '؛ تعذر جلب بعض المجالات' : ''}{market.data.hasMore ? '؛ توجد إعلانات إضافية لدى المصدر' : ''}.</Text>
      {oldSnapshot ? <Text style={[ui.text, { color: colors.error }]}>بيانات المصدر أقدم من يومين. لا نقدر نؤكد أنها أحدث إعلانات السوق؛ راجع المصدر قبل التقديم.</Text> : null}
      <Text style={ui.text}>من آخر متابعة على هذا الجهاز: {updates.added.length} إعلانات جديدة و{updates.changed.length} إعلانات تغيّر محتواها في العينة.</Text>
      {updates.added.length || updates.changed.length ? <Pressable accessibilityRole="button" onPress={() => void updates.markSeen()}><Text style={ui.link}>اعتبار التحديثات مقروءة</Text></Pressable> : null}
    </> : null}
    {targetMatch ? <>
      <Text style={ui.heading}>وظيفتك المستهدفة</Text>
      {!currentTarget ? <Text style={ui.note}>إعلانك المحفوظ غير موجود في العينة الحالية؛ هذا لا يثبت إغلاقه. راجع رابط المصدر.</Text> : currentTarget.description !== target.target!.job.description ? <Text style={ui.text}>تغيّر وصف وظيفتك. المقارنة والخطة أدناه من النص الجديد؛ اختَرها مجددًا لحفظ النسخة المحدّثة.</Text> : null}
      <JobGapPlan match={targetMatch} />
      <Pressable accessibilityRole="button" disabled={target.busy} onPress={() => void target.choose(null)}><Text style={ui.link}>إلغاء استهداف الوظيفة مع إبقاء عناصر خطتي</Text></Pressable>
    </> : null}
    {ready && market.data && !visible.length ? <Text style={ui.text}>ما لقينا إعلانات قابلة للتصنيف في هذا الاختيار. جرّب مجالًا ثانيًا أو أكمل ملفك.</Text> : null}
    {visible.map(match => <View key={match.job.id} style={{ gap: 8 }}>
      {updates.added.includes(match.job.id) ? <Text style={ui.eyebrow}>إعلان جديد من آخر متابعة</Text> : updates.changed.includes(match.job.id) ? <Text style={ui.eyebrow}>تغيّر محتوى الإعلان</Text> : null}
      <JobMatchCard match={match} expanded={expanded === match.job.id} selected={target.target?.job.id === match.job.id}
        busy={!learning.ready || learning.busy || !target.ready || target.busy} onExpand={() => setExpanded(expanded === match.job.id ? null : match.job.id)}
        onChoose={() => void choose(match)} onOpen={url => void openLink(url)} />
    </View>)}
    <Text style={ui.note}>التوافق ليس احتمال قبول. الإعلانات عينة من المصدر، والحد الأدنى للخبرة والمؤهل لا يُعوّض بمجرد ارتفاع تطابق المهارات. متابعة التحديثات داخل التطبيق وعلى هذا الجهاز؛ ما فيه إشعارات خارج التطبيق حاليًا.</Text>
  </ScrollView></SafeAreaView>;
}
