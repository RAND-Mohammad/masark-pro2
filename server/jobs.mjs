import express from 'express';

// حددنا البحث عشان ما تخلص حصة الطلبات بسرعة.
export const jobSearches = Object.freeze({
  software: 'developer OR "software engineer" OR "software tester"',
  data: '"data analyst" OR "data scientist" OR "data engineer"',
  security: 'cybersecurity OR "security analyst" OR "network engineer"',
  cloud: '"cloud engineer" OR DevOps OR "database administrator"',
  graduates: '(graduate OR intern OR trainee OR tamheer) AND (software OR data OR IT OR technology OR database OR cybersecurity)',
});
const value = field => field && typeof field === 'object' ? field.value : field;
const text = (field, max = 300) => typeof value(field) === 'string' ? value(field).slice(0, max) : '';
const iso = input => typeof input === 'string' && Number.isFinite(Date.parse(input)) ? new Date(input).toISOString() : null;
function safeUrl(field) {
  try {
    const url = new URL(value(field));
    return url.protocol === 'https:' && !url.username && !url.password
      && !/^(localhost|127\.|10\.|192\.168\.|\[)/i.test(url.hostname) ? url.href : null;
  } catch { return null; }
}
export function normalizeJob(job) {
  if (!job || typeof job.job_id !== 'string' || !text(job.title) || job.currentness !== 'current' || job.stale === true) return null;
  if (!Array.isArray(job.locations) || !job.locations.some(location => value(location)?.country === 'SA')) return null;
  const postings = Array.isArray(job.postings) ? job.postings.filter(post => post.posting_status === 'listed') : [];
  const source = postings.find(post => safeUrl(post.posting_url));
  if (!source) return null;
  const attribution = source.attribution;
  // بعض المصادر تشترط نعرض اسمها ورابطها مع الإعلان.
  if (attribution?.required === true && (!text(attribution.text) || !safeUrl(attribution.link))) return null;
  return {
    id: job.job_id, title: text(job.title), employer: text(job.employer_name),
    description: text(job.description, 30000),
    locations: job.locations.filter(location => value(location)?.country === 'SA')
      .map(location => text(value(location)?.city) || text(value(location)?.region) || 'السعودية').slice(0, 10),
    source: text(source.source), sourceUrl: safeUrl(source.posting_url),
    applyUrl: safeUrl(source.application_url) || safeUrl(source.posting_url),
    postedAt: iso(source.source_posted_at), lastCheckedAt: iso(source.last_completed_fetch_at),
    attribution: attribution?.required === true ? { text: text(attribution.text), url: safeUrl(attribution.link) } : null,
  };
}
export function createJobsService({ getKey = () => process.env.HEADCOUNT_API_KEY?.trim(), fetchImpl = fetch, now = Date.now } = {}) {
  const cache = new Map();
  const pending = new Map();
  const failedUntil = new Map();
  async function getJobs(category) {
    const key = getKey();
    if (!key) throw Object.assign(new Error('خدمة الوظائف غير مهيأة على الخادم. أضيفي HEADCOUNT_API_KEY في server/.env ثم أعيدي تشغيل الخادم.'), { status: 503 });
    if (!Object.hasOwn(jobSearches, category)) throw Object.assign(new Error('اختر مجالًا صحيحًا.'), { status: 400 });
    const cached = cache.get(category);
    if (cached && now() - cached.time < 6 * 60 * 60 * 1000) return cached.result;
    if (pending.has(category)) return pending.get(category);
    if ((failedUntil.get(category) ?? 0) > now()) throw Object.assign(new Error('خدمة الوظائف غير متاحة مؤقتًا. أعد المحاولة بعد دقيقة.'), { status: 503 });
    const task = (async () => {
      const url = new URL('https://api.headcountlabs.com/v1/jobs');
      const since = new Date(now() - 30 * 86400000).toISOString().slice(0, 10);
      for (const [name, input] of Object.entries({ country: 'SA', currentness: 'current', title_advanced: jobSearches[category], posted_since: since, limit: '25', sort: 'updated' })) url.searchParams.set(name, input);
      try {
        const response = await fetchImpl(url.href, {
          headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
          signal: AbortSignal.timeout(20000), redirect: 'error',
        });
        if (!response.ok) throw new Error('Provider unavailable');
        const body = await response.json();
        if (!Array.isArray(body?.data) || body.data.length > 25 || !iso(body.snapshot_watermark)) throw new Error('Invalid provider result');
        const seen = new Set();
        const jobs = body.data.map(normalizeJob).filter(job => job && !seen.has(job.id) && seen.add(job.id));
        const result = { source: 'Headcount Labs', category, fetchedAt: new Date(now()).toISOString(),
          sourceSnapshotAt: iso(body.snapshot_watermark), postedSince: since,
          hasMore: Boolean(body.next_cursor), jobs };
        cache.set(category, { time: now(), result });
        failedUntil.delete(category);
        return result;
      } catch {
        failedUntil.set(category, now() + 60000);
        // نخلي رسالة الخطأ عامة عشان ما تطلع بيانات المفتاح.
        throw Object.assign(new Error('تعذر جلب الوظائف من المصدر. أعد المحاولة بعد قليل.'), { status: 503 });
      }
    })();
    pending.set(category, task);
    try { return await task; } finally { pending.delete(category); }
  }
  getJobs.refresh = category => { cache.delete(category); return getJobs(category); };
  return getJobs;
}
export const sharedJobsService = createJobsService();
export function startJobsRefresh({ service = sharedJobsService, getKey = () => process.env.HEADCOUNT_API_KEY?.trim(), intervalMs = 6 * 3600000 } = {}) {
  let stopped = false; let running = false;
  async function refresh() {
    if (stopped || running || !getKey()) return;
    running = true;
    try {
      for (const category of Object.keys(jobSearches)) {
        if (stopped) break;
        try { await service.refresh(category); } catch { /* نعيد المحاولة بالتحديث الجاي. */ }
      }
    } finally { running = false; }
  }
  const initial = setTimeout(() => void refresh(), 1000); initial.unref?.();
  const timer = setInterval(() => void refresh(), intervalMs); timer.unref?.();
  return () => { stopped = true; clearTimeout(initial); clearInterval(timer); };
}
export function createJobsRouter({ authenticate, getJobs = sharedJobsService }) {
  const router = express.Router();
  router.use(authenticate);
  router.get('/', async (req, res) => {
    if (Object.keys(req.query).some(name => name !== 'category') || typeof req.query.category !== 'string' || !Object.hasOwn(jobSearches, req.query.category)) {
      return res.status(400).json({ error: 'اختر مجالًا صحيحًا.' });
    }
    try { return res.json(await getJobs(req.query.category)); }
    catch (error) { return res.status(error.status ?? 503).json({ error: error.status ? error.message : 'تعذر جلب الوظائف.' }); }
  });
  return router;
}
