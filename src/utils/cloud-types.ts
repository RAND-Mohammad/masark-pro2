import { parsePersonalProfile, type PersonalProfile } from './personal-profile';
import { parseSkillProfile, type SkillProfile } from './skill-profile';
import { validReview, type CvReview } from './saved-cv.types';
import { validateCvFile } from './cv-file';
import { isValidLearningPlanId } from './learning-plan';
import { parseInterviewHistory, type InterviewResult } from './interview-types';
import { parseJobTarget, type JobTarget } from './job-target';

export type CloudCv = { path: string; name: string; size: number; mimeType: string; review: CvReview | null };
export type CloudSnapshot = { version: 1; personal: PersonalProfile | null; skills: SkillProfile | null; plan: string[]; learningProgress: Record<string, string>; professionalCertifications: string[]; cv: CloudCv | null; interviews?: InterviewResult[]; jobTarget?: JobTarget | null };
export type CloudRecord = { revision: number; snapshot: CloudSnapshot; updated_at: string };
export type CloudMeta = { version: 1; enabled: boolean; paused: boolean; dirty: boolean; localVersion: number; baseRevision: number | null; lastSynced: string | null; lastLocalState: string | null; fileBinding: { identity: string; path: string } | null };
export const CLOUD_META_KEY = 'masarak-cloud-sync-v1';
export const defaultCloudMeta = (): CloudMeta => ({ version: 1, enabled: false, paused: false, dirty: false, localVersion: 0, baseRevision: null, lastSynced: null, lastLocalState: null, fileBinding: null });
export function validCloudPath(path: string, owner: string): boolean {
  return path.startsWith(owner + '/') && /^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+\.(pdf|docx)$/.test(path);
}
export function parseCloudSnapshot(value: unknown, owner: string): CloudSnapshot {
  if (!value || typeof value !== 'object' || JSON.stringify(value).length > 1500000) throw new Error('Invalid cloud data');
  const v = value as CloudSnapshot;
  if (v.version !== 1 || !Array.isArray(v.plan) || v.plan.length > 1200 || v.plan.some(id => typeof id !== 'string')) throw new Error('Invalid cloud plan');
  const rawProgress = (v as CloudSnapshot & { learningProgress?: unknown }).learningProgress;
  if (rawProgress !== undefined && (!rawProgress || typeof rawProgress !== 'object' || Array.isArray(rawProgress) || Object.keys(rawProgress).length > 100)) throw new Error('Invalid learning progress');
  const learningProgress: Record<string, string> = {};
  for (const [id, completedAt] of Object.entries(rawProgress ?? {})) {
    if (id.length > 100 || typeof completedAt !== 'string' || completedAt.length > 40 || Number.isNaN(Date.parse(completedAt))) throw new Error('Invalid learning progress');
    learningProgress[id] = completedAt;
  }
  const rawCertifications = (v as CloudSnapshot & { professionalCertifications?: unknown }).professionalCertifications;
  if (rawCertifications !== undefined && (!Array.isArray(rawCertifications) || rawCertifications.length > 50 || rawCertifications.some(id => typeof id !== 'string' || id.length > 100))) throw new Error('Invalid professional certifications');
  const professionalCertifications = [...new Set((rawCertifications ?? []) as string[])];
  let cv: CloudCv | null = null;
  if (v.cv !== null) {
    if (!v.cv || typeof v.cv.path !== 'string' || !validCloudPath(v.cv.path, owner) || typeof v.cv.name !== 'string' || v.cv.name.length > 250 || typeof v.cv.mimeType !== 'string' || typeof v.cv.size !== 'number' || !Number.isFinite(v.cv.size) || v.cv.size < 1 || validateCvFile(v.cv) || (v.cv.review !== null && !validReview(v.cv.review))) throw new Error('Invalid cloud CV');
    cv = { path: v.cv.path, name: v.cv.name, size: v.cv.size, mimeType: v.cv.mimeType, review: v.cv.review };
  }
  return { version: 1, personal: v.personal === null ? null : parsePersonalProfile(v.personal), skills: v.skills === null ? null : parseSkillProfile(v.skills), plan: [...new Set(v.plan.filter(isValidLearningPlanId))], learningProgress, professionalCertifications, cv, ...(v.interviews !== undefined ? { interviews: parseInterviewHistory(v.interviews) } : {}), ...(v.jobTarget !== undefined ? { jobTarget: parseJobTarget(v.jobTarget) } : {}) };
}
export function parseCloudMeta(raw: string | null): CloudMeta {
  if (raw === null) return defaultCloudMeta();
  const v = { ...defaultCloudMeta(), ...JSON.parse(raw) } as CloudMeta;
  if (v.version !== 1 || typeof v.enabled !== 'boolean' || typeof v.paused !== 'boolean' || typeof v.dirty !== 'boolean' || !Number.isSafeInteger(v.localVersion) || v.localVersion < 0 || (v.baseRevision !== null && (!Number.isSafeInteger(v.baseRevision) || v.baseRevision < 1)) || (v.lastSynced !== null && typeof v.lastSynced !== 'string') || (v.lastLocalState !== null && typeof v.lastLocalState !== 'string') || (v.fileBinding !== null && (!v.fileBinding || typeof v.fileBinding.identity !== 'string' || typeof v.fileBinding.path !== 'string'))) throw new Error('Invalid cloud metadata');
  return v;
}
