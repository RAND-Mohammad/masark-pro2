export type AuthLink = { access_token: string; refresh_token: string; recovery: boolean };
export function parseAuthLink(value: string, beforeRead?: () => void): AuthLink | null {
  let url: URL;
  try { url = new URL(value); } catch { return null; }
  if (!['http:', 'https:', 'exp:', 'exps:', 'masarak:'].includes(url.protocol)) return null;
  const callback = url.pathname.replace(/\/$/, '').endsWith('/auth-callback') || (url.protocol === 'masarak:' && url.hostname === 'auth-callback');
  if (!callback) return null;
  beforeRead?.();
  const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
  const get = (name: string) => hash.get(name) ?? url.searchParams.get(name);
  if (get('error') || get('error_code')) throw new Error('رابط التأكيد غير صالح أو انتهت صلاحيته. اطلب رسالة جديدة.');
  const access = get('access_token'); const refresh = get('refresh_token');
  if (!access || !refresh || access.length > 20000 || refresh.length > 20000) throw new Error('رابط التأكيد غير مكتمل. اطلب رسالة جديدة.');
  return { access_token: access, refresh_token: refresh, recovery: get('type') === 'recovery' };
}
