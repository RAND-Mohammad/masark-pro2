import { fetch } from 'expo/fetch';
import { supabase } from './supabase';
import { serverUrl } from './cv-api';
import { isInterviewResult, type InterviewResult } from './interview-types';
import type { InterviewQuestion } from '../data/interview-bank.mjs';
import { captureDataScope } from './scoped-storage';
async function request(path: string, body?: unknown): Promise<unknown> {
  const scope = captureDataScope();
  if (!supabase) throw new Error('تسجيل الدخول غير مهيأ. / Authentication is not configured.');
  const { data, error } = await supabase.auth.getSession();
  scope.assertCurrent();
  if (error || !data.session) throw new Error('سجّل الدخول للتقييم. / Sign in to evaluate.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 35000);
  try {
  const response = await fetch(`${serverUrl()}/interview/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { Authorization: `Bearer ${data.session.access_token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body), signal: controller.signal,
  });
  const result = await response.json();
  if (!response.ok) throw new Error(typeof result?.error === 'string' ? result.error : 'تعذر الاتصال. / Connection failed.');
  return result;
  } finally { clearTimeout(timeout); }
}
export async function getInterviewQuestions(careerId: string, language: 'ar' | 'en'): Promise<{ questions: InterviewQuestion[]; aiConfigured: boolean }> {
  const result = await request(`questions?careerId=${encodeURIComponent(careerId)}&language=${language}`) as { questions?: InterviewQuestion[]; aiConfigured?: boolean; source?: string };
  if (!Array.isArray(result.questions) || result.questions.length > 10 || result.source !== 'curated-practice'
    || typeof result.aiConfigured !== 'boolean' || result.questions.some(item => typeof item.id !== 'string'
      || item.careerId !== careerId || typeof item.prompt !== 'string' || !Array.isArray(item.concepts)
      || item.concepts.some(concept => typeof concept !== 'string'))) throw new Error('نتيجة غير صالحة. / Invalid response.');
  return { questions: result.questions, aiConfigured: result.aiConfigured };
}
export async function evaluateInterviewAnswer(input: { careerId: string; questionId: string; language: 'ar' | 'en'; answer: string; useAi: boolean; consent: boolean }): Promise<InterviewResult> {
  const result = await request('evaluate', input);
  if (!isInterviewResult(result) || result.careerId !== input.careerId || result.questionId !== input.questionId || result.language !== input.language
    || result.answer !== input.answer.trim()) throw new Error('نتيجة غير صالحة. / Invalid response.');
  return result;
}
