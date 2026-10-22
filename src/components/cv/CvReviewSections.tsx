import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { addCvReviewItem, CV_SECTIONS, moveCvReviewItem, updateCvReviewItem } from '../../utils/cv-review';
import type { CvAnalysis } from '../../utils/skill-profile';
import type { CvReview } from '../../utils/saved-cv.types';
import type { ReviewSection } from '../../utils/cv-review';
import { describeExperienceDuration } from '../../utils/cv-duration.mjs';
import dataset from '../../masarak_dataset.json';

type Field = { key: string; label: string; multiline?: boolean; hint?: string };
type Props = {
  review: CvReview;
  onChange: (review: CvReview) => void;
  busy: boolean;
  analyzedAt?: string;
  onSkillNote: (id: string | null) => string;
};

const sectionLabels: Record<ReviewSection, string> = {
  skills: 'المهارات',
  projects: 'المشاريع',
  courses: 'الدورات',
  certificates: 'الشهادات',
  education: 'التعليم',
  experiences: 'الخبرات',
  activities: 'الأنشطة والتطوع',
  unclassified: 'معلومات تحتاج إلى تصنيف',
};

const sectionFields: Record<ReviewSection, Field[]> = {
  skills: [{ key: 'name', label: 'اسم المهارة' }, { key: 'evidence', label: 'النص الدليل من السيرة', multiline: true }],
  projects: [
    { key: 'name', label: 'اسم المشروع' },
    { key: 'description', label: 'وصف المشروع', multiline: true },
    { key: 'role', label: 'الدور في المشروع' },
    { key: 'technologies', label: 'التقنيات المذكورة', hint: 'افصل بينها بفاصلة' },
    { key: 'category', label: 'التصنيف التقني' },
    { key: 'category_basis', label: 'أساس التصنيف' },
    { key: 'category_evidence', label: 'دليل التصنيف' },
    { key: 'evidence', label: 'النص الدليل من السيرة', multiline: true },
  ],
  courses: [
    { key: 'name', label: 'اسم الدورة' },
    { key: 'issuer', label: 'الجهة أو المنصة' },
    { key: 'date', label: 'تاريخ الدورة' },
    { key: 'evidence', label: 'النص الدليل من السيرة', multiline: true },
  ],
  certificates: [
    { key: 'name', label: 'اسم الشهادة' },
    { key: 'issuer', label: 'الجهة المانحة' },
    { key: 'date', label: 'تاريخ الشهادة' },
    { key: 'evidence', label: 'النص الدليل من السيرة', multiline: true },
  ],
  education: [
    { key: 'name', label: 'المؤهل أو الدرجة' },
    { key: 'organization', label: 'الجامعة أو المؤسسة' },
    { key: 'college', label: 'الكلية' },
    { key: 'major', label: 'التخصص' },
    { key: 'dates', label: 'تواريخ الدراسة' },
    { key: 'study_status', label: 'حالة الدراسة أو التخرج المتوقع' },
    { key: 'description', label: 'تفاصيل إضافية', multiline: true },
    { key: 'evidence', label: 'النص الدليل من السيرة', multiline: true },
  ],
  experiences: [
    { key: 'role', label: 'المسمى الوظيفي أو التدريبي' },
    { key: 'organization', label: 'جهة العمل أو التدريب' },
    { key: 'location', label: 'المكان' },
    { key: 'dates', label: 'تواريخ الخبرة' },
    { key: 'description', label: 'المهام والمسؤوليات', multiline: true },
    { key: 'evidence', label: 'النص الدليل من السيرة', multiline: true },
  ],
  activities: [
    { key: 'name', label: 'النشاط أو الدور' },
    { key: 'organization', label: 'الجهة أو النادي' },
    { key: 'dates', label: 'الفترة' },
    { key: 'description', label: 'وصف المشاركة', multiline: true },
    { key: 'evidence', label: 'النص الدليل من السيرة', multiline: true },
  ],
  unclassified: [
    { key: 'name', label: 'اسم المعلومة' },
    { key: 'organization', label: 'الجهة' },
    { key: 'dates', label: 'التاريخ أو الفترة' },
    { key: 'description', label: 'تفاصيل المعلومة', multiline: true },
    { key: 'evidence', label: 'النص الدليل من السيرة', multiline: true },
  ],
};

const fieldValue = (value: unknown) => Array.isArray(value) ? value.join('، ') : typeof value === 'string' ? value : '';

function sectionStatusText(status?: string, empty = false) {
  if (status === 'not_found') return 'لم يظهر نص واضح لهذا القسم في الملف؛ هذا لا يعني عدم وجود هذه المعلومات لديك.';
  if (status === 'uncertain') return 'وجدنا نصًا غير محسوم أو تصنيفه غير واضح. راجعه وانقله إلى القسم المناسب.';
  if (status === 'legacy' || !status) return 'هذه نتيجة أقدم لا تحتوي حالة استخراج لكل قسم؛ قد تحتاج إلى إعادة التحليل.';
  if (empty) return 'لم تظهر عناصر قابلة للمراجعة هنا. قد لا يكون القسم موجودًا في الملف أو ربما لم نتمكن من استخراجه.';
  return 'راجع النصوص والأدلة؛ العناصر المستخرجة لا تُعتمد إلا باختيارك.';
}

export default function CvReviewSections({ review, onChange, busy, analyzedAt, onSkillNote }: Props) {
  function add(section: ReviewSection) {
    const added = addCvReviewItem(review, section);
    const nextIndex = (added[section] ?? []).at(-1);
    if (nextIndex !== undefined) {
      const rows = added.analysis[section] ?? [];
      const markedRows = rows.map((item, index) => index === nextIndex ? { ...item, source: 'user_supplied' } : item);
      added.analysis = { ...added.analysis, [section]: markedRows } as CvAnalysis;
    }
    onChange(added);
  }

  function toggle(section: ReviewSection, index: number) {
    const selected = review[section] ?? [];
    onChange({ ...review, [section]: selected.includes(index) ? selected.filter(item => item !== index) : [...selected, index] });
  }

  function renderSection(section: ReviewSection) {
    const rows = review.analysis[section] ?? [];
    const selected = review[section] ?? [];
    const status = review.analysis.section_status?.[section];
    const noRows = rows.length === 0;
    const emptyMessage = section === 'unclassified'
      ? 'لا توجد معلومات تنتظر التصنيف حاليًا.'
      : sectionStatusText(status, noRows);
    return <View key={section} style={[styles.section, section === 'unclassified' && styles.unclassifiedSection]}>
      <View style={styles.sectionTitleRow}>
        <View style={styles.sectionTitleCopy}>
          <Text style={styles.sectionTitle}>{sectionLabels[section]}</Text>
          <Text style={styles.sectionStatus}>{section === 'unclassified' ? 'منطقة مراجعة — لا تُحتسب ضمن الدورات أو الشهادات' : sectionStatusText(status)}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={`إضافة إلى ${sectionLabels[section]}`} disabled={busy} onPress={() => add(section)} style={styles.addButton}>
          <Text style={styles.addButtonText}>+ إضافة</Text>
        </Pressable>
      </View>
      {noRows ? <View style={styles.emptyState}><Text style={styles.emptyText}>{emptyMessage}</Text></View> : null}
      {rows.map((row, index) => {
        const entry = row as unknown as Record<string, unknown>;
        const isUserSupplied = entry.source === 'user_supplied';
        const skillId = typeof entry.mapped_skill_id === 'string' ? entry.mapped_skill_id : null;
        const missingFields = Array.isArray(entry.needs_review) ? sectionFields[section].filter(field =>
          (entry.needs_review as string[]).includes(field.key) && !fieldValue(entry[field.key]).trim()) : [];
        const duration = section === 'experiences' && typeof entry.dates === 'string'
          ? describeExperienceDuration(entry.dates, analyzedAt)
          : '';
        return <View key={`${section}-${index}`} style={[styles.entry, !selected.includes(index) && styles.excludedEntry]}>
          <View style={styles.entryTop}>
            <View style={styles.provenance}>
              <View style={[styles.provenanceDot, isUserSupplied && styles.userDot]} />
              <Text style={[styles.provenanceText, isUserSupplied && styles.userText]}>{isUserSupplied ? 'أُضيفت يدويًا · ليست مستخرجة' : entry.source === 'user_corrected' ? 'صححها المستخدم · راجع الدليل الأصلي' : 'مستخرجة من الملف'}</Text>
            </View>
            {section === 'unclassified' ? <Text style={styles.toggleText}>بانتظار التصنيف</Text> : <Pressable accessibilityRole="checkbox" accessibilityLabel={`${selected.includes(index) ? 'استبعاد' : 'اعتماد'} ${section === 'experiences' ? entry.role : entry.name}`} accessibilityState={{ checked: selected.includes(index), disabled: busy }} disabled={busy} onPress={() => toggle(section, index)} style={styles.reviewToggle}>
              <View style={[styles.checkbox, selected.includes(index) && styles.checked]}>
                <Text style={styles.checkMark}>{selected.includes(index) ? '✓' : ''}</Text>
              </View>
              <Text style={styles.toggleText}>{selected.includes(index) ? 'معتمدة' : 'مستبعدة'}</Text>
            </Pressable>}
          </View>
          {entry.retained_from_previous === true ? <Text style={styles.sectionStatus}>احتُفظ بهذا البند من مراجعتك السابقة، وليس استخراجًا جديدًا؛ راجع تفاصيله قبل الاعتماد.</Text> : null}
          {missingFields.length > 0 ? <Text style={styles.sectionStatus}>يحتاج مراجعة: {missingFields.map(field => field.label).join('، ')}. تُركت المعلومات غير المؤكدة فارغة بدل التخمين.</Text> : null}
          {section === 'projects' && typeof entry.category === 'string' ? <View style={styles.categoryTag}>
            <Text style={styles.categoryTagText}>تصنيف {entry.category_basis === 'inferred' ? 'مستنتج' : entry.category_basis === 'explicit' ? 'مذكور بالنص' : entry.category_basis === 'user' ? 'صححه المستخدم' : 'غير محدد — يحتاج مراجعة'}</Text>
          </View> : null}
          {sectionFields[section].map(field => <View key={field.key} style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>{field.label}</Text>
            <TextInput
              accessibilityLabel={field.label}
              placeholder={field.hint ?? field.label}
              placeholderTextColor="#84958D"
              style={[styles.input, field.multiline && styles.multiline]}
              multiline={field.multiline}
              editable={!busy}
              value={fieldValue(entry[field.key])}
              onChangeText={value => onChange(updateCvReviewItem(review, section, index, field.key, value))}
              textAlignVertical={field.multiline ? 'top' : 'center'}
            />
            {field.key !== 'evidence' && entry.field_evidence && typeof entry.field_evidence === 'object' && typeof (entry.field_evidence as Record<string, unknown>)[field.key] === 'string'
              ? <Text style={styles.sectionStatus}>المصدر الأصلي لهذا الحقل: «{(entry.field_evidence as Record<string, string>)[field.key]}»{entry.field_pages && typeof entry.field_pages === 'object' && Array.isArray((entry.field_pages as Record<string, number[]>)[field.key]) ? ` — ص ${(entry.field_pages as Record<string, number[]>)[field.key].join('، ')}` : ''}</Text> : null}
          </View>)}
          {section === 'experiences' && duration ? <View style={styles.durationBox}><Text style={styles.durationLabel}>مدة الخبرة</Text><Text style={styles.durationText}>{duration}</Text></View> : null}
          {section === 'skills' ? <View style={styles.skillMapping}>
            <Text style={styles.skillMappingText}>{skillId ? `ربط مقترح: ${dataset.skills.find(skill => skill.skill_id === skillId)?.name ?? skillId}` : 'لا يوجد ربط موثوق في القاموس؛ تبقى المهارة للمراجعة.'}</Text>
            <Text style={styles.skillMappingNote}>{onSkillNote(skillId)}</Text>
          </View> : null}
          <View style={styles.moveBlock}>
            <Text style={styles.moveHeading}>{section === 'unclassified' ? 'صنّف هذه المعلومة' : 'نقل المعلومة إلى قسم آخر'}</Text>
            <View style={styles.moveOptions}>
              {CV_SECTIONS.filter(target => target !== section).map(target => <Pressable
                key={target}
                accessibilityRole="button"
                accessibilityLabel={`نقل ${section === 'experiences' ? entry.role : entry.name} إلى ${sectionLabels[target]}`}
                disabled={busy}
                onPress={() => onChange(moveCvReviewItem(review, section, index, target))}
                style={styles.moveButton}
              ><Text style={styles.moveButtonText}>{sectionLabels[target]}</Text></Pressable>)}
            </View>
            {section !== 'unclassified' ? <Pressable accessibilityRole="button" disabled={busy} onPress={() => onChange(moveCvReviewItem(review, section, index, 'unclassified'))} style={styles.holdButton}>
              <Text style={styles.holdButtonText}>إلى المعلومات التي تحتاج تصنيفًا</Text>
            </Pressable> : null}
          </View>
        </View>;
      })}
    </View>;
  }

  const optionalSections: ReviewSection[] = [];
  if (review.analysis.activities !== undefined || (review.activities?.length ?? 0) > 0) optionalSections.push('activities');
  optionalSections.push('unclassified');

  return <View style={styles.container}>
    {CV_SECTIONS.map(section => renderSection(section))}
    {optionalSections.map(section => renderSection(section))}
  </View>;
}

const styles = StyleSheet.create({
  container: { gap: 14 },
  section: { backgroundColor: '#FFFEFA', borderWidth: 1, borderColor: '#DEE7DD', borderRadius: 18, overflow: 'hidden' },
  unclassifiedSection: { borderColor: '#E5C99A', backgroundColor: '#FFFCF5' },
  sectionTitleRow: { flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 10, padding: 15, borderBottomWidth: 1, borderBottomColor: '#E9EEE7' },
  sectionTitleCopy: { flex: 1, gap: 5 },
  sectionTitle: { color: '#1C4641', fontSize: 18, fontWeight: '800', textAlign: 'right' },
  sectionStatus: { color: '#72847B', fontSize: 12, lineHeight: 20, textAlign: 'right' },
  addButton: { borderRadius: 10, backgroundColor: '#E5F0E7', paddingHorizontal: 10, paddingVertical: 8 },
  addButtonText: { color: '#176B62', fontSize: 13, fontWeight: '800' },
  emptyState: { margin: 13, padding: 12, backgroundColor: '#F5F7F2', borderRadius: 11 },
  emptyText: { color: '#65786F', fontSize: 13, lineHeight: 21, textAlign: 'right' },
  entry: { margin: 12, padding: 13, borderRadius: 14, backgroundColor: '#F8F9F5', borderWidth: 1, borderColor: '#E6EBE3', gap: 12 },
  excludedEntry: { opacity: 0.72, backgroundColor: '#F1F2EE' },
  entryTop: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  provenance: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, flexShrink: 1 },
  provenanceDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#4F8872' },
  userDot: { backgroundColor: '#B68043' },
  provenanceText: { color: '#4C7969', fontSize: 11, fontWeight: '700', textAlign: 'right' },
  userText: { color: '#8E6435' },
  reviewToggle: { flexDirection: 'row-reverse', gap: 6, alignItems: 'center', paddingVertical: 4 },
  checkbox: { width: 21, height: 21, borderRadius: 6, borderWidth: 1.5, borderColor: '#9EB1A6', alignItems: 'center', justifyContent: 'center' },
  checked: { backgroundColor: '#176B62', borderColor: '#176B62' },
  checkMark: { color: '#FFFDF7', fontSize: 13, fontWeight: '800' },
  toggleText: { color: '#315F55', fontSize: 12, fontWeight: '700' },
  fieldBlock: { gap: 5 },
  fieldLabel: { color: '#587068', fontSize: 12, fontWeight: '700', textAlign: 'right' },
  input: { minHeight: 44, color: '#23423C', borderWidth: 1, borderColor: '#DCE5DA', borderRadius: 10, paddingHorizontal: 11, paddingVertical: 9, fontSize: 14, lineHeight: 21, textAlign: 'right', backgroundColor: '#FFFEFB' },
  multiline: { minHeight: 76, paddingTop: 10 },
  categoryTag: { alignSelf: 'flex-end', backgroundColor: '#F3EBDC', borderRadius: 9, paddingHorizontal: 9, paddingVertical: 5 },
  categoryTagText: { color: '#805D31', fontSize: 11, fontWeight: '700' },
  durationBox: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#EAF1E9', borderRadius: 10, padding: 10 },
  durationLabel: { color: '#526E64', fontSize: 12, fontWeight: '700' },
  durationText: { color: '#176B62', fontSize: 13, fontWeight: '800' },
  skillMapping: { backgroundColor: '#EEF3ED', borderRadius: 10, padding: 10, gap: 5 },
  skillMappingText: { color: '#416459', fontSize: 12, textAlign: 'right' },
  skillMappingNote: { color: '#708078', fontSize: 11, lineHeight: 18, textAlign: 'right' },
  moveBlock: { borderTopWidth: 1, borderTopColor: '#E2E8E0', paddingTop: 11, gap: 8 },
  moveHeading: { color: '#60746B', fontSize: 12, fontWeight: '700', textAlign: 'right' },
  moveOptions: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6 },
  moveButton: { borderWidth: 1, borderColor: '#D9E4D9', backgroundColor: '#FFFEFA', borderRadius: 9, paddingVertical: 7, paddingHorizontal: 9 },
  moveButtonText: { color: '#26665B', fontSize: 11, fontWeight: '700' },
  holdButton: { alignSelf: 'flex-start', paddingVertical: 4 },
  holdButtonText: { color: '#8C6436', fontSize: 12, fontWeight: '700', textAlign: 'right' },
});
