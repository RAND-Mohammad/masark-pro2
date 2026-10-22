import { useCallback, useEffect, useRef, useState } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CV_MIME_TYPES, formatCvSize } from '../utils/cv-file';
import { getValidatedCvFile } from '../utils/cv-upload-file';
import { analyzeCv } from '../utils/cv-api';
import { readSkillProfile, saveReviewedCv, clearReviewedCv, type CvProfile } from '../utils/skill-profile';
import dataset from '../masarak_dataset.json';
import { careerTitles } from '../utils/career-matches';
import { captureDataScope } from '../utils/scoped-storage';
import { loadSavedCv, storeCvFile, storeCvReview, deleteSavedCv } from '../utils/saved-cv';
import { approvedCvAnalysis, createCvReview, cvReviewCounts, normalizeCvReview } from '../utils/cv-review';
import type { CvReview } from '../utils/saved-cv.types';
import type { CvSection, ReviewSection } from '../utils/cv-review';
import CvReviewSections from '../components/cv/CvReviewSections';
import { needsCvReanalysis } from '../utils/cv-parser-version.mjs';
import { createReanalysisReview, restoreCvReview } from '../utils/cv-reanalysis';

function skillScoreNote(id: string | null) {
  if (!id) return 'لم نجد ربطًا موثوقًا لهذا الاسم؛ تُحفظ المهارة للمراجعة ولا نحتسبها بالتخمين.';
  const core = dataset.career_skills.filter(row => row.skill_id === id && row.priority === 'core').map(row => careerTitles[row.career_id] ?? row.career_id);
  if (core.length) return 'تدخل تغطية المتطلبات الأساسية لمسار: ' + core.join('، ') + '. تُحتسب الكفاءة مرة واحدة مهما تكررت أدواتها.';
  if (dataset.career_skills.some(row => row.skill_id === id)) return 'مهارة مساندة مرتبطة بمسارات؛ تظهر في ملفك والخطة، ولا تغير نسبة المتطلبات الأساسية.';
  return 'مهارة معروفة في القاموس ومحفوظة، لكنها ليست ضمن متطلبات المسارات الستة الحالية.';
}

const sectionNames: Record<CvSection, string> = {
  skills: 'المهارات',
  projects: 'المشاريع',
  courses: 'الدورات',
  certificates: 'الشهادات',
  education: 'التعليم',
  experiences: 'الخبرات',
};

export default function UploadCvScreen() {
  const router = useRouter();
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
    }).catch(() => { if (active.current) setError('تعذر استرجاع السيرة المحفوظة. حاول فتح الصفحة مجددًا.'); })
      .finally(() => { if (active.current) setReady(true); });
    return () => { active.current = false; };
  }, []));

  useEffect(() => {
    if (!ready || !file || !review || busy) return;
    void storeCvReview(file.uri, review)
      .catch(() => setError('تعذر حفظ تعديلات المراجعة. حاول مجددًا قبل إغلاق التطبيق.'));
  }, [ready, file, review, busy]);

  async function removeCv() {
    const scope = captureDataScope();
    if (locked.current) return;
    locked.current = true; setBusy(true); setStatus('جارٍ حذف السيرة…'); setError('');
    try {
      const remaining = await clearReviewedCv();
      scope.assertCurrent();
      await deleteSavedCv();
      setFile(null); setReview(null); setSavedCv(remaining.cv); setConsent(false); setConfirmDelete(false); setConfirmReanalysis(false); setHistory(null);
    } catch { setError('تعذر إكمال حذف السيرة. حاول مجددًا.'); }
    finally { locked.current = false; setBusy(false); }
  }

  async function pickCv() {
    const scope = captureDataScope();
    if (locked.current) return;
    locked.current = true; setBusy(true); setStatus('جارٍ اختيار الملف…'); setError('');
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: CV_MIME_TYPES, multiple: false, copyToCacheDirectory: true, base64: false });
      if (result.canceled) return;
      scope.assertCurrent();
      const selected = result.assets[0];
      if (!selected) throw new Error('تعذر اختيار الملف.');
      await getValidatedCvFile(selected);
      scope.assertCurrent();
      const saved = await storeCvFile(selected);
      setFile(saved.asset); setReview(null); setConsent(false); setConfirmDelete(false); setConfirmReanalysis(false); setHistory(null);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'تعذر اختيار الملف.'); }
    finally { locked.current = false; setBusy(false); }
  }

  async function runAnalysis() {
    const scope = captureDataScope();
    if (!file || !consent || locked.current) return;
    locked.current = true; setBusy(true); setStatus('جارٍ قراءة السيرة وتحليلها…'); setError('');
    try {
      const result = await analyzeCv(file);
      scope.assertCurrent();
      const nextReview = createReanalysisReview(result, review, savedCv);
      await storeCvReview(file.uri, nextReview);
      scope.assertCurrent();
      if (!active.current) return;
      setReview(nextReview); setConfirmReanalysis(false); setHistory(null);
    } catch (failure) { if (active.current) setError(failure instanceof Error ? failure.message : 'تعذر التحليل.'); }
    finally { locked.current = false; setBusy(false); }
  }

  async function approve() {
    const scope = captureDataScope();
    if (!review || locked.current) return;
    locked.current = true; setBusy(true); setStatus('جارٍ حفظ المعلومات…'); setError('');
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
      if (hasUnnamedSelected) throw new Error('أكمل أسماء المعلومات التي تريد حفظها أو ألغِ اختيارها.');
      if (file) await storeCvReview(file.uri, review);
      scope.assertCurrent();
      await saveReviewedCv(approvedCvAnalysis(review));
      router.replace('/home');
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'تعذر الحفظ.'); }
    finally { locked.current = false; setBusy(false); }
  }

  function selection(label: string, selected: boolean, onPress: () => void) {
    return <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: selected, disabled: busy }} disabled={busy} onPress={onPress} style={styles.consentRow}>
      <View style={[styles.checkbox, selected && styles.checkboxSelected]}><Text style={styles.checkboxMark}>{selected ? '✓' : ''}</Text></View>
      <Text style={styles.consentText}>{label}</Text>
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
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => router.canGoBack() ? router.back() : router.replace('/home')} style={styles.backButton}>
          <Text style={styles.backText}>العودة</Text><Text style={styles.backArrow}>←</Text>
        </Pressable>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>ملفك المهني</Text>
          <Text style={styles.title}>تحليل السيرة الذاتية</Text>
          <Text style={styles.intro}>ارفع سيرتك، راجع النتيجة، ثم اعتمدها.</Text>
        </View>

        {oldDraft || oldApproved ? <View style={styles.warning} accessibilityRole="alert">
          <Text style={styles.noticeTitle}>نتيجة من إصدار سابق تحتاج مراجعة</Text>
          <Text style={styles.note}>{analysis && !oldDraft
            ? 'آخر اعتماد محفوظ أقدم من المحلل الحالي؛ راجع النتيجة الجديدة واعتمدها عندما تتأكد منها.'
            : 'نتيجة التحليل محفوظة دون إصدار المحلل الحالي أو بإصدار مختلف، وتحتاج إعادة تحليل للاستفادة من الإصلاحات. لن نعيد التحليل أو نستبدل معلوماتك تلقائيًا.'}</Text>
          {!file ? <Text style={styles.note}>ملف PDF غير متوفر على هذا الجهاز؛ اختره أولًا. تبقى معلوماتك المعتمدة كما هي.</Text> : null}
        </View> : null}

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.fileIcon}><Text style={styles.fileIconText}>PDF</Text></View>
            <View style={styles.cardHeaderCopy}>
              <Text style={styles.heading}>{file ? 'ملف السيرة المحفوظ' : 'ابدأ بملف السيرة'}</Text>
              <Text style={styles.note}>PDF فقط · حتى 10 ميجابايت</Text>
            </View>
          </View>
          <Text style={styles.text}>PDF نصي باللغة الإنجليزية فقط · حتى 10 ميجابايت</Text>
          <Pressable style={[styles.button, busy && styles.disabled]} accessibilityRole="button" disabled={busy || !ready} onPress={() => void pickCv()}>
            <Text style={styles.buttonText}>{file ? 'اختيار ملف آخر' : 'اختيار السيرة من الملفات'}</Text>
          </Pressable>
          {file ? <>
            <View style={styles.fileMeta}><Text style={styles.fileName}>{file.name}</Text><Text style={styles.fileSize}>{formatCvSize(file.size)}</Text></View>
            <View style={styles.notice}>
              <Text style={styles.noticeTitle}>قبل التحليل</Text>
              <Text style={styles.note}>يُرسل الملف إلى Gemini بعد موافقتك. ملفات الصور وOCR غير مدعومة.</Text>
              <Text style={styles.note}>للاختبار، استخدم سيرة تجريبية؛ قد تستخدم Google بيانات الخطة المجانية لتحسين خدماتها.</Text>
            </View>
            {selection('أوافق على إرسال السيرة إلى Google Gemini.', consent, () => setConsent(!consent))}
            <Pressable disabled={busy} onPress={() => void Linking.openURL('https://ai.google.dev/gemini-api/docs/pricing').catch(() => setError('تعذر فتح تفاصيل خطة Google.'))}>
              <Text style={styles.link}>تفاصيل استخدام البيانات</Text>
            </Pressable>
            <Pressable style={[styles.button, styles.secondaryButton, (!consent || busy) && styles.disabled]} accessibilityRole="button" disabled={!consent || busy} onPress={() => {
              if (review || savedCv) setConfirmReanalysis(true);
              else void runAnalysis();
            }}>
              <Text style={styles.secondaryButtonText}>{analysis || savedCv ? 'إعادة التحليل' : 'تحليل السيرة الذاتية'}</Text>
            </Pressable>
            {confirmReanalysis ? <View style={styles.confirmBox}>
              <Text style={styles.text}>ستُنشأ مراجعة جديدة مع الاحتفاظ ببنودك المصححة والمضافة يدويًا واستبعاداتك. تُحفظ نسخة سابقة للعرض والاستعادة؛ لا تتغير معلوماتك المعتمدة حتى تعتمد النتيجة الجديدة.</Text>
              <Text style={styles.note}>التعديلات القديمة التي لا تحمل علامة تصحيح لا يمكن تمييزها آليًا؛ تبقى في النسخة السابقة للعرض والاستعادة. راجع النسختين قبل الاعتماد.</Text>
              <Pressable accessibilityRole="button" disabled={busy || !consent} onPress={() => void runAnalysis()}><Text style={styles.link}>إعادة التحليل مع الحفاظ على تعديلاتي</Text></Pressable>
              <Pressable accessibilityRole="button" disabled={busy} onPress={() => setConfirmReanalysis(false)}><Text style={styles.link}>إلغاء إعادة التحليل</Text></Pressable>
            </View> : null}
            <Text style={styles.note}>راجع النتيجة قبل اعتمادها. تُحفظ السيرة على هذا الجهاز حتى حذفها.</Text>
            <Pressable accessibilityRole="button" disabled={busy} onPress={() => setConfirmDelete(true)} style={styles.deleteAction}><Text style={styles.deleteText}>حذف السيرة المحفوظة</Text></Pressable>
            {confirmDelete ? <View style={styles.confirmBox}>
              <Text style={styles.text}>هل تريد حذف ملف السيرة والمعلومات والمهارات المستخرجة منه؟ تبقى المعلومات المضافة يدويًا بشكل مستقل والمهارات اليدوية وخطة التعلم.</Text>
              <Pressable accessibilityRole="button" disabled={busy} onPress={() => void removeCv()}><Text style={styles.deleteText}>نعم، حذف السيرة</Text></Pressable>
              <Pressable accessibilityRole="button" disabled={busy} onPress={() => setConfirmDelete(false)}><Text style={styles.link}>إلغاء</Text></Pressable>
            </View> : null}
          </> : null}
        </View>

        {!ready ? <View style={styles.loadingCard}><View style={styles.skeletonLine} /><View style={styles.skeletonLineShort} /><Text style={styles.note}>جارٍ استرجاع سيرتك…</Text></View> : null}
        {busy ? <View style={styles.progress}><ActivityIndicator color="#176B62" /><Text style={styles.text}>{status}</Text></View> : null}
        {error ? <View style={styles.errorBox}><Text style={styles.error} accessibilityRole="alert">{error}</Text></View> : null}

        {review && analysis ? <>
          <View style={styles.reviewIntro}>
            <Text style={styles.eyebrow}>مراجعة تفصيلية</Text>
            <Text style={styles.heading}>المعلومة لك، والقرار لك</Text>
            <Text style={styles.text}>الأعداد أدناه تتغير مع اعتمادك، وتحتسب العناصر الفريدة فقط. استبعد غير الصحيح، أو انقله إلى قسمه المناسب.</Text>
            <Text style={styles.note}>لا نحتسب البند نفسه مرتين بين الدورات والشهادات. البنود غير المصنفة لا تدخل الأعداد حتى تحدد قسمها.</Text>
          </View>
          {analysis.warnings.map((warning, index) => <View key={`${warning}-${index}`} style={styles.warning}><Text style={styles.note}>{warning}</Text></View>)}
          {review.previous_review || review.previous_approved ? <View style={styles.notice}>
            <Text style={styles.noticeTitle}>نسختك السابقة محفوظة</Text>
            {review.previous_review ? <Pressable accessibilityRole="button" disabled={busy} onPress={() => setHistory('draft')}><Text style={styles.link}>عرض المراجعة السابقة</Text></Pressable> : null}
            {review.previous_approved ? <Pressable accessibilityRole="button" disabled={busy} onPress={() => setHistory('approved')}><Text style={styles.link}>عرض آخر اعتماد سابق</Text></Pressable> : null}
            {previousReview && history ? <>
              <Text style={styles.note}>نسخة سابقة للقراءة فقط، وليست نتيجة استخراج جديدة.</Text>
              <CvReviewSections review={previousReview} onChange={() => {}} busy analyzedAt={previousReview.analysis.analyzed_at} onSkillNote={skillScoreNote} />
              <Pressable accessibilityRole="button" disabled={busy} onPress={() => { setReview(restoreCvReview(review, history)); setHistory(null); }}><Text style={styles.link}>استعادة هذه المراجعة</Text></Pressable>
              <Pressable accessibilityRole="button" disabled={busy} onPress={() => setHistory(null)}><Text style={styles.link}>إخفاء النسخة السابقة</Text></Pressable>
            </> : null}
          </View> : null}
          <View style={styles.countStrip}>
            {(['skills', 'projects', 'courses', 'certificates', 'education', 'experiences'] as CvSection[]).map((section, index) => (
              <View key={section} style={[styles.countCell, index === 5 && styles.lastCountCell]}>
                <Text accessibilityLabel={`عدد ${sectionNames[section]} المعتمدة`} style={styles.countNumber}>{approvedCounts?.[section] ?? 0}</Text>
                <Text style={styles.countLabel}>{sectionNames[section]}</Text>
              </View>
            ))}
          </View>
          <CvReviewSections review={review} onChange={setReview} busy={busy} analyzedAt={analysis.analyzed_at} onSkillNote={skillScoreNote} />
          <View style={styles.approvalNote}>
            <Text style={styles.note}>المهارات المعتمدة المرتبطة بالقاموس تُضاف إلى اختياراتك السابقة. الدورات والشهادات والتعليم والخبرات والمشاريع تُحفظ في ملف السيرة ولا تدخل نسبة تغطية المهارات.</Text>
          </View>
          <Pressable accessibilityRole="button" style={[styles.button, styles.approveButton, busy && styles.disabled]} disabled={busy} onPress={() => void approve()}>
            <Text style={styles.buttonText}>اعتماد المعلومات وحفظها</Text>
          </Pressable>
        </> : null}

        {savedCv && !review ? <View style={styles.savedBlock}>
          <View style={styles.reviewIntro}>
            <Text style={styles.eyebrow}>آخر اعتماد</Text>
            <Text style={styles.heading}>معلوماتك المحفوظة</Text>
            <Text style={styles.note}>رفع ملف جديد لا يغيّر المعلومات المحفوظة حتى تعتمد نتيجته.</Text>
          </View>
          <View style={styles.countStrip}>
            {(['skills', 'projects', 'courses', 'certificates', 'education', 'experiences'] as CvSection[]).map((section, index) => (
              <View key={section} style={[styles.countCell, index === 5 && styles.lastCountCell]}>
                <Text style={styles.countNumber}>{savedCounts?.[section] ?? 0}</Text>
                <Text style={styles.countLabel}>{sectionNames[section]}</Text>
              </View>
            ))}
          </View>
          {(['skills', 'projects', 'courses', 'certificates', 'education', 'experiences'] as CvSection[]).map(section => {
            const rows = savedCv[section] ?? [];
            const state = savedCv.section_status?.[section] ?? 'legacy';
            const stateText = state === 'not_found' ? 'لم يظهر نص واضح؛ وهذا لا يعني عدم وجود معلومات.' : state === 'uncertain' ? 'وجد نص يحتاج إلى مراجعة أو تصنيف.' : state === 'legacy' ? 'نتيجة أقدم قد تحتاج إلى إعادة التحليل.' : 'معلومات مستخرجة ومعتمدة.';
            return <View key={section} style={styles.savedSection}>
              <View style={styles.savedSectionHeading}><Text style={styles.heading}>{sectionNames[section]}</Text><Text style={styles.savedCount}>{savedCounts?.[section] ?? 0}</Text></View>
              <Text style={styles.note}>{stateText}</Text>
              {rows.length ? rows.map((row, index) => <Text key={`${section}-${index}`} style={styles.savedEntry}>{[
                ...Object.entries(row).filter(([key, value]) => key !== 'evidence' && key !== 'mapped_skill_id' && value && typeof value === 'string').map(([, value]) => value as string),
                ...(Array.isArray((row as unknown as { technologies?: string[] }).technologies) ? [(row as unknown as { technologies: string[] }).technologies.join('، ')] : []),
              ].filter(Boolean).join(' · ')}{row.evidence ? `\nالدليل: ${row.evidence}` : ''}</Text>) : <Text style={styles.note}>لا توجد معلومة معتمدة هنا. قد لا تكون استُخرجت من هذا الملف.</Text>}
            </View>;
          })}
        </View> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F6F1' },
  content: { width: '100%', maxWidth: 680, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 64, gap: 18 },
  backButton: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 8, paddingVertical: 7, paddingHorizontal: 2 },
  backText: { color: '#23675F', fontSize: 15, fontWeight: '700' },
  backArrow: { color: '#23675F', fontSize: 20 },
  hero: { paddingTop: 8, paddingBottom: 8, gap: 9 },
  eyebrow: { color: '#997345', textAlign: 'right', fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  title: { color: '#174A46', fontSize: 29, fontWeight: '800', lineHeight: 40, textAlign: 'right' },
  intro: { color: '#526C65', fontSize: 16, lineHeight: 27, textAlign: 'right' },
  card: { backgroundColor: '#FFFEFA', borderWidth: 1, borderColor: '#DFE7DE', padding: 18, borderRadius: 20, gap: 15, shadowColor: '#254F46', shadowOpacity: 0.045, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 1 },
  cardHeader: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },
  cardHeaderCopy: { flex: 1, gap: 3 },
  fileIcon: { width: 46, height: 46, borderRadius: 15, backgroundColor: '#E7F0E8', justifyContent: 'center', alignItems: 'center' },
  fileIconText: { color: '#27685F', fontSize: 12, fontWeight: '900', letterSpacing: 0.6 },
  heading: { color: '#193F3C', fontSize: 19, fontWeight: '700', textAlign: 'right' },
  text: { color: '#48635B', fontSize: 15, lineHeight: 25, textAlign: 'right' },
  note: { color: '#687C74', fontSize: 13, lineHeight: 22, textAlign: 'right' },
  button: { backgroundColor: '#176B62', borderRadius: 14, minHeight: 50, paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center' },
  buttonText: { color: '#FFFDF7', fontSize: 16, fontWeight: '700', textAlign: 'center' },
  disabled: { opacity: 0.48 },
  fileMeta: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: '#F2F5EF', gap: 3 },
  fileName: { color: '#193F3C', fontSize: 15, lineHeight: 23, textAlign: 'left' },
  fileSize: { color: '#708079', fontSize: 12, textAlign: 'left' },
  consentRow: { flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 10, paddingVertical: 4 },
  checkbox: { width: 23, height: 23, borderRadius: 7, borderWidth: 1.5, borderColor: '#9CB1A7', marginTop: 2, alignItems: 'center', justifyContent: 'center' },
  checkboxSelected: { backgroundColor: '#176B62', borderColor: '#176B62' },
  checkboxMark: { color: '#FFFDF7', fontSize: 14, fontWeight: '800' },
  consentText: { color: '#3F5D55', fontSize: 14, lineHeight: 23, textAlign: 'right', flex: 1 },
  notice: { borderRightWidth: 3, borderRightColor: '#C69B63', backgroundColor: '#FAF4E8', padding: 12, gap: 5, borderRadius: 9 },
  noticeTitle: { color: '#805D31', fontSize: 14, fontWeight: '800', textAlign: 'right' },
  link: { color: '#176B62', fontSize: 15, paddingVertical: 6, textAlign: 'right', fontWeight: '700' },
  secondaryButton: { backgroundColor: '#E6F0E9', borderWidth: 1, borderColor: '#D5E4D8' },
  secondaryButtonText: { color: '#176B62', fontSize: 16, fontWeight: '700', textAlign: 'center' },
  deleteAction: { borderTopWidth: 1, borderTopColor: '#E6EBE5', paddingTop: 9, marginTop: 2 },
  deleteText: { color: '#A3473E', fontSize: 15, fontWeight: '700', textAlign: 'right', paddingVertical: 7 },
  confirmBox: { borderRadius: 14, backgroundColor: '#FAF0EC', padding: 13, gap: 4 },
  loadingCard: { backgroundColor: '#FFFEFA', borderRadius: 16, padding: 18, gap: 11 },
  skeletonLine: { height: 12, width: '70%', borderRadius: 6, backgroundColor: '#E7ECE5', alignSelf: 'flex-end' },
  skeletonLineShort: { height: 10, width: '43%', borderRadius: 6, backgroundColor: '#EDF0E9', alignSelf: 'flex-end' },
  progress: { flexDirection: 'row-reverse', gap: 10, alignItems: 'center', paddingHorizontal: 4 },
  errorBox: { backgroundColor: '#FFF1ED', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#F0D8CF' },
  error: { color: '#A13F35', fontSize: 14, lineHeight: 23, textAlign: 'right' },
  reviewIntro: { gap: 7, paddingTop: 4 },
  warning: { backgroundColor: '#FBF4E8', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#E9D8B9' },
  countStrip: { flexDirection: 'row-reverse', flexWrap: 'wrap', backgroundColor: '#EAF0E8', borderRadius: 16, paddingVertical: 12, paddingHorizontal: 6 },
  countCell: { width: '33.333%', alignItems: 'center', justifyContent: 'center', paddingVertical: 7, borderLeftWidth: 1, borderLeftColor: '#D4DFD3', gap: 3 },
  lastCountCell: { borderLeftWidth: 0 },
  countNumber: { color: '#176B62', fontSize: 22, fontWeight: '800' },
  countLabel: { color: '#567169', fontSize: 12, fontWeight: '700' },
  approvalNote: { borderTopWidth: 1, borderTopColor: '#DDE6DC', paddingTop: 12 },
  approveButton: { minHeight: 56, marginTop: 2 },
  savedBlock: { gap: 14 },
  savedSection: { backgroundColor: '#FFFEFA', borderWidth: 1, borderColor: '#DFE7DE', borderRadius: 16, padding: 15, gap: 9 },
  savedSectionHeading: { flexDirection: 'row-reverse', alignItems: 'center', gap: 9 },
  savedCount: { color: '#176B62', fontSize: 14, fontWeight: '800', backgroundColor: '#E6F0E9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, overflow: 'hidden' },
  savedEntry: { color: '#425E56', backgroundColor: '#F4F6F1', borderRadius: 10, padding: 11, fontSize: 14, lineHeight: 23, textAlign: 'right' },
});
