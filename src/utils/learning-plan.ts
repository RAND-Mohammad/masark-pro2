import AsyncStorage, { captureDataScope } from './scoped-storage';
import dataset from '../masarak_dataset.json';

export const LEARNING_PLAN_KEY = 'masarak-learning-plan-v1';
const key = LEARNING_PLAN_KEY;
const validIds = new Set(dataset.skills.map((item) => item.skill_id));
const plannedArtifact = /^(cert|experience|project):[a-z0-9-]+(?::[0-9]+)?$/;
let pending: Promise<unknown> = Promise.resolve();

export const certificationPlanId = (id: string) => `cert:${id}`;
export const experiencePlanId = (careerId: string) => `experience:${careerId}:0`;
export const projectPlanId = (careerId: string, index: number) => `project:${careerId}:${index}`;
export function isValidLearningPlanId(id: string) { return validIds.has(id) || (id.length <= 120 && plannedArtifact.test(id)); }

export async function readLearningPlan(): Promise<string[]> {
  const saved = await AsyncStorage.getItem(key);
  if (saved === null) return [];
  const parsed: unknown = JSON.parse(saved);
  if (!Array.isArray(parsed) || !parsed.every((id) => typeof id === 'string')) {
    throw new Error('Invalid learning plan');
  }
  return [...new Set(parsed.filter(isValidLearningPlanId))];
}

export function changeLearningPlan(id: string, add: boolean): Promise<string[]> {
  const scope = captureDataScope();
  const operation = pending.then(async () => {
    scope.assertCurrent();
    if (!isValidLearningPlanId(id)) throw new Error('Unknown plan item');
    const current = await readLearningPlan();
    const next = add ? [...new Set([...current, id])] : current.filter((entry) => entry !== id);
    await AsyncStorage.setItem(key, JSON.stringify(next));
    scope.assertCurrent();
    return next;
  });
  pending = operation.catch(() => undefined);
  return operation;
}

// Add a personalized gap plan atomically without discarding existing goals.
export function addLearningPlanItems(ids: string[]): Promise<string[]> {
  const scope = captureDataScope();
  const operation = pending.then(async () => {
    scope.assertCurrent();
    if (ids.some(id => !isValidLearningPlanId(id))) throw new Error('Unknown plan item');
    const current = await readLearningPlan(); scope.assertCurrent();
    const next = [...new Set([...current, ...ids])];
    await AsyncStorage.setItem(key, JSON.stringify(next)); scope.assertCurrent(); return next;
  });
  pending = operation.catch(() => undefined); return operation;
}
