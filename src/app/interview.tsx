import { useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CloudCard } from '../components/cloud-card';
import { colors, ui } from '../constants/design';
import { jobPaths, resolveBaseCareerId, type JobPath } from '../constants/job-paths';
import { useInterview } from '../hooks/use-interview';
import { usePersonalProfile } from '../hooks/use-personal-profile';
import type { InterviewQuestion } from '../data/interview-bank.mjs';
import type { InterviewResult } from '../utils/interview-types';

type Language = 'ar' | 'en';
const validCareer = (value: string | undefined) => {
  const resolved = value ? resolveBaseCareerId(value) : '';
  return /^C0[1-9]$/.test(resolved) ? resolved : '';
};
const familyNames: Record<string, { ar: string; en: string }> = {
  C01: { ar: 'تطوير البرمجيات', en: 'Software development' },
  C02: { ar: 'تحليل البيانات وذكاء الأعمال', en: 'Data analysis & BI' },
  C03: { ar: 'علم البيانات', en: 'Data science' },
  C04: { ar: 'الذكاء الاصطناعي', en: 'Artificial intelligence' },
  C05: { ar: 'الأمن السيبراني', en: 'Cybersecurity' },
  C06: { ar: 'الشبكات', en: 'Networking' },
  C07: { ar: 'قواعد البيانات وهندسة البيانات', en: 'Database & data engineering' },
  C08: { ar: 'تقنية المعلومات والعمليات', en: 'IT & operations' },
  C09: { ar: 'تحليل الأنظمة والأعمال', en: 'Systems & business analysis' },
};
const copy = {
  ar: {
    eyebrow: 'تدريب عملي · خطوة بخطوة', title: 'تدرّب على شرح طريقة تفكيرك',
    intro: 'أسئلة تدريبية منتقاة لمسارات الحوسبة. ليست من بنك مقابلات شركة، ولا تتنبأ بالتوظيف أو تثبت كفاءة.',
    language: 'اللغة', arabic: 'العربية', english: 'English', role: 'اختر المسار الوظيفي',
    search: 'ابحث عن مسمى وظيفي أو تخصص', curated: 'الأسئلة المنتقاة', question: 'اختر سؤالًا للتدرب',
    concepts: 'أفكار قد تساعدك في الإجابة', answer: 'إجابتك', answerPlaceholder: 'اكتب إجابتك بأسلوبك، واذكر مثالًا حقيقيًا أو وضّح إن كان افتراضيًا.',
    characters: 'حرفًا', submit: 'قيّم إجابتي محليًا', submitAi: 'قيّم إجابتي بالذكاء الاصطناعي',
    guest: 'جرّب الأسئلة دون حساب. التقييم وحفظ النتيجة يتطلبان تسجيل الدخول.',
    signIn: 'تسجيل الدخول أو إنشاء حساب', aiTitle: 'تقييم اختياري بمساعدة الذكاء الاصطناعي',
    aiConsent: 'أوافق على إرسال نص إجابتي فقط إلى مزوّد الذكاء الاصطناعي لتقييمها. لن أضمّن بيانات شخصية.',
    aiUnavailable: 'التقييم المتاح حاليًا محلي؛ لم يتم إعداد خدمة الذكاء الاصطناعي لهذا المسار.',
    localNote: 'التقييم المحلي يستخدم إشارات نصية إرشادية، وقد لا يفهم السياق أو الصياغات البديلة.',
    history: 'سجل تدريبي خاص بهذا الجهاز أو الحساب', historyLimit: 'يُحفظ حتى 100 تقييم. عند بلوغ الحد، لا يمكن حفظ تقييم جديد حتى تحذف سجلًا.',
    noHistory: 'لا توجد نتائج بعد. اختر سؤالًا واكتب إجابتك لتبدأ.',
    score: 'النتيجة', rubric: 'معيار الإرشاد', strengths: 'نقاط ظهرت في إجابتك',
    improvements: 'أفكار للتطوير', feedback: 'ملاحظات', local: 'LOCAL · محلي', ai: 'AI · ذكاء اصطناعي',
    delete: 'حذف هذه النتيجة', confirmDelete: 'هل تريد حذف هذا التقييم نهائيًا من السجل؟',
    confirm: 'تأكيد الحذف', cancel: 'إلغاء', remove: 'حذف', back: 'رجوع',
    loading: 'جارٍ تحميل الأسئلة والسجل…', retry: 'إعادة المحاولة', errorTitle: 'تعذر إكمال الطلب',
    noQuestions: 'لا تتوفر أسئلة لهذا المسار الآن.', emptyAnswer: 'اكتب 10 أحرف على الأقل قبل التقييم.',
    longAnswer: 'الحد الأقصى للإجابة 6000 حرف.', selectQuestion: 'اختر سؤالًا أولًا.',
    historyFull: 'وصل السجل إلى 100 نتيجة. احذف نتيجة بعد مراجعتها قبل إجراء تقييم جديد.',
    noConcepts: 'استخدم مثالًا واضحًا، واشرح ما فعلته وما تعلمته.',
    cloud: 'مزامنة اختيارية', modeLocal: 'تقييم محلي', modeAi: 'تقييم بمساعدة AI',
    dateUnknown: 'تاريخ غير متاح', accountPrivacy: 'السجل مفصول حسب وضع الضيف أو الحساب؛ لا يُنقل سجل الضيف إلى الحساب تلقائيًا.',
  },
  en: {
    eyebrow: 'Practice, one step at a time', title: 'Practice explaining how you think',
    intro: 'Curated practice questions for computing paths. They are not a company interview bank, a hiring prediction, or proof of competency.',
    language: 'Language', arabic: 'العربية', english: 'English', role: 'Choose a career path',
    search: 'Search job title or major', curated: 'Curated practice', question: 'Choose a question',
    concepts: 'Ideas that may help your answer', answer: 'Your answer', answerPlaceholder: 'Write in your own words. Use a real example, or say clearly when it is hypothetical.',
    characters: 'characters', submit: 'Evaluate locally', submitAi: 'Evaluate with AI',
    guest: 'Explore questions without an account. Sign in is required to evaluate and save a result.',
    signIn: 'Sign in or create an account', aiTitle: 'Optional AI-assisted evaluation',
    aiConsent: 'I agree to send only my answer text to the AI provider for evaluation. I will not include personal data.',
    aiUnavailable: 'Local evaluation is available; AI service is not configured for this path.',
    localNote: 'Local evaluation uses indicative text signals and may miss context or alternate wording.',
    history: 'Practice history for this device or account', historyLimit: 'Up to 100 evaluations are kept. At the limit, delete a record before another can be saved.',
    noHistory: 'No results yet. Choose a question and write an answer to begin.',
    score: 'Score', rubric: 'Practice rubric', strengths: 'Signals in your answer',
    improvements: 'Ideas to develop', feedback: 'Feedback', local: 'LOCAL', ai: 'AI',
    delete: 'Delete this result', confirmDelete: 'Permanently remove this evaluation from history?',
    confirm: 'Confirm delete', cancel: 'Cancel', remove: 'Delete', back: 'Back',
    loading: 'Loading questions and history…', retry: 'Try again', errorTitle: 'Could not complete request',
    noQuestions: 'No questions are available for this path right now.', emptyAnswer: 'Write at least 10 characters before evaluation.',
    longAnswer: 'Answers are limited to 6000 characters.', selectQuestion: 'Choose a question first.',
    historyFull: 'History has reached 100 results. Review and delete one before another evaluation.',
    noConcepts: 'Use a clear example, explain what you did, and share what you learned.',
    cloud: 'Optional sync', modeLocal: 'Local evaluation', modeAi: 'AI-assisted evaluation',
    dateUnknown: 'Date unavailable', accountPrivacy: 'History is isolated between guest and account scopes; guest history is not copied into an account automatically.',
  },
} as const;

function initialPathId(routeCareer: string, goal: string | null | undefined) {
  const routePath = jobPaths.find(path => path.id === routeCareer);
  if (routePath) return routePath.id;
  const routeBase = validCareer(routeCareer);
  if (routeBase) return jobPaths.find(path => path.baseCareerId === routeBase)?.id ?? jobPaths[0].id;
  const goalPath = jobPaths.find(path => path.id === goal);
  if (goalPath) return goalPath.id;
  const goalBase = validCareer(goal ?? undefined);
  return jobPaths.find(path => path.baseCareerId === goalBase)?.id ?? jobPaths[0].id;
}

export default function InterviewScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ careerId?: string | string[]; id?: string | string[]; language?: string }>();
  const routeParam = Array.isArray(params.careerId) ? params.careerId[0] : params.careerId
    ?? (Array.isArray(params.id) ? params.id[0] : params.id) ?? '';
  const profileState = usePersonalProfile();
  const [language, setLanguage] = useState<Language>(params.language === 'en' ? 'en' : 'ar');
  const [selectedPathOverride, setSelectedPathOverride] = useState(() => initialPathId(routeParam, null));
  const [touchedRole, setTouchedRole] = useState(false);
  const [rolePickerOpen, setRolePickerOpen] = useState(false);
  const [roleSearch, setRoleSearch] = useState('');
  const [draft, setDraft] = useState({ key: '', questionId: '', answer: '', aiConsent: false });
  const [selectedHistory, setSelectedHistory] = useState<InterviewResult | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState('');
  const selectedPathId = !touchedRole && profileState.ready
    ? initialPathId(routeParam, profileState.personal?.careerGoal)
    : selectedPathOverride;
  const path = jobPaths.find(item => item.id === selectedPathId) ?? jobPaths[0];
  const careerId = resolveBaseCareerId(path.id);
  const t = copy[language];
  const interview = useInterview(careerId, language);
  const textAlign = language === 'ar' ? 'right' : 'left';
  const rowDirection = language === 'ar' ? 'row-reverse' : 'row';
  const contextKey = `${careerId}:${language}`;
  const currentDraft = draft.key === contextKey ? draft : { key: contextKey, questionId: '', answer: '', aiConsent: false };
  const answer = currentDraft.answer;
  const aiConsent = currentDraft.aiConsent;
  const updateDraft = (changes: Partial<typeof currentDraft>) => setDraft(previous => ({
    ...(previous.key === contextKey ? previous : { questionId: '', answer: '', aiConsent: false }),
    ...changes,
    key: contextKey,
  }));

  const visiblePaths = useMemo(() => {
    const query = roleSearch.trim().toLocaleLowerCase();
    if (!query) return jobPaths;
    return jobPaths.filter(item => `${item.title} ${item.majors.join(' ')}`.toLocaleLowerCase().includes(query));
  }, [roleSearch]);
  const questions = interview.questions;
  const selectedQuestion = questions.find(item => item.id === currentDraft.questionId) ?? questions[0];
  const activeResult = interview.result?.careerId === careerId && interview.result.language === language
    && interview.result.questionId === selectedQuestion?.id && interview.result.answer === answer.trim() ? interview.result : null;
  const canSubmit = interview.signedIn && !!selectedQuestion && answer.trim().length >= 10 && answer.length <= 6000 && interview.history.length < 100 && !interview.busy;

  function choosePath(item: JobPath) {
    if (interview.busy) return;
    setTouchedRole(true);
    setSelectedPathOverride(item.id);
    setRolePickerOpen(false);
    setRoleSearch('');
    setSelectedHistory(null);
    setConfirmDeleteId('');
  }

  function selectLanguage(next: Language) {
    if (!interview.busy && language !== next) {
      setLanguage(next);
      setSelectedHistory(null);
      setConfirmDeleteId('');
    }
  }

  function openSignIn() {
    router.push({ pathname: '/account', params: { mode: 'login' } });
  }

  function retry() {
    router.replace({ pathname: '/interview', params: { careerId, language } });
  }

  async function submitAnswer() {
    if (interview.busy) return;
    if (!selectedQuestion) return;
    if (answer.trim().length < 10) return;
    if (answer.length > 6000) return;
    const useAi = interview.aiConfigured && aiConsent;
    await interview.submit(selectedQuestion.id, answer.trim(), useAi, useAi);
    setSelectedHistory(null);
  }

  async function confirmRemove(id: string) {
    if (interview.busy) return;
    await interview.remove(id);
    setConfirmDeleteId('');
    setSelectedHistory(null);
  }

  function questionLabel(question: InterviewQuestion) {
    return question.prompt;
  }

  function rubricConcepts(question: InterviewQuestion) {
    return question.concepts.length ? question.concepts : [];
  }

  function renderResult(result: InterviewResult, historical = false) {
    return <View style={styles.resultCard}>
      <View style={[styles.resultTop, { flexDirection: rowDirection }]}>
        <View style={[styles.modeBadge, result.mode === 'ai' ? styles.aiBadge : styles.localBadge]}>
          <Text style={styles.modeText}>{result.mode === 'ai' ? t.ai : t.local}</Text>
        </View>
        <Text style={[styles.resultQuestion, { textAlign }]}>{result.question}</Text>
      </View>
      <View style={[styles.scoreLine, { flexDirection: rowDirection }]}>
        <Text style={[styles.scoreLabel, { textAlign }]}>{t.score}</Text>
        <Text style={styles.score}>{result.score}<Text style={styles.scoreUnit}> / 100</Text></Text>
      </View>
      <Text style={[styles.sectionLabel, { textAlign }]}>{t.feedback}</Text>
      <Text style={[styles.body, { textAlign }]}>{result.feedback}</Text>
      <Text style={[styles.sectionLabel, { textAlign }]}>{t.answer}</Text>
      <Text style={[styles.body, { textAlign }]}>{result.answer}</Text>
      <Text style={[styles.sectionLabel, { textAlign }]}>{t.strengths}</Text>
      {result.strengths.length ? result.strengths.map((item, index) => <Text key={`s-${index}`} style={[styles.listItem, { textAlign }]}>• {item}</Text>) : <Text style={[styles.note, { textAlign }]}>{t.noConcepts}</Text>}
      <Text style={[styles.sectionLabel, { textAlign }]}>{t.improvements}</Text>
      {result.improvements.length ? result.improvements.map((item, index) => <Text key={`i-${index}`} style={[styles.listItem, { textAlign }]}>• {item}</Text>) : <Text style={[styles.note, { textAlign }]}>{t.noConcepts}</Text>}
      {historical && <Text style={[styles.note, { textAlign }]}>{new Date(result.createdAt).toLocaleString(language === 'ar' ? 'ar-SA' : 'en-US')}</Text>}
      <Text style={[styles.disclaimer, { textAlign }]}>{t.intro}</Text>
    </View>;
  }

  function renderHistoryItem(item: InterviewResult) {
    const opened = selectedHistory?.id === item.id;
    const pendingDelete = confirmDeleteId === item.id;
    return <View key={item.id} style={styles.historyItem}>
      <Pressable accessibilityRole="button" accessibilityState={{ selected: opened }} onPress={() => { setSelectedHistory(opened ? null : item); setConfirmDeleteId(''); }} style={({ pressed }) => [styles.historyButton, pressed && ui.pressed]}>
        <View style={[styles.historyMeta, { flexDirection: rowDirection }]}>
          <Text style={[styles.modeSmall, item.mode === 'ai' ? styles.aiText : styles.localText]}>{item.mode === 'ai' ? t.ai : t.local}</Text>
          <Text style={styles.historyScore}>{item.score}/100</Text>
        </View>
        <Text numberOfLines={2} style={[styles.historyQuestion, { textAlign }]}>{item.question}</Text>
        <Text style={[styles.note, { textAlign }]}>{new Date(item.createdAt).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US')}</Text>
      </Pressable>
      {opened && <>
        {renderResult(item, true)}
        {pendingDelete ? <View style={styles.confirmBox}>
          <Text style={[styles.body, { textAlign }]}>{t.confirmDelete}</Text>
          <View style={[styles.actionRow, { flexDirection: rowDirection }]}>
            <Pressable accessibilityRole="button" disabled={interview.busy} onPress={() => void confirmRemove(item.id)} style={[ui.button, styles.smallAction, interview.busy && ui.pressed]}><Text style={ui.buttonText}>{interview.busy ? '…' : t.confirm}</Text></Pressable>
            <Pressable accessibilityRole="button" disabled={interview.busy} onPress={() => setConfirmDeleteId('')} style={[ui.outline, styles.smallAction]}><Text style={ui.outlineText}>{t.cancel}</Text></Pressable>
          </View>
        </View> : <Pressable accessibilityRole="button" disabled={interview.busy} onPress={() => setConfirmDeleteId(item.id)} style={styles.deleteButton}><Text style={[styles.deleteText, { textAlign }]}>{t.delete}</Text></Pressable>}
      </>}
    </View>;
  }

  return <SafeAreaView edges={['top', 'left', 'right']} style={ui.screen}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={ui.content}>
      <View style={[styles.topline, { flexDirection: rowDirection }]}>
        <Pressable accessibilityRole="button" disabled={interview.busy} onPress={() => router.canGoBack() ? router.back() : router.replace('/home')} style={styles.back}><Text style={[styles.backText, { textAlign }]}>{t.back}</Text></Pressable>
        <View style={[styles.languageSwitch, { flexDirection: rowDirection }]}>
          {(['ar', 'en'] as const).map(option => <Pressable key={option} accessibilityRole="button" accessibilityState={{ selected: language === option, disabled: interview.busy }} disabled={interview.busy} onPress={() => selectLanguage(option)} style={[styles.languageButton, language === option && styles.languageActive]}><Text style={[styles.languageText, language === option && styles.languageTextActive]}>{option === 'ar' ? t.arabic : t.english}</Text></Pressable>)}
        </View>
      </View>
      <View style={styles.hero}>
        <Text style={[ui.eyebrow, { textAlign }]}>{t.eyebrow}</Text>
        <Text style={[ui.title, { textAlign }]}>{t.title}</Text>
        <Text style={[ui.text, { textAlign }]}>{t.intro}</Text>
      </View>
      <View style={styles.privacyNote}><Text style={[styles.privacyText, { textAlign }]}>{t.accountPrivacy}</Text></View>

      <View style={ui.card}>
        <Text style={[ui.heading, { textAlign }]}>{t.role}</Text>
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: rolePickerOpen, disabled: interview.busy }} disabled={interview.busy} onPress={() => setRolePickerOpen(value => !value)} style={[styles.selectedPath, { flexDirection: rowDirection }]}>
          <View style={styles.pathBadge}><Text style={styles.pathBadgeText}>{careerId}</Text></View>
          <View style={styles.pathCopy}><Text style={[styles.pathTitle, { textAlign }]}>{path.title}</Text><Text style={[styles.note, { textAlign }]}>{path.majors.slice(0, 2).join(' · ')}</Text></View>
          <Text style={styles.chevron}>{rolePickerOpen ? '−' : '+'}</Text>
        </Pressable>
        {rolePickerOpen && <>
          <TextInput accessibilityLabel={t.search} value={roleSearch} onChangeText={setRoleSearch} placeholder={t.search} placeholderTextColor={colors.muted} style={[ui.input, { textAlign }]} editable={!interview.busy} />
          <ScrollView style={styles.pathList} keyboardShouldPersistTaps="handled">
            {visiblePaths.length ? visiblePaths.map(item => {
              const selected = item.id === path.id;
              return <Pressable key={item.id} accessibilityRole="button" accessibilityState={{ selected, disabled: interview.busy }} disabled={interview.busy} onPress={() => choosePath(item)} style={[styles.pathOption, selected && styles.pathOptionSelected, { flexDirection: rowDirection }]}>
                <View style={styles.pathOptionText}><Text style={[styles.pathTitle, { textAlign }]}>{item.title}</Text><Text style={[styles.note, { textAlign }]}>{familyNames[item.baseCareerId]?.[language] ?? item.baseCareerId} · {item.majors[0]}</Text></View>
                {selected && <Text style={styles.selectedMark}>✓</Text>}
              </Pressable>;
            }) : <Text style={[styles.note, { textAlign }]}>{language === 'ar' ? 'لا توجد نتائج مطابقة.' : 'No matching paths.'}</Text>}
          </ScrollView>
        </>}
        <View style={styles.pathSummary}><Text style={[styles.note, { textAlign }]}>{familyNames[careerId]?.[language]} · {language === 'ar' ? 'تدريب من أسئلة منتقاة' : 'curated question practice'}</Text></View>
      </View>

      <View style={styles.sectionIntro}>
        <Text style={[ui.heading, { textAlign }]}>{t.curated}</Text>
        <Text style={[ui.note, { textAlign }]}>{language === 'ar' ? 'تمرين تعليمي عام، وليس أسئلة شركة بعينها.' : 'General learning practice, not questions from a specific employer.'}</Text>
      </View>
      {interview.loading ? <View style={ui.card}><View style={styles.skeletonWide} /><View style={styles.skeletonShort} /><View style={styles.skeletonWide} /></View> : questions.length === 0 ? <View style={ui.card}><Text style={[ui.text, { textAlign }]}>{t.noQuestions}</Text></View> : <View style={styles.questionList}>
        {questions.map(question => {
          const active = selectedQuestion?.id === question.id;
          return <Pressable key={question.id} accessibilityRole="button" accessibilityState={{ selected: active, disabled: interview.busy }} disabled={interview.busy} onPress={() => { if (!active) updateDraft({ questionId: question.id, answer: '', aiConsent: false }); setSelectedHistory(null); }} style={({ pressed }) => [styles.questionCard, active && styles.questionActive, pressed && ui.pressed]}>
            <View style={[styles.questionHeader, { flexDirection: rowDirection }]}><Text style={styles.questionNumber}>{question.id.split('-').slice(-1)[0].toUpperCase()}</Text><Text style={[styles.questionPrompt, { textAlign }]}>{questionLabel(question)}</Text></View>
            {active && <><Text style={[styles.conceptLabel, { textAlign }]}>{t.concepts}</Text><View style={[styles.concepts, { flexDirection: rowDirection }]}>{rubricConcepts(question).map((concept, index) => <View key={`${concept}-${index}`} style={styles.conceptPill}><Text style={styles.conceptText}>{concept}</Text></View>)}</View></>}
          </Pressable>;
        })}
      </View>}

      {selectedQuestion && <View style={ui.card}>
        <Text style={[ui.heading, { textAlign }]}>{t.answer}</Text>
        <Text style={[ui.text, { textAlign }]}>{questionLabel(selectedQuestion)}</Text>
        <TextInput accessibilityLabel={t.answer} accessibilityHint={language === 'ar' ? 'من 10 إلى 6000 حرف' : '10 to 6000 characters'} multiline value={answer} onChangeText={value => updateDraft({ answer: value })} editable={!interview.busy} maxLength={6001} placeholder={t.answerPlaceholder} placeholderTextColor={colors.muted} style={[styles.answerInput, { textAlign, writingDirection: language === 'ar' ? 'rtl' : 'ltr' }]} />
        <Text style={[styles.counter, { textAlign }]}>{answer.trim().length} / 6000 {t.characters}</Text>
        {!interview.signedIn && <View style={styles.guestNotice}><Text style={[styles.body, { textAlign }]}>{t.guest}</Text><Pressable accessibilityRole="button" onPress={openSignIn} style={ui.outline}><Text style={ui.outlineText}>{t.signIn}</Text></Pressable></View>}
        {interview.signedIn && interview.aiConfigured && <View style={styles.aiOptIn}>
          <Text style={[styles.sectionLabel, { textAlign }]}>{t.aiTitle}</Text>
          <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: aiConsent, disabled: interview.busy }} disabled={interview.busy} onPress={() => updateDraft({ aiConsent: !aiConsent })} style={[styles.consentRow, { flexDirection: rowDirection }]}>
            <View style={[styles.checkbox, aiConsent && styles.checkboxSelected]}><Text style={styles.checkboxMark}>{aiConsent ? '✓' : ''}</Text></View><Text style={[styles.body, { textAlign, flex: 1 }]}>{t.aiConsent}</Text>
          </Pressable>
        </View>}
        {interview.signedIn && !interview.aiConfigured && <Text style={[styles.note, { textAlign }]}>{t.aiUnavailable}</Text>}
        <Text style={[styles.note, { textAlign }]}>{t.localNote}</Text>
        {interview.signedIn && answer.trim().length > 0 && answer.trim().length < 10 && <Text style={[styles.validation, { textAlign }]}>{t.emptyAnswer}</Text>}
        {answer.length > 6000 && <Text style={[styles.validation, { textAlign }]}>{t.longAnswer}</Text>}
        {interview.signedIn && interview.history.length >= 100 && <Text style={[styles.validation, { textAlign }]}>{t.historyFull}</Text>}
        {!selectedQuestion && <Text style={[styles.validation, { textAlign }]}>{t.selectQuestion}</Text>}
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: !canSubmit }} disabled={!canSubmit} onPress={() => void submitAnswer()} style={[ui.button, !canSubmit && styles.disabledButton]}>
          <Text style={ui.buttonText}>{interview.busy ? '…' : aiConsent && interview.aiConfigured ? t.submitAi : t.submit}</Text>
        </Pressable>
      </View>}

      {interview.error ? <View style={styles.errorBox}><Text style={[styles.errorTitle, { textAlign }]}>{t.errorTitle}</Text><Text accessibilityRole="alert" style={[styles.errorText, { textAlign }]}>{interview.error}</Text><Pressable accessibilityRole="button" disabled={interview.busy} onPress={retry} style={ui.outline}><Text style={ui.outlineText}>{t.retry}</Text></Pressable></View> : null}
      {activeResult && <View><Text style={[ui.heading, { textAlign }]}>{language === 'ar' ? 'نتيجتك' : 'Your result'}</Text>{renderResult(activeResult)}</View>}

      <View style={styles.sectionIntro}>
        <Text style={[ui.heading, { textAlign }]}>{t.history}</Text>
        <Text style={[ui.note, { textAlign }]}>{t.historyLimit}</Text>
      </View>
      {interview.loading ? <View style={ui.card}><View style={styles.skeletonWide} /><View style={styles.skeletonShort} /></View> : interview.history.length === 0 ? <View style={styles.emptyHistory}><Text style={[styles.emptyMark]}>—</Text><Text style={[ui.text, { textAlign }]}>{t.noHistory}</Text></View> : <View style={styles.historyList}>{interview.history.slice(0, 100).map(renderHistoryItem)}</View>}
      <CloudCard language={language} />
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  topline: { alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  back: { paddingVertical: 8, paddingHorizontal: 10 },
  backText: { color: colors.primary, fontSize: 14, fontWeight: '600' },
  languageSwitch: { backgroundColor: colors.mint, borderRadius: 14, padding: 4, gap: 4 },
  languageButton: { paddingHorizontal: 11, paddingVertical: 8, borderRadius: 11 },
  languageActive: { backgroundColor: colors.surface },
  languageText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  languageTextActive: { color: colors.primary },
  hero: { gap: 7, paddingTop: 7 },
  privacyNote: { backgroundColor: '#EEF2E7', borderRadius: 15, paddingHorizontal: 14, paddingVertical: 12 },
  privacyText: { color: colors.muted, fontSize: 12, lineHeight: 19 },
  selectedPath: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.soft, padding: 13, borderRadius: 15, alignItems: 'center', gap: 11 },
  pathBadge: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.mint },
  pathBadgeText: { color: colors.primary, fontWeight: '700', fontSize: 12 },
  pathCopy: { flex: 1, gap: 4 },
  pathTitle: { color: colors.ink, fontSize: 15, fontWeight: '600' },
  chevron: { color: colors.primary, fontSize: 22, fontWeight: '600', paddingHorizontal: 5 },
  pathList: { maxHeight: 290, borderWidth: 1, borderColor: colors.border, borderRadius: 14, overflow: 'hidden' },
  pathOption: { alignItems: 'center', gap: 8, padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface },
  pathOptionSelected: { backgroundColor: colors.mint },
  pathOptionText: { flex: 1, gap: 3 },
  selectedMark: { color: colors.primary, fontWeight: '700' },
  pathSummary: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 },
  sectionIntro: { gap: 4 },
  questionList: { gap: 10 },
  questionCard: { borderRadius: 18, padding: 16, gap: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  questionActive: { borderColor: colors.primary, backgroundColor: '#F1F6F1' },
  questionHeader: { alignItems: 'flex-start', gap: 11 },
  questionNumber: { minWidth: 29, height: 29, paddingHorizontal: 5, borderRadius: 10, overflow: 'hidden', textAlign: 'center', textAlignVertical: 'center', backgroundColor: colors.mint, color: colors.primary, fontSize: 10, fontWeight: '700', lineHeight: 29 },
  questionPrompt: { flex: 1, color: colors.ink, fontSize: 15, lineHeight: 24, fontWeight: '600' },
  conceptLabel: { color: colors.muted, fontSize: 12, fontWeight: '600', marginTop: 2 },
  concepts: { flexWrap: 'wrap', gap: 7 },
  conceptPill: { borderRadius: 10, backgroundColor: colors.mint, paddingHorizontal: 10, paddingVertical: 6 },
  conceptText: { color: colors.primary, fontSize: 12, fontWeight: '600' },
  answerInput: { minHeight: 155, maxHeight: 280, textAlignVertical: 'top', color: colors.ink, backgroundColor: colors.soft, borderColor: colors.border, borderWidth: 1, borderRadius: 15, padding: 14, fontSize: 15, lineHeight: 24 },
  counter: { fontSize: 11, color: colors.muted, marginTop: -8 },
  guestNotice: { gap: 6, padding: 13, backgroundColor: colors.mint, borderRadius: 15 },
  body: { color: colors.muted, fontSize: 14, lineHeight: 22 },
  aiOptIn: { gap: 9, borderWidth: 1, borderColor: colors.border, borderRadius: 15, padding: 13, backgroundColor: '#F7F4EB' },
  consentRow: { alignItems: 'flex-start', gap: 10 },
  checkbox: { width: 23, height: 23, borderRadius: 7, borderColor: colors.border, borderWidth: 1, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  checkboxSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkboxMark: { color: colors.surface, fontSize: 14, fontWeight: '700' },
  note: { color: colors.muted, fontSize: 12, lineHeight: 20 },
  validation: { color: colors.error, fontSize: 12, lineHeight: 18 },
  disabledButton: { opacity: 0.48 },
  errorBox: { backgroundColor: '#F8ECE9', borderColor: '#E9C7C0', borderWidth: 1, borderRadius: 17, padding: 16, gap: 9 },
  errorTitle: { color: colors.error, fontSize: 15, fontWeight: '700' },
  errorText: { color: colors.error, fontSize: 13, lineHeight: 21 },
  resultCard: { backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: colors.border, padding: 17, gap: 11 },
  resultTop: { alignItems: 'flex-start', gap: 9 },
  resultQuestion: { color: colors.ink, flex: 1, fontSize: 14, lineHeight: 22, fontWeight: '600' },
  modeBadge: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8 },
  localBadge: { backgroundColor: colors.mint },
  aiBadge: { backgroundColor: '#F3EBD5' },
  modeText: { fontSize: 10, color: colors.ink, fontWeight: '700', letterSpacing: 0.6 },
  scoreLine: { alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderColor: colors.border, paddingTop: 11 },
  scoreLabel: { color: colors.muted, fontSize: 13 },
  score: { color: colors.primary, fontSize: 26, fontWeight: '700' },
  scoreUnit: { color: colors.muted, fontSize: 12, fontWeight: '500' },
  sectionLabel: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  listItem: { color: colors.muted, fontSize: 13, lineHeight: 21 },
  disclaimer: { color: colors.muted, fontSize: 11, lineHeight: 18, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 9 },
  historyList: { gap: 10 },
  historyItem: { borderWidth: 1, borderColor: colors.border, borderRadius: 17, backgroundColor: colors.surface, overflow: 'hidden' },
  historyButton: { padding: 14, gap: 7 },
  historyMeta: { alignItems: 'center', justifyContent: 'space-between' },
  modeSmall: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  aiText: { color: '#826B30' },
  localText: { color: colors.primary },
  historyScore: { color: colors.primary, fontWeight: '700', fontSize: 15 },
  historyQuestion: { color: colors.ink, fontSize: 14, lineHeight: 22 },
  confirmBox: { backgroundColor: '#F8ECE9', padding: 14, gap: 12, borderTopWidth: 1, borderTopColor: '#E9C7C0' },
  actionRow: { gap: 9 },
  smallAction: { flex: 1 },
  deleteButton: { paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border },
  deleteText: { color: colors.error, fontSize: 13, fontWeight: '600' },
  emptyHistory: { backgroundColor: colors.mint, borderRadius: 18, padding: 20, alignItems: 'center', gap: 6 },
  emptyMark: { color: colors.gold, fontWeight: '700', fontSize: 26 },
  skeletonWide: { height: 18, width: '88%', borderRadius: 8, backgroundColor: colors.soft },
  skeletonShort: { height: 13, width: '55%', borderRadius: 7, backgroundColor: colors.soft },
});
