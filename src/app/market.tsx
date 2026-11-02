import { useMemo } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/auth-context';
import { useMarketJobs } from '../hooks/use-market-jobs';
import { jobCategories } from '../utils/jobs-api';
import { extractJobRequirements } from '../utils/job-matching';
import { colors, ui, createAdaptiveStyles} from '../constants/design';
import { useAppPreferences } from '../contexts/app-preferences-context';

const date = (value: string, locale: string) => new Date(value).toLocaleDateString(locale, { calendar: 'gregory', dateStyle: 'medium' });

export default function MarketScreen() {
  const router = useRouter();
  const auth = useAuth();
  const { language } = useAppPreferences();
  const en = language === 'en';
  const market = useMarketJobs(en);
  const text = (ar: string, english: string) => en ? english : ar;
  const summary = useMemo(() => {
    if (!market.data) return null;
    const counts = jobCategories.map(category => ({
      ...category,
      count: market.data!.groupIds[category.id]?.length ?? 0,
    }));
    const employers = new Map<string, number>();
    const skillJobs = new Map<string, Set<string>>();
    for (const job of market.data.jobs) {
      employers.set(job.employer, (employers.get(job.employer) ?? 0) + 1);
      const requirement = extractJobRequirements(job);
      for (const skill of requirement.skills) {
        if (skill.priority === 'mentioned') continue;
        const jobs = skillJobs.get(skill.name) ?? new Set<string>();
        jobs.add(job.id);
        skillJobs.set(skill.name, jobs);
      }
    }
    return {
      counts,
      employers: [...employers].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 5),
      skills: [...skillJobs].map(([name, jobs]) => ({ name, count: jobs.size }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, 8),
      maximumCategory: Math.max(1, ...counts.map(item => item.count)),
    };
  }, [market.data]);

  return <SafeAreaView edges={['top', 'left', 'right']} style={ui.screen}>
    <ScrollView contentContainerStyle={ui.content}>
      <Pressable accessibilityRole="button" onPress={() => router.canGoBack() ? router.back() : router.replace('/home')}>
        <Text style={[ui.link, en && styles.ltr]}>{text('رجوع', 'Back')}</Text>
      </Pressable>
      <Text style={[ui.eyebrow, en && styles.ltr]}>{text('مؤشرات من الإعلانات المتاحة', 'INSIGHTS FROM AVAILABLE LISTINGS')}</Text>
      <Text style={[ui.title, en && styles.ltr]}>{text('لوحة سوق الوظائف', 'Job market snapshot')}</Text>
      <Text style={[ui.text, en && styles.ltr]}>{text('نعرض ما ظهر في عينة إعلانات Headcount المتاحة للتطبيق. الأعداد وتكرار المتطلبات لا تمثل كل وظائف السوق السعودي ولا تضمن بقاء الإعلان مفتوحًا.', 'This snapshot summarizes the Headcount listings available to the app. Counts and recurring requirements do not represent the entire Saudi job market or guarantee that a listing is still open.')}</Text>

      {!auth.session && auth.ready ? <View style={ui.card}>
        <Text style={[ui.heading, en && styles.ltr]}>{text('سجّل الدخول لعرض العينة', 'Sign in to view the listings')}</Text>
        <Text style={[ui.text, en && styles.ltr]}>{text('تحميل الإعلانات وحفظ الوظائف يتطلب حسابًا في مسارك.', 'Sign in to load listings and save jobs.')}</Text>
        <Pressable accessibilityRole="button" style={ui.button} onPress={() => router.push({ pathname: '/account', params: { mode: 'login' } })}>
          <Text style={ui.buttonText}>{text('تسجيل الدخول', 'Sign in')}</Text>
        </Pressable>
      </View> : null}

      {market.loading ? <View style={styles.loading}><ActivityIndicator color={colors.primary} /><Text style={[ui.text, en && styles.ltr]}>{text('جارٍ تحميل بيانات العينة…', 'Loading listing data…')}</Text></View> : null}
      {market.error ? <View style={styles.errorBox}><Text accessibilityRole="alert" style={[styles.errorText, en && styles.ltr]}>{market.error}</Text><Pressable accessibilityRole="button" onPress={() => void market.refresh()}><Text style={[ui.link, en && styles.ltr]}>{text('إعادة المحاولة', 'Try again')}</Text></Pressable></View> : null}

      {summary && market.data ? <>
        <View style={[ui.card, { backgroundColor: colors.mint }]}>
          <Text style={[ui.heading, en && styles.ltr]}>{en ? `${market.data.jobs.length} unique listings in this sample` : `${market.data.jobs.length} إعلانًا فريدًا في العينة`}</Text>
          <Text style={[ui.note, en && styles.ltr]}>{en ? `Last fetched: ${date(market.data.fetchedAt, 'en-US')} · Source snapshot: ${date(market.data.snapshots[0], 'en-US')}` : `آخر جلب: ${date(market.data.fetchedAt, 'ar-SA')} · تاريخ بيانات المصدر: ${date(market.data.snapshots[0], 'ar-SA')}`}</Text>
          {market.data.partial ? <Text style={[ui.note, en && styles.ltr]}>{text('تعذر تحميل بعض المجالات؛ الأرقام الحالية جزئية.', 'Some categories could not be loaded; these figures are partial.')}</Text> : null}
          {market.data.hasMore ? <Text style={[ui.note, en && styles.ltr]}>{text('المصدر لديه نتائج إضافية لم تدخل في هذه العينة.', 'The source has additional results that are not included in this sample.')}</Text> : null}
        </View>

        <View style={ui.card}>
          <Text style={[ui.heading, en && styles.ltr]}>{text('الإعلانات حسب المجال', 'Listings by category')}</Text>
          {summary.counts.map(item => <View key={item.id} style={styles.metric}>
            <View style={[styles.metricLabel, en && styles.metricLabelLtr]}><Text style={[ui.text, en && styles.ltr]}>{en ? ({ software: 'Software', data: 'Data', security: 'Security & networking', cloud: 'Cloud & databases', graduates: 'Graduate & internship' }[item.id]) : item.title}</Text><Text style={styles.metricCount}>{item.count}</Text></View>
            <View style={styles.track}><View style={[styles.fill, { width: `${Math.max(item.count ? 5 : 0, item.count / summary.maximumCategory * 100)}%` }]} /></View>
          </View>)}
        </View>

        <View style={ui.card}>
          <Text style={[ui.heading, en && styles.ltr]}>{text('المهارات الأكثر تكرارًا', 'Most recurring skills')}</Text>
          <Text style={[ui.note, en && styles.ltr]}>{text('تكرار أسماء المتطلبات التي استطاع النظام استخراجها من الإعلانات، وليس قياسًا شاملًا للطلب.', 'Counts reflect requirements the app could extract from the listings; they are not a complete measure of market demand.')}</Text>
          {summary.skills.length ? summary.skills.map(item => <View key={item.name} style={styles.listRow}>
            <Text style={[ui.text, en && styles.ltr]}>{item.name}</Text><Text style={styles.countPill}>{en ? `${item.count} listings` : `${item.count} إعلان`}</Text>
          </View>) : <Text style={[ui.note, en && styles.ltr]}>{text('لا تتوفر متطلبات قابلة للتجميع في العينة الحالية.', 'No requirements could be grouped in this sample.')}</Text>}
        </View>

        <View style={ui.card}>
          <Text style={[ui.heading, en && styles.ltr]}>{text('الجهات الظاهرة في العينة', 'Employers in this sample')}</Text>
          {summary.employers.length ? summary.employers.map(([name, count]) => <View key={name} style={styles.listRow}>
            <Text style={[ui.text, en && styles.ltr]}>{name}</Text><Text style={styles.countPill}>{en ? `${count} listings` : `${count} إعلان`}</Text>
          </View>) : <Text style={[ui.note, en && styles.ltr]}>{text('لا توجد جهات ظاهرة حاليًا.', 'No employers are available right now.')}</Text>}
        </View>

        <Pressable accessibilityRole="button" style={ui.button} onPress={() => router.push('/jobs')}>
          <Text style={ui.buttonText}>{text('استعراض الوظائف ومطابقتها بملفي', 'Browse jobs and match them to my profile')}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" style={ui.outline} onPress={() => void market.refresh()}>
          <Text style={ui.outlineText}>{text('إعادة تحميل العينة', 'Refresh sample')}</Text>
        </Pressable>
      </> : null}

      <Text style={[ui.note, en && styles.ltr]}>{text('الإعلانات قد تنتهي أو تتغير لدى الجهة قبل موعد التحديث التالي. افتح الرابط الأصلي للتأكد من الحالة والتفاصيل قبل التقديم.', 'Listings may expire or change before the next refresh. Open the original source to confirm details and status before applying.')}</Text>
    </ScrollView>
  </SafeAreaView>;
}

const styles = createAdaptiveStyles(() => ({
  loading: { alignItems: 'center', gap: 12, padding: 18 },
  errorBox: { borderWidth: 1, borderColor: colors.errorBorder, backgroundColor: colors.errorSurface, borderRadius: 15, padding: 15, gap: 8 },
  errorText: { color: colors.error, fontSize: 14, lineHeight: 22, textAlign: 'right' },
  metric: { gap: 6 },
  metricLabel: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
  metricCount: { color: colors.primary, fontSize: 15, fontWeight: '700' },
  track: { height: 8, borderRadius: 6, backgroundColor: colors.soft, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 6, backgroundColor: colors.primary },
  listRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderBottomWidth: 1, borderColor: colors.border, paddingVertical: 8 },
  countPill: { color: colors.primary, backgroundColor: colors.mint, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5, fontSize: 11, fontWeight: '600' },
  ltr: { textAlign: 'left' as const, writingDirection: 'ltr' as const },
  metricLabelLtr: { flexDirection: 'row' as const },
}));
