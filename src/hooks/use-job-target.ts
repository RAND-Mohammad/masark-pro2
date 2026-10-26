import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { readJobTarget, saveJobTarget, type JobTarget } from '../utils/job-target';
import type { MarketJob } from '../utils/jobs-api';
export function useJobTarget() {
  const [target, setTarget] = useState<JobTarget | null>(null);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const revision = useRef(0);
  useFocusEffect(useCallback(() => {
    let active = true; const current = ++revision.current; setReady(false);
    readJobTarget().then(value => { if (active && current === revision.current) { setTarget(value); setError(''); } })
      .catch(() => { if (active) setError('تعذر قراءة الوظيفة المستهدفة.'); })
      .finally(() => { if (active) setReady(true); });
    return () => { active = false; revision.current++; };
  }, []));
  async function choose(job: MarketJob | null) {
    if (locked.current || !ready) return false;
    locked.current = true; setBusy(true); const current = ++revision.current;
    try { const value = await saveJobTarget(job); if (current !== revision.current) return false; setTarget(value); setError(''); return true; }
    catch { if (current === revision.current) setError('تعذر حفظ الوظيفة المستهدفة.'); return false; }
    finally { locked.current = false; setBusy(false); }
  }
  return { target, error, ready, busy, choose };
}
