import { fetch } from 'expo/fetch';
import { supabase } from './supabase';
import { serverUrl } from './cv-api';
import { captureDataScope } from './scoped-storage';

export const jobCategories = [
  { id: 'software', title: 'البرمجة' }, { id: 'data', title: 'البيانات' },
  { id: 'security', title: 'الأمن والشبكات' }, { id: 'cloud', title: 'السحابة وقواعد البيانات' },
  { id: 'graduates', title: 'الخريجون والتدريب' },
] as const;
export type JobCategory = typeof jobCategories[number]['id'];
export type MarketJob = {
  id: string; title: string; employer: string; description: string; locations: string[];
  source: string; sourceUrl: string; applyUrl: string; postedAt: string | null; lastCheckedAt: string | null;
  attribution: { text: string; url: string } | null;
};
export type JobsResult = {
  source: 'Headcount Labs'; category: JobCategory; fetchedAt: string; sourceSnapshotAt: string;
  postedSince: string; hasMore: boolean; jobs: MarketJob[];
};
const safeUrl = (value: unknown) => {
  try { return typeof value === 'string' && new URL(value).protocol === 'https:'; } catch { return false; }
};
const date = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value));
function isJobsResult(value: unknown, category: JobCategory): value is JobsResult {
  if (!value || typeof value !== 'object') return false;
  const body = value as JobsResult;
  return body.source === 'Headcount Labs' && body.category === category && date(body.fetchedAt)
    && date(body.sourceSnapshotAt) && date(body.postedSince) && typeof body.hasMore === 'boolean'
    && Array.isArray(body.jobs) && body.jobs.length <= 25 && body.jobs.every(job => job
      && ['id', 'title', 'employer', 'description', 'source'].every(field => typeof job[field as keyof MarketJob] === 'string')
      && Array.isArray(job.locations) && job.locations.every(item => typeof item === 'string')
      && safeUrl(job.sourceUrl) && safeUrl(job.applyUrl)
      && (job.postedAt === null || date(job.postedAt)) && (job.lastCheckedAt === null || date(job.lastCheckedAt))
      && (job.attribution === null || (typeof job.attribution?.text === 'string' && safeUrl(job.attribution?.url))));
}
export async function getMarketJobs(category: JobCategory): Promise<JobsResult> {
  const scope = captureDataScope();
  if (!supabase) throw new Error('خدمة تسجيل الدخول غير مهيأة.');
  const { data, error } = await supabase.auth.getSession();
  scope.assertCurrent();
  if (error || !data.session) throw new Error('سجّل الدخول في مسارك لعرض الوظائف.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(`${serverUrl()}/jobs?category=${category}`, {
      headers: { Authorization: `Bearer ${data.session.access_token}` }, signal: controller.signal,
    });
    const body: unknown = await response.json();
    scope.assertCurrent();
    if (!response.ok) throw new Error(body && typeof body === 'object' && 'error' in body && typeof body.error === 'string' ? body.error : 'تعذر جلب الوظائف.');
    if (!isJobsResult(body, category)) throw new Error('نتيجة الوظائف غير صالحة. حاول مجددًا.');
    return body;
  } catch (error) {
    if (error instanceof TypeError || (error instanceof Error && error.name === 'AbortError')) throw new Error('تعذر الاتصال بخادم مسارك. تأكد أنه يعمل وأن عنوانه متاح لجوالك.');
    throw error;
  } finally { clearTimeout(timeout); }
}
