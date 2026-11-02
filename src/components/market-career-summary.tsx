import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { createAdaptiveStyles, ui } from '../constants/design';
import { useAppPreferences } from '../contexts/app-preferences-context';
import { useAuth } from '../contexts/auth-context';
import { careerTitles } from '../utils/career-matches';
import { marketCareerMatches, rankMarketJobs } from '../utils/job-matching';
import { useMarketJobs } from '../hooks/use-market-jobs';
import { useSkillProfile } from '../hooks/use-skill-profile';
import { usePersonalProfile } from '../hooks/use-personal-profile';

const careerTitlesEn: Record<string, string> = {
  C01: 'Software development', C02: 'Data analysis', C03: 'Data science',
  C04: 'Artificial intelligence', C05: 'Cybersecurity', C06: 'Networking',
  C07: 'Data engineering', C08: 'Cloud and DevOps', C09: 'Business systems analysis',
};
const styles = createAdaptiveStyles(() => ({
  ltr: { textAlign: 'left' as const, writingDirection: 'ltr' as const },
}));

export function MarketCareerSummary() {
  const router = useRouter();
  const auth = useAuth();
  const profile = useSkillProfile();
  const personal = usePersonalProfile();
  const { language } = useAppPreferences();
  const en = language === 'en';
  const market = useMarketJobs(en);
  const text = (ar: string, english: string) => en ? english : ar;
  const locale = en ? 'en-US' : 'ar-SA';
  const comparisonReady = profile.ready && personal.ready;
  const hasProfile = Boolean(profile.profile?.cv || profile.profile?.skill_ids.length
    || personal.personal?.education?.trim() || personal.personal?.careerGoal);
  const matches = market.data && comparisonReady
    ? marketCareerMatches(rankMarketJobs(market.data.jobs, profile.profile, personal.personal)) : [];

  return <View style={ui.card}>
    <Text style={[ui.heading, en && styles.ltr]}>{text('المسارات الأقرب من إعلانات السوق', 'Career paths across current listings')}</Text>
    <Text style={[ui.note, en && styles.ltr]}>{text(
      'ترتيب مستقل من توافق ملفك مع عينة الإعلانات. عدد الوظائف الأقرب لا يتجاوز شرط خبرة أو مؤهل مستخرج. درجة الجاهزية للمسار مقياس منفصل.',
      'A separate ranking based on how your profile matches this listing sample. A closer listing still may have experience or education requirements. Career readiness is a separate measure.',
    )}</Text>

    {!auth.session ? <View style={{ gap: 8 }}>
      <Text style={[ui.text, en && styles.ltr]}>{text('سجّل الدخول لتحميل عينة الإعلانات ومقارنتها بملفك.', 'Sign in to load current listings and compare them with your profile.')}</Text>
      <Pressable accessibilityRole="button" style={ui.outline} onPress={() => router.push({ pathname: '/account', params: { mode: 'login' } })}>
        <Text style={ui.outlineText}>{text('تسجيل الدخول', 'Sign in')}</Text>
      </Pressable>
    </View> : market.loading || !profile.ready || !personal.ready ? <Text style={[ui.note, en && styles.ltr]}>
      {text('جارٍ تحميل الملف وعينة الإعلانات لمقارنتهما…', 'Loading your profile and listing sample for comparison…')}
    </Text> : market.error || profile.error || personal.error ? <View style={{ gap: 8 }}>
      <Text accessibilityRole="alert" style={[ui.note, en && styles.ltr]}>{text('تعذر تحميل بيانات المقارنة. أعد المحاولة.', 'Could not load comparison data. Try again.')}</Text>
      {market.error ? <Pressable accessibilityRole="button" onPress={() => void market.refresh()}><Text style={[ui.link, en && styles.ltr]}>{text('إعادة المحاولة', 'Try again')}</Text></Pressable>
        : <Text style={[ui.note, en && styles.ltr]}>{text('أعد فتح هذه الصفحة لإعادة تحميل ملفك.', 'Reopen this page to reload your profile.')}</Text>}
    </View> : !market.data || !matches.length ? <Text style={[ui.note, en && styles.ltr]}>
      {!hasProfile
        ? text('أضف مهارات أو مؤهلًا إلى ملفك أولًا لمقارنة الإعلانات.', 'Add skills or education to your profile to compare listings.')
        : text('لا توجد إعلانات قابلة للمقارنة ضمن العينة الحالية.', 'No classifiable listings are available in the current sample.')}
    </Text> : <View style={{ gap: 12 }}>
      {matches.slice(0, 5).map((item, index) => <View key={item.careerId} style={{ gap: 4 }}>
        <Text style={[ui.text, en && styles.ltr]}>{index + 1}. {en ? careerTitlesEn[item.careerId] ?? item.careerId : careerTitles[item.careerId] ?? item.careerId} · {text('متوسط التوافق', 'average match')} {item.score}%</Text>
        <Text style={[ui.note, en && styles.ltr]}>{en
          ? `${item.jobs} classifiable listings · ${item.closerJobs} closer · recurring gaps: ${item.missing.slice(0, 5).join(', ') || 'no extracted core skill gap'}`
          : `${item.jobs} إعلانات قابلة للحساب · ${item.closerJobs} أقرب · فجوات متكررة: ${item.missing.slice(0, 5).join('، ') || 'لا توجد فجوة مهارات مستخرجة'}`}</Text>
      </View>)}
      <Text style={[ui.note, en && styles.ltr]}>{en
        ? `Source snapshot: ${new Date(market.data.snapshots[0]).toLocaleDateString(locale, { calendar: 'gregory' })}${market.data.partial ? ' · Some categories were unavailable' : ''}${market.data.hasMore ? ' · More listings are available from the source' : ''}. This is a sample, not a full market census.`
        : `تاريخ بيانات المصدر: ${new Date(market.data.snapshots[0]).toLocaleDateString(locale, { calendar: 'gregory' })}${market.data.partial ? ' · تعذر جلب بعض المجالات' : ''}${market.data.hasMore ? ' · توجد إعلانات إضافية لدى المصدر' : ''}. هذه عينة وليست إحصاءً شاملًا للسوق.`}</Text>
    </View>}

    <Pressable accessibilityRole="button" onPress={() => router.push('/market' as never)}>
      <Text style={[ui.link, en && styles.ltr]}>{text('لوحة سوق الوظائف من العينة', 'Open the job market snapshot')}</Text>
    </Pressable>
    <Pressable accessibilityRole="button" onPress={() => router.push('/jobs')}>
      <Text style={[ui.link, en && styles.ltr]}>{text('وظائف مناسبة لي وخطط فجواتها', 'Browse jobs and plan around skill gaps')}</Text>
    </Pressable>
  </View>;
}
