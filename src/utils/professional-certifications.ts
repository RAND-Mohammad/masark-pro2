import AsyncStorage, { captureDataScope } from './scoped-storage';
import { professionalCertificationIds } from '../constants/professional-certifications';

export const PROFESSIONAL_CERTIFICATIONS_KEY = 'masarak-professional-certifications-v1';
let pending: Promise<unknown> = Promise.resolve();

export function parseProfessionalCertifications(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 50 || value.some(id => typeof id !== 'string')) return [];
  return [...new Set(value.filter(id => professionalCertificationIds.has(id)))];
}

export async function readProfessionalCertifications(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(PROFESSIONAL_CERTIFICATIONS_KEY);
  return raw === null ? [] : parseProfessionalCertifications(JSON.parse(raw));
}

export function changeProfessionalCertification(id: string, achieved: boolean): Promise<string[]> {
  const scope = captureDataScope();
  const operation = pending.then(async () => {
    scope.assertCurrent();
    if (!professionalCertificationIds.has(id)) throw new Error('Unknown certification');
    const current = await readProfessionalCertifications();
    const next = achieved ? [...new Set([...current, id])] : current.filter(item => item !== id);
    await AsyncStorage.setItem(PROFESSIONAL_CERTIFICATIONS_KEY, JSON.stringify(next));
    scope.assertCurrent();
    return next;
  });
  pending = operation.catch(() => undefined);
  return operation;
}
