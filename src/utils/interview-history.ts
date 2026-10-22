import AsyncStorage, { captureDataScope } from './scoped-storage';
import { parseInterviewHistory, type InterviewResult } from './interview-types';
export const INTERVIEW_HISTORY_KEY = 'masarak-interviews-v1';
export async function readInterviewHistory(): Promise<InterviewResult[]> {
  const raw = await AsyncStorage.getItem(INTERVIEW_HISTORY_KEY);
  return raw === null ? [] : parseInterviewHistory(JSON.parse(raw));
}
let pending: Promise<unknown> = Promise.resolve();
export function saveInterviewResult(result: InterviewResult): Promise<InterviewResult[]> {
  const scope = captureDataScope();
  const operation = pending.then(async () => {
    scope.assertCurrent();
    const current = await readInterviewHistory(); scope.assertCurrent();
    const next = parseInterviewHistory([result, ...current.filter(item => item.id !== result.id)]);
    await AsyncStorage.setItem(INTERVIEW_HISTORY_KEY, JSON.stringify(next));
    scope.assertCurrent(); return next;
  });
  pending = operation.catch(() => undefined); return operation;
}
export function removeInterviewResult(id: string): Promise<InterviewResult[]> {
  const scope = captureDataScope();
  const operation = pending.then(async () => {
    scope.assertCurrent();
    const current = await readInterviewHistory(); scope.assertCurrent();
    const next = current.filter(item => item.id !== id);
    await AsyncStorage.setItem(INTERVIEW_HISTORY_KEY, JSON.stringify(next)); scope.assertCurrent(); return next;
  });
  pending = operation.catch(() => undefined); return operation;
}
