export type InterviewQuestion = { id: string; careerId: string; prompt: string; concepts: string[]; type?: 'technical' | 'behavioral'; source?: 'curated-practice' | 'groq-adaptive' };
export const interviewCareerIds: string[];
export function interviewQuestions(careerId: string, language?: 'ar' | 'en'): InterviewQuestion[];
export function interviewRubric(careerId: string, questionId: string): string[][] | null;
