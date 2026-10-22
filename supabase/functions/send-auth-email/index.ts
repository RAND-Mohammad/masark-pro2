import { Webhook } from 'npm:standardwebhooks@1.0.0';
import { createAuthEmailHandler } from './handler.ts';

// The gateway's JWT check must be disabled for this function only.
// Every email still requires a valid, recent Supabase webhook signature.
Deno.serve(createAuthEmailHandler({
  Webhook,
  getEnv: (name: string) => Deno.env.get(name),
}));
