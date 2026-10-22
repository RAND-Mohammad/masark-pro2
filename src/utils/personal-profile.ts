import AsyncStorage, { captureDataScope } from './scoped-storage';
import dataset from '../masarak_dataset.json';
import { jobPathIds } from '../constants/job-paths';

export type PersonalProfile = {
  version: 1; name: string; major: string; institution: string;
  education: string; studyStatus: string; studyDates: string; college?: string;
  gpa: number | null; gpaScale: 4 | 5 | null;
  interests: string[]; traits: string[]; careerGoal: string | null;
};
export const PERSONAL_PROFILE_KEY = 'masarak-personal-profile-v1';
export const emptyPersonalProfile = (): PersonalProfile => ({ version: 1, name: '', major: '', institution: '', education: '', studyStatus: '', studyDates: '', gpa: null, gpaScale: null, interests: [], traits: [], careerGoal: null });
export function parsePersonalProfile(value: unknown): PersonalProfile {
  if (!value || typeof value !== 'object') throw new Error('Invalid personal profile');
  const v = value as Record<string, unknown>;
  const fields = ['name', 'major', 'institution', 'education', 'studyStatus', 'studyDates'] as const;
  if (v.version !== 1 || fields.some(field => typeof v[field] !== 'string' || (v[field] as string).length > 300)) throw new Error('Invalid personal profile');
  if (v.college !== undefined && (typeof v.college !== 'string' || v.college.length > 300)) throw new Error('Invalid college');
  const list = (field: 'interests' | 'traits') => {
    const values = v[field];
    if (!Array.isArray(values) || values.length > 30 || values.some(item => typeof item !== 'string' || item.length > 100)) throw new Error('Invalid profile list');
    return [...new Set(values.map(item => item.trim()).filter(Boolean))];
  };
  if (v.careerGoal !== null && (typeof v.careerGoal !== 'string' || (!jobPathIds.has(v.careerGoal) && !dataset.careers.some(career => career.career_id === v.careerGoal)))) throw new Error('Invalid career goal');
  const gpaScale = v.gpaScale === 4 || v.gpaScale === 5 ? v.gpaScale : null;
  const gpa = typeof v.gpa === 'number' && Number.isFinite(v.gpa) && gpaScale !== null && v.gpa >= 0 && v.gpa <= gpaScale ? v.gpa : null;
  if ((v.gpa !== undefined && v.gpa !== null && gpa === null) || (v.gpaScale !== undefined && v.gpaScale !== null && gpaScale === null)) throw new Error('Invalid GPA');
  return { version: 1, ...Object.fromEntries(fields.map(field => [field, (v[field] as string).trim()])), ...(v.college !== undefined ? { college: (v.college as string).trim() } : {}), gpa, gpaScale, interests: list('interests'), traits: list('traits'), careerGoal: v.careerGoal } as PersonalProfile;
}
export async function readPersonalProfile(): Promise<PersonalProfile | null> {
  const raw = await AsyncStorage.getItem(PERSONAL_PROFILE_KEY);
  return raw === null ? null : parsePersonalProfile(JSON.parse(raw));
}
let pending: Promise<unknown> = Promise.resolve();
export function savePersonalProfile(value: PersonalProfile): Promise<PersonalProfile> {
  const scope = captureDataScope();
  const profile = parsePersonalProfile(value);
  const task = pending.then(async () => { scope.assertCurrent(); await readPersonalProfile(); scope.assertCurrent(); await AsyncStorage.setItem(PERSONAL_PROFILE_KEY, JSON.stringify(profile)); scope.assertCurrent(); return profile; });
  pending = task.catch(() => undefined);
  return task;
}
export function saveCareerGoal(careerGoal: string): Promise<PersonalProfile> {
  const scope = captureDataScope();
  const task = pending.then(async () => {
    scope.assertCurrent();
    const current = await readPersonalProfile() ?? emptyPersonalProfile(); scope.assertCurrent();
    const next = parsePersonalProfile({ ...current, careerGoal });
    await AsyncStorage.setItem(PERSONAL_PROFILE_KEY, JSON.stringify(next)); scope.assertCurrent(); return next;
  });
  pending = task.catch(() => undefined); return task;
}
