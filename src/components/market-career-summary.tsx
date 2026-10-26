import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ui } from '../constants/design';
import { careerTitles } from '../utils/career-matches';
import { marketCareerMatches, rankMarketJobs } from '../utils/job-matching';
import { useMarketJobs } from '../hooks/use-market-jobs';
import { useSkillProfile } from '../hooks/use-skill-profile';
import { usePersonalProfile } from '../hooks/use-personal-profile';

export function MarketCareerSummary() {
  const router = useRouter(); const market = useMarketJobs();
  const profile = useSkillProfile(); const personal = usePersonalProfile();
  const matches = market.data && profile.ready && personal.ready && !profile.error && !personal.error
    ? marketCareerMatches(rankMarketJobs(market.data.jobs, profile.profile, personal.personal)) : [];
  return <View style={ui.card}>
    <Text style={ui.heading}>المسارات الأقرب من إعلانات السوق</Text>
    <Text style={ui.note}>ترتيب مستقل من توافق ملفك مع عينة الإعلانات، وعدد الوظائف الأقرب بلا عائق خبرة أو مؤهل مستخرج. درجة جاهزيتك العامة للمسار تبقى منفصلة.</Text>
    {matches.slice(0, 5).map((item, index) => <View key={item.careerId} style={{ gap: 4 }}>
      <Text style={ui.text}>{index + 1}. {careerTitles[item.careerId] ?? item.careerId} · متوسط التوافق {item.score}%</Text>
      <Text style={ui.note}>{item.jobs} إعلانات قابلة للحساب · {item.closerJobs} أقرب · فجوات متكررة: {item.missing.slice(0, 5).join('، ') || 'لا توجد فجوة مهارات مستخرجة'}</Text>
    </View>)}
    {!matches.length ? <Text style={ui.note}>{market.loading ? 'جارٍ مقارنة إعلانات السوق بملفك…' : 'أكمل ملفك وافتح الوظائف لعرض الترتيب المتاح من العينة.'}</Text> : null}
    {market.data ? <Text style={ui.note}>تاريخ بيانات المصدر: {new Date(market.data.snapshots[0]).toLocaleDateString('ar-SA', { calendar: 'gregory' })}{market.data.partial ? ' · تعذر جلب بعض المجالات' : ''}. هذه عينة وليست إحصاءً شاملًا للسوق.</Text> : null}
    <Pressable accessibilityRole="button" onPress={() => router.push('/jobs')}><Text style={ui.link}>وظائف مناسبة لي وخطط فجواتها</Text></Pressable>
  </View>;
}
