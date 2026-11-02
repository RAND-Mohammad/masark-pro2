/**
 * Build headers for server-side Supabase service requests.
 * Opaque sb_secret_* keys belong in `apikey`; they are not JWT bearer tokens.
 * Legacy service_role JWTs still need both headers for REST and Storage APIs.
 */
export function supabaseServiceHeaders(key, extra = {}) {
  const value = typeof key === 'string' ? key.trim() : '';
  const headers = { apikey: value, ...extra };
  if (value && !value.startsWith('sb_')) headers.Authorization = `Bearer ${value}`;
  return headers;
}
