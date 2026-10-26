import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../contexts/auth-context';
import { getMarketJobs, jobCategories, type JobsResult, type MarketJob } from '../utils/jobs-api';
import { captureDataScope } from '../utils/scoped-storage';

const shared = new Map<string, { until: number; request: Promise<MarketDataset>; assertCurrent: () => void }>();
export type MarketDataset = { jobs: MarketJob[]; groupIds: Record<string, string[]>; snapshots: string[]; fetchedAt: string; partial: boolean; hasMore: boolean };
async function loadMarket(account: string): Promise<MarketDataset> {
  const scope = captureDataScope();
  if (scope.owner !== account) throw new Error('تغيّر الحساب أثناء جلب الوظائف.');
  const key = scope.key('market-jobs');
  const cached = shared.get(key);
  if (cached && cached.until > Date.now()) {
    try { cached.assertCurrent(); return cached.request; } catch { shared.delete(key); }
  }
  const request = Promise.allSettled(jobCategories.map(item => getMarketJobs(item.id))).then(results => {
    scope.assertCurrent();
    const success = results.flatMap(result => result.status === 'fulfilled' ? [result.value] : []) as JobsResult[];
    if (!success.length) throw new Error('تعذر تحميل إعلانات الوظائف. تأكد من تشغيل السيرفر ثم أعد المحاولة.');
    const jobs = new Map<string, MarketJob>();
    for (const group of success) for (const job of group.jobs) jobs.set(job.id, job);
    return { jobs: [...jobs.values()], groupIds: Object.fromEntries(success.map(result => [result.category, result.jobs.map(job => job.id)])), snapshots: [...new Set(success.map(result => result.sourceSnapshotAt))].sort(),
      fetchedAt: success.map(result => result.fetchedAt).sort().at(-1)!, partial: success.length !== results.length, hasMore: success.some(result => result.hasMore) };
  });
  // النتيجة عامة، لكن طلب كل حساب يبقى منفصل عن الثاني.
  shared.set(key, { until: Date.now() + 60000, request, assertCurrent: scope.assertCurrent });
  if (shared.size > 8) for (const candidate of shared.keys()) if (candidate !== key) { shared.delete(candidate); break; }
  try { return await request; } catch (error) { if (shared.get(key)?.request === request) shared.delete(key); throw error; }
}
export function useMarketJobs() {
  const auth = useAuth();
  const account = auth.session?.user.id;
  const [state, setState] = useState<{ account: string; data: MarketDataset | null; error: string } | null>(null);
  const active = useRef(false);
  const revision = useRef(0);
  const refresh = useCallback(async () => {
    if (!auth.ready || !account) return;
    const request = ++revision.current;
    try {
      const data = await loadMarket(account);
      if (active.current && request === revision.current) setState({ account, data, error: '' });
    } catch (error) {
      if (active.current && request === revision.current) setState({ account, data: null, error: error instanceof Error ? error.message : 'تعذر جلب الوظائف.' });
    }
  }, [auth.ready, account]);
  useFocusEffect(useCallback(() => {
    active.current = true;
    void refresh();
    const timer = setInterval(() => void refresh(), 60000);
    return () => { active.current = false; revision.current++; clearInterval(timer); };
  }, [refresh]));
  const current = account && state?.account === account ? state : null;
  return { data: current?.data ?? null, error: current?.error ?? '', loading: Boolean(auth.ready && account && !current), refresh };
}
