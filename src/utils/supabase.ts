import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { authStorage } from './auth-storage';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? '';
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ?? '';
export const authConfigured = /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url) && key.startsWith('sb_publishable_');
// Never use a service-role/secret key in a mobile bundle.
export const supabase = authConfigured ? createClient(url, key, {
  auth: { storage: authStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, flowType: 'implicit' },
}) : null;

// A request keeps its original identity even if the global SDK session changes mid-flight.
let requestClientNumber = 0;
export function createAccountClient(session: import('@supabase/supabase-js').Session, parentSignal?: AbortSignal) {
  if (!authConfigured || !session.access_token) throw new Error('Account client unavailable');
  return createClient(url, key, {
    auth: { storageKey: `masarak-request-client-${++requestClientNumber}`, persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      headers: { Authorization: `Bearer ${session.access_token}` },
      fetch: async (input, init) => {
        const controller = new AbortController();
        const signals = [init?.signal, parentSignal].filter((signal): signal is AbortSignal => !!signal);
        const abort = () => controller.abort();
        for (const signal of signals) { if (signal.aborted) abort(); else signal.addEventListener('abort', abort, { once: true }); }
        const timer = setTimeout(abort, String(input).includes('/storage/v1/') ? 60000 : 15000);
        try { return await fetch(input, { ...init, signal: controller.signal }); }
        finally { clearTimeout(timer); for (const signal of signals) signal.removeEventListener('abort', abort); }
      },
    },
  });
}
