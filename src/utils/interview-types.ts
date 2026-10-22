export type InterviewResult = {
  id: string; careerId: string; questionId: string; question: string; answer: string;
  language: 'ar' | 'en'; mode: 'local' | 'ai'; score: number;
  feedback: string; strengths: string[]; improvements: string[]; createdAt: string;
};
export function isInterviewResult(value: unknown): value is InterviewResult {
  if (!value || typeof value !== 'object') return false;
  const v = value as InterviewResult;
  return typeof v.id === 'string' && /^[a-zA-Z0-9-]{1,80}$/.test(v.id)
    && typeof v.careerId === 'string' && /^C0[1-9]$/.test(v.careerId)
    && typeof v.questionId === 'string' && v.questionId.startsWith(v.careerId + '-') && v.questionId.length <= 80
    && typeof v.question === 'string' && v.question.length > 0 && v.question.length <= 1000
    && typeof v.answer === 'string' && v.answer.trim().length >= 10 && v.answer.length <= 6000
    && ['ar', 'en'].includes(v.language) && ['local', 'ai'].includes(v.mode)
    && Number.isInteger(v.score) && v.score >= 0 && v.score <= 100
    && typeof v.feedback === 'string' && v.feedback.length <= 2500
    && ['strengths', 'improvements'].every(key => {
      const list = v[key as 'strengths'];
      return Array.isArray(list) && list.length <= 10 && list.every(item => typeof item === 'string' && item.length <= 500);
    }) && typeof v.createdAt === 'string' && Number.isFinite(Date.parse(v.createdAt));
}
export function parseInterviewHistory(value: unknown): InterviewResult[] {
  if (!Array.isArray(value) || value.length > 100 || !value.every(isInterviewResult)
    || new Set(value.map(item => item.id)).size !== value.length) throw new Error('Invalid interview history');
  return value;
}
