import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { captureDataScope, readScopedRaw, updateScopedRaw } from '../utils/scoped-storage';
import { compareJobDigests, jobDigest, type JobDigest } from '../utils/job-updates';
import type { MarketDataset } from './use-market-jobs';
const key = 'masarak-market-seen-v1';
function parse(raw: string): JobDigest {
  const value = JSON.parse(raw);
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length > 250
    || Object.values(value).some(hash => typeof hash !== 'string' || !/^[a-f0-9]{1,8}$/.test(hash))) throw new Error('Invalid job update history');
  return value;
}
export function useJobUpdates(data: MarketDataset | null) {
  const [changes, setChanges] = useState<{ data: MarketDataset; added: string[]; changed: string[] } | null>(null);
  const [error, setError] = useState('');
  useFocusEffect(useCallback(() => {
    if (!data) return;
    let active = true; const scope = captureDataScope();
    const current = jobDigest(data.jobs);
    readScopedRaw(key, scope).then(async raw => {
      if (!raw) { await updateScopedRaw(key, () => JSON.stringify(current), scope); scope.assertCurrent(); }
      const difference = raw ? compareJobDigests(parse(raw), current) : { added: [], changed: [] };
      if (active) { setChanges({ data, ...difference }); setError(''); }
    }).catch(() => { if (active) setError('تعذر قراءة سجل تحديثات الوظائف.'); });
    return () => { active = false; };
  }, [data]));
  async function markSeen() {
    if (!data) return;
    const scope = captureDataScope();
    try { await updateScopedRaw(key, () => JSON.stringify(jobDigest(data.jobs)), scope); scope.assertCurrent(); setChanges({ data, added: [], changed: [] }); setError(''); }
    catch { setError('تعذر حفظ متابعة الوظائف.'); }
  }
  return { added: changes?.data === data ? changes.added : [], changed: changes?.data === data ? changes.changed : [], error, markSeen };
}
