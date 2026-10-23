import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { addCvReviewItem, CV_SECTIONS, moveCvReviewItem, updateCvReviewItem } from '../../utils/cv-review';
import { experienceDuration } from '../../utils/cv-duration.mjs';
import type { CvAnalysis } from '../../utils/skill-profile';
import type { CvReview } from '../../utils/saved-cv.types';
import type { ReviewSection } from '../../utils/cv-review';
import { MasarakIcon, type IconName } from '../masarak-icon';

type Field = { key: string; label: string; multiline?: boolean; hint?: string };
type Props = {
  review: CvReview;
  onChange: (review: CvReview) => void;
  busy: boolean;
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

const sectionSubtitles: Record<ReviewSection, string> = {
  skills: 'مهاراتك التقنية والشخصية',
  projects: 'أعمال نفذتها والتقنيات المستخدمة',
  courses: 'الدورات والبرامج التدريبية',
  certificates: 'الشهادات المهنية والأكاديمية',
  education: 'المؤهلات والبيانات الأكاديمية',
  experiences: 'العمل والتدريب العملي',
  activities: 'التطوع والأنشطة',
  unclassified: 'معلومات تحتاج إلى مراجعة وتصنيف',
};

const sectionIcons: Record<ReviewSection, IconName> = {
  skills: 'skills', projects: 'projects', courses: 'course', certificates: 'certificate',
  education: 'education', experiences: 'experience', activities: 'activity', unclassified: 'profile',
};

const sectionFields: Record<ReviewSection, Field[]> = {
  skills: [{ key: 'name', label: 'المهارة' }],
  projects: [
    { key: 'name', label: 'اسم المشروع' },
    { key: 'organization', label: 'الجهة أو المؤسسة' },
    { key: 'dates', label: 'تاريخ أو فترة المشروع' },
    { key: 'duration', label: 'مدة المشروع', hint: 'مثال: 3 أشهر أو فصل دراسي' },
    { key: 'description', label: 'وصف المشروع', multiline: true },
    { key: 'technologies', label: 'التقنيات المستخدمة', hint: 'مثال: Python، Flask، SQL' },
  ],
  courses: [
    { key: 'name', label: 'اسم الدورة' },
    { key: 'issuer', label: 'الجهة أو المنصة' },
    { key: 'date', label: 'تاريخ الدورة' },
    { key: 'duration', label: 'مدة الدورة', hint: 'مثال: 6 أسابيع أو 20 ساعة' },
  ],
  certificates: [
    { key: 'name', label: 'اسم الشهادة' },
    { key: 'issuer', label: 'الجهة المانحة' },
    { key: 'date', label: 'تاريخ الشهادة' },
  ],
  education: [
    { key: 'name', label: 'المؤهل أو الدرجة' },
    { key: 'organization', label: 'الجامعة أو المؤسسة' },
    { key: 'college', label: 'الكلية' },
    { key: 'major', label: 'التخصص' },
    { key: 'dates', label: 'تواريخ الدراسة' },
    { key: 'study_status', label: 'حالة الدراسة', hint: 'مثال: ما زلت أدرس أو متخرج' },
    { key: 'gpa', label: 'المعدل التراكمي GPA', hint: 'مثال: 4.5 من 5 أو 3.8/4' },
  ],
  experiences: [
    { key: 'role', label: 'المسمى الوظيفي أو التدريبي' },
    { key: 'organization', label: 'جهة العمل أو التدريب' },
    { key: 'dates', label: 'تواريخ الخبرة' },
    { key: 'description', label: 'المهام والمسؤوليات', multiline: true },
  ],
  activities: [
    { key: 'name', label: 'النشاط أو الدور' },
    { key: 'organization', label: 'الجهة أو النادي' },
    { key: 'dates', label: 'الفترة' },
    { key: 'description', label: 'وصف المشاركة', multiline: true },
  ],
  unclassified: [
    { key: 'name', label: 'اسم المعلومة' },
    { key: 'organization', label: 'الجهة' },
    { key: 'dates', label: 'التاريخ أو الفترة' },
    { key: 'description', label: 'تفاصيل المعلومة', multiline: true },
  ],
};

const fieldValue = (value: unknown) => Array.isArray(value) ? value.join('، ') : typeof value === 'string' ? value : '';

function sectionStatusText(status?: string, empty = false) {
  if (status === 'not_found') return 'لا توجد بيانات في السيرة.';
  if (status === 'uncertain') return 'تحتاج مراجعة.';
  if (status === 'legacy' || !status) return 'أعيدي التحليل لتحديث النتائج.';
  if (empty) return 'لا توجد عناصر.';
  return 'راجعي البيانات قبل اعتمادها.';
}

function formatDuration(dates: string, analyzedAt?: string) {
  const duration = experienceDuration(dates, analyzedAt);
  if (!duration) return '';
  const years = duration.years > 0 ? `${duration.years} ${duration.years === 1 ? 'سنة' : 'سنوات'}` : '';
  const months = duration.remainderMonths > 0 ? `${duration.remainderMonths} ${duration.remainderMonths === 1 ? 'شهر' : 'أشهر'}` : '';
  const value = [years, months].filter(Boolean).join(' و') || 'أقل من شهر';
  return `المدة: ${value}${duration.approximate ? ' تقريبًا' : ''}${duration.ongoing ? ' · مستمرة' : ''}`;
}

export default function CvReviewSections({ review, onChange, busy }: Props) {
  const [openMove, setOpenMove] = useState<string | null>(null);
  const [openSection, setOpenSection] = useState<ReviewSection | null>(() =>
    review.analysis.education?.length ? 'education' : CV_SECTIONS.find(section => (review.analysis[section] ?? []).length > 0) ?? null,
  );
  const [openEntries, setOpenEntries] = useState<Record<string, boolean>>({});
  function add(section: ReviewSection) {
    const added = addCvReviewItem(review, section);
    const nextIndex = (added[section] ?? []).at(-1);
    if (nextIndex !== undefined) {
      const rows = added.analysis[section] ?? [];
      const markedRows = rows.map((item, index) => index === nextIndex ? { ...item, source: 'user_supplied' } : item);
      added.analysis = { ...added.analysis, [section]: markedRows } as CvAnalysis;
      setOpenSection(section);
      if (section !== 'skills') setOpenEntries(previous => ({ ...previous, [`${section}-${nextIndex}`]: true }));
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
    const expanded = openSection === section;
    const emptyMessage = section === 'unclassified'
      ? 'لا توجد معلومات تنتظر التصنيف حاليًا.'
      : sectionStatusText(status, noRows);
    const firstRow = rows[0] as unknown as Record<string, unknown> | undefined;
    const firstName = firstRow ? fieldValue(section === 'experiences' ? firstRow.role : firstRow.name) : '';
    const firstSummary = firstRow ? [fieldValue(firstRow.organization), fieldValue(firstRow.major), fieldValue(firstRow.dates),
      fieldValue(firstRow.description), Array.isArray(firstRow.technologies) ? firstRow.technologies.join('، ') : ''].filter(Boolean).join(' · ') : '';
    const sectionSummary = section === 'skills' && rows.length
      ? `${rows.length} مهارة · ${selected.length} معتمدة`
      : firstName ? [firstName, firstSummary].filter(Boolean).join(' · ') : noRows ? emptyMessage : '';
    const sectionStatus = noRows ? section === 'unclassified' ? 'لا عناصر تنتظر التصنيف' : 'لا توجد بيانات مستخرجة' : `${selected.length} من ${rows.length} معتمدة`;
    const progress = rows.length ? Math.round(selected.length / rows.length * 100) : 0;
    return <View key={section} style={[styles.section, section === 'unclassified' && styles.unclassifiedSection]}>
      <View style={styles.sectionTitleRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${sectionLabels[section]}، ${sectionSummary.slice(0, 120)}، ${sectionStatus}، ${expanded ? 'إخفاء التفاصيل' : 'عرض التفاصيل'}`}
          accessibilityState={{ expanded }}
          onPress={() => setOpenSection(current => current === section ? null : section)}
          style={({ pressed }) => [styles.sectionTitleCopy, pressed && styles.pressed]}
        >
          <View style={styles.sectionHeadingLine}>
            <View style={styles.sectionIcon}><MasarakIcon name={sectionIcons[section]} size={21} /></View>
            <View style={styles.sectionHeadingCopy}>
              <Text style={styles.sectionTitle}>{sectionLabels[section]}</Text>
              <Text style={styles.sectionSubtitle}>{sectionSubtitles[section]}</Text>
            </View>
            <Text style={styles.chevron}>{expanded ? '⌃' : '⌄'}</Text>
          </View>
          <View style={styles.progressRow}>
            <Text style={styles.sectionStatus} numberOfLines={1}>{section === 'unclassified' ? `${rows.length} بانتظار التصنيف` : sectionStatus}</Text>
            <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progress}%` }]} /></View>
            <Text style={styles.progressPercent}>{progress}%</Text>
          </View>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`إضافة إلى ${sectionLabels[section]}`} disabled={busy} onPress={() => add(section)} style={styles.addButton}>
          <Text style={styles.addButtonText}>+ إضافة</Text>
        </Pressable>
      </View>
      {expanded ? <>
      {noRows ? <View style={styles.emptyState}><Text style={styles.emptyText}>{emptyMessage}</Text></View> : null}
      {section === 'skills' ? <View style={styles.skillsCloud}>
        {rows.map((row, index) => {
          const entry = row as unknown as Record<string, unknown>;
          const name = fieldValue(entry.name);
          const approved = selected.includes(index);
          const chipWidth = Math.max(42, Math.min(180, [...name].length * 8 + 12));
          return <View key={`${section}-${index}`} style={[styles.skillChip, approved ? styles.approvedSkillChip : styles.excludedSkillChip]}>
            <TextInput
              accessibilityLabel="المهارة"
              placeholder="المهارة"
              placeholderTextColor="#84958D"
              editable={!busy}
              value={name}
              onChangeText={value => onChange(updateCvReviewItem(review, section, index, 'name', value))}
              style={[styles.skillChipInput, { width: chipWidth }]}
              textAlign="center"
            />
            <Pressable accessibilityRole="checkbox" accessibilityLabel={`${approved ? 'استبعاد' : 'اعتماد'} ${name}`} accessibilityState={{ checked: approved, disabled: busy }} hitSlop={10} disabled={busy} onPress={() => toggle(section, index)} style={[styles.skillCheck, approved && styles.skillCheckApproved]}>
              <Text style={[styles.skillCheckText, approved && styles.skillCheckTextApproved]}>{approved ? '✓' : '+'}</Text>
            </Pressable>
          </View>;
        })}
      </View> : rows.map((row, index) => {
        const entry = row as unknown as Record<string, unknown>;
        const rowKey = `${section}-${index}`;
        const needsReview = Array.isArray(entry.needs_review) && sectionFields[section].some(field =>
          (entry.needs_review as string[]).includes(field.key) && !fieldValue(entry[field.key]).trim());
        const displayName = section === 'experiences' ? entry.role : entry.name;
        const duration = section === 'experiences' && typeof entry.dates === 'string'
          ? formatDuration(entry.dates, review.analysis.analyzed_at)
          : '';
        const organization = fieldValue(section === 'courses' || section === 'certificates' ? entry.issuer : entry.organization);
        const date = fieldValue(section === 'courses' || section === 'certificates' ? entry.date : entry.dates);
        const explicitDuration = fieldValue(entry.duration);
        const dateRangeDuration = (section === 'projects' || section === 'courses') && date
          ? formatDuration(date, review.analysis.analyzed_at).replace(/^المدة:\s*/u, '')
          : '';
        const shownDuration = explicitDuration || dateRangeDuration;
        const description = fieldValue(entry.description);
        const technologies = Array.isArray(entry.technologies) ? entry.technologies.map(fieldValue).filter(Boolean) : [];
        const previewMeta = section === 'education'
          ? [fieldValue(entry.major) && `التخصص: ${fieldValue(entry.major)}`, date && `الدراسة: ${date}`, `الحالة: ${fieldValue(entry.study_status) || 'غير محددة'}`, fieldValue(entry.gpa) && `GPA: ${fieldValue(entry.gpa)}`]
          : section === 'projects' || section === 'courses'
            ? [date && `التاريخ: ${date}`, shownDuration && `المدة: ${shownDuration}`]
            : section === 'experiences'
              ? [date && `الفترة: ${date}`, duration]
              : section === 'certificates'
                ? [date && `التاريخ: ${date}`]
                : [organization, date];
        const entryExpanded = Boolean(openEntries[rowKey]);
        return <View key={rowKey} style={[styles.entry, !selected.includes(index) && styles.excludedEntry]}>
          <View style={styles.entryTop}>
            <View style={styles.entryCopy}>
              <Text style={styles.entryName}>{fieldValue(displayName) || `معلومة ${index + 1}`}</Text>
              {organization ? <Text style={styles.entryOrganization} numberOfLines={1}>{organization}</Text> : null}
            </View>
            {section === 'unclassified' ? <Text style={styles.toggleText}>بانتظار التصنيف</Text> : <Pressable accessibilityRole="checkbox" accessibilityLabel={`${selected.includes(index) ? 'استبعاد' : 'اعتماد'} ${section === 'experiences' ? entry.role : entry.name}`} accessibilityState={{ checked: selected.includes(index), disabled: busy }} hitSlop={10} disabled={busy} onPress={() => toggle(section, index)} style={styles.reviewToggle}>
              <View style={[styles.checkbox, selected.includes(index) && styles.checked]}>
                <Text style={styles.checkMark}>{selected.includes(index) ? '✓' : ''}</Text>
              </View>
              <Text style={styles.toggleText}>{selected.includes(index) ? 'معتمدة' : 'مستبعدة'}</Text>
            </Pressable>}
          </View>
          {section === 'projects' ? <Text style={[styles.previewDescription, !description && styles.missingPreview]} numberOfLines={3}>{description || 'أضف وصف المشروع'}</Text> : null}
          {section === 'experiences' && description ? <Text style={styles.previewDescription} numberOfLines={2}>{description}</Text> : null}
          {section === 'education' && previewMeta.some(Boolean) ? <View style={styles.previewMeta}><Text style={styles.entrySummary}>{previewMeta.filter(Boolean).join(' · ')}</Text></View> : null}
          {section === 'projects' && previewMeta.some(Boolean) ? <View style={styles.previewMeta}><Text style={styles.entrySummary}>{previewMeta.filter(Boolean).join(' · ')}</Text></View> : null}
          {section === 'courses' && previewMeta.some(Boolean) ? <View style={styles.previewMeta}><Text style={styles.entrySummary}>{previewMeta.filter(Boolean).join(' · ')}</Text></View> : null}
          {section === 'certificates' && previewMeta.some(Boolean) ? <View style={styles.previewMeta}><Text style={styles.entrySummary}>{previewMeta.filter(Boolean).join(' · ')}</Text></View> : null}
          {section === 'experiences' && previewMeta.some(Boolean) ? <View style={styles.previewMeta}><Text style={styles.entrySummary}>{previewMeta.filter(Boolean).join(' · ')}</Text></View> : null}
          {section !== 'projects' && section !== 'experiences' && section !== 'education' && section !== 'courses' && section !== 'certificates' && (description || previewMeta.some(Boolean))
            ? <Text style={styles.entrySummary}>{[...previewMeta, description].filter(Boolean).join(' · ')}</Text> : null}
          {section === 'projects' ? technologies.length ? <View style={styles.technologyList}>{technologies.map((technology, technologyIndex) => <View key={`${rowKey}-technology-${technologyIndex}`} style={styles.technologyChip}><Text style={styles.technologyText}>{technology}</Text></View>)}</View> : <Text style={[styles.entrySummary, styles.missingPreview]}>أضف التقنيات المستخدمة</Text> : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${entryExpanded ? 'إخفاء' : 'عرض'} التفاصيل والتعديل: ${fieldValue(displayName)}`}
            accessibilityState={{ expanded: entryExpanded }}
            disabled={busy}
            onPress={() => setOpenEntries(previous => ({ ...previous, [rowKey]: !previous[rowKey] }))}
            style={styles.entryDetailsButton}
          ><Text style={styles.entryDetailsText}>{entryExpanded ? 'إخفاء التفاصيل' : 'تعديل المعلومات'}</Text></Pressable>
          {entryExpanded ? <>
          {needsReview ? <Text style={styles.reviewHint}>تحتاج مراجعة</Text> : null}
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
            {section === 'experiences' && field.key === 'dates' && duration ? <Text style={styles.durationText}>{duration}</Text> : null}
          </View>)}
          <View style={styles.moveBlock}>
            {section !== 'unclassified' ? <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: openMove === rowKey }}
              accessibilityLabel={`تغيير قسم ${displayName ?? ''}`}
              disabled={busy}
              onPress={() => setOpenMove(current => current === rowKey ? null : rowKey)}
              style={styles.changeSectionButton}
            ><Text style={styles.changeSectionText}>{openMove === rowKey ? 'إخفاء الأقسام' : 'تغيير القسم'}</Text></Pressable> : <Text style={styles.moveHeading}>اختاري القسم المناسب</Text>}
            {(section === 'unclassified' || openMove === rowKey) ? <View style={styles.moveOptions}>
              {CV_SECTIONS.filter(target => target !== section).map(target => <Pressable
                key={target}
                accessibilityRole="button"
                accessibilityLabel={`نقل ${displayName ?? ''} إلى ${sectionLabels[target]}`}
                disabled={busy}
                onPress={() => { onChange(moveCvReviewItem(review, section, index, target)); setOpenMove(null); }}
                style={styles.moveButton}
              ><Text style={styles.moveButtonText}>{sectionLabels[target]}</Text></Pressable>)}
            </View> : null}
          </View>
          </> : null}
        </View>;
      })}
      </> : null}
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
  section: { backgroundColor: '#F8F9F6', borderWidth: 1, borderColor: '#DEE7DD', borderRadius: 18, overflow: 'hidden' },
  unclassifiedSection: { borderColor: '#E5C99A', backgroundColor: '#FFFCF5' },
  sectionTitleRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, padding: 15, borderBottomWidth: 1, borderBottomColor: '#E9EEE7' },
  sectionTitleCopy: { flex: 1, gap: 8, minHeight: 62, justifyContent: 'center' },
  sectionHeadingLine: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10 },
  sectionIcon: { width: 38, height: 38, borderRadius: 13, backgroundColor: '#E7EEF9', alignItems: 'center', justifyContent: 'center' },
  sectionHeadingCopy: { flex: 1, gap: 1 },
  sectionTitle: { color: '#1C4641', fontSize: 18, fontWeight: '800', textAlign: 'right' },
  sectionSubtitle: { color: '#72847B', fontSize: 12, lineHeight: 18, textAlign: 'right' },
  progressRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  sectionStatus: { color: '#587068', fontSize: 11, lineHeight: 16, textAlign: 'right' },
  progressTrack: { flex: 1, height: 5, borderRadius: 4, backgroundColor: '#E3E8E1', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4, backgroundColor: '#3883D8' },
  progressPercent: { minWidth: 31, color: '#587068', fontSize: 10, fontWeight: '700', textAlign: 'left' },
  chevron: { color: '#587068', fontSize: 21, lineHeight: 24 },
  addButton: { borderRadius: 10, backgroundColor: '#E5F0E7', minHeight: 44, minWidth: 74, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10, paddingVertical: 7 },
  addButtonText: { color: '#176B62', fontSize: 13, fontWeight: '800' },
  emptyState: { margin: 13, padding: 12, backgroundColor: '#F5F7F2', borderRadius: 11 },
  emptyText: { color: '#65786F', fontSize: 13, lineHeight: 21, textAlign: 'right' },
  entry: { margin: 12, padding: 13, borderRadius: 16, backgroundColor: '#FFFEFC', borderWidth: 1, borderColor: '#E6EBE3', gap: 10 },
  excludedEntry: { opacity: 0.72, backgroundColor: '#F1F2EE' },
  entryTop: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  entryCopy: { flex: 1, gap: 4 },
  entryName: { color: '#254740', fontSize: 15, lineHeight: 22, fontWeight: '700', textAlign: 'right' },
  entryOrganization: { color: '#72847B', fontSize: 13, lineHeight: 20, textAlign: 'right' },
  entrySummary: { color: '#6A7D75', fontSize: 12, lineHeight: 19, textAlign: 'right' },
  previewDescription: { color: '#405A53', fontSize: 13, lineHeight: 20, textAlign: 'right' },
  missingPreview: { color: '#9A7040' },
  previewMeta: { borderTopWidth: 1, borderTopColor: '#E8ECE7', paddingTop: 8 },
  technologyList: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 7, justifyContent: 'flex-start' },
  technologyChip: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 18, backgroundColor: '#EEECE3', borderWidth: 1, borderColor: '#E2DFD1' },
  technologyText: { color: '#40564F', fontSize: 12, fontWeight: '700' },
  entryDetailsButton: { alignSelf: 'stretch', minHeight: 42, borderWidth: 1, borderColor: '#D9E3DA', borderRadius: 22, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  entryDetailsText: { color: '#176B62', fontSize: 13, fontWeight: '700', textAlign: 'center' },
  reviewToggle: { flexDirection: 'row-reverse', gap: 6, alignItems: 'center', paddingVertical: 4 },
  checkbox: { width: 21, height: 21, borderRadius: 6, borderWidth: 1.5, borderColor: '#9EB1A6', alignItems: 'center', justifyContent: 'center' },
  checked: { backgroundColor: '#176B62', borderColor: '#176B62' },
  checkMark: { color: '#FFFDF7', fontSize: 13, fontWeight: '800' },
  toggleText: { color: '#315F55', fontSize: 12, fontWeight: '700' },
  skillsCloud: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 9, paddingHorizontal: 13, paddingTop: 13, paddingBottom: 2 },
  skillChip: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 42, paddingLeft: 10, paddingRight: 6, borderRadius: 22, borderWidth: 1 },
  approvedSkillChip: { backgroundColor: '#EEECE3', borderColor: '#E0DDCF' },
  excludedSkillChip: { backgroundColor: '#F5F4EF', borderColor: '#E8E5DA', opacity: 0.68 },
  skillChipInput: { minWidth: 42, maxWidth: 180, minHeight: 30, padding: 0, color: '#354941', fontSize: 14, fontWeight: '700' },
  skillCheck: { width: 23, height: 23, borderRadius: 12, borderWidth: 1, borderColor: '#AAB8AC', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFEFA' },
  skillCheckApproved: { backgroundColor: '#176B62', borderColor: '#176B62' },
  skillCheckText: { color: '#176B62', fontSize: 14, fontWeight: '800', lineHeight: 18 },
  skillCheckTextApproved: { color: '#FFFDF7' },
  durationText: { color: '#176B62', fontSize: 12, fontWeight: '700', textAlign: 'right' },
  fieldBlock: { gap: 5 },
  fieldLabel: { color: '#587068', fontSize: 12, fontWeight: '700', textAlign: 'right' },
  input: { minHeight: 44, color: '#23423C', borderWidth: 1, borderColor: '#DCE5DA', borderRadius: 10, paddingHorizontal: 11, paddingVertical: 9, fontSize: 14, lineHeight: 21, textAlign: 'right', backgroundColor: '#FFFEFB' },
  multiline: { minHeight: 76, paddingTop: 10 },
  reviewHint: { color: '#92683C', fontSize: 11, fontWeight: '700', textAlign: 'right' },
  moveBlock: { borderTopWidth: 1, borderTopColor: '#E2E8E0', paddingTop: 8, gap: 8 },
  moveHeading: { color: '#60746B', fontSize: 12, fontWeight: '700', textAlign: 'right' },
  changeSectionButton: { alignSelf: 'flex-start', paddingVertical: 3, paddingHorizontal: 2 },
  changeSectionText: { color: '#58786D', fontSize: 12, fontWeight: '700' },
  moveOptions: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6 },
  moveButton: { borderWidth: 1, borderColor: '#D9E4D9', backgroundColor: '#FFFEFA', borderRadius: 9, paddingVertical: 7, paddingHorizontal: 9 },
  moveButtonText: { color: '#26665B', fontSize: 11, fontWeight: '700' },
  pressed: { opacity: 0.68 },
});
