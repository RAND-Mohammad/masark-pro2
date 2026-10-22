import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../contexts/auth-context';
import { interviewQuestions } from '../data/interview-bank.mjs';
import type { InterviewResult } from '../utils/interview-types';
import { getInterviewQuestions, evaluateInterviewAnswer } from '../utils/interview-api';
import { readInterviewHistory, saveInterviewResult, removeInterviewResult } from '../utils/interview-history';
import { captureDataScope } from '../utils/scoped-storage';

export function useInterview(careerId: string, language: 'ar' | 'en') {
  const { session } = useAuth();
  const [questions, setQuestions] = useState(() => interviewQuestions(careerId, language));
  const [history, setHistory] = useState<InterviewResult[]>([]);
  const [result, setResult] = useState<InterviewResult | null>(null);
  const [aiConfigured, setAiConfigured] = useState(false);
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const active = useRef(false); const locked = useRef(false);
  useFocusEffect(useCallback(() => {
    active.current = true; const scope = captureDataScope();
    let current = true;
    setLoading(true); setError(''); setResult(null); setAiConfigured(false); setQuestions(interviewQuestions(careerId, language));
    void (async () => {
      try {
        const saved = await readInterviewHistory(); scope.assertCurrent();
        if (current) setHistory(saved);
        if (session) {
          const available = await getInterviewQuestions(careerId, language); scope.assertCurrent();
          if (current) { setQuestions(available.questions); setAiConfigured(available.aiConfigured); }
        }
      } catch { if (current) setError('تعذر تحميل السجل أو الاتصال بالخادم. الأسئلة المعروضة محلية؛ أعد فتح الصفحة للمحاولة. / History or server unavailable. Questions are a local preview; reopen to retry.'); }
      finally { if (current) setLoading(false); }
    })();
    return () => { current = false; active.current = false; };
  }, [careerId, language, session]));
  async function submit(questionId: string, answer: string, useAi: boolean, consent: boolean) {
    if (locked.current) return;
    const scope = captureDataScope();
    locked.current = true; setBusy(true); setError('');
    try {
      const evaluated = await evaluateInterviewAnswer({ careerId, questionId, language, answer, useAi, consent }); scope.assertCurrent();
      const saved = await saveInterviewResult(evaluated); scope.assertCurrent();
      if (active.current) { setResult(evaluated); setHistory(saved); }
    } catch (failure) { if (active.current) setError(failure instanceof Error ? failure.message : 'تعذر التقييم أو الحفظ. / Evaluation or save failed.'); }
    finally { locked.current = false; if (active.current) setBusy(false); }
  }
  async function remove(id: string) {
    if (locked.current) return;
    const scope = captureDataScope(); locked.current = true; setBusy(true);
    try {
      const saved = await removeInterviewResult(id); scope.assertCurrent();
      if (active.current) { setHistory(saved); if (result?.id === id) setResult(null); setError(''); }
    } catch { if (active.current) setError('تعذر حذف النتيجة. / Could not remove result.'); }
    finally { locked.current = false; if (active.current) setBusy(false); }
  }
  return { questions, history, result, aiConfigured, loading, busy, error, signedIn: !!session, submit, remove };
}
