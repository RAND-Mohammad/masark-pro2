import { captureDataScope, invalidateDataScope, readScopedRaw, updateScopedRaw, withoutChangeTracking, replaceScopedItems } from './scoped-storage';
import { readPersonalProfile, PERSONAL_PROFILE_KEY } from './personal-profile';
import { readSkillProfile, SKILL_PROFILE_KEY } from './skill-profile';
import { readLearningPlan, LEARNING_PLAN_KEY } from './learning-plan';
import { readLearningProgress, LEARNING_PROGRESS_KEY } from './learning-progress';
import { readProfessionalCertifications, PROFESSIONAL_CERTIFICATIONS_KEY } from './professional-certifications';
import { loadSavedCv, prepareSavedCvRestore } from './saved-cv';
import { cvBytes, downloadCloudCv } from './cloud-files';
import { CLOUD_META_KEY, parseCloudMeta, parseCloudSnapshot, type CloudMeta, type CloudRecord, type CloudSnapshot } from './cloud-types';
import { synchronizeAccount, type SyncChoice, type CloudResult, type CloudPorts } from './cloud-engine';
import { createAccountClient } from './supabase';
import type { Session } from '@supabase/supabase-js';
import { readInterviewHistory, INTERVIEW_HISTORY_KEY } from './interview-history';
import { readJobTarget, JOB_TARGET_KEY } from './job-target';

export function cloudErrorMessage(error: unknown): string {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  if (['42P01', 'PGRST205', 'PGRST202'].includes(code)) return 'الحفظ السحابي يحتاج تطبيق إعداد الجداول في Supabase أولًا.';
  if (['42501', 'PGRST301'].includes(code)) return 'تعذر الوصول إلى بيانات الحساب. سجّل الدخول مجددًا وتحقق من إعداد صلاحيات الحفظ.';
  return 'تعذرت المزامنة الآن. بيانات الجهاز محفوظة؛ تحقق من الإنترنت ثم أعد المحاولة.';
}
export function createCloudRuntime(getSession: () => Session | null, onRestoring: (busy: boolean) => void) {
  let scope = captureDataScope();
  let stopped = false;
  const lifetime = new AbortController();
  let pending: Promise<unknown> = Promise.resolve();
  const check = () => { if (stopped) throw new Error('Cloud runtime stopped'); scope.assertCurrent(); if (!scope.owner || getSession()?.user.id !== scope.owner) throw new Error('Account changed'); };
  const meta = async () => { check(); return parseCloudMeta(await readScopedRaw(CLOUD_META_KEY, scope)); };
  const changeMeta = async (change: (value: CloudMeta) => CloudMeta) => {
    check();
    await updateScopedRaw(CLOUD_META_KEY, raw => { check(); return JSON.stringify(change(parseCloudMeta(raw))); }, scope);
    check();
  };
  const localData = async () => {
    const [personal, skills, plan, learningProgress, professionalCertifications, cv] = await Promise.all([readPersonalProfile(), readSkillProfile(), readLearningPlan(), readLearningProgress(), readProfessionalCertifications(), loadSavedCv()]); check();
    const [interviews, jobTarget] = await Promise.all([readInterviewHistory(), readJobTarget()]); check();
    return { personal, skills, plan, learningProgress, professionalCertifications, cv, interviews, jobTarget };
  };
  const describeLocal = (data: Awaited<ReturnType<typeof localData>>) => JSON.stringify({ personal: data.personal, skills: data.skills, plan: data.plan, learningProgress: data.learningProgress, professionalCertifications: data.professionalCertifications, cv: data.cv ? { identity: data.cv.file_id, name: data.cv.asset.name, size: data.cv.asset.size, mimeType: data.cv.asset.mimeType, review: data.cv.review } : null, interviews: data.interviews, ...(data.jobTarget ? { jobTarget: data.jobTarget } : {}) });
  async function sync(choice: SyncChoice = 'auto', enable = false): Promise<CloudResult> {
    const operation = pending.then(async () => {
      check();
      // Bind every request to this account's token; a later sign-out cannot redirect A's payload to B.
      const client = createAccountClient(getSession()!, lifetime.signal);
      const owner = scope.owner!;
      const ports: CloudPorts = {
        assertCurrent: check, readMeta: meta, changeMeta,
        localState: async () => describeLocal(await localData()),
        readRemote: async () => {
          const { data, error } = await client.from('masarak_account_data').select('user_id,revision,snapshot,updated_at').eq('user_id', owner).maybeSingle();
          check(); if (error) throw error;
          if (!data) return null;
          if (data.user_id !== owner || !Number.isSafeInteger(data.revision) || data.revision < 1) throw new Error('Invalid cloud owner');
          return { revision: data.revision, snapshot: parseCloudSnapshot(data.snapshot, owner), updated_at: data.updated_at };
        },
        hasLocalData: async () => {
          const [personal, skills, plan, learningProgress, professionalCertifications, cv] = await Promise.all([readPersonalProfile(), readSkillProfile(), readLearningPlan(), readLearningProgress(), readProfessionalCertifications(), loadSavedCv()]);
          check();
          return !!(personal || skills || plan.length || Object.keys(learningProgress).length || professionalCertifications.length || cv || (await readInterviewHistory()).length || await readJobTarget());
        },
        prepareUpload: async () => {
          const [data, metadata] = await Promise.all([localData(), meta()]);
          const { personal, skills, plan, learningProgress, professionalCertifications, cv: saved, interviews } = data;
          check();
          let cv: CloudSnapshot['cv'] = null;
          let binding: CloudMeta['fileBinding'] = null;
          let createdPath: string | null = null;
          if (saved) {
            const existingBinding = metadata.fileBinding;
            let path = existingBinding && existingBinding.identity === saved.file_id ? existingBinding.path : null;
            if (!path) {
              const bytes = await cvBytes(saved.asset); check();
              path = `${owner}/cv-${Date.now()}-${Math.random().toString(36).slice(2)}.${saved.asset.name.toLowerCase().endsWith('.pdf') ? 'pdf' : 'docx'}`;
              const mime = saved.asset.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
              const { error } = await client.storage.from('masarak-cvs').upload(path, bytes, { contentType: mime, upsert: false });
              if (error) throw error;
              createdPath = path; check();
            }
            const size = saved.asset.size ?? (await cvBytes(saved.asset)).byteLength;
            cv = { path, name: saved.asset.name, size, mimeType: saved.asset.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', review: saved.review };
            binding = { identity: saved.file_id!, path };
          }
          const snapshot = parseCloudSnapshot({ version: 1, personal, skills, plan, learningProgress, professionalCertifications, cv, interviews, jobTarget: data.jobTarget }, owner);
          return { snapshot, localState: describeLocal(data), binding, cleanup: async () => { if (createdPath) await client.storage.from('masarak-cvs').remove([createdPath]); } };
        },
        saveRemote: async (snapshot, expected) => {
          check();
          const { data, error } = await client.rpc('save_masarak_account', { p_snapshot: snapshot, p_expected_revision: expected });
          if (error) throw error;
          const row = Array.isArray(data) ? data[0] : null;
          if (!row || row.user_id !== owner || !Number.isSafeInteger(row.revision)) throw new Error('Invalid cloud response');
          return { revision: row.revision, snapshot, updated_at: row.updated_at } as CloudRecord;
        },
        restore: async snapshot => {
          check(); onRestoring(true);
          let downloaded: Awaited<ReturnType<typeof downloadCloudCv>> | null = null;
          try {
            const before = (await meta()).localVersion;
            if (snapshot.cv) downloaded = await downloadCloudCv(client, snapshot.cv, lifetime.signal);
            check();
            if ((await meta()).localVersion !== before) throw new Error('Local data changed during download');
            // Cancel old file-analysis responses and queued edits before applying another device's snapshot.
            invalidateDataScope(); scope = captureDataScope(); check();
            return await withoutChangeTracking(owner, async () => {
              const staged = await prepareSavedCvRestore(downloaded?.asset ?? null, snapshot.cv?.review ?? null);
              try {
                const saved = await staged.commit(); check();
                await replaceScopedItems([
                  [PERSONAL_PROFILE_KEY, snapshot.personal ? JSON.stringify(snapshot.personal) : null],
                  [SKILL_PROFILE_KEY, snapshot.skills ? JSON.stringify(snapshot.skills) : null],
                  [LEARNING_PLAN_KEY, JSON.stringify(snapshot.plan)],
                  [LEARNING_PROGRESS_KEY, JSON.stringify(snapshot.learningProgress)],
                  [PROFESSIONAL_CERTIFICATIONS_KEY, JSON.stringify(snapshot.professionalCertifications)],
                  [INTERVIEW_HISTORY_KEY, JSON.stringify(snapshot.interviews ?? [])],
                  ...(snapshot.jobTarget !== undefined ? [[JOB_TARGET_KEY, snapshot.jobTarget ? JSON.stringify(snapshot.jobTarget) : null] as [string, string | null]] : []),
                ], scope);
                check(); await staged.finish().catch(() => undefined);
                return { binding: saved && snapshot.cv ? { identity: saved.file_id!, path: snapshot.cv.path } : null, localState: describeLocal(await localData()) };
              } catch (error) { await staged.rollback(); throw error; }
            });
          } finally { await downloaded?.cleanup(); onRestoring(false); }
        },
        cleanupPrevious: async (oldSnapshot, snapshot) => {
          if (oldSnapshot?.cv && oldSnapshot.cv.path !== snapshot.cv?.path) await client.storage.from('masarak-cvs').remove([oldSnapshot.cv.path]);
        },
      };
      return synchronizeAccount(ports, choice, enable);
    });
    pending = operation.catch(() => undefined);
    return operation;
  }
  return { sync, meta, pause: () => changeMeta(m => ({ ...m, enabled: false, paused: true })), stop: () => { stopped = true; lifetime.abort(); } };
}
