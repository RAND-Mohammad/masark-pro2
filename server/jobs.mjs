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
  const activity = { lastAttemptAt: null, lastSuccessAt: null, lastErrorAt: null };
  const categoryActivity = new Map(Object.keys(jobSearches).map(category => [category, {
    lastAttemptAt: null, lastSuccessAt: null, lastErrorAt: null,
  }]));
  async function getJobs(category) {
    const key = getKey();
    if (!key) throw Object.assign(new Error('خدمة الوظائف غير مهيأة على الخادم. أضيفي HEADCOUNT_API_KEY في server/.env ثم أعيدي تشغيل الخادم.'), { status: 503 });
    if (!Object.hasOwn(jobSearches, category)) throw Object.assign(new Error('اختر مجالًا صحيحًا.'), { status: 400 });
    const cached = cache.get(category);
    if (cached && now() - cached.time < 6 * 60 * 60 * 1000) return cached.result;
    if (pending.has(category)) return pending.get(category);
    if ((failedUntil.get(category) ?? 0) > now()) throw Object.assign(new Error('خدمة الوظائف غير متاحة مؤقتًا. أعد المحاولة بعد دقيقة.'), { status: 503 });
    const task = (async () => {
      const attemptedAt = new Date(now()).toISOString();
      activity.lastAttemptAt = attemptedAt;
      categoryActivity.get(category).lastAttemptAt = attemptedAt;
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
        activity.lastSuccessAt = result.fetchedAt;
        activity.lastErrorAt = null;
        categoryActivity.get(category).lastSuccessAt = result.fetchedAt;
        categoryActivity.get(category).lastErrorAt = null;
        failedUntil.delete(category);
        return result;
      } catch {
        const failedAt = now();
        activity.lastErrorAt = new Date(failedAt).toISOString();
        categoryActivity.get(category).lastErrorAt = activity.lastErrorAt;
        failedUntil.set(category, failedAt + 60000);
        // نخلي رسالة الخطأ عامة عشان ما تطلع بيانات المفتاح.
        throw Object.assign(new Error('تعذر جلب الوظائف من المصدر. أعد المحاولة بعد قليل.'), { status: 503 });
      }
    })();
    pending.set(category, task);
    try { return await task; } finally { pending.delete(category); }
  }
  getJobs.refresh = category => { cache.delete(category); return getJobs(category); };
  getJobs.status = () => ({
    configured: Boolean(getKey()),
    lastAttemptAt: activity.lastAttemptAt,
    lastSuccessAt: activity.lastSuccessAt,
    lastErrorAt: activity.lastErrorAt,
    categories: Object.fromEntries(Object.keys(jobSearches).map(category => {
      const entry = cache.get(category);
      return [category, {
        cached: Boolean(entry), fetchedAt: entry?.result.fetchedAt ?? null,
        count: entry?.result.jobs.length ?? 0, ...categoryActivity.get(category),
        retryAt: failedUntil.has(category) ? new Date(failedUntil.get(category)).toISOString() : null,
        retryBlocked: (failedUntil.get(category) ?? 0) > now(),
      }];
    })),
  });
  return getJobs;
}
export const sharedJobsService = createJobsService();
const refreshHours = new Set([6, 12, 24]);
const millisecondsPerHour = 3600000;
export const defaultJobsRefreshSchedule = Object.freeze({ enabled: true, intervalHours: 6 });

export function normalizeJobsRefreshSchedule(input) {
  if (!input || typeof input !== 'object' || typeof input.enabled !== 'boolean'
    || !refreshHours.has(input.intervalHours)) return null;
  return { enabled: input.enabled, intervalHours: input.intervalHours };
}

export function createJobsRefreshScheduler({
  service = sharedJobsService,
  getKey = () => process.env.HEADCOUNT_API_KEY?.trim(),
  loadSchedule,
  initialSchedule = defaultJobsRefreshSchedule,
  now = Date.now,
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout,
  startupDelayMs = 1000,
} = {}) {
  let schedule = normalizeJobsRefreshSchedule(initialSchedule) ?? { ...defaultJobsRefreshSchedule };
  let stopped = false;
  let running = false;
  let timer = null;
  let nextRunAt = null;
  let lastRunAt = null;
  let lastFinishedAt = null;
  let lastResult = { succeeded: 0, failed: 0 };

  function status() {
    return {
      ...schedule,
      configured: Boolean(getKey()),
      running,
      nextRunAt,
      lastRunAt,
      lastFinishedAt,
      lastResult: { ...lastResult },
    };
  }

  function arm(delayMs) {
    if (timer) clearTimeoutFn(timer);
    timer = null;
    nextRunAt = null;
    if (stopped || !schedule.enabled || !getKey()) return;
    const boundedDelay = Math.max(0, delayMs);
    nextRunAt = new Date(now() + boundedDelay).toISOString();
    timer = setTimeoutFn(async () => {
      timer = null;
      nextRunAt = null;
      await refresh();
      arm(schedule.intervalHours * millisecondsPerHour);
    }, boundedDelay);
    timer?.unref?.();
  }

  async function refresh() {
    if (stopped || running || !getKey()) return { succeeded: 0, failed: 0 };
    running = true;
    lastRunAt = new Date(now()).toISOString();
    let succeeded = 0;
    let failed = 0;
    try {
      for (const category of Object.keys(jobSearches)) {
        if (stopped) break;
        try { await service.refresh(category); succeeded += 1; }
        catch { failed += 1; /* تُحترم مهلة إعادة المحاولة التي يفرضها مزود الوظائف. */ }
      }
    } finally {
      running = false;
      lastFinishedAt = new Date(now()).toISOString();
      lastResult = { succeeded, failed };
    }
    return { ...lastResult };
  }

  async function start() {
    if (loadSchedule) {
      try {
        const loaded = normalizeJobsRefreshSchedule(await loadSchedule());
        if (loaded) schedule = loaded;
      } catch { /* Keep the local default until the admin schema is ready. */ }
    }
    arm(startupDelayMs);
    return status();
  }

  function updateSchedule(input) {
    const normalized = normalizeJobsRefreshSchedule(input);
    if (!normalized) throw Object.assign(new Error('اختر جدول تحديث صالحًا.'), { status: 400 });
    schedule = normalized;
    arm(schedule.intervalHours * millisecondsPerHour);
    return status();
  }

  function stop() {
    stopped = true;
    if (timer) clearTimeoutFn(timer);
    timer = null;
    nextRunAt = null;
  }

  return { start, stop, refresh, updateSchedule, status };
}

export function startJobsRefresh(options = {}) {
  const scheduler = createJobsRefreshScheduler(options);
  void scheduler.start();
  return scheduler;
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
