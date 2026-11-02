import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, createAdaptiveStyles, ui } from '../constants/design';
import { useAppPreferences } from '../contexts/app-preferences-context';
import { useAuth } from '../contexts/auth-context';
import { useCloud } from '../contexts/cloud-context';
import { AccountDeletionError, requestAccountDeletion } from '../utils/account-api';
import { clearAccountLocalData } from '../utils/account-local-data';

export default function DeleteAccountScreen() {
  const router = useRouter();
  const auth = useAuth();
  const cloud = useCloud();
  const { language } = useAppPreferences();
  const en = language === 'en';
  const t = (ar: string, english: string) => en ? english : ar;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [finished, setFinished] = useState(false);
  const [cleanupWarning, setCleanupWarning] = useState('');
  const [deletionStarted, setDeletionStarted] = useState(false);

  function goBack() {
    cloud.resumeAfterDeletion();
    if (router.canGoBack()) router.back();
    else router.replace('/privacy');
  }

  async function erase() {
    const userId = auth.session?.user.id;
    if (!userId || busy) return;
    setBusy(true); setError('');
    await cloud.holdForDeletion();
    try {
      await requestAccountDeletion();
    } catch (failure) {
      const started = failure instanceof AccountDeletionError ? failure.deletionStarted : true;
      setDeletionStarted(started);
      if (!started) cloud.resumeAfterDeletion();
      setError(failure instanceof Error ? failure.message : t('تعذر حذف الحساب. حاولي مرة أخرى.', 'Could not delete your account. Try again.'));
      setBusy(false);
      return;
    }

    let localDataRemoved = true;
    try { await clearAccountLocalData(userId); }
    catch { localDataRemoved = false; }
    const sessionRemoved = await auth.finishAccountDeletion();
    if (!localDataRemoved || !sessionRemoved) {
      setCleanupWarning(t('حُذف الحساب من الخادم، لكن تعذر تنظيف بعض البيانات المحلية. أغلقي التطبيق وأعيدي فتحه، ثم تحققي من بيانات هذا الجهاز.', 'The account was deleted from the server, but some local cleanup could not be confirmed. Close and reopen the app, then check data on this device.'));
    }
    setFinished(true);
    setBusy(false);
  }

  return <SafeAreaView style={ui.screen}><ScrollView contentContainerStyle={ui.content}>
    {!finished ? <>
      <Pressable accessibilityRole="button" disabled={busy || deletionStarted} onPress={goBack}><Text style={[ui.link, en && styles.ltr]}>{t('رجوع', 'Back')}</Text></Pressable>
      <View style={styles.warningIcon}><Text style={styles.warningMark}>!</Text></View>
      <Text style={[ui.title, en && styles.ltr]}>{t('حذف الحساب وبياناته', 'Delete account and data')}</Text>
      <Text style={[ui.text, en && styles.ltr]}>{t('سيُحذف حساب الدخول وبيانات مسارك السحابية وملفات السيرة الخاصة بهذا الحساب. سيُسجّل خروجك، ولن تتمكني من استعادة الحساب.', 'This permanently deletes your sign-in, Masarak cloud data, and private CV files for this account. You will be signed out and cannot restore the account.')}</Text>
      <View style={styles.notice}>
        <Text style={[styles.noticeTitle, en && styles.ltr]}>{t('قبل التأكيد', 'Before you continue')}</Text>
        <Text style={[ui.text, en && styles.ltr]}>{t('صدّري نسخة من بياناتك أولًا إذا كنتِ تريدين الاحتفاظ بها. حذف ملف السيرة وحده لا يحذف الحساب. قد تخضع النسخ الاحتياطية وسجلات مزود الخدمة لفترة الاحتفاظ الخاصة به.', 'Export your data first if you want to keep a copy. Deleting a CV alone does not delete your account. Provider backups and service logs may follow their own retention periods.')}</Text>
      </View>
      {error ? <Text accessibilityRole="alert" style={[styles.error, en && styles.ltr]}>{error}</Text> : null}
      {deletionStarted ? <Text style={[styles.locked, en && styles.ltr]}>{t('بدأ الحذف وأوقفنا المزامنة لحماية بياناتك. أعيدي المحاولة لإكمال إزالة الحساب.', 'Deletion has started and sync is paused to protect your data. Retry to finish removing the account.')}</Text> : null}
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy }} disabled={busy || !auth.session} onPress={() => void erase()} style={[styles.dangerButton, busy && ui.pressed]}>
        <Text style={styles.dangerText}>{busy ? t('جارٍ حذف الحساب…', 'Deleting account…') : deletionStarted ? t('إعادة محاولة إكمال الحذف', 'Retry account deletion') : t('حذف الحساب نهائيًا', 'Permanently delete account')}</Text>
      </Pressable>
      {!deletionStarted ? <Pressable accessibilityRole="button" disabled={busy} onPress={goBack} style={ui.outline}>
        <Text style={ui.outlineText}>{t('الاحتفاظ بحسابي', 'Keep my account')}</Text>
      </Pressable> : null}
    </> : <View style={styles.finished}>
      <View style={styles.successIcon}><Text style={styles.successMark}>✓</Text></View>
      <Text style={[ui.title, en && styles.ltr]}>{t('تم حذف الحساب', 'Account deleted')}</Text>
      <Text style={[ui.text, en && styles.ltr]}>{t('حُذف حسابك وبيانات مسارك السحابية. يمكنك الآن متابعة استخدام مسارك كضيف.', 'Your account and Masarak cloud data have been deleted. You can continue using Masarak as a guest.')}</Text>
      {cleanupWarning ? <Text accessibilityRole="alert" style={[styles.error, en && styles.ltr]}>{cleanupWarning}</Text> : null}
      <Pressable accessibilityRole="button" style={ui.button} onPress={() => router.replace('/')}><Text style={ui.buttonText}>{t('متابعة', 'Continue')}</Text></Pressable>
    </View>}
  </ScrollView></SafeAreaView>;
}

const styles = createAdaptiveStyles(() => ({
  ltr: { textAlign: 'left' as const, writingDirection: 'ltr' as const },
  warningIcon: { width: 54, height: 54, borderRadius: 27, borderWidth: 2, borderColor: colors.error, alignItems: 'center' as const, justifyContent: 'center' as const, alignSelf: 'flex-end' as const, backgroundColor: colors.errorSurface },
  warningMark: { color: colors.error, fontSize: 30, lineHeight: 36, fontWeight: '700' as const },
  notice: { padding: 18, gap: 10, borderRadius: 18, borderWidth: 1, borderColor: colors.warningBorder, backgroundColor: colors.warningSurface },
  noticeTitle: { color: colors.ink, fontSize: 17, fontWeight: '700' as const, textAlign: 'right' as const },
  error: { color: colors.error, fontSize: 14, lineHeight: 22, textAlign: 'right' as const },
  locked: { color: colors.gold, fontSize: 14, lineHeight: 22, textAlign: 'right' as const },
  dangerButton: { minHeight: 54, borderRadius: 15, padding: 16, alignItems: 'center' as const, justifyContent: 'center' as const, borderWidth: 1, borderColor: colors.error, backgroundColor: colors.errorSurface },
  dangerText: { color: colors.error, fontSize: 16, fontWeight: '700' as const, textAlign: 'center' as const },
  finished: { gap: 20, paddingTop: 100 },
  successIcon: { width: 62, height: 62, borderRadius: 31, backgroundColor: colors.successSurface, alignItems: 'center' as const, justifyContent: 'center' as const, alignSelf: 'center' as const },
  successMark: { color: colors.primary, fontSize: 32, fontWeight: '700' as const },
}));
