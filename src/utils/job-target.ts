import AsyncStorage, { captureDataScope } from './scoped-storage';
import type { MarketJob } from './jobs-api';

export type JobTarget = { version: 1; selectedAt: string; job: MarketJob };
export const JOB_TARGET_KEY = 'masarak-job-target-v1';
export function parseJobTarget(value: unknown): JobTarget | null {
  if (value === null) return null;
  if (!value || typeof value !== 'object' || JSON.stringify(value).length > 80000) throw new Error('Invalid job target');
  const target = value as JobTarget; const job = target.job;
  const url = (text: unknown) => { try { return typeof text === 'string' && new URL(text).protocol === 'https:'; } catch { return false; } };
  if (target.version !== 1 || typeof target.selectedAt !== 'string' || !Number.isFinite(Date.parse(target.selectedAt)) || !job
    || ['id', 'title', 'employer', 'description', 'source'].some(field => typeof job[field as keyof MarketJob] !== 'string')
    || job.id.length > 100 || job.description.length > 30000 || !url(job.sourceUrl) || !url(job.applyUrl)
    || !Array.isArray(job.locations) || job.locations.length > 10 || job.locations.some(item => typeof item !== 'string' || item.length > 300)
    || [job.postedAt, job.lastCheckedAt].some(item => item !== null && (typeof item !== 'string' || !Number.isFinite(Date.parse(item))))
    || (job.attribution !== null && (!job.attribution || typeof job.attribution.text !== 'string' || !url(job.attribution.url)))) throw new Error('Invalid job target');
  return { version: 1, selectedAt: target.selectedAt, job };
}
export async function readJobTarget(): Promise<JobTarget | null> {
  const raw = await AsyncStorage.getItem(JOB_TARGET_KEY);
  return raw ? parseJobTarget(JSON.parse(raw)) : null;
}
export async function saveJobTarget(job: MarketJob | null) {
  const scope = captureDataScope();
  const target = job ? parseJobTarget({ version: 1, selectedAt: new Date().toISOString(), job }) : null;
  scope.assertCurrent();
  if (target) await AsyncStorage.setItem(JOB_TARGET_KEY, JSON.stringify(target));
  else await AsyncStorage.removeItem(JOB_TARGET_KEY);
  scope.assertCurrent();
  return target;
}
