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
const jobsMessage = (code: 'auth-unavailable' | 'sign-in' | 'service-unavailable' | 'source-unavailable' | 'invalid-response' | 'server-unreachable' | 'app-unavailable', english: boolean) => {
  const unreachable = __DEV__
    ? ['تعذر الاتصال بخادم مسارك. افتح طرفية ثانية في مجلد المشروع وشغّل npm.cmd run cv-server، وتأكد من اتصال الجوال والكمبيوتر بالشبكة نفسها.', 'Could not reach the Masarak server. Open a second terminal in the project folder and run npm.cmd run cv-server. Keep your phone and computer on the same network.']
    : ['تعذر الاتصال بخدمة مسارك. حاول مرة أخرى لاحقًا.', 'Could not reach the Masarak service. Try again later.'];
  const messages = {
    'auth-unavailable': ['خدمة تسجيل الدخول غير متاحة الآن.', 'Sign-in is temporarily unavailable.'],
    'sign-in': ['سجّل الدخول في مسارك لعرض الوظائف.', 'Sign in to Masarak to view job listings.'],
    'service-unavailable': ['خدمة الوظائف غير مهيأة حاليًا. راجع مسؤول النظام.', 'The job service is not configured yet. Contact the system administrator.'],
    'source-unavailable': ['تعذر تحديث الوظائف من المصدر الآن. حاول لاحقًا.', 'Job listings are temporarily unavailable. Try again later.'],
    'invalid-response': ['تعذر قراءة بيانات الوظائف. حاول تحديثها.', 'Could not read the job listing data. Try refreshing.'],
    'server-unreachable': unreachable,
    'app-unavailable': ['خدمة الوظائف غير متاحة في هذه النسخة. تواصل مع مسؤول النظام.', 'Job listings are not enabled in this app version. Contact the system administrator.'],
  } as const;
  return english ? messages[code][1] : messages[code][0];
};
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
export async function getMarketJobs(category: JobCategory, english = false): Promise<JobsResult> {
  const scope = captureDataScope();
  if (!supabase) throw new Error(jobsMessage('auth-unavailable', english));
  const session = await supabase.auth.getSession().catch(() => null);
  scope.assertCurrent();
  if (!session || session.error) throw new Error(jobsMessage('auth-unavailable', english));
  if (!session.data.session) throw new Error(jobsMessage('sign-in', english));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(`${serverUrl()}/jobs?category=${category}`, {
      headers: { Authorization: `Bearer ${session.data.session.access_token}` }, signal: controller.signal,
    });
    const body: unknown = await response.json();
    scope.assertCurrent();
    if (!response.ok) {
      const detail = body && typeof body === 'object' && 'error' in body && typeof body.error === 'string' ? body.error : '';
      const code = /HEADCOUNT_API_KEY|خدمة الوظائف غير مهيأة/iu.test(detail) ? 'service-unavailable'
        : response.status === 401 ? 'sign-in'
          : response.status >= 500 ? 'source-unavailable' : 'invalid-response';
      throw new Error(jobsMessage(code, english));
    }
    if (!isJobsResult(body, category)) throw new Error(jobsMessage('invalid-response', english));
    return body;
  } catch (error) {
    if (error instanceof TypeError || (error instanceof Error && error.name === 'AbortError')) throw new Error(jobsMessage('server-unreachable', english));
    if (error instanceof Error && error.message.includes('لم تُضبط لهذه النسخة')) throw new Error(jobsMessage('app-unavailable', english));
    throw error;
  } finally { clearTimeout(timeout); }
}
