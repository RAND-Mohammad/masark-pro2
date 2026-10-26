import { Pressable, Text, View } from 'react-native';
import { ui, colors } from '../constants/design';
import type { JobMatch } from '../utils/job-matching';

export function JobMatchCard({ match, expanded, selected, busy, onExpand, onChoose, onOpen }: {
  match: JobMatch; expanded: boolean; selected: boolean; busy: boolean; onExpand: () => void; onChoose: () => void; onOpen: (url: string) => void;
}) {
  const { job, requirements } = match;
  const status = { closer: 'أقرب بحسب المتطلبات المستخرجة', gaps: 'تحتاج تطوير مهارات', review: 'شروط تحتاج مراجعة', insufficient: 'بيانات غير كافية لحساب التوافق' }[match.status];
  return <View style={ui.card}>
    <Text style={ui.heading}>{job.title}</Text><Text style={ui.text}>{job.employer} · {job.locations.join('، ')}</Text>
    <Text style={[ui.heading, { color: colors.primary }]}>{match.score === null ? 'التوافق غير محسوب' : `${match.score}% توافق مع الإعلان`}</Text>
    <Text style={ui.note}>{status}{selected ? ' · وظيفتك المستهدفة' : ''}</Text>
    <Text style={ui.note}>النسبة تقيس المتطلبات التي استخرجناها، وليست احتمال قبول أو ضمان توظيف.</Text>
    {match.reasons.length ? <Text style={ui.text}>{match.reasons.join('\n')}</Text> : <Text style={ui.text}>أكمل بياناتك واعتمد مهارات السيرة حتى نوضح سبب الترشيح.</Text>}
    {match.blockers.map(message => <Text key={message} style={[ui.text, { color: colors.error }]}>{message}</Text>)}
    <Text style={ui.text}>{match.missing.length ? `المهارات المطلوبة غير الموثقة: ${match.missing.map(item => item.name + (item.alternatives.length ? ` أو ${item.alternatives.join(' أو ')}` : '')).join('، ')}` : match.matched.length ? 'المهارات المطلوبة المستخرجة موثقة في ملفك.' : 'لم نستخرج قائمة مهارات مطلوبة كافية؛ راجع وصف الإعلان.'}</Text>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={onExpand}><Text style={ui.link}>{expanded ? 'إخفاء التفاصيل' : 'ليش ترشحت لي؟ عرض الشروط والأدلة'}</Text></Pressable>
    {expanded ? <>
      <Text style={ui.note}>أوزان المقارنة: المهارات المطلوبة 60، الخبرة 25، المؤهل 15. نعيد توزيع الأوزان على الشروط الموجودة فقط؛ الشروط المفضلة لا تخصم من النسبة. نقص شرط أساسي يمنع اعتبار الوظيفة أقرب ترشيح.</Text>
      <Text style={ui.text}>{match.experience.message}</Text><Text style={ui.text}>{match.education.message}</Text>
      {requirements.experience ? <Text selectable style={ui.note}>نص شرط الخبرة: {requirements.experience.evidence}</Text> : null}
      {requirements.education ? <Text selectable style={ui.note}>نص شرط المؤهل: {requirements.education.evidence}</Text> : null}
      {requirements.skills.filter(item => item.priority !== 'mentioned').map(item => <View key={item.key} style={{ gap: 4 }}>
        <Text style={ui.text}>{item.name} · {item.priority === 'required' ? 'مطلوبة' : 'مفضلة'}</Text><Text selectable style={ui.note}>{item.evidence}</Text>
      </View>)}
      {requirements.unparsed.length ? <><Text style={ui.heading}>شروط إضافية تحتاج مراجعتك</Text>{requirements.unparsed.map((line, index) => <Text key={index} style={ui.note}>{line}</Text>)}</> : null}
      {match.preferredMatched.length ? <Text style={ui.note}>مفضّل وموثق: {match.preferredMatched.map(item => item.name).join('، ')}.</Text> : null}
      {match.preferredMissing.length ? <Text style={ui.note}>مفضّل غير موثق: {match.preferredMissing.map(item => item.name).join('، ')}.</Text> : null}
      <Text selectable style={[ui.text, { textAlign: 'left', writingDirection: 'auto' }]}>{job.description}</Text>
    </> : null}
    <Text style={ui.note}>تاريخ النشر: {job.postedAt ? new Date(job.postedAt).toLocaleDateString('ar-SA', { calendar: 'gregory' }) : 'غير متوفر'} · {job.source}</Text>
    {job.attribution ? <Pressable accessibilityRole="link" onPress={() => onOpen(job.attribution!.url)}><Text style={ui.link}>{job.attribution.text}</Text></Pressable> : null}
    <Pressable accessibilityRole="button" disabled={busy} accessibilityState={{ disabled: busy }} style={ui.outline} onPress={onChoose}><Text style={ui.outlineText}>{selected ? 'عرض وتحديث خطة هذه الوظيفة' : 'استهدف الوظيفة وابنِ خطة للفجوات'}</Text></Pressable>
    <Pressable accessibilityRole="link" style={ui.button} onPress={() => onOpen(job.applyUrl)}><Text style={ui.buttonText}>فتح الإعلان والتقديم لدى المصدر</Text></Pressable>
  </View>;
}
