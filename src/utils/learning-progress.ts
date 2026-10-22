import AsyncStorage, { captureDataScope } from './scoped-storage';
import { learningResourceIds } from '../constants/learning-resources';

export const LEARNING_PROGRESS_KEY = 'masarak-learning-progress-v1';
export type LearningProgress = Record<string, string>;
let pending: Promise<unknown> = Promise.resolve();

export function parseLearningProgress(value: unknown): LearningProgress {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const parsed: LearningProgress = {};
  for (const [id, completedAt] of Object.entries(value)) {
    if (learningResourceIds.has(id) && typeof completedAt === 'string' && !Number.isNaN(Date.parse(completedAt))) {
      parsed[id] = completedAt;
    }
  }
  return parsed;
}

export async function readLearningProgress(): Promise<LearningProgress> {
  const saved = await AsyncStorage.getItem(LEARNING_PROGRESS_KEY);
  if (saved === null) return {};
  return parseLearningProgress(JSON.parse(saved));
}

export function changeLearningResource(id: string, completed: boolean): Promise<LearningProgress> {
  const scope = captureDataScope();
  const operation = pending.then(async () => {
    scope.assertCurrent();
    if (!learningResourceIds.has(id)) throw new Error('Unknown learning resource');
    const current = await readLearningProgress();
    const next = { ...current };
    if (completed) next[id] = new Date().toISOString();
    else delete next[id];
    await AsyncStorage.setItem(LEARNING_PROGRESS_KEY, JSON.stringify(next));
    scope.assertCurrent();
    return next;
  });
  pending = operation.catch(() => undefined);
  return operation;
}
