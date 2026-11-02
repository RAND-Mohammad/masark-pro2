import express from 'express';
import { supabaseServiceHeaders } from './supabase-service-headers.mjs';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const safeSegment = /^[A-Za-z0-9._-]{1,200}$/;
const pageSize = 1000;
const maxObjects = 5000;
const removalBatchSize = 100;

function serviceRoleKey(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  const key = value.trim();
  if (/^sb_secret_[A-Za-z0-9_-]{20,}$/.test(key)) return true;
  const parts = key.split('.');
  if (parts.length !== 3) return false;
  try { return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')).role === 'service_role'; }
  catch { return false; }
}

function deletionError(code, status = 503) {
  return Object.assign(new Error(code), { code, status });
}

export function createAccountDeletionRouter({ authenticate, fetchImpl = fetch, env = process.env } = {}) {
  const router = express.Router();
  const deletionsInProgress = new Set();
  router.use(authenticate);

  async function adminFetch(path, key, init = {}) {
    const baseUrl = (env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim().replace(/\/$/, '');
    try {
      return await fetchImpl(`${baseUrl}${path}`, {
        ...init,
        headers: {
          ...supabaseServiceHeaders(key),
          'Content-Type': 'application/json',
          ...init.headers,
        },
        signal: init.signal ?? AbortSignal.timeout(20000),
        redirect: 'error',
        cache: 'no-store',
      });
    } catch { throw deletionError('UPSTREAM_UNAVAILABLE'); }
  }

  async function ownedStoragePaths(userId, key) {
    const found = [];
    const visited = new Set();

    async function visit(folder, depth) {
      if (depth > 8 || visited.has(folder)) throw deletionError('STORAGE_PATH_INVALID', 409);
      visited.add(folder);
      let offset = 0;
      while (true) {
        const response = await adminFetch('/storage/v1/object/list/masarak-cvs', key, {
          method: 'POST',
          body: JSON.stringify({ prefix: folder, limit: pageSize, offset, sortBy: { column: 'name', order: 'asc' } }),
        });
        if (!response.ok) throw deletionError(response.status === 401 || response.status === 403 ? 'SERVICE_ROLE_INVALID' : 'STORAGE_LIST_FAILED');
        let rows;
        try { rows = await response.json(); } catch { throw deletionError('STORAGE_LIST_FAILED'); }
        if (!Array.isArray(rows) || rows.some(item => !item || typeof item.name !== 'string')) throw deletionError('STORAGE_LIST_FAILED');
        for (const item of rows) {
          if (!safeSegment.test(item.name) || item.name === '.' || item.name === '..') throw deletionError('STORAGE_PATH_INVALID', 409);
          if (item.id === null) {
            await visit(`${folder}/${item.name}`, depth + 1);
          } else {
            const path = `${folder}/${item.name}`;
            if (!path.startsWith(`${userId}/`) || path.split('/').some(segment => segment === '.' || segment === '..')) throw deletionError('STORAGE_PATH_INVALID', 409);
            found.push(path);
            if (found.length > maxObjects) throw deletionError('STORAGE_OBJECT_LIMIT', 409);
          }
        }
        if (rows.length < pageSize) break;
        offset += rows.length;
      }
    }

    await visit(userId, 0);
    return [...new Set(found)];
  }

  async function deleteOwnedStorage(userId, key) {
    let removed = 0;
    // Repeat listing after each pass to catch a completed upload racing the delete request.
    for (let pass = 0; pass < 3; pass++) {
      const paths = await ownedStoragePaths(userId, key);
      if (!paths.length) return removed;
      for (let index = 0; index < paths.length; index += removalBatchSize) {
        const batch = paths.slice(index, index + removalBatchSize);
        const response = await adminFetch('/storage/v1/object/masarak-cvs', key, {
          method: 'DELETE', body: JSON.stringify({ prefixes: batch }),
        });
        if (!response.ok) throw deletionError(response.status === 401 || response.status === 403 ? 'SERVICE_ROLE_INVALID' : 'STORAGE_DELETE_FAILED');
        removed += batch.length;
      }
    }
    if ((await ownedStoragePaths(userId, key)).length) throw deletionError('STORAGE_NOT_EMPTY', 409);
    return removed;
  }

  async function lockAccount(userId, key) {
    const response = await adminFetch('/rest/v1/masarak_account_deletions?on_conflict=user_id', key, {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ user_id: userId }),
    });
    if (!response.ok) throw deletionError(response.status === 401 || response.status === 403 ? 'SERVICE_ROLE_INVALID' : 'DELETION_LOCK_FAILED');
  }

  router.post('/delete', express.json({ limit: '2kb', strict: true }), async (req, res) => {
    const userId = res.locals.cvUser?.id?.toLowerCase();
    if (!userId || !uuidPattern.test(userId)) return res.status(401).json({ error: 'سجّل الدخول مجددًا.' });
    if (req.body?.confirmation !== 'DELETE') return res.status(400).json({ error: 'التأكيد غير مكتمل.' });

    const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    const baseUrl = (env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim().replace(/\/$/, '');
    if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(baseUrl) || !serviceRoleKey(key)) {
      return res.status(503).json({ error: 'إعداد حذف الحساب على الخادم غير مكتمل.' });
    }
    if (deletionsInProgress.has(userId)) return res.status(409).json({ error: 'حذف الحساب جارٍ بالفعل. انتظري قليلًا ثم أعيدي المحاولة.', deletionStarted: true });
    deletionsInProgress.add(userId);

    let deletionStarted = false;
    try {
      // The RLS lock prevents other devices from uploading while Storage is cleaned.
      await lockAccount(userId, key);
      deletionStarted = true;
      const removedStorageFiles = await deleteOwnedStorage(userId, key);
      const response = await adminFetch(`/auth/v1/admin/users/${encodeURIComponent(userId)}`, key, {
        method: 'DELETE', body: JSON.stringify({ should_soft_delete: false }),
      });
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) throw deletionError('SERVICE_ROLE_INVALID');
        if (response.status === 404) throw deletionError('AUTH_USER_NOT_FOUND', 409);
        throw deletionError('AUTH_DELETE_FAILED', 409);
      }
      return res.json({ deleted: true, removedStorageFiles });
    } catch (error) {
      const code = error?.code ?? 'UPSTREAM_UNAVAILABLE';
      if (!deletionStarted && code === 'UPSTREAM_UNAVAILABLE') deletionStarted = true;
      const status = error?.status ?? 503;
      const messages = {
        SERVICE_ROLE_INVALID: 'تحققي من إعداد مفتاح الخدمة السري على الخادم.',
        STORAGE_LIST_FAILED: 'تعذر التحقق من ملفات الحساب في التخزين. لم يُحذف الحساب؛ أعيدي المحاولة.',
        STORAGE_DELETE_FAILED: 'تعذر حذف كل ملفات الحساب. لم يُحذف الحساب؛ أعيدي المحاولة.',
        STORAGE_NOT_EMPTY: 'ما زالت بعض ملفات الحساب في التخزين. لم يُحذف الحساب؛ أعيدي المحاولة.',
        STORAGE_PATH_INVALID: 'تعذر التحقق من مسارات ملفات الحساب بأمان. لم يُحذف الحساب.',
        STORAGE_OBJECT_LIMIT: 'عدد ملفات الحساب يتجاوز حد الحذف الآمن. لم يُحذف الحساب؛ تواصلي مع الدعم.',
        AUTH_USER_NOT_FOUND: 'تعذر العثور على الحساب في خدمة المصادقة.',
        AUTH_DELETE_FAILED: 'تعذر حذف الحساب من خدمة المصادقة. لم يكتمل الطلب؛ أعيدي المحاولة أو تواصلي مع الدعم.',
        DELETION_LOCK_FAILED: 'تعذر بدء حذف الحساب بأمان. تحققي من تطبيق supabase/005_account_erasure.sql ثم أعيدي المحاولة.',
        UPSTREAM_UNAVAILABLE: 'تعذر الاتصال بخدمات Supabase. لم يتأكد حذف الحساب؛ تحققي من الاتصال ثم أعيدي المحاولة.',
      };
      return res.status(status).json({ error: messages[code] ?? messages.UPSTREAM_UNAVAILABLE, deletionStarted });
    } finally { deletionsInProgress.delete(userId); }
  });

  router.use((error, _req, res, _next) => res.status(error.status === 413 ? 413 : 400).json({ error: 'تعذر قراءة طلب حذف الحساب أو تجاوز الحجم المسموح.' }));
  return router;
}
