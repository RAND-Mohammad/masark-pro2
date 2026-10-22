// Validate with the project's Auth server; never trust locally decoded JWT claims.
export function createCvSessionGuard({
  url = process.env.EXPO_PUBLIC_SUPABASE_URL,
  key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  fetchImpl = fetch,
} = {}) {
  const projectUrl = url?.trim().replace(/\/$/, '');
  const publicKey = key?.trim();
  return async (req, res, next) => {
    const header = req.get('Authorization');
    const match = typeof header === 'string' && /^Bearer ([^\s,]+)$/i.exec(header);
    const unauthorized = () => res.status(401).json({ error: 'سجّل الدخول مجددًا لتحليل السيرة.' });
    if (!match || match[1].length > 8192) return unauthorized();
    if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(projectUrl ?? '') || !publicKey?.startsWith('sb_publishable_')) {
      return res.status(503).json({ error: 'خدمة التحقق من الجلسة غير مهيأة.' });
    }
    try {
      // Equivalent to Supabase auth.getUser(accessToken), not getSession/JWT decoding.
      const response = await fetchImpl(`${projectUrl}/auth/v1/user`, {
        method: 'GET',
        headers: { apikey: publicKey, Authorization: `Bearer ${match[1]}` },
        signal: AbortSignal.timeout(10000),
        redirect: 'error',
        cache: 'no-store',
      });
      if (response.status === 401 || response.status === 403) return unauthorized();
      if (!response.ok) throw new Error('Auth unavailable');
      const user = await response.json();
      if (!user || typeof user.id !== 'string' || !user.id.trim()) throw new Error('Invalid Auth response');
      // Only the identity returned by Supabase is trusted; client user_id is ignored.
      res.locals.cvUser = { id: user.id };
      return next();
    } catch {
      // Fail closed without exposing tokens, upstream responses or configuration.
      return res.status(503).json({ error: 'تعذر التحقق من الجلسة الآن. حاول لاحقًا.' });
    }
  };
}
