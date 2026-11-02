import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, createAdaptiveStyles, ui } from '../constants/design';
import { useAppPreferences } from '../contexts/app-preferences-context';
import { useAuth } from '../contexts/auth-context';
import { useCloud } from '../contexts/cloud-context';
import { clearReviewedCv, readSkillProfile } from '../utils/skill-profile';
import { deleteSavedCv, loadSavedCv } from '../utils/saved-cv';
import { exportAccountData, exportSavedCvFile } from '../utils/account-export';
import { readPersonalProfile } from '../utils/personal-profile';
import { readLearningPlan } from '../utils/learning-plan';
import { readLearningProgress } from '../utils/learning-progress';
import { readProfessionalCertifications } from '../utils/professional-certifications';
import { readInterviewHistory } from '../utils/interview-history';
import { readJobTarget } from '../utils/job-target';
import { readCvCloudStorageConsent, saveCvCloudStorageConsent } from '../utils/cv-cloud-storage';

export default function PrivacyScreen() {
  const router = useRouter();
  const auth = useAuth();
  const cloud = useCloud();
  const { language } = useAppPreferences();
  const en = language === 'en';
  const t = useCallback((ar: string, english: string) => en ? english : ar, [en]);
  const [exporting, setExporting] = useState(false);
  const [exportingCv, setExportingCv] = useState(false);
  const [deletingCv, setDeletingCv] = useState(false);
  const [cvStorageEnabled, setCvStorageEnabled] = useState(false);
  const [cvStorageReady, setCvStorageReady] = useState(false);
  const [savingCvStorage, setSavingCvStorage] = useState(false);
  const [confirmCvDelete, setConfirmCvDelete] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void readCvCloudStorageConsent().then(enabled => {
      if (active) setCvStorageEnabled(enabled);
    }).catch(() => {
      if (active) setError(t('تعذر قراءة تفضيل حفظ السيرة.', 'Could not read the CV storage preference.'));
    }).finally(() => { if (active) setCvStorageReady(true); });
    return () => { active = false; };
  }, [t]);

  async function updateCvStorage(enabled: boolean) {
    if (!auth.session) {
      router.push({ pathname: '/account', params: { mode: 'login' } });
      return;
    }
    if (!cvStorageReady || savingCvStorage || !cloud.ready) return;
    setSavingCvStorage(true); setError(''); setMessage('');
    try {
      await saveCvCloudStorageConsent(enabled);
      setCvStorageEnabled(enabled);
      const result = await cloud.synchronize('auto');
      if (result === 'synced') {
        setMessage(enabled
          ? t('حُفظت نسخة السيرة في حسابك لتتمكني من استعادتها على أجهزتك.', 'A CV copy is stored in your account so you can restore it on your devices.')
          : t('أزيلت نسخة السيرة من حسابك، وبقيت النسخة الموجودة على هذا الجهاز.', 'The account copy was removed. The copy on this device remains available.'));
      } else if (result === 'conflict') {
        setMessage(t('حُفظ تفضيلك على هذا الجهاز. عالجي تعارض المزامنة لإكمال تحديث نسخة الحساب.', 'Your preference is saved on this device. Resolve the sync conflict to finish updating the account copy.'));
      } else if (result === 'removed') {
        setMessage(enabled
          ? t('حُفظ تفضيلك على هذا الجهاز، لكن نسخة الحساب حُذفت سابقًا ولم نُعِد إنشاءها تلقائيًا.', 'Your preference is saved on this device, but the account copy was previously deleted and was not recreated automatically.')
          : t('لا توجد نسخة سيرة في الحساب لإزالتها. بقيت النسخة الموجودة على هذا الجهاز.', 'There was no account copy to remove. The copy on this device remains available.'));
      } else {
        setMessage(t('حُفظ تفضيلك. سيكتمل تحديث نسخة الحساب عند توفر الاتصال.', 'Your preference is saved. The account copy will update when a connection is available.'));
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : t('تعذر حفظ تفضيل السيرة.', 'Could not save the CV preference.'));
    } finally { setSavingCvStorage(false); }
  }

  async function exportData() {
    setExporting(true); setError(''); setMessage('');
    try {
      const [personal, skills, learningPlan, learningProgress, certifications, interviews, jobTarget, cv] = await Promise.all([
        readPersonalProfile(), readSkillProfile(), readLearningPlan(), readLearningProgress(),
        readProfessionalCertifications(), readInterviewHistory(), readJobTarget(), loadSavedCv(),
      ]);
      await exportAccountData({
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        account: auth.session ? { email: auth.session.user.email ?? null } : null,
        data: {
          personalProfile: personal,
          skillsAndReviewedCv: skills,
          learningPlan,
          learningProgress,
          professionalCertifications: certifications,
          interviewHistory: interviews,
          savedJob: jobTarget,
          savedCvDocument: cv ? { name: cv.asset.name, size: cv.asset.size, mimeType: cv.asset.mimeType, lastModified: cv.asset.lastModified ?? null } : null,
        },
      });
      setMessage(t('تم تجهيز ملف JSON للمعلومات المحفوظة على هذا الجهاز. يمكنك تصدير ملف PDF الأصلي بصورة منفصلة.', 'A JSON export of the data saved on this device is ready. You can export the original CV PDF separately.'));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : t('تعذر تصدير البيانات.', 'Could not export your data.'));
    } finally { setExporting(false); }
  }

  async function removeCv() {
    setDeletingCv(true); setError(''); setMessage('');
    try {
      await clearReviewedCv();
      await deleteSavedCv();
      setConfirmCvDelete(false);
      setMessage(t('حُذفت نسخة السيرة ونتيجتها من الجهاز. ستُزامن الإزالة مع الحساب عند توفر الاتصال.', 'The saved CV and its review were removed from this device. The removal will sync to your account when connected.'));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : t('تعذر حذف السيرة. حاولي مرة أخرى.', 'Could not delete the CV. Try again.'));
    } finally { setDeletingCv(false); }
  }

  async function exportCv() {
    setExportingCv(true); setError(''); setMessage('');
    try {
      const cv = await loadSavedCv();
      if (!cv) throw new Error(t('لا توجد سيرة محفوظة على هذا الجهاز.', 'There is no saved CV on this device.'));
      await exportSavedCvFile(cv.asset);
      setMessage(t('تم فتح مشاركة ملف السيرة الأصلي.', 'The original CV file is ready to share.'));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : t('تعذر تصدير السيرة.', 'Could not export the CV.'));
    } finally { setExportingCv(false); }
  }

  return <SafeAreaView style={ui.screen}><ScrollView contentContainerStyle={ui.content}>
    <Pressable accessibilityRole="button" onPress={() => router.canGoBack() ? router.back() : router.replace('/profile')}><Text style={[ui.link, en && styles.ltr]}>{t('العودة', 'Back')}</Text></Pressable>
    <Text style={[ui.title, en && styles.ltr]}>{t('بياناتك في مسارك', 'Your data in Masarak')}</Text>
    <Text style={[ui.text, en && styles.ltr]}>{t('تحكمي في نسخة بياناتك المحفوظة على هذا الجهاز وفي حسابك.', 'Manage the data saved on this device and in your account.')}</Text>

    <View style={ui.card}>
      <View style={{ direction: 'ltr', flexDirection: en ? 'row' : 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
        <Text style={[ui.heading, en && styles.ltr, { flex: 1 }]}>{t('حفظ السيرة بأمان', 'Store my CV securely')}</Text>
        <Switch
          accessibilityLabel={t('حفظ نسخة السيرة في الحساب', 'Store a CV copy in the account')}
          value={cvStorageEnabled}
          onValueChange={value => void updateCvStorage(value)}
          disabled={!auth.session || !cvStorageReady || !cloud.ready || savingCvStorage}
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor={colors.surface}
        />
      </View>
      <Text style={[ui.text, en && styles.ltr]}>{cvStorageEnabled
        ? t('تُحفظ نسخة السيرة في حسابك لاستعادتها على أجهزتك. إيقاف الخيار يزيل نسخة الحساب، مع الاحتفاظ بنسخة الجهاز.', 'A CV copy is stored in your account for your devices. Turning this off removes the account copy while keeping the copy on this device.')
        : t('تبقى السيرة على هذا الجهاز فقط. فعّلي الخيار لحفظ نسخة في حسابك واستعادتها على أجهزتك.', 'Your CV stays on this device. Turn this on to store an account copy and restore it on your devices.')}</Text>
      {!auth.session ? <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/account', params: { mode: 'login' } })}>
        <Text style={[ui.link, en && styles.ltr]}>{t('سجّلي الدخول لتفعيل حفظ السيرة في حسابك.', 'Sign in to store a CV copy in your account.')}</Text>
      </Pressable> : null}
      {savingCvStorage ? <Text style={[ui.note, en && styles.ltr]}>{t('جارٍ تحديث تفضيل حفظ السيرة…', 'Updating CV storage preference…')}</Text> : null}
    </View>

    <View style={ui.card}>
      <Text style={[ui.heading, en && styles.ltr]}>{t('تصدير بياناتي', 'Export my data')}</Text>
      <Text style={[ui.text, en && styles.ltr]}>{t('ينشئ ملف JSON لملفك ومهاراتك وخطة التعلم ونتائج المقابلات والوظيفة المحفوظة. يُصدّر ما هو متاح على هذا الجهاز؛ انتظري اكتمال المزامنة إذا كانت بياناتك معلقة. ملف السيرة PDF يُصدّر منفصلًا.', 'Creates a JSON file with your profile, skills, learning plan, interview history, and saved job. It exports what is available on this device; wait for sync if changes are pending. The original CV PDF is exported separately.')}</Text>
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: exporting }} disabled={exporting} style={[ui.button, exporting && ui.pressed]} onPress={() => void exportData()}>
        <Text style={ui.buttonText}>{exporting ? t('جارٍ تجهيز الملف…', 'Preparing file…') : t('تصدير البيانات', 'Export data')}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: exportingCv }} disabled={exportingCv} style={ui.outline} onPress={() => void exportCv()}>
        <Text style={ui.outlineText}>{exportingCv ? t('جارٍ تجهيز السيرة…', 'Preparing CV…') : t('تصدير ملف السيرة PDF', 'Export original CV PDF')}</Text>
      </Pressable>
      {cloud.status === 'pending' || cloud.busy ? <Text style={[ui.note, styles.warning, en && styles.ltr]}>{t('هناك تغييرات لم تكتمل مزامنتها بعد.', 'Some changes have not finished syncing yet.')}</Text> : null}
    </View>

    <View style={ui.card}>
      <Text style={[ui.heading, en && styles.ltr]}>{t('حذف السيرة المحفوظة', 'Delete saved CV')}</Text>
      <Text style={[ui.text, en && styles.ltr]}>{t('يحذف ملف PDF ونتيجته المحفوظة على الجهاز، وتصل إزالة بيانات التحليل إلى حسابك مع المزامنة. تبقى المعلومات التي أضفتِها يدويًا مستقلة.', 'Removes the PDF and its saved review from this device. The review deletion syncs to your account. Information you added manually stays separate.')}</Text>
      {confirmCvDelete ? <>
        <Text style={[styles.confirm, en && styles.ltr]}>{t('تأكيد حذف السيرة ونتيجتها؟ لا يمكن التراجع عن هذا الإجراء.', 'Delete the CV and its review? This cannot be undone.')}</Text>
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: deletingCv }} disabled={deletingCv} style={styles.dangerButton} onPress={() => void removeCv()}>
          <Text style={styles.dangerText}>{deletingCv ? t('جارٍ الحذف…', 'Deleting…') : t('تأكيد حذف السيرة', 'Confirm CV deletion')}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" disabled={deletingCv} onPress={() => setConfirmCvDelete(false)}><Text style={[ui.link, en && styles.ltr]}>{t('إلغاء', 'Cancel')}</Text></Pressable>
      </> : <Pressable accessibilityRole="button" onPress={() => { setError(''); setMessage(''); setConfirmCvDelete(true); }} style={ui.outline}>
        <Text style={ui.outlineText}>{t('حذف السيرة المحفوظة', 'Delete saved CV')}</Text>
      </Pressable>}
    </View>

    <View style={ui.card}>
      <Text style={[ui.heading, en && styles.ltr]}>{t('حسابك وبياناتك', 'Your account and data')}</Text>
      <Text style={[ui.text, en && styles.ltr]}>{t('حذف الحساب يزيل حساب الدخول وبيانات مسارك السحابية وملفات السيرة المخزنة. سيُسجّل خروجك من التطبيق. قد تخضع النسخ الاحتياطية وسجلات مزود الخدمة لفترة الاحتفاظ الخاصة به.', 'Deleting your account removes its sign-in, Masarak cloud data, and stored CV files, then signs you out. Provider backups and service logs may follow their own retention periods.')}</Text>
      {auth.session ? <Pressable accessibilityRole="button" style={styles.dangerButton} onPress={() => router.push('/delete-account' as never)}>
        <Text style={styles.dangerText}>{t('حذف الحساب وبياناته', 'Delete account and data')}</Text>
      </Pressable> : <Pressable accessibilityRole="button" style={ui.outline} onPress={() => router.push({ pathname: '/account', params: { mode: 'login' } })}>
        <Text style={ui.outlineText}>{t('سجّلي الدخول لإدارة حسابك', 'Sign in to manage your account')}</Text>
      </Pressable>}
    </View>

    {error ? <Text accessibilityRole="alert" style={[styles.error, en && styles.ltr]}>{error}</Text> : null}
    {message ? <Text accessibilityRole="status" style={[styles.success, en && styles.ltr]}>{message}</Text> : null}
    <Text style={[ui.note, en && styles.ltr]}>{t('هذا وصف للميزات الحالية، وليس سياسة خصوصية قانونية نهائية.', 'This describes current features and is not a finalized legal privacy policy.')}</Text>
  </ScrollView></SafeAreaView>;
}

const styles = createAdaptiveStyles(() => ({
  ltr: { textAlign: 'left' as const, writingDirection: 'ltr' as const },
  warning: { color: colors.gold },
  confirm: { color: colors.error, fontSize: 14, lineHeight: 22, textAlign: 'right' as const },
  dangerButton: { minHeight: 50, borderWidth: 1, borderColor: colors.error, borderRadius: 14, padding: 14, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: colors.errorSurface },
  dangerText: { color: colors.error, fontSize: 15, fontWeight: '700' as const, textAlign: 'center' as const },
  error: { color: colors.error, fontSize: 14, lineHeight: 22, textAlign: 'right' as const },
  success: { color: colors.primary, fontSize: 14, lineHeight: 22, textAlign: 'right' as const },
}));
