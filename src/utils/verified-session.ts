import type { Session } from '@supabase/supabase-js';

type SessionClient = {
  auth: {
    getSession: () => Promise<{ data: { session: Session | null }; error: unknown }>;
    getUser: (token: string) => Promise<{ data: { user: Session['user'] | null }; error: unknown }>;
  };
};
export async function restoreVerifiedSession(client: SessionClient): Promise<Session | null> {
  const saved = await client.auth.getSession();
  if (saved.error) throw saved.error;
  if (!saved.data.session) return null;
  const verified = await client.auth.getUser(saved.data.session.access_token);
  if (verified.error) throw verified.error;
  if (!verified.data.user) throw new Error('Session could not be verified');
  return { ...saved.data.session, user: verified.data.user };
}
