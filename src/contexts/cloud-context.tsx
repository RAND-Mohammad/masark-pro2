import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { useAuth } from './auth-context';
import { createCloudRuntime, cloudErrorMessage } from '../utils/cloud-runtime';
import { enableCloudChangeTracking, subscribeDataChanges } from '../utils/scoped-storage';
import type { SyncChoice, CloudResult } from '../utils/cloud-engine';

type CloudState = { ready: boolean; restoring: boolean; busy: boolean; enabled: boolean; restoreVersion: number; status: CloudResult | 'checking'; error: string; lastSynced: string | null; synchronize: (choice?: SyncChoice, enable?: boolean) => Promise<void>; pause: () => Promise<void> };
const Context = createContext<CloudState | null>(null);
export function CloudProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const accountId = auth.session?.user.id ?? null;
  const sessionRef = useRef(auth.session);
  useEffect(() => { sessionRef.current = auth.session; }, [auth.session]);
  const runtime = useRef<ReturnType<typeof createCloudRuntime> | null>(null);
  const [ready, setReady] = useState(!accountId);
  const [restoring, setRestoring] = useState(false);
  const [busy, setBusy] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [restoreVersion, setRestoreVersion] = useState(0);
  const [status, setStatus] = useState<CloudState['status']>(accountId ? 'checking' : 'disabled');
  const [error, setError] = useState('');
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const alive = useRef(true);
  const running = useRef(new Set<ReturnType<typeof createCloudRuntime>>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const synchronizeRef = useRef<CloudState['synchronize']>(async () => {});
  const synchronize = useCallback(async (choice: SyncChoice = 'auto', enable = false) => {
    const current = runtime.current;
    if (!current || running.current.has(current)) return;
    const stillCurrent = () => alive.current && runtime.current === current;
    running.current.add(current); setBusy(true); setError('');
    try {
      const result = await current.sync(choice, enable);
      if (!stillCurrent()) return;
      setStatus(result);
      const meta = await current.meta();
      if (!stillCurrent()) return;
      setLastSynced(meta.lastSynced);
      setEnabled(meta.enabled);
      if (result === 'pending' && meta.enabled && !meta.paused) timer.current = setTimeout(() => { void synchronizeRef.current(); }, 1000);
    } catch (failure) { if (stillCurrent()) { setError(cloudErrorMessage(failure)); setStatus('pending'); } }
    finally { running.current.delete(current); if (stillCurrent()) { setBusy(false); setRestoring(false); setReady(true); } }
  }, []);
  useEffect(() => { synchronizeRef.current = synchronize; }, [synchronize]);
  useEffect(() => {
    alive.current = true; enableCloudChangeTracking();
    if (!auth.ready) return;
    if (!accountId) return () => { alive.current = false; };
    const current: ReturnType<typeof createCloudRuntime> = createCloudRuntime(() => sessionRef.current, value => { if (alive.current && runtime.current === current) { if (value) setRestoring(true); else setRestoreVersion(v => v + 1); } });
    runtime.current = current;
    queueMicrotask(() => { if (alive.current) void synchronizeRef.current(); });
    const unsubscribe = subscribeDataChanges((scope, failed) => {
      if (scope.owner !== accountId || !alive.current) return;
      if (failed) { setStatus('pending'); setError('حُفظت البيانات على الجهاز، لكن تعذر تجهيز مزامنتها. أعد المحاولة قبل إغلاق التطبيق.'); return; }
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => { void current.meta().then(meta => { if (alive.current && runtime.current === current && meta.enabled && !meta.paused) { setStatus('pending'); void synchronizeRef.current(); } }).catch(() => undefined); }, 900);
    });
    const appState = AppState.addEventListener('change', state => { if (state === 'active') void current.meta().then(meta => { if (alive.current && runtime.current === current && meta.enabled && !meta.paused) void synchronizeRef.current(); }).catch(() => undefined); });
    return () => { alive.current = false; unsubscribe(); appState.remove(); current.stop(); runtime.current = null; if (timer.current) clearTimeout(timer.current); };
  }, [auth.ready, accountId]);
  async function pause() {
    const current = runtime.current;
    if (!current || running.current.has(current)) return;
    running.current.add(current); setBusy(true);
    const stillCurrent = () => alive.current && runtime.current === current;
    try { await current.pause(); if (stillCurrent()) { setStatus('paused'); setEnabled(false); setError(''); } } catch (failure) { if (stillCurrent()) setError(cloudErrorMessage(failure)); }
    finally { running.current.delete(current); if (stillCurrent()) setBusy(false); }
  }
  return <Context.Provider value={{ ready, restoring, busy, enabled, restoreVersion, status, error, lastSynced, synchronize, pause }}>{children}</Context.Provider>;
}
export function useCloud() { const value = useContext(Context); if (!value) throw new Error('CloudProvider missing'); return value; }
