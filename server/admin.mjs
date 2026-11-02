import express from 'express';
import { randomUUID } from 'node:crypto';
import { defaultJobsRefreshSchedule, jobSearches, normalizeJobsRefreshSchedule, sharedJobsService } from './jobs.mjs';
import { sharedAdminStore } from './admin-store.mjs';
import { checkResourceLink as sharedResourceLinkCheck } from './resource-link-check.mjs';

const allowedAdminIds = () => new Set((process.env.MASARAK_ADMIN_USER_IDS ?? '').split(',').map(id => id.trim().toLowerCase()).filter(id => /^[0-9a-f-]{36}$/.test(id)));
const fail = (res, error) => res.status(error?.status ?? 503).json({ error: error?.status === 400 ? error.message
    : error?.code === 'ADMIN_SCHEMA_MISSING' ? 'تأكدي من تطبيق supabase/004_admin_console.sql، ثم شغّلي supabase/admin_remaining_setup.sql في SQL Editor.'
    : error?.code === 'ADMIN_ROLE_MISCONFIGURED' ? 'تحققي من إعداد SUPABASE_SERVICE_ROLE_KEY في الخادم.'
      : 'تعذر إكمال طلب الإدارة الآن.' });

export function createPublicLearningResourcesRouter({ store = sharedAdminStore } = {}) {
  const router = express.Router();
  router.get('/', async (_req, res) => {
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    try { return res.json(await store.getPublicResources()); }
    catch { return res.json([]); }
  });
  return router;
}

export function createAdminRouter({ authenticate, store = sharedAdminStore, jobs = sharedJobsService, scheduler = null, checkResourceLink = sharedResourceLinkCheck, now = () => Date.now() } = {}) {
  const router = express.Router();
  const linkCheckProofs = new Map();
  router.use(authenticate);
  router.use((req, res, next) => {
    const id = res.locals.cvUser?.id?.toLowerCase();
    if (!id || !allowedAdminIds().has(id)) return res.status(403).json({ error: 'هذا الحساب غير مخول للوصول إلى لوحة الإدارة.' });
    res.locals.adminActorId = id;
    return next();
  });
  router.use(express.json({ limit: '16kb', strict: true }));
  router.get('/session', (_req, res) => res.json({ role: 'admin' }));
  router.get('/status', async (_req, res) => {
    let resources = null;
    let adminStoreIssue = null;
    try { resources = await store.getAdminResources(); }
    catch (error) {
      adminStoreIssue = error?.code === 'ADMIN_SCHEMA_MISSING' ? 'schema'
        : error?.code === 'ADMIN_ROLE_MISCONFIGURED' ? 'credentials' : 'connection';
    }
    return res.json({
      service: { status: 'ok', groqConfigured: Boolean(process.env.GROQ_API_KEY?.trim()) },
      adminStore: { configured: store.isConfigured(), available: Boolean(resources), issue: adminStoreIssue, resources: resources?.length ?? null, visibleResources: resources?.filter(item => item.isVisible).length ?? null },
      jobs: jobs.status?.() ?? { configured: false, categories: {} },
      scheduler: scheduler?.status?.() ?? { ...defaultJobsRefreshSchedule, configured: false, running: false, nextRunAt: null, lastRunAt: null, lastFinishedAt: null, lastResult: { succeeded: 0, failed: 0 } },
    });
  });
  router.get('/audit', async (_req, res) => {
    try { return res.json(await store.getAuditEvents()); } catch (error) { return fail(res, error); }
  });
  router.get('/sources', (_req, res) => res.json({
    sources: [{ id: 'headcount-labs', name: 'Headcount Labs', supported: true, configured: jobs.status?.().configured ?? false,
      refreshIntervalHours: scheduler?.status?.().intervalHours ?? defaultJobsRefreshSchedule.intervalHours,
      categories: Object.entries(jobSearches).map(([id, query]) => ({ id, query })) }],
    schedule: scheduler?.status?.() ?? { ...defaultJobsRefreshSchedule, enabled: true, nextRunAt: null },
    status: jobs.status?.() ?? { configured: false, categories: {} },
  }));
  router.get('/schedule', async (_req, res) => {
    try {
      const schedule = await store.getJobsSchedule();
      return res.json({ schedule, runtime: scheduler?.status?.() ?? null });
    } catch (error) { return fail(res, error); }
  });
  router.put('/schedule', async (req, res) => {
    const schedule = normalizeJobsRefreshSchedule(req.body);
    if (!schedule) return res.status(400).json({ error: 'اختر جدول تحديث صالحًا.' });
    if (typeof store.saveJobsSchedule !== 'function') return res.status(503).json({ error: 'يلزم إعداد تخزين جدول الإدارة أولًا.' });
    try {
      const saved = await store.saveJobsSchedule(schedule, res.locals.adminActorId);
      const runtime = scheduler?.updateSchedule?.(schedule) ?? null;
      return res.json({ schedule: saved, runtime });
    } catch (error) {
      if (error?.code === 'ADMIN_SCHEMA_MISSING') return res.status(503).json({ error: 'طبّقي supabase/admin_remaining_setup.sql في SQL Editor أولًا.' });
      return fail(res, error);
    }
  });
  router.post('/sources/retry-failed', async (_req, res) => {
    const categories = jobs.status?.().categories ?? {};
    const failures = Object.entries(categories).filter(([, state]) => state?.lastErrorAt);
    const results = [];
    for (const [category, state] of failures) {
      if (state.retryAt && Date.parse(state.retryAt) > now()) {
        results.push({ category, status: 'backoff', retryAt: state.retryAt });
        continue;
      }
      try {
        const result = await jobs.refresh(category);
        results.push({ category, status: 'success', count: result.jobs.length, fetchedAt: result.fetchedAt });
        try { await store.auditRefresh(res.locals.adminActorId, category); } catch { /* The provider refresh can succeed before audit storage is configured. */ }
      } catch {
        const retryAt = jobs.status?.().categories?.[category]?.retryAt ?? null;
        results.push({ category, status: 'failed', retryAt });
      }
    }
    return res.json({ results, status: jobs.status?.() ?? { categories: {} } });
  });
  router.post('/sources/refresh', async (req, res) => {
    const category = req.body?.category;
    if (typeof category !== 'string' || !Object.hasOwn(jobSearches, category)) return res.status(400).json({ error: 'اختاري مجالًا صحيحًا للتحديث.' });
    try {
      const result = await jobs.refresh(category);
      let auditSaved = false;
      try { await store.auditRefresh(res.locals.adminActorId, category); auditSaved = true; } catch { /* A completed fetch remains successful while the audit table is being configured. */ }
      return res.json({ source: result.source, category, fetchedAt: result.fetchedAt, count: result.jobs.length, auditSaved, status: jobs.status?.() });
    } catch (error) { return fail(res, error); }
  });
  router.get('/resources', async (_req, res) => {
    try { return res.json(await store.getAdminResources()); } catch (error) { return fail(res, error); }
  });
  router.post('/resources/check-link', async (req, res) => {
    const url = req.body?.url;
    if (typeof url !== 'string' || url.length > 2048) return res.status(400).json({ error: 'أدخلي رابط المورد أولًا.' });
    let normalizedUrl;
    try { normalizedUrl = new URL(url).href; } catch { return res.status(400).json({ error: 'صيغة الرابط غير صالحة.' }); }
    try {
      const result = await checkResourceLink(normalizedUrl);
      if (result.redirected) return res.json({ redirected: true, destination: result.destination, statusCode: result.statusCode });
      for (const [token, proof] of linkCheckProofs) if (proof.expiresAt <= now()) linkCheckProofs.delete(token);
      while (linkCheckProofs.size >= 500) linkCheckProofs.delete(linkCheckProofs.keys().next().value);
      const token = randomUUID();
      linkCheckProofs.set(token, { actorId: res.locals.adminActorId, url: normalizedUrl, checkedAt: result.checkedAt, expiresAt: now() + 10 * 60 * 1000 });
      return res.json({ token, checkedAt: result.checkedAt, statusCode: result.statusCode, redirected: false });
    } catch (error) {
      const status = Number.isInteger(error?.statusCode) ? error.statusCode : undefined;
      return res.status(422).json({ error: status ? `الرابط لم يستجب بنجاح (HTTP ${status}).` : 'تعذر التحقق من الرابط. تأكدي أنه يعمل كرابط HTTPS عام ثم أعيدي المحاولة.' });
    }
  });
  router.post('/resources', async (req, res) => {
    try {
      const { resource, visible, reviewed, linkCheckToken } = req.body ?? {};
      let proof = null;
      if (typeof linkCheckToken === 'string') {
        proof = linkCheckProofs.get(linkCheckToken) ?? null;
        if (!proof || proof.expiresAt <= now() || proof.actorId !== res.locals.adminActorId) {
          linkCheckProofs.delete(linkCheckToken);
          if (visible) return res.status(400).json({ error: 'انتهت صلاحية فحص الرابط. افحصيه مرة أخرى قبل النشر.' });
          proof = null;
        } else {
          let normalizedUrl = '';
          try { normalizedUrl = new URL(resource?.url).href; } catch { /* Store validation returns the field error. */ }
          if (normalizedUrl !== proof.url) return res.status(400).json({ error: 'تغير الرابط بعد فحصه. افحصي الرابط الحالي قبل النشر.' });
        }
      }
      if (visible && !proof) return res.status(400).json({ error: 'افحصي الرابط أولًا قبل إظهار المورد للمستخدمين.' });
      const result = await store.saveResource(req.body?.resource, {
        visible, reviewed, actorId: res.locals.adminActorId,
        linkCheckStatus: proof ? 'reachable' : 'not_checked', linkCheckedAt: proof?.checkedAt ?? null,
      });
      if (linkCheckToken) linkCheckProofs.delete(linkCheckToken);
      return res.json({ resource: result });
    } catch (error) { return fail(res, error); }
  });
  router.use((error, _req, res, _next) => res.status(error.status === 413 ? 413 : 400).json({ error: 'تعذر قراءة طلب الإدارة أو تجاوز الحجم المسموح.' }));
  return router;
}
