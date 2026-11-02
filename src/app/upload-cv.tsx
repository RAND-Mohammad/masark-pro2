import { colors, createAdaptiveStyles } from '../constants/design';
import { useCallback, useEffect, useRef, useState } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, Text, View, type TextProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CV_MIME_TYPES, formatCvSize } from '../utils/cv-file';
import { getValidatedCvFile } from '../utils/cv-upload-file';
import { analyzeCv } from '../utils/cv-api';
import { readSkillProfile, saveReviewedCv, clearReviewedCv, type CvProfile } from '../utils/skill-profile';
import { captureDataScope } from '../utils/scoped-storage';
import { loadSavedCv, storeCvFile, storeCvReview, deleteSavedCv } from '../utils/saved-cv';
import { approvedCvAnalysis, createCvReview, cvReviewCounts, normalizeCvReview } from '../utils/cv-review';
import type { CvReview } from '../utils/saved-cv.types';
import type { CvSection, ReviewSection } from '../utils/cv-review';
import CvReviewSections from '../components/cv/CvReviewSections';
import { needsCvReanalysis } from '../utils/cv-parser-version.mjs';
import { createReanalysisReview, restoreCvReview } from '../utils/cv-reanalysis';
import { DisclosureCard } from '../components/disclosure-card';
import { useAppPreferences } from '../contexts/app-preferences-context';

function compactAnalysisWarning(warning: string, en: boolean) {
  if (warning.includes('استُبعدت معلومات')) return en ? 'Some details had insufficient evidence and were excluded. Review the results.' : 'استُبعدت معلومات بلا دليل واضح في السيرة. راجعي النتائج.';
  if (warning.includes('ربط بعض التواريخ')) return en ? 'Some dates were left blank because their relationship was unclear. Review them.' : 'تُركت بعض التواريخ فارغة لعدم وضوح ارتباطها. راجعيها.';
  if (warning.includes('إشارات لمشاريع أو أنشطة')) return en ? 'Some project or activity references could not be verified. Review both sections, even if they look empty.' : 'تعذّر التحقق من بعض المشاريع أو الأنشطة. راجعي القسمين حتى لو ظهرا فارغين.';
  if (warning.includes('احتُفظ بالبنود المصححة')) return en ? 'Your previous edits and exclusions were kept. Review possible duplicates before approving.' : 'احتفظنا بتعديلاتك واستبعاداتك السابقة. قد يظهر بند مكرر؛ راجعيه قبل الاعتماد.';
  return warning;
}

const sectionNames: Record<CvSection, string> = {
  skills: 'المهارات',
  projects: 'المشاريع',
  courses: 'الدورات',
  certificates: 'الشهادات',
  education: 'التعليم',
  experiences: 'الخبرات',
};

function LocalizedCopy({ ar, english, en, style, ...props }: TextProps & { ar: string; english: string; en: boolean }) {
  return <Text {...props} style={[style, en && styles.ltr]}>{en ? english : ar}</Text>;
}

export default function UploadCvScreen() {
  const router = useRouter();
  const { language } = useAppPreferences(); const en = language === 'en';
  const t = useCallback((ar: string, english: string) => en ? english : ar, [en]);
  const names: Record<CvSection, string> = en ? { skills: 'Skills', projects: 'Projects', courses: 'Courses', certificates: 'Certifications', education: 'Education', experiences: 'Experience' } : sectionNames;
  const [file, setFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [consent, setConsent] = useState(false);
  const [ready, setReady] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmReanalysis, setConfirmReanalysis] = useState(false);
  const [history, setHistory] = useState<'draft' | 'approved' | null>(null);
  const [review, setReview] = useState<CvReview | null>(null);
  const [savedCv, setSavedCv] = useState<CvProfile | null>(null);
  const locked = useRef(false);
  const active = useRef(true);
  const analysis = review?.analysis ?? null;

  useFocusEffect(useCallback(() => {
    active.current = true;
    void Promise.all([readSkillProfile(), loadSavedCv()]).then(([profile, saved]) => {
      if (!active.current) return;
      setSavedCv(profile?.cv ?? null);
      if (saved) {
        setFile(saved.asset);
        setReview(saved.review ? normalizeCvReview(saved.review) : null);
      }
    }).catch(() => { if (active.current) setError(t('تعذر استرجاع السيرة المحفوظة. حاول فتح الصفحة مجددًا.', 'Could not restore the saved CV. Reopen this page and try again.')); })
      .finally(() => { if (active.current) setReady(true); });
    return () => { active.current = false; };
  }, [t]));

  useEffect(() => {
    if (!ready || !file || !review || busy) return;
    void storeCvReview(file.uri, review)
      .catch(() => setError(t('تعذر حفظ تعديلات المراجعة. حاول مجددًا قبل إغلاق التطبيق.', 'Could not save your review edits. Try again before closing the app.')));
  }, [ready, file, review, busy, t]);

  async function removeCv() {
    const scope = captureDataScope();
    if (locked.current) return;
    locked.current = true; setBusy(true); setStatus(t('جارٍ حذف السيرة…', 'Deleting CV…')); setError('');
    try {
      const remaining = await clearReviewedCv();
      scope.assertCurrent();
      await deleteSavedCv();
      setFile(null); setReview(null); setSavedCv(remaining.cv); setConsent(false); setConfirmDelete(false); setConfirmReanalysis(false); setHistory(null);
    } catch { setError(t('تعذر إكمال حذف السيرة. حاول مجددًا.', 'Could not delete the CV. Try again.')); }
    finally { locked.current = false; setBusy(false); }
  }

  async function pickCv() {
    const scope = captureDataScope();
    if (locked.current) return;
    locked.current = true; setBusy(true); setStatus(t('جارٍ اختيار الملف…', 'Choosing file…')); setError('');
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: CV_MIME_TYPES, multiple: false, copyToCacheDirectory: true, base64: false });
      if (result.canceled) return;
      scope.assertCurrent();
      const selected = result.assets[0];
      if (!selected) throw new Error(t('تعذر اختيار الملف.', 'Could not choose a file.'));
      await getValidatedCvFile(selected);
      scope.assertCurrent();
      const saved = await storeCvFile(selected);
      setFile(saved.asset); setReview(null); setConsent(false); setConfirmDelete(false); setConfirmReanalysis(false); setHistory(null);
    } catch (failure) { setError(failure instanceof Error ? failure.message : t('تعذر اختيار الملف.', 'Could not choose a file.')); }
    finally { locked.current = false; setBusy(false); }
  }

  async function runAnalysis() {
    const scope = captureDataScope();
    if (!file || !consent || locked.current) return;
    locked.current = true; setBusy(true); setStatus(t('جارٍ قراءة السيرة وتحليلها…', 'Reading and analyzing your CV…')); setError('');
    try {
      const result = await analyzeCv(file);
      scope.assertCurrent();
      const nextReview = createReanalysisReview(result, review, savedCv);
      await storeCvReview(file.uri, nextReview);
      scope.assertCurrent();
      if (!active.current) return;
      setReview(nextReview); setConfirmReanalysis(false); setHistory(null);
    } catch (failure) { if (active.current) setError(failure instanceof Error ? failure.message : t('تعذر التحليل.', 'Analysis failed.')); }
    finally { locked.current = false; setBusy(false); }
  }

  async function approve() {
    const scope = captureDataScope();
    if (!review || locked.current) return;
    locked.current = true; setBusy(true); setStatus(t('جارٍ حفظ المعلومات…', 'Saving your information…')); setError('');
    try {
      const selectedSections: ReviewSection[] = ['skills', 'projects', 'courses', 'certificates', 'education', 'experiences', 'activities'];
      const hasUnnamedSelected = selectedSections.some(section => {
        const indexes = review[section] ?? [];
        const rows = review.analysis[section] ?? [];
        return indexes.some(index => {
          const row = rows[index] as unknown as Record<string, string> | undefined;
          return row && !(section === 'experiences' ? row.role ?? '' : row.name ?? '').trim();
        });
      });
      if (hasUnnamedSelected) throw new Error(t('أكمل أسماء المعلومات التي تريد حفظها أو ألغِ اختيارها.', 'Add names to the selected items you want to save, or unselect them.'));
      if (file) await storeCvReview(file.uri, review);
      scope.assertCurrent();
      await saveReviewedCv(approvedCvAnalysis(review));
      router.replace('/home');
    } catch (failure) { setError(failure instanceof Error ? failure.message : t('تعذر الحفظ.', 'Could not save.')); }
    finally { locked.current = false; setBusy(false); }
  }

  function selection(label: string, selected: boolean, onPress: () => void) {
    return <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: selected, disabled: busy }} disabled={busy} onPress={onPress} style={[styles.consentRow, en && styles.row]}>
      <View style={[styles.checkbox, selected && styles.checkboxSelected]}><Text style={styles.checkboxMark}>{selected ? '✓' : ''}</Text></View>
      <Text style={[styles.consentText, en && styles.ltr]}>{label}</Text>
    </Pressable>;
  }

  const approvedCounts = review ? cvReviewCounts(review) : null;
  const savedCounts = savedCv ? cvReviewCounts(createCvReview(savedCv)) : null;
  const oldDraft = needsCvReanalysis(analysis), oldApproved = needsCvReanalysis(savedCv);
  const previousReview = history === 'draft' ? review?.previous_review
    : history === 'approved' && review?.previous_approved ? createCvReview(review.previous_approved) : null;

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => router.canGoBack() ? router.back() : router.replace('/home')} style={[styles.backButton, en && styles.row]}>
          <LocalizedCopy ar="العودة" english="Back" en={en} style={styles.backText} /><Text style={styles.backArrow}>{en ? '→' : '←'}</Text>
        </Pressable>
        <View style={styles.hero}>
          <LocalizedCopy ar="ملفك المهني" english="Your career profile" en={en} style={styles.eyebrow} />
          <LocalizedCopy ar="تحليل السيرة الذاتية" english="CV analysis" en={en} style={styles.title} />
          <LocalizedCopy ar="ارفع سيرتك، راجع النتيجة، ثم اعتمدها." english="Upload your CV, review the results, and approve them." en={en} style={styles.intro} />
        </View>

        {oldDraft || oldApproved ? <View style={styles.warning} accessibilityRole="alert">
          <LocalizedCopy ar="نتيجة من إصدار سابق تحتاج مراجعة" english="An older result needs review" en={en} style={styles.noticeTitle} />
          <LocalizedCopy ar={analysis && !oldDraft
            ? 'آخر اعتماد محفوظ أقدم من المحلل الحالي؛ راجع النتيجة الجديدة واعتمدها عندما تتأكد منها.'
            : 'نتيجة التحليل محفوظة دون إصدار المحلل الحالي أو بإصدار مختلف، وتحتاج إعادة تحليل للاستفادة من الإصلاحات. لن نعيد التحليل أو نستبدل معلوماتك تلقائيًا.'}
            english={analysis && !oldDraft
              ? 'Your last approved result predates the current analyzer. Review and approve the new result when you are satisfied with it.'
              : 'This saved result uses an older or unknown analyzer version. Reanalyze to receive the fixes; your approved information will not be replaced automatically.'}
            en={en} style={styles.note} />
          {!file ? <LocalizedCopy ar="ملف PDF غير متوفر على هذا الجهاز؛ اختره أولًا. تبقى معلوماتك المعتمدة كما هي." english="The PDF is not available on this device. Choose it again; your approved information will remain unchanged." en={en} style={styles.note} /> : null}
        </View> : null}

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.fileIcon}><Text style={styles.fileIconText}>PDF</Text></View>
            <View style={styles.cardHeaderCopy}>
              <LocalizedCopy ar={file ? 'ملف السيرة المحفوظ' : 'ابدأ بملف السيرة'} english={file ? 'Saved CV file' : 'Start with your CV'} en={en} style={styles.heading} />
              <LocalizedCopy ar="PDF نصي بالإنجليزية · حتى 10 ميجابايت" english="English text PDF · up to 10 MB" en={en} style={styles.note} />
            </View>
          </View>
          <Pressable style={[styles.button, busy && styles.disabled]} accessibilityRole="button" disabled={busy || !ready} onPress={() => void pickCv()}>
            <LocalizedCopy ar={file ? 'اختيار ملف آخر' : 'اختيار السيرة من الملفات'} english={file ? 'Choose another file' : 'Choose a CV file'} en={en} style={styles.buttonText} />
          </Pressable>
          {file ? <>
            <View style={styles.fileMeta}><Text style={styles.fileName}>{file.name}</Text><Text style={styles.fileSize}>{formatCvSize(file.size)}</Text></View>
            {selection(t('أوافق على إرسال نص السيرة إلى Groq.', 'I agree to send my CV text to Groq.'), consent, () => setConsent(!consent))}
            <Pressable style={[styles.button, styles.secondaryButton, (!consent || busy) && styles.disabled]} accessibilityRole="button" disabled={!consent || busy} onPress={() => {
              if (review || savedCv) setConfirmReanalysis(true);
              else void runAnalysis();
            }}>
              <LocalizedCopy ar={analysis || savedCv ? 'إعادة التحليل' : 'تحليل السيرة الذاتية'} english={analysis || savedCv ? 'Reanalyze CV' : 'Analyze CV'} en={en} style={styles.secondaryButtonText} />
            </Pressable>
            {confirmReanalysis ? <View style={styles.confirmBox}>
              <LocalizedCopy ar="سننشئ مراجعة جديدة. معلوماتك المعتمدة لا تتغير حتى تعتمديها؛ راجعي النسخة السابقة لأي تعديل لم يظهر." english="A new review will be created. Approved information will stay unchanged until you approve it; check the previous version for edits that are missing." en={en} style={styles.text} />
              <Pressable accessibilityRole="button" disabled={busy || !consent} onPress={() => void runAnalysis()}><LocalizedCopy ar="إعادة التحليل مع الحفاظ على تعديلاتي" english="Reanalyze and keep my edits" en={en} style={styles.link} /></Pressable>
              <Pressable accessibilityRole="button" disabled={busy} onPress={() => setConfirmReanalysis(false)}><LocalizedCopy ar="إلغاء إعادة التحليل" english="Cancel reanalysis" en={en} style={styles.link} /></Pressable>
            </View> : null}
            <LocalizedCopy ar="راجع النتيجة قبل اعتمادها. تُحفظ السيرة على هذا الجهاز حتى حذفها." english="Review the result before approving it. Your CV stays on this device until you delete it." en={en} style={styles.note} />
            <Pressable accessibilityRole="button" disabled={busy} onPress={() => setConfirmDelete(true)} style={styles.deleteAction}><LocalizedCopy ar="حذف السيرة المحفوظة" english="Delete saved CV" en={en} style={styles.deleteText} /></Pressable>
            {confirmDelete ? <View style={styles.confirmBox}>
              <LocalizedCopy ar="هل تريد حذف ملف السيرة والمعلومات والمهارات المستخرجة منه؟ تبقى المعلومات المضافة يدويًا بشكل مستقل والمهارات اليدوية وخطة التعلم." english="Delete the CV and the information and skills extracted from it? Manually added information, manual skills, and your learning plan will remain." en={en} style={styles.text} />
              <Pressable accessibilityRole="button" disabled={busy} onPress={() => void removeCv()}><LocalizedCopy ar="نعم، حذف السيرة" english="Yes, delete the CV" en={en} style={styles.deleteText} /></Pressable>
              <Pressable accessibilityRole="button" disabled={busy} onPress={() => setConfirmDelete(false)}><LocalizedCopy ar="إلغاء" english="Cancel" en={en} style={styles.link} /></Pressable>
            </View> : null}
          </> : null}
        </View>

        {!ready ? <View style={styles.loadingCard}><View style={styles.skeletonLine} /><View style={styles.skeletonLineShort} /><LocalizedCopy ar="جارٍ استرجاع سيرتك…" english="Restoring your CV…" en={en} style={styles.note} /></View> : null}
        {busy ? <View style={[styles.progress, en && styles.row]}><ActivityIndicator color={colors.primary} /><Text style={[styles.text, en && styles.ltr]}>{status}</Text></View> : null}
        {error ? <View style={styles.errorBox}><Text style={[styles.error, en && styles.ltr]} accessibilityRole="alert">{error}</Text></View> : null}

        {review && analysis ? <>
          <View style={styles.reviewIntro}>
            <LocalizedCopy ar="مراجعة السيرة" english="CV review" en={en} style={styles.eyebrow} />
            <LocalizedCopy ar="تحققي من البيانات" english="Check your information" en={en} style={styles.heading} />
            <LocalizedCopy ar="استبعدي غير الصحيح وصنّفي غير المحدد؛ يُحتسب البند مرة واحدة بين الدورات والشهادات." english="Remove incorrect details and classify uncertain entries. An item is counted once across courses and certifications." en={en} style={styles.note} />
          </View>
          {analysis.warnings.length ? <View style={styles.warning}>
            <LocalizedCopy ar="ملاحظات التحليل" english="Analysis notes" en={en} style={styles.noticeTitle} />
            {analysis.warnings.map((warning, index) => <Text key={`${warning}-${index}`} style={[styles.note, en && styles.ltr]}>• {compactAnalysisWarning(warning, en)}</Text>)}
          </View> : null}
          {review.previous_review || review.previous_approved ? <View style={styles.notice}>
            <LocalizedCopy ar="نسختك السابقة محفوظة" english="Your previous version is saved" en={en} style={styles.noticeTitle} />
            {review.previous_review ? <Pressable accessibilityRole="button" disabled={busy} onPress={() => setHistory('draft')}><LocalizedCopy ar="عرض المراجعة السابقة" english="View previous review" en={en} style={styles.link} /></Pressable> : null}
            {review.previous_approved ? <Pressable accessibilityRole="button" disabled={busy} onPress={() => setHistory('approved')}><LocalizedCopy ar="عرض آخر اعتماد سابق" english="View last approved version" en={en} style={styles.link} /></Pressable> : null}
            {previousReview && history ? <>
              <LocalizedCopy ar="نسخة سابقة · للعرض والاستعادة" english="Previous version · view and restore" en={en} style={styles.note} />
              <CvReviewSections review={previousReview} onChange={() => {}} busy />
              <Pressable accessibilityRole="button" disabled={busy} onPress={() => { setReview(restoreCvReview(review, history)); setHistory(null); }}><LocalizedCopy ar="استعادة هذه المراجعة" english="Restore this review" en={en} style={styles.link} /></Pressable>
              <Pressable accessibilityRole="button" disabled={busy} onPress={() => setHistory(null)}><LocalizedCopy ar="إخفاء النسخة السابقة" english="Hide previous version" en={en} style={styles.link} /></Pressable>
            </> : null}
          </View> : null}
          <View style={[styles.countStrip, en && styles.ltrRow]}>
            {(['skills', 'projects', 'courses', 'certificates', 'education', 'experiences'] as CvSection[]).map((section, index) => (
              <View key={section} style={[styles.countCell, index === 5 && styles.lastCountCell]}>
                <Text accessibilityLabel={`${en ? 'Approved' : 'عدد'} ${names[section]}`} style={styles.countNumber}>{approvedCounts?.[section] ?? 0}</Text>
                <Text style={[styles.countLabel, en && styles.ltr]}>{names[section]}</Text>
              </View>
            ))}
          </View>
          <CvReviewSections review={review} onChange={setReview} busy={busy} />
          <View style={styles.approvalNote}>
            <LocalizedCopy ar="تدخل المهارات الأساسية في نسبة التغطية؛ بقية البيانات تُحفظ في ملف السيرة." english="Core skills contribute to coverage; other details are saved in your CV profile." en={en} style={styles.note} />
          </View>
          <Pressable accessibilityRole="button" style={[styles.button, styles.approveButton, busy && styles.disabled]} disabled={busy} onPress={() => void approve()}>
            <LocalizedCopy ar="اعتماد المعلومات وحفظها" english="Approve and save information" en={en} style={styles.buttonText} />
          </Pressable>
        </> : null}

        {savedCv && !review ? <View style={styles.savedBlock}>
          <View style={styles.reviewIntro}>
            <LocalizedCopy ar="آخر اعتماد" english="Last approval" en={en} style={styles.eyebrow} />
            <LocalizedCopy ar="معلوماتك المحفوظة" english="Your saved information" en={en} style={styles.heading} />
            <LocalizedCopy ar="رفع ملف جديد لا يغيّر المعلومات المحفوظة حتى تعتمد نتيجته." english="Uploading a new file does not change saved information until you approve its result." en={en} style={styles.note} />
          </View>
          <View style={[styles.countStrip, en && styles.ltrRow]}>
            {(['skills', 'projects', 'courses', 'certificates', 'education', 'experiences'] as CvSection[]).map((section, index) => (
              <View key={section} style={[styles.countCell, index === 5 && styles.lastCountCell]}>
                <Text style={styles.countNumber}>{savedCounts?.[section] ?? 0}</Text>
                <Text style={[styles.countLabel, en && styles.ltr]}>{names[section]}</Text>
              </View>
            ))}
          </View>
          {(['skills', 'projects', 'courses', 'certificates', 'education', 'experiences'] as CvSection[]).map(section => {
            const rows = savedCv[section] ?? [];
            const state = savedCv.section_status?.[section] ?? 'legacy';
            const stateText = state === 'not_found' ? t('لم يظهر نص واضح؛ وهذا لا يعني عدم وجود معلومات.', 'No clear text was found; this does not mean the information is absent.') : state === 'uncertain' ? t('وجد نص يحتاج إلى مراجعة أو تصنيف.', 'Text was found that needs review or classification.') : state === 'legacy' ? t('نتيجة أقدم قد تحتاج إلى إعادة التحليل.', 'An older result may need reanalysis.') : t('معلومات مستخرجة ومعتمدة.', 'Information extracted and approved.');
            const first = rows[0] as unknown as Record<string, unknown> | undefined;
            const firstSummary = first ? [first.role ?? first.name, first.organization, first.major, first.dates, first.description,
              Array.isArray(first.technologies) ? first.technologies.join('، ') : '']
              .filter((item): item is string => typeof item === 'string' && item.trim().length > 0).join(' · ') : '';
            const sectionState = state === 'not_found' ? t('لا بيانات', 'No data') : state === 'uncertain' || state === 'legacy' ? t('تحتاج مراجعة', 'Review needed') : t('معتمدة', 'Approved');
            return <DisclosureCard key={section} title={names[section]} subtitle={stateText}
              summary={firstSummary || (rows.length ? t(`${rows.length} عناصر محفوظة`, `${rows.length} saved items`) : t('لا توجد عناصر في هذا القسم', 'No items in this section'))}
              status={sectionState}>
              <LocalizedCopy ar={stateText} english={stateText} en={en} style={styles.note} />
              {rows.length ? rows.map((row, index) => <Text key={`${section}-${index}`} style={styles.savedEntry}>{[
                ...Object.entries(row).filter(([key, value]) => key !== 'evidence' && key !== 'mapped_skill_id' && value && typeof value === 'string').map(([, value]) => value as string),
                ...(Array.isArray((row as unknown as { technologies?: string[] }).technologies) ? [(row as unknown as { technologies: string[] }).technologies.join('، ')] : []),
              ].filter(Boolean).join(' · ')}</Text>) : <LocalizedCopy ar="لا توجد معلومة معتمدة هنا. قد لا تكون استُخرجت من هذا الملف." english="No approved information here. It may not have been extracted from this file." en={en} style={styles.note} />}
            </DisclosureCard>;
          })}
        </View> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = createAdaptiveStyles(() => ({
  screen: { flex: 1, backgroundColor: colors.background },
  ltr: { textAlign: 'left', writingDirection: 'ltr' },
  row: { flexDirection: 'row' },
  ltrRow: { flexDirection: 'row' },
  content: { width: '100%', maxWidth: 680, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 64, gap: 18 },
  backButton: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 8, paddingVertical: 7, paddingHorizontal: 2 },
  backText: { color: colors.primary, fontSize: 15, fontWeight: '700' },
  backArrow: { color: colors.primary, fontSize: 20 },
  hero: { paddingTop: 8, paddingBottom: 8, gap: 9 },
  eyebrow: { color: colors.gold, textAlign: 'right', fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  title: { color: colors.ink, fontSize: 29, fontWeight: '800', lineHeight: 40, textAlign: 'right' },
  intro: { color: colors.muted, fontSize: 16, lineHeight: 27, textAlign: 'right' },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 18, borderRadius: 20, gap: 15, shadowColor: colors.ink, shadowOpacity: 0.045, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 1 },
  cardHeader: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },
  cardHeaderCopy: { flex: 1, gap: 3 },
  fileIcon: { width: 46, height: 46, borderRadius: 15, backgroundColor: colors.mint, justifyContent: 'center', alignItems: 'center' },
  fileIconText: { color: colors.primary, fontSize: 12, fontWeight: '900', letterSpacing: 0.6 },
  heading: { color: colors.ink, fontSize: 19, fontWeight: '700', textAlign: 'right' },
  text: { color: colors.muted, fontSize: 15, lineHeight: 25, textAlign: 'right' },
  note: { color: colors.muted, fontSize: 13, lineHeight: 22, textAlign: 'right' },
  button: { backgroundColor: colors.primary, borderRadius: 14, minHeight: 50, paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center' },
  buttonText: { color: colors.onPrimary, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  disabled: { opacity: 0.48 },
  fileMeta: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: colors.soft, gap: 3 },
  fileName: { color: colors.ink, fontSize: 15, lineHeight: 23, textAlign: 'left' },
  fileSize: { color: colors.muted, fontSize: 12, textAlign: 'left' },
  consentRow: { flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 10, paddingVertical: 4 },
  checkbox: { width: 23, height: 23, borderRadius: 7, borderWidth: 1.5, borderColor: colors.border, marginTop: 2, alignItems: 'center', justifyContent: 'center' },
  checkboxSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkboxMark: { color: colors.onPrimary, fontSize: 14, fontWeight: '800' },
  consentText: { color: colors.muted, fontSize: 14, lineHeight: 23, textAlign: 'right', flex: 1 },
  notice: { borderRightWidth: 3, borderRightColor: colors.gold, backgroundColor: colors.warningSurface, padding: 12, gap: 5, borderRadius: 9 },
  noticeTitle: { color: colors.gold, fontSize: 14, fontWeight: '800', textAlign: 'right' },
  link: { color: colors.primary, fontSize: 15, paddingVertical: 6, textAlign: 'right', fontWeight: '700' },
  secondaryButton: { backgroundColor: colors.mint, borderWidth: 1, borderColor: colors.border },
  secondaryButtonText: { color: colors.primary, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  deleteAction: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 9, marginTop: 2 },
  deleteText: { color: colors.error, fontSize: 15, fontWeight: '700', textAlign: 'right', paddingVertical: 7 },
  confirmBox: { borderRadius: 14, backgroundColor: colors.errorSurface, padding: 13, gap: 4 },
  loadingCard: { backgroundColor: colors.surface, borderRadius: 16, padding: 18, gap: 11 },
  skeletonLine: { height: 12, width: '70%', borderRadius: 6, backgroundColor: colors.soft, alignSelf: 'flex-end' },
  skeletonLineShort: { height: 10, width: '43%', borderRadius: 6, backgroundColor: colors.soft, alignSelf: 'flex-end' },
  progress: { flexDirection: 'row-reverse', gap: 10, alignItems: 'center', paddingHorizontal: 4 },
  errorBox: { backgroundColor: colors.errorSurface, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: colors.errorBorder },
  error: { color: colors.error, fontSize: 14, lineHeight: 23, textAlign: 'right' },
  reviewIntro: { gap: 7, paddingTop: 4 },
  warning: { backgroundColor: colors.warningSurface, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: colors.warningBorder, gap: 4 },
  countStrip: { flexDirection: 'row-reverse', flexWrap: 'wrap', backgroundColor: colors.mint, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 6 },
  countCell: { width: '33.333%', alignItems: 'center', justifyContent: 'center', paddingVertical: 7, borderLeftWidth: 1, borderLeftColor: colors.border, gap: 3 },
  lastCountCell: { borderLeftWidth: 0 },
  countNumber: { color: colors.primary, fontSize: 22, fontWeight: '800' },
  countLabel: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  approvalNote: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 },
  approveButton: { minHeight: 56, marginTop: 2 },
  savedBlock: { gap: 14 },
  savedEntry: { color: colors.muted, backgroundColor: colors.background, borderRadius: 10, padding: 11, fontSize: 14, lineHeight: 23, textAlign: 'right' },
}));
