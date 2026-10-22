import type { SupabaseClient } from '@supabase/supabase-js';

export const SIGNUP_CODE_LENGTH = 6;
export const SIGNUP_RESEND_DELAY_MS = 60_000;

export function normalizeSignupCode(value: string): string {
  return value.replace(/[٠-٩۰-۹]/g, character => {
    const code = character.charCodeAt(0);
    return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
  }).replace(/\s/g, '');
}

export function signupCodeIsValid(value: string): boolean {
  return /^[0-9]{6}$/.test(normalizeSignupCode(value));
}

export function signupResendSeconds(availableAt: number, now: number): number {
  return Math.max(0, Math.ceil((availableAt - now) / 1000));
}

export async function confirmSignupEmail(
  client: Pick<SupabaseClient['auth'], 'verifyOtp'>,
  email: string,
  code: string,
) {
  if (!signupCodeIsValid(code)) throw new Error('أدخل رمز التأكيد المكوّن من ٦ أرقام.');
  const result = await client.verifyOtp({
    email: email.trim().toLowerCase(),
    token: normalizeSignupCode(code),
    type: 'email',
  });
  if (result.error) throw result.error;
  if (!result.data.session) throw new Error('Email confirmation did not return a session');
  return result.data.session;
}
