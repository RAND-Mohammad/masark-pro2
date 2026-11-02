import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { colors, createAdaptiveStyles } from '../../constants/design';
import { addCvReviewItem, CV_SECTIONS, moveCvReviewItem, updateCvReviewItem } from '../../utils/cv-review';
import { experienceDuration } from '../../utils/cv-duration.mjs';
import type { CvAnalysis } from '../../utils/skill-profile';
import type { CvReview } from '../../utils/saved-cv.types';
import type { ReviewSection } from '../../utils/cv-review';
import { MasarakIcon, type IconName } from '../masarak-icon';
import { useAppPreferences } from '../../contexts/app-preferences-context';

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

const sectionLabelsEn: Record<ReviewSection, string> = {
  skills: 'Skills', projects: 'Projects', courses: 'Courses', certificates: 'Certificates',
  education: 'Education', experiences: 'Experience', activities: 'Activities & volunteering',
  unclassified: 'Needs classification',
};
const sectionSubtitlesEn: Record<ReviewSection, string> = {
  skills: 'Technical and personal skills', projects: 'Work you completed and tools used',
  courses: 'Courses and training programs', certificates: 'Professional and academic certificates',
  education: 'Qualifications and academic details', experiences: 'Work and practical training',
  activities: 'Volunteering and activities', unclassified: 'Information to review and classify',
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

const sectionFieldsEn: Record<ReviewSection, Record<string, Field>> = {
  skills: { name: { key: 'name', label: 'Skill' } },
  projects: {
    name: { key: 'name', label: 'Project name' }, organization: { key: 'organization', label: 'Organization' },
    dates: { key: 'dates', label: 'Project dates' }, duration: { key: 'duration', label: 'Project duration', hint: 'For example, 3 months or one semester' },
    description: { key: 'description', label: 'Project description', multiline: true }, technologies: { key: 'technologies', label: 'Technologies used', hint: 'For example: Python, Flask, SQL' },
  },
  courses: {
    name: { key: 'name', label: 'Course name' }, issuer: { key: 'issuer', label: 'Provider or platform' },
    date: { key: 'date', label: 'Course date' }, duration: { key: 'duration', label: 'Course duration', hint: 'For example, 6 weeks or 20 hours' },
  },
  certificates: { name: { key: 'name', label: 'Certificate name' }, issuer: { key: 'issuer', label: 'Issuing organization' }, date: { key: 'date', label: 'Certificate date' } },
  education: {
    name: { key: 'name', label: 'Qualification or degree' }, organization: { key: 'organization', label: 'University or institution' },
    college: { key: 'college', label: 'College' }, major: { key: 'major', label: 'Major' }, dates: { key: 'dates', label: 'Study dates' },
    study_status: { key: 'study_status', label: 'Study status', hint: 'For example, currently studying or graduated' },
    gpa: { key: 'gpa', label: 'GPA', hint: 'For example, 4.5 out of 5 or 3.8/4' },
  },
  experiences: {
    role: { key: 'role', label: 'Job or training title' }, organization: { key: 'organization', label: 'Employer or training provider' },
    dates: { key: 'dates', label: 'Experience dates' }, description: { key: 'description', label: 'Responsibilities', multiline: true },
  },
  activities: {
    name: { key: 'name', label: 'Activity or role' }, organization: { key: 'organization', label: 'Organization or club' },
    dates: { key: 'dates', label: 'Dates' }, description: { key: 'description', label: 'Activity details', multiline: true },
  },
  unclassified: {
    name: { key: 'name', label: 'Information name' }, organization: { key: 'organization', label: 'Organization' },
    dates: { key: 'dates', label: 'Date or period' }, description: { key: 'description', label: 'Details', multiline: true },
  },
};

const fieldValue = (value: unknown) => Array.isArray(value) ? value.join('، ') : typeof value === 'string' ? value : '';

function sectionStatusText(status?: string, empty = false, en = false) {
  if (status === 'not_found') return en ? 'No information found in the CV.' : 'لا توجد بيانات في السيرة.';
  if (status === 'uncertain') return en ? 'Needs review.' : 'تحتاج مراجعة.';
  if (status === 'legacy' || !status) return en ? 'Analyze again to refresh these results.' : 'أعيدي التحليل لتحديث النتائج.';
  if (empty) return en ? 'No items.' : 'لا توجد عناصر.';
  return en ? 'Review the information before approving it.' : 'راجعي البيانات قبل اعتمادها.';
}

function formatDuration(dates: string, analyzedAt?: string, en = false) {
  const duration = experienceDuration(dates, analyzedAt);
  if (!duration) return '';
  const years = duration.years > 0 ? `${duration.years} ${en ? duration.years === 1 ? 'year' : 'years' : duration.years === 1 ? 'سنة' : 'سنوات'}` : '';
  const months = duration.remainderMonths > 0 ? `${duration.remainderMonths} ${en ? duration.remainderMonths === 1 ? 'month' : 'months' : duration.remainderMonths === 1 ? 'شهر' : 'أشهر'}` : '';
  const value = [years, months].filter(Boolean).join(en ? ' and ' : ' و') || (en ? 'Less than a month' : 'أقل من شهر');
  return `${en ? 'Duration: ' : 'المدة: '}${value}${duration.approximate ? en ? ' approximately' : ' تقريبًا' : ''}${duration.ongoing ? en ? ' · ongoing' : ' · مستمرة' : ''}`;
}

export default function CvReviewSections({ review, onChange, busy }: Props) {
  const { language } = useAppPreferences();
  const en = language === 'en';
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
      ? en ? 'There is no information waiting for classification.' : 'لا توجد معلومات تنتظر التصنيف حاليًا.'
      : sectionStatusText(status, noRows, en);
    const sectionLabel = en ? sectionLabelsEn[section] : sectionLabels[section];
    const firstRow = rows[0] as unknown as Record<string, unknown> | undefined;
    const firstName = firstRow ? fieldValue(section === 'experiences' ? firstRow.role : firstRow.name) : '';
    const firstSummary = firstRow ? [fieldValue(firstRow.organization), fieldValue(firstRow.major), fieldValue(firstRow.dates),
      fieldValue(firstRow.description), Array.isArray(firstRow.technologies) ? firstRow.technologies.join('، ') : ''].filter(Boolean).join(' · ') : '';
    const sectionSummary = section === 'skills' && rows.length
      ? en ? `${rows.length} skills · ${selected.length} approved` : `${rows.length} مهارة · ${selected.length} معتمدة`
      : firstName ? [firstName, firstSummary].filter(Boolean).join(' · ') : noRows ? emptyMessage : '';
    const sectionStatus = noRows ? section === 'unclassified' ? en ? 'Nothing to classify' : 'لا عناصر تنتظر التصنيف' : en ? 'No information extracted' : 'لا توجد بيانات مستخرجة' : en ? `${selected.length} of ${rows.length} approved` : `${selected.length} من ${rows.length} معتمدة`;
    const fields = sectionFields[section].map(field => en ? sectionFieldsEn[section][field.key] ?? field : field);
    const progress = rows.length ? Math.round(selected.length / rows.length * 100) : 0;
    return <View key={section} style={[styles.section, section === 'unclassified' && styles.unclassifiedSection]}>
      <View style={[styles.sectionTitleRow, en && styles.rowLtr]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={en ? `${sectionLabel}. ${sectionSummary.slice(0, 120)}. ${sectionStatus}. ${expanded ? 'Hide details' : 'Show details'}` : `${sectionLabel}، ${sectionSummary.slice(0, 120)}، ${sectionStatus}، ${expanded ? 'إخفاء التفاصيل' : 'عرض التفاصيل'}`}
          accessibilityState={{ expanded }}
          onPress={() => setOpenSection(current => current === section ? null : section)}
          style={({ pressed }) => [styles.sectionTitleCopy, pressed && styles.pressed]}
        >
          <View style={[styles.sectionHeadingLine, en && styles.rowLtr]}>
            <View style={styles.sectionIcon}><MasarakIcon name={sectionIcons[section]} size={21} /></View>
            <View style={styles.sectionHeadingCopy}>
              <Text style={[styles.sectionTitle, en && styles.ltr]}>{sectionLabel}</Text>
              <Text style={[styles.sectionSubtitle, en && styles.ltr]}>{en ? sectionSubtitlesEn[section] : sectionSubtitles[section]}</Text>
            </View>
            <Text style={styles.chevron}>{expanded ? '⌃' : '⌄'}</Text>
          </View>
          <View style={[styles.progressRow, en && styles.rowLtr]}>
            <Text style={[styles.sectionStatus, en && styles.ltr]} numberOfLines={1}>{section === 'unclassified' ? en ? `${rows.length} waiting to classify` : `${rows.length} بانتظار التصنيف` : sectionStatus}</Text>
            <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progress}%` }]} /></View>
            <Text style={styles.progressPercent}>{progress}%</Text>
          </View>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={en ? `Add to ${sectionLabel}` : `إضافة إلى ${sectionLabel}`} disabled={busy} onPress={() => add(section)} style={styles.addButton}>
          <Text style={styles.addButtonText}>{en ? '+ Add' : '+ إضافة'}</Text>
        </Pressable>
      </View>
      {expanded ? <>
      {noRows ? <View style={styles.emptyState}><Text style={styles.emptyText}>{emptyMessage}</Text></View> : null}
      {section === 'skills' ? <View style={[styles.skillsCloud, en && styles.skillsCloudLtr]}>
        {rows.map((row, index) => {
          const entry = row as unknown as Record<string, unknown>;
          const name = fieldValue(entry.name);
          const approved = selected.includes(index);
          const chipWidth = Math.max(42, Math.min(180, [...name].length * 8 + 12));
          return <View key={`${section}-${index}`} style={[styles.skillChip, approved ? styles.approvedSkillChip : styles.excludedSkillChip]}>
            <TextInput
              accessibilityLabel={en ? 'Skill' : 'المهارة'}
              placeholder={en ? 'Skill' : 'المهارة'}
              placeholderTextColor={colors.muted}
              editable={!busy}
              value={name}
              onChangeText={value => onChange(updateCvReviewItem(review, section, index, 'name', value))}
              style={[styles.skillChipInput, { width: chipWidth }]}
              textAlign="center"
            />
            <Pressable accessibilityRole="checkbox" accessibilityLabel={`${approved ? en ? 'Remove' : 'استبعاد' : en ? 'Approve' : 'اعتماد'} ${name}`} accessibilityState={{ checked: approved, disabled: busy }} hitSlop={10} disabled={busy} onPress={() => toggle(section, index)} style={[styles.skillCheck, approved && styles.skillCheckApproved]}>
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
          ? formatDuration(entry.dates, review.analysis.analyzed_at, en)
          : '';
        const organization = fieldValue(section === 'courses' || section === 'certificates' ? entry.issuer : entry.organization);
        const date = fieldValue(section === 'courses' || section === 'certificates' ? entry.date : entry.dates);
        const explicitDuration = fieldValue(entry.duration);
        const dateRangeDuration = (section === 'projects' || section === 'courses') && date
          ? formatDuration(date, review.analysis.analyzed_at, en).replace(en ? /^Duration:\s*/u : /^المدة:\s*/u, '')
          : '';
        const shownDuration = explicitDuration || dateRangeDuration;
        const description = fieldValue(entry.description);
        const technologies = Array.isArray(entry.technologies) ? entry.technologies.map(fieldValue).filter(Boolean) : [];
        const previewMeta = section === 'education'
          ? [fieldValue(entry.major) && `${en ? 'Major' : 'التخصص'}: ${fieldValue(entry.major)}`, date && `${en ? 'Study dates' : 'الدراسة'}: ${date}`, `${en ? 'Status' : 'الحالة'}: ${fieldValue(entry.study_status) || (en ? 'Not specified' : 'غير محددة')}`, fieldValue(entry.gpa) && `GPA: ${fieldValue(entry.gpa)}`]
          : section === 'projects' || section === 'courses'
            ? [date && `${en ? 'Date' : 'التاريخ'}: ${date}`, shownDuration && `${en ? 'Duration' : 'المدة'}: ${shownDuration}`]
            : section === 'experiences'
              ? [date && `${en ? 'Period' : 'الفترة'}: ${date}`, duration]
              : section === 'certificates'
                ? [date && `${en ? 'Date' : 'التاريخ'}: ${date}`]
                : [organization, date];
        const entryExpanded = Boolean(openEntries[rowKey]);
        return <View key={rowKey} style={[styles.entry, !selected.includes(index) && styles.excludedEntry]}>
          <View style={[styles.entryTop, en && styles.rowLtr]}>
            <View style={styles.entryCopy}>
              <Text style={[styles.entryName, en && styles.ltr]}>{fieldValue(displayName) || (en ? `Item ${index + 1}` : `معلومة ${index + 1}`)}</Text>
              {organization ? <Text style={[styles.entryOrganization, en && styles.ltr]} numberOfLines={1}>{organization}</Text> : null}
            </View>
            {section === 'unclassified' ? <Text style={[styles.toggleText, en && styles.ltr]}>{en ? 'Waiting to classify' : 'بانتظار التصنيف'}</Text> : <Pressable accessibilityRole="checkbox" accessibilityLabel={`${selected.includes(index) ? en ? 'Remove' : 'استبعاد' : en ? 'Approve' : 'اعتماد'} ${section === 'experiences' ? entry.role : entry.name}`} accessibilityState={{ checked: selected.includes(index), disabled: busy }} hitSlop={10} disabled={busy} onPress={() => toggle(section, index)} style={[styles.reviewToggle, en && styles.rowLtr]}>
              <View style={[styles.checkbox, selected.includes(index) && styles.checked]}>
                <Text style={styles.checkMark}>{selected.includes(index) ? '✓' : ''}</Text>
              </View>
              <Text style={[styles.toggleText, en && styles.ltr]}>{selected.includes(index) ? en ? 'Approved' : 'معتمدة' : en ? 'Excluded' : 'مستبعدة'}</Text>
            </Pressable>}
          </View>
          {entry.source === 'user_supplied' ? <Text style={[styles.manualNotice, en && styles.ltr]}>{en ? 'Added manually · not extracted from the CV' : 'مضافة يدويًا · ليست مستخرجة من السيرة'}</Text> : null}
          {section === 'projects' ? <Text style={[styles.previewDescription, en && styles.ltr, !description && styles.missingPreview]} numberOfLines={3}>{description || (en ? 'Add a project description' : 'أضف وصف المشروع')}</Text> : null}
          {section === 'experiences' && description ? <Text style={[styles.previewDescription, en && styles.ltr]} numberOfLines={2}>{description}</Text> : null}
          {section === 'education' && previewMeta.some(Boolean) ? <View style={styles.previewMeta}><Text style={[styles.entrySummary, en && styles.ltr]}>{previewMeta.filter(Boolean).join(' · ')}</Text></View> : null}
          {section === 'projects' && previewMeta.some(Boolean) ? <View style={styles.previewMeta}><Text style={[styles.entrySummary, en && styles.ltr]}>{previewMeta.filter(Boolean).join(' · ')}</Text></View> : null}
          {section === 'courses' && previewMeta.some(Boolean) ? <View style={styles.previewMeta}><Text style={[styles.entrySummary, en && styles.ltr]}>{previewMeta.filter(Boolean).join(' · ')}</Text></View> : null}
          {section === 'certificates' && previewMeta.some(Boolean) ? <View style={styles.previewMeta}><Text style={[styles.entrySummary, en && styles.ltr]}>{previewMeta.filter(Boolean).join(' · ')}</Text></View> : null}
          {section === 'experiences' && previewMeta.some(Boolean) ? <View style={styles.previewMeta}><Text style={[styles.entrySummary, en && styles.ltr]}>{previewMeta.filter(Boolean).join(' · ')}</Text></View> : null}
          {section !== 'projects' && section !== 'experiences' && section !== 'education' && section !== 'courses' && section !== 'certificates' && (description || previewMeta.some(Boolean))
            ? <Text style={[styles.entrySummary, en && styles.ltr]}>{[...previewMeta, description].filter(Boolean).join(' · ')}</Text> : null}
          {section === 'projects' ? technologies.length ? <View style={[styles.technologyList, en && styles.technologyListLtr]}>{technologies.map((technology, technologyIndex) => <View key={`${rowKey}-technology-${technologyIndex}`} style={styles.technologyChip}><Text style={[styles.technologyText, en && styles.ltr]}>{technology}</Text></View>)}</View> : <Text style={[styles.entrySummary, en && styles.ltr, styles.missingPreview]}>{en ? 'Add technologies used' : 'أضف التقنيات المستخدمة'}</Text> : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={en ? `${entryExpanded ? 'Hide' : 'Show'} details and edit: ${fieldValue(displayName)}` : `${entryExpanded ? 'إخفاء' : 'عرض'} التفاصيل والتعديل: ${fieldValue(displayName)}`}
            accessibilityState={{ expanded: entryExpanded }}
            disabled={busy}
            onPress={() => setOpenEntries(previous => ({ ...previous, [rowKey]: !previous[rowKey] }))}
            style={styles.entryDetailsButton}
          ><Text style={styles.entryDetailsText}>{entryExpanded ? en ? 'Hide details' : 'إخفاء التفاصيل' : en ? 'Edit information' : 'تعديل المعلومات'}</Text></Pressable>
          {entryExpanded ? <>
          {needsReview ? <Text style={[styles.reviewHint, en && styles.ltr]}>{en ? 'Needs review' : 'تحتاج مراجعة'}</Text> : null}
          {fields.map(field => {
            const evidenceMap = entry.field_evidence && typeof entry.field_evidence === 'object'
              ? entry.field_evidence as Record<string, unknown> : null;
            const quote = evidenceMap?.[field.key];
            return <View key={field.key} style={styles.fieldBlock}>
              <Text style={[styles.fieldLabel, en && styles.ltr]}>{field.label}</Text>
              {typeof quote === 'string' && quote.trim() ? <Text selectable style={[styles.sourceEvidence, en && styles.ltr]}>
                {en ? 'Original source for this field:' : 'المصدر الأصلي لهذا الحقل:'} {quote}
              </Text> : null}
              <TextInput
                accessibilityLabel={field.label}
                placeholder={field.hint ?? field.label}
                placeholderTextColor={colors.muted}
                style={[styles.input, en && styles.ltr, field.multiline && styles.multiline]}
                multiline={field.multiline}
                editable={!busy}
                value={fieldValue(entry[field.key])}
                onChangeText={value => onChange(updateCvReviewItem(review, section, index, field.key, value))}
                textAlignVertical={field.multiline ? 'top' : 'center'}
              />
              {section === 'experiences' && field.key === 'dates' && duration ? <Text style={[styles.durationText, en && styles.ltr]}>{duration}</Text> : null}
            </View>;
          })}
          <View style={styles.moveBlock}>
            {section !== 'unclassified' ? <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: openMove === rowKey }}
              accessibilityLabel={en ? `Change section for ${displayName ?? ''}` : `تغيير قسم ${displayName ?? ''}`}
              disabled={busy}
              onPress={() => setOpenMove(current => current === rowKey ? null : rowKey)}
              style={styles.changeSectionButton}
            ><Text style={styles.changeSectionText}>{openMove === rowKey ? en ? 'Hide sections' : 'إخفاء الأقسام' : en ? 'Change section' : 'تغيير القسم'}</Text></Pressable> : <Text style={[styles.moveHeading, en && styles.ltr]}>{en ? 'Choose the right section' : 'اختاري القسم المناسب'}</Text>}
            {(section === 'unclassified' || openMove === rowKey) ? <View style={styles.moveOptions}>
              {CV_SECTIONS.filter(target => target !== section).map(target => <Pressable
                key={target}
                accessibilityRole="button"
                accessibilityLabel={en ? `Move ${displayName ?? ''} to ${sectionLabelsEn[target]}` : `نقل ${displayName ?? ''} إلى ${sectionLabels[target]}`}
                disabled={busy}
                onPress={() => { onChange(moveCvReviewItem(review, section, index, target)); setOpenMove(null); }}
                style={styles.moveButton}
              ><Text style={[styles.moveButtonText, en && styles.ltr]}>{en ? sectionLabelsEn[target] : sectionLabels[target]}</Text></Pressable>)}
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

const styles = createAdaptiveStyles(() => ({
  ltr: { textAlign: 'left', writingDirection: 'ltr' },
  rowLtr: { flexDirection: 'row' },
  container: { gap: 14 },
  section: { backgroundColor: colors.soft, borderWidth: 1, borderColor: colors.border, borderRadius: 18, overflow: 'hidden' },
  unclassifiedSection: { borderColor: colors.warningBorder, backgroundColor: colors.warningSurface },
  sectionTitleRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, padding: 15, borderBottomWidth: 1, borderBottomColor: colors.border },
  sectionTitleCopy: { flex: 1, gap: 8, minHeight: 62, justifyContent: 'center' },
  sectionHeadingLine: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10 },
  sectionIcon: { width: 38, height: 38, borderRadius: 13, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  sectionHeadingCopy: { flex: 1, gap: 1 },
  sectionTitle: { color: colors.ink, fontSize: 18, fontWeight: '800', textAlign: 'right' },
  sectionSubtitle: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: 'right' },
  progressRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  sectionStatus: { color: colors.muted, fontSize: 11, lineHeight: 16, textAlign: 'right' },
  progressTrack: { flex: 1, height: 5, borderRadius: 4, backgroundColor: colors.track, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4, backgroundColor: colors.primary },
  progressPercent: { minWidth: 31, color: colors.muted, fontSize: 10, fontWeight: '700', textAlign: 'left' },
  chevron: { color: colors.muted, fontSize: 21, lineHeight: 24 },
  addButton: { borderRadius: 10, backgroundColor: colors.successSurface, minHeight: 44, minWidth: 74, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10, paddingVertical: 7 },
  addButtonText: { color: colors.primary, fontSize: 13, fontWeight: '800' },
  emptyState: { margin: 13, padding: 12, backgroundColor: colors.soft, borderRadius: 11 },
  emptyText: { color: colors.muted, fontSize: 13, lineHeight: 21, textAlign: 'right' },
  entry: { margin: 12, padding: 13, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 10 },
  excludedEntry: { opacity: 0.72, backgroundColor: colors.soft },
  entryTop: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  entryCopy: { flex: 1, gap: 4 },
  entryName: { color: colors.ink, fontSize: 15, lineHeight: 22, fontWeight: '700', textAlign: 'right' },
  entryOrganization: { color: colors.muted, fontSize: 13, lineHeight: 20, textAlign: 'right' },
  entrySummary: { color: colors.muted, fontSize: 12, lineHeight: 19, textAlign: 'right' },
  previewDescription: { color: colors.ink, fontSize: 13, lineHeight: 20, textAlign: 'right' },
  manualNotice: { color: colors.gold, fontSize: 11, lineHeight: 17, fontWeight: '700', textAlign: 'right' },
  missingPreview: { color: colors.gold },
  previewMeta: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8 },
  technologyList: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 7, justifyContent: 'flex-start' },
  technologyChip: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 18, backgroundColor: colors.soft, borderWidth: 1, borderColor: colors.border },
  technologyText: { color: colors.ink, fontSize: 12, fontWeight: '700' },
  entryDetailsButton: { alignSelf: 'stretch', minHeight: 42, borderWidth: 1, borderColor: colors.border, borderRadius: 22, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  entryDetailsText: { color: colors.primary, fontSize: 13, fontWeight: '700', textAlign: 'center' },
  reviewToggle: { flexDirection: 'row-reverse', gap: 6, alignItems: 'center', paddingVertical: 4 },
  checkbox: { width: 21, height: 21, borderRadius: 6, borderWidth: 1.5, borderColor: colors.muted, alignItems: 'center', justifyContent: 'center' },
  checked: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkMark: { color: colors.onPrimary, fontSize: 13, fontWeight: '800' },
  toggleText: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  skillsCloud: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 9, paddingHorizontal: 13, paddingTop: 13, paddingBottom: 2 },
  skillsCloudLtr: { justifyContent: 'flex-start' },
  technologyListLtr: { flexDirection: 'row', justifyContent: 'flex-start' },
  skillChip: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 42, paddingLeft: 10, paddingRight: 6, borderRadius: 22, borderWidth: 1 },
  approvedSkillChip: { backgroundColor: colors.soft, borderColor: colors.border },
  excludedSkillChip: { backgroundColor: colors.soft, borderColor: colors.border, opacity: 0.68 },
  skillChipInput: { minWidth: 42, maxWidth: 180, minHeight: 30, padding: 0, color: colors.ink, fontSize: 14, fontWeight: '700' },
  skillCheck: { width: 23, height: 23, borderRadius: 12, borderWidth: 1, borderColor: colors.muted, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  skillCheckApproved: { backgroundColor: colors.primary, borderColor: colors.primary },
  skillCheckText: { color: colors.primary, fontSize: 14, fontWeight: '800', lineHeight: 18 },
  skillCheckTextApproved: { color: colors.onPrimary },
  durationText: { color: colors.primary, fontSize: 12, fontWeight: '700', textAlign: 'right' },
  fieldBlock: { gap: 5 },
  fieldLabel: { color: colors.muted, fontSize: 12, fontWeight: '700', textAlign: 'right' },
  sourceEvidence: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: 'right', borderRightWidth: 2, borderRightColor: colors.border, paddingRight: 9 },
  input: { minHeight: 44, color: colors.ink, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 11, paddingVertical: 9, fontSize: 14, lineHeight: 21, textAlign: 'right', backgroundColor: colors.surface },
  multiline: { minHeight: 76, paddingTop: 10 },
  reviewHint: { color: colors.gold, fontSize: 11, fontWeight: '700', textAlign: 'right' },
  moveBlock: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8, gap: 8 },
  moveHeading: { color: colors.muted, fontSize: 12, fontWeight: '700', textAlign: 'right' },
  changeSectionButton: { alignSelf: 'flex-start', paddingVertical: 3, paddingHorizontal: 2 },
  changeSectionText: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  moveOptions: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6 },
  moveButton: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 9, paddingVertical: 7, paddingHorizontal: 9 },
  moveButtonText: { color: colors.primary, fontSize: 11, fontWeight: '700' },
  pressed: { opacity: 0.68 },
}));
