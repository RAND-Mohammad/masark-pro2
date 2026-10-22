import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { AppState, Platform } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import { authConfigured, supabase } from '../utils/supabase';
import { setDataOwner } from '../utils/scoped-storage';
import { parseAuthLink } from '../utils/auth-links';
import { authErrorMessage } from '../utils/auth-errors';
import { restoreVerifiedSession } from '../utils/verified-session';

type AuthState = { session: Session | null; ready: boolean; error: string; configured: boolean; callbackBusy: boolean; callbackError: string; recoveryPending: boolean; completeLogin: () => void; finishRecovery: () => void; reload: () => void; signOut: () => Promise<void> };
const AuthContext = createContext<AuthState | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [callbackBusy, setCallbackBusy] = useState(false);
  const [callbackError, setCallbackError] = useState('');
  const [recoveryPending, setRecoveryPending] = useState(false);
  const incomingUrl = Linking.useLinkingURL();
  const lastLink = useRef('');
  const cleanedLink = useRef('');
  const [completedLink, setCompletedLink] = useState('');
  const navigatedLink = useRef('');
  const [loginRequest, setLoginRequest] = useState(0);
  const handledLogin = useRef(0);
  const initialized = useRef(false);
  const acceptSession = useCallback((next: Session | null) => {
    setDataOwner(next?.user.id ?? null);
    initialized.current = true;
    setSession(next);
    if (!next) setRecoveryPending(false);
    setError('');
    setReady(true);
  }, []);
  useEffect(() => {
    let active = true;
    initialized.current = false;
    let revision = 0;
    const client = supabase;
    const subscription = client?.auth.onAuthStateChange((_event, next) => {
      revision += 1;
      if (active && _event === 'PASSWORD_RECOVERY') setRecoveryPending(true);
      if (active && initialized.current && _event !== 'INITIAL_SESSION') acceptSession(next);
    }).data.subscription;
    const load = async () => {
      try {
        for (let retry = 0; retry < 5; retry++) {
          const before = revision;
          const restored = client ? await restoreVerifiedSession(client) : null;
          if (!active) return;
          if (before !== revision) continue;
          acceptSession(restored);
          return;
        }
        throw new Error('Session changed during initialization');
      } catch {
        if (active && !initialized.current) {
          try { await client?.auth.signOut({ scope: 'local' }); }
          catch { /* A local sign-out error must not block startup as a guest. */ }
          if (active && !initialized.current) acceptSession(null);
        }
      }
    };
    void load();
    const appState = Platform.OS !== 'web' && client ? AppState.addEventListener('change', state => {
      if (state === 'active') client.auth.startAutoRefresh();
      else client.auth.stopAutoRefresh();
    }) : null;
    if (Platform.OS !== 'web' && client && AppState.currentState === 'active') client.auth.startAutoRefresh();
    return () => { active = false; subscription?.unsubscribe(); appState?.remove(); if (Platform.OS !== 'web') client?.auth.stopAutoRefresh(); };
  }, [acceptSession, attempt]);
  useEffect(() => {
    if (!incomingUrl || lastLink.current === incomingUrl || cleanedLink.current === incomingUrl) return;
    const consumeLink = async () => {
      await Promise.resolve();
      let parsed;
      try {
        parsed = parseAuthLink(incomingUrl, () => {
          if (Platform.OS === 'web' && typeof window !== 'undefined') {
            cleanedLink.current = window.location.origin + window.location.pathname;
            window.history.replaceState(window.history.state, '', window.location.pathname);
          }
        });
      }
      catch (failure) { setCallbackError(failure instanceof Error ? failure.message : 'تعذر تأكيد الرابط.'); return; }
      if (!parsed) return;
      lastLink.current = incomingUrl;
      setCallbackBusy(true); setCallbackError(''); setRecoveryPending(parsed.recovery);
      try {
        if (!supabase) throw new Error('الحسابات غير متاحة حاليًا.');
        const result = await supabase.auth.setSession({ access_token: parsed.access_token, refresh_token: parsed.refresh_token });
        if (result.error) throw result.error;
        setCompletedLink(incomingUrl);
      } catch (failure) { setCallbackError(authErrorMessage(failure)); setRecoveryPending(false); }
      finally { setCallbackBusy(false); }
    };
    void consumeLink();
  }, [incomingUrl]);
  useEffect(() => {
    if (!ready || !session || callbackBusy || callbackError || !completedLink || navigatedLink.current === completedLink) return;
    navigatedLink.current = completedLink;
    router.replace(recoveryPending ? '/reset-password' : '/home');
  }, [ready, session, callbackBusy, callbackError, completedLink, recoveryPending, router]);
  useEffect(() => {
    if (!ready || !session || callbackBusy || recoveryPending || handledLogin.current === loginRequest) return;
    handledLogin.current = loginRequest;
    router.replace('/home');
  }, [ready, session, callbackBusy, recoveryPending, loginRequest, router]);
  async function signOut() {
    if (!supabase) return;
    const { error: failure } = await supabase.auth.signOut({ scope: 'local' });
    if (failure) throw failure;
    setRecoveryPending(false);
    acceptSession(null);
  }
  return <AuthContext.Provider value={{ session, ready, error, configured: authConfigured, callbackBusy, callbackError, recoveryPending, completeLogin: () => setLoginRequest(value => value + 1), finishRecovery: () => setRecoveryPending(false), reload: () => setAttempt(value => value + 1), signOut }}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('AuthProvider missing');
  return value;
}
