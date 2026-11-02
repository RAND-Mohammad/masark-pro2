import baselineResources from '../src/constants/learning-resources.data.json' with { type: 'json' };
import { supabaseServiceHeaders } from './supabase-service-headers.mjs';

const defaultJobsSchedule = Object.freeze({ enabled: true, intervalHours: 6 });

const resourceIdPattern = /^[a-z0-9][a-z0-9-]{1,79}$/;
const textFields = ['title', 'provider', 'url', 'level', 'duration', 'access', 'language'];

export function validateLearningResource(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const value = input;
  if (typeof value.id !== 'string' || !resourceIdPattern.test(value.id)) return null;
  if (textFields.some(field => typeof value[field] !== 'string' || !value[field].trim() || value[field].length > 500)) return null;
  let url;
  try { url = new URL(value.url); } catch { return null; }
  if (url.protocol !== 'https:' || url.username || url.password || !url.hostname.includes('.')) return null;
  if (!Array.isArray(value.skillIds) || value.skillIds.length > 40 || value.skillIds.some(id => typeof id !== 'string' || !/^[A-Za-z0-9_-]{2,32}$/.test(id))) return null;
  return {
    id: value.id,
    title: value.title.trim(), provider: value.provider.trim(), url: url.href,
    skillIds: [...new Set(value.skillIds)], level: value.level.trim(), duration: value.duration.trim(),
    access: value.access.trim(), language: value.language.trim(),
  };
}

export function createAdminStore({ fetchImpl = fetch, env = process.env } = {}) {
  const config = () => ({ url: env.EXPO_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, ''), key: env.SUPABASE_SERVICE_ROLE_KEY?.trim() });
  const hasServiceRoleKey = key => {
    if (key?.startsWith('sb_secret_')) return true;
    if (typeof key !== 'string' || key.split('.').length !== 3) return false;
    try { return JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString('utf8')).role === 'service_role'; }
    catch { return false; }
  };
  const isConfigured = () => /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(config().url ?? '') && hasServiceRoleKey(config().key);
  async function request(path, init = {}) {
    const current = config();
    if (!isConfigured()) throw Object.assign(new Error('Admin database is not configured'), { status: 503 });
    let response;
    try {
      response = await fetchImpl(`${current.url}/rest/v1/${path}`, {
        ...init,
        headers: { ...supabaseServiceHeaders(current.key), 'Content-Type': 'application/json', ...init.headers },
        signal: init.signal ?? AbortSignal.timeout(12000), redirect: 'error', cache: 'no-store',
      });
    } catch { throw Object.assign(new Error('Admin database is unavailable'), { status: 503 }); }
    if (!response.ok) {
      let code = '';
      try { code = (await response.clone().json()).code ?? ''; } catch { /* Ignore provider-specific error content. */ }
      if (['42P01', '42703', 'PGRST204', 'PGRST205', 'PGRST202'].includes(code)) throw Object.assign(new Error('Admin schema is not installed'), { status: 503, code: 'ADMIN_SCHEMA_MISSING' });
      if ([401, 403].includes(response.status) || ['42501', 'PGRST301'].includes(code)) throw Object.assign(new Error('Admin service credentials are not authorized'), { status: 503, code: 'ADMIN_ROLE_MISCONFIGURED' });
      throw Object.assign(new Error('Admin database request failed'), { status: response.status >= 500 ? 503 : 502 });
    }
    if (response.status === 204) return null;
    try { return await response.json(); } catch { throw Object.assign(new Error('Invalid admin database response'), { status: 502 }); }
  }
  async function listOverrides() {
    const rows = await request('masarak_admin_learning_resources?select=resource_id,payload,is_visible,link_status,reviewed_at,link_check_status,link_checked_at,updated_at&order=updated_at.desc');
    if (!Array.isArray(rows)) throw Object.assign(new Error('Invalid admin resource list'), { status: 502 });
    return rows.filter(row => resourceIdPattern.test(row.resource_id) && validateLearningResource(row.payload));
  }
  async function getPublicResources() {
    let rows;
    try { rows = await listOverrides(); } catch { return baselineResources; }
    const replacements = new Map(rows.map(row => [row.resource_id, row]));
    const resources = [];
    for (const base of baselineResources) {
      const row = replacements.get(base.id);
      if (row?.is_visible === false) continue;
      resources.push(row ? validateLearningResource(row.payload) : base);
      replacements.delete(base.id);
    }
    for (const row of replacements.values()) if (row.is_visible === true && row.link_status === 'reviewed'
      && row.link_check_status === 'reachable' && typeof row.link_checked_at === 'string') resources.push(validateLearningResource(row.payload));
    return resources.filter(Boolean);
  }
  async function getAdminResources() {
    const rows = await listOverrides();
    const overrides = new Map(rows.map(row => [row.resource_id, row]));
    const results = baselineResources.map(base => {
      const row = overrides.get(base.id);
      overrides.delete(base.id);
      return { ...(row ? validateLearningResource(row.payload) : base), isVisible: row ? row.is_visible : true,
        linkStatus: row?.link_status ?? 'reviewed', linkCheckStatus: row?.link_check_status ?? 'not_checked',
        linkCheckedAt: row?.link_checked_at ?? null, updatedAt: row?.updated_at ?? null, isDefault: true };
    });
    for (const row of overrides.values()) results.push({ ...validateLearningResource(row.payload), isVisible: row.is_visible,
      linkStatus: row.link_status, linkCheckStatus: row.link_check_status, linkCheckedAt: row.link_checked_at,
      updatedAt: row.updated_at, isDefault: false });
    return results.filter(resource => resource.id);
  }
  async function saveResource(resource, { visible, reviewed, actorId, linkCheckStatus, linkCheckedAt }) {
    const payload = validateLearningResource(resource);
    const checkedAt = typeof linkCheckedAt === 'string' && !Number.isNaN(Date.parse(linkCheckedAt)) ? new Date(linkCheckedAt).toISOString() : null;
    if (!payload || typeof visible !== 'boolean' || typeof reviewed !== 'boolean' || !actorId
      || !['not_checked', 'reachable'].includes(linkCheckStatus)
      || (linkCheckStatus === 'reachable') !== Boolean(checkedAt)) throw Object.assign(new Error('Invalid resource'), { status: 400 });
    if (visible && !reviewed) throw Object.assign(new Error('A resource must be reviewed before publishing'), { status: 400 });
    if (visible && linkCheckStatus !== 'reachable') throw Object.assign(new Error('A resource link must be reachable before publishing'), { status: 400 });
    await request('rpc/masarak_admin_save_learning_resource_v2', { method: 'POST', body: JSON.stringify({
      p_resource_id: payload.id, p_payload: payload, p_is_visible: visible,
      p_link_status: reviewed ? 'reviewed' : 'needs_review', p_link_check_status: linkCheckStatus,
      p_link_checked_at: checkedAt, p_actor: actorId,
    }) });
    return payload;
  }
  async function auditRefresh(actorId, category) {
    await request('masarak_admin_audit_events', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({
      actor_id: actorId, action: 'jobs_refresh_requested', target_id: category, details: { source: 'Headcount Labs' },
    }) });
  }
  async function getJobsSchedule() {
    let rows;
    try {
      rows = await request('masarak_admin_job_schedules?id=eq.1&select=enabled,interval_hours,updated_at');
    } catch (error) {
      if (error?.code === 'ADMIN_SCHEMA_MISSING') return { ...defaultJobsSchedule, persisted: false, storageAvailable: false, updatedAt: null };
      throw error;
    }
    if (!Array.isArray(rows) || !rows.length) return { ...defaultJobsSchedule, persisted: false, storageAvailable: true, updatedAt: null };
    const row = rows[0];
    if (typeof row?.enabled !== 'boolean' || ![6, 12, 24].includes(row?.interval_hours)) {
      throw Object.assign(new Error('Invalid admin job schedule'), { status: 502 });
    }
    return { enabled: row.enabled, intervalHours: row.interval_hours, persisted: true, storageAvailable: true, updatedAt: row.updated_at ?? null };
  }
  async function saveJobsSchedule(schedule, actorId) {
    if (!schedule || typeof schedule.enabled !== 'boolean' || ![6, 12, 24].includes(schedule.intervalHours) || !actorId) {
      throw Object.assign(new Error('Invalid admin job schedule'), { status: 400 });
    }
    const updatedAt = new Date().toISOString();
    const rows = await request('masarak_admin_job_schedules?on_conflict=id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify({ id: 1, enabled: schedule.enabled, interval_hours: schedule.intervalHours, updated_by: actorId, updated_at: updatedAt }),
    });
    try {
      await request('masarak_admin_audit_events', {
        method: 'POST', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ actor_id: actorId, action: 'jobs_schedule_updated', target_id: 'headcount-labs', details: schedule }),
      });
    } catch { /* Keep a successfully saved schedule even if audit storage is not ready yet. */ }
    return { ...schedule, persisted: true, storageAvailable: true, updatedAt: rows?.[0]?.updated_at ?? updatedAt };
  }
  async function getAuditEvents() {
    const rows = await request('masarak_admin_audit_events?select=action,target_id,details,created_at&order=created_at.desc&limit=30');
    if (!Array.isArray(rows)) throw Object.assign(new Error('Invalid admin audit log'), { status: 502 });
    return rows.filter(row => ['learning_resource_saved', 'jobs_refresh_requested', 'jobs_schedule_updated'].includes(row.action)
      && typeof row.target_id === 'string' && typeof row.created_at === 'string')
      .map(({ action, target_id, details, created_at }) => ({ action, targetId: target_id, details: details && typeof details === 'object' ? details : {}, createdAt: created_at }));
  }
  return { isConfigured, getPublicResources, getAdminResources, getAuditEvents, saveResource, auditRefresh, getJobsSchedule, saveJobsSchedule };
}

export const sharedAdminStore = createAdminStore();
