import { Pressable, Text, View } from 'react-native';
import { createAdaptiveStyles, ui, colors } from '../constants/design';
import type { JobMatch } from '../utils/job-matching';
import { useAppPreferences } from '../contexts/app-preferences-context';

export function JobMatchCard({ match, expanded, selected, busy, onExpand, onChoose, onOpen }: {
  match: JobMatch; expanded: boolean; selected: boolean; busy: boolean; onExpand: () => void; onChoose: () => void; onOpen: (url: string) => void;
}) {
  const { job, requirements } = match;
  const { language } = useAppPreferences(); const en = language === 'en';
  const t = (ar: string, english: string) => en ? english : ar;
  const status = en ? { closer: 'Closer match by extracted requirements', gaps: 'Skills to develop', review: 'Requirements need review', insufficient: 'Not enough data to calculate a match' }[match.status] : { closer: 'أقرب بحسب المتطلبات المستخرجة', gaps: 'تحتاج تطوير مهارات', review: 'شروط تحتاج مراجعة', insufficient: 'بيانات غير كافية لحساب التوافق' }[match.status];
  return <View style={ui.card}>
    <Text style={[ui.heading, en && styles.ltr]}>{job.title}</Text><Text style={[ui.text, en && styles.ltr]}>{job.employer} · {job.locations.join(en ? ', ' : '، ')}</Text>
    <Text style={[ui.heading, { color: colors.primary }, en && styles.ltr]}>{match.score === null ? t('التوافق غير محسوب', 'Match not calculated') : `${match.score}% ${t('توافق مع الإعلان', 'match with listing')}`}</Text>
    <Text style={[ui.note, en && styles.ltr]}>{status}{selected ? ` · ${t('وظيفتك المستهدفة', 'Target job')}` : ''}</Text>
    <Text style={[ui.note, en && styles.ltr]}>{t('النسبة تقيس المتطلبات التي استخرجناها، وليست احتمال قبول أو ضمان توظيف.', 'This score measures extracted requirements; it is not a hiring probability or guarantee.')}</Text>
    {match.reasons.length ? <Text style={[ui.text, en && styles.ltr]}>{match.reasons.join('\n')}</Text> : <Text style={[ui.text, en && styles.ltr]}>{t('أكمل بياناتك واعتمد مهارات السيرة حتى نوضح سبب الترشيح.', 'Complete your profile and approve CV skills to see why this role was recommended.')}</Text>}
    {match.blockers.map(message => <Text key={message} style={[ui.text, { color: colors.error }]}>{message}</Text>)}
    <Text style={[ui.text, en && styles.ltr]}>{match.missing.length ? `${t('المهارات المطلوبة غير الموثقة:', 'Required skills not documented:')} ${match.missing.map(item => item.name + (item.alternatives.length ? ` ${t('أو', 'or')} ${item.alternatives.join(en ? ' or ' : ' أو ')}` : '')).join(en ? ', ' : '، ')}` : match.matched.length ? t('المهارات المطلوبة المستخرجة موثقة في ملفك.', 'The extracted required skills are documented in your profile.') : t('لم نستخرج قائمة مهارات مطلوبة كافية؛ راجع وصف الإعلان.', 'We could not extract enough required skills; review the listing description.')}</Text>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={onExpand}><Text style={[ui.link, en && styles.ltr]}>{expanded ? t('إخفاء التفاصيل', 'Hide details') : t('ليش ترشحت لي؟ عرض الشروط والأدلة', 'Why this match? Requirements and evidence')}</Text></Pressable>
    {expanded ? <>
      <Text style={[ui.note, en && styles.ltr]}>{t('أوزان المقارنة: المهارات المطلوبة 60، الخبرة 25، المؤهل 15. نعيد توزيع الأوزان على الشروط الموجودة فقط؛ الشروط المفضلة لا تخصم من النسبة. نقص شرط أساسي يمنع اعتبار الوظيفة أقرب ترشيح.', 'Match weights: required skills 60, experience 25, education 15. We redistribute weights across requirements present in the listing. Preferred requirements do not reduce the score; a missing required condition prevents a “closest match” label.')}</Text>
      <Text style={[ui.text, en && styles.ltr]}>{match.experience.message}</Text><Text style={[ui.text, en && styles.ltr]}>{match.education.message}</Text>
      {requirements.experience ? <Text selectable style={[ui.note, en && styles.ltr]}>{t('نص شرط الخبرة:', 'Experience requirement:')} {requirements.experience.evidence}</Text> : null}
      {requirements.education ? <Text selectable style={[ui.note, en && styles.ltr]}>{t('نص شرط المؤهل:', 'Education requirement:')} {requirements.education.evidence}</Text> : null}
      {requirements.skills.filter(item => item.priority !== 'mentioned').map(item => <View key={item.key} style={{ gap: 4 }}>
        <Text style={[ui.text, en && styles.ltr]}>{item.name} · {item.priority === 'required' ? t('مطلوبة', 'Required') : t('مفضلة', 'Preferred')}</Text><Text selectable style={[ui.note, en && styles.ltr]}>{item.evidence}</Text>
      </View>)}
      {requirements.unparsed.length ? <><Text style={[ui.heading, en && styles.ltr]}>{t('شروط إضافية تحتاج مراجعتك', 'Additional requirements to review')}</Text>{requirements.unparsed.map((line, index) => <Text key={index} style={[ui.note, en && styles.ltr]}>{line}</Text>)}</> : null}
      {match.preferredMatched.length ? <Text style={[ui.note, en && styles.ltr]}>{t('مفضّل وموثق:', 'Preferred and documented:')} {match.preferredMatched.map(item => item.name).join(en ? ', ' : '، ')}.</Text> : null}
      {match.preferredMissing.length ? <Text style={[ui.note, en && styles.ltr]}>{t('مفضّل غير موثق:', 'Preferred, not documented:')} {match.preferredMissing.map(item => item.name).join(en ? ', ' : '، ')}.</Text> : null}
      <Text selectable style={[ui.text, { textAlign: 'left', writingDirection: 'auto' }]}>{job.description}</Text>
    </> : null}
    <Text style={[ui.note, en && styles.ltr]}>{t('تاريخ النشر:', 'Posted:')} {job.postedAt ? new Date(job.postedAt).toLocaleDateString(en ? 'en-US' : 'ar-SA', { calendar: 'gregory' }) : t('غير متوفر', 'Unavailable')} · {job.source}</Text>
    {job.attribution ? <Pressable accessibilityRole="link" onPress={() => onOpen(job.attribution!.url)}><Text style={ui.link}>{job.attribution.text}</Text></Pressable> : null}
    <Pressable accessibilityRole="button" disabled={busy} accessibilityState={{ disabled: busy }} style={ui.outline} onPress={onChoose}><Text style={ui.outlineText}>{selected ? t('عرض وتحديث خطة هذه الوظيفة', 'View and update this job plan') : t('استهدف الوظيفة وابنِ خطة للفجوات', 'Set as target and build a gap plan')}</Text></Pressable>
    <Pressable accessibilityRole="link" style={ui.button} onPress={() => onOpen(job.applyUrl)}><Text style={ui.buttonText}>{t('فتح الإعلان والتقديم لدى المصدر', 'Open listing and apply at source')}</Text></Pressable>
  </View>;
}

const styles = createAdaptiveStyles(() => ({ ltr: { textAlign: 'left', writingDirection: 'ltr' } }));
