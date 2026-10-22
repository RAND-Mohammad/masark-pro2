// Keep one source for both the former Node hook and the Supabase Edge Function.
// Node 22.22+ supports these erasable TypeScript types without a build step.
export { buildAuthEmails, EmailPayloadError } from '../supabase/functions/_shared/auth-email-templates.ts';
