import NativeAsyncStorage from '@react-native-async-storage/async-storage';
import { CLOUD_META_KEY } from './cloud-types';
import { INTERVIEW_HISTORY_KEY } from './interview-history';
import { JOB_TARGET_KEY } from './job-target';
import { LEARNING_PLAN_KEY } from './learning-plan';
import { LEARNING_PROGRESS_KEY } from './learning-progress';
import { PERSONAL_PROFILE_KEY } from './personal-profile';
import { PROFESSIONAL_CERTIFICATIONS_KEY } from './professional-certifications';
import { deleteSavedCv } from './saved-cv';
import { invalidateDataScope, captureDataScope } from './scoped-storage';
import { SKILL_PROFILE_KEY } from './skill-profile';

const accountDataKeys = [
  CLOUD_META_KEY,
  INTERVIEW_HISTORY_KEY,
  JOB_TARGET_KEY,
  LEARNING_PLAN_KEY,
  LEARNING_PROGRESS_KEY,
  PERSONAL_PROFILE_KEY,
  PROFESSIONAL_CERTIFICATIONS_KEY,
  SKILL_PROFILE_KEY,
] as const;

export async function clearAccountLocalData(accountId: string): Promise<void> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(accountId)) throw new Error('معرّف الحساب غير صالح.');
  const normalizedId = accountId.toLowerCase();
  if (captureDataScope().owner?.toLowerCase() !== normalizedId) throw new Error('تغيّر الحساب قبل إكمال حذف بيانات الجهاز.');
  invalidateDataScope();
  await deleteSavedCv();
  const physicalKeys = accountDataKeys.map(key => `${key}:account:${normalizedId}`);
  await NativeAsyncStorage.multiRemove(physicalKeys);
}
