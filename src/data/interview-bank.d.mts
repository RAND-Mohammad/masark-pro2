export type InterviewQuestion = { id: string; careerId: string; prompt: string; concepts: string[] };
export const interviewCareerIds: string[];
export function interviewQuestions(careerId: string, language?: 'ar' | 'en'): InterviewQuestion[];
export function interviewRubric(careerId: string, questionId: string): string[][] | null;
