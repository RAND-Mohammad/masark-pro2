// Read-only diagnostics. Use the runtime environment; never print credentials.
try { process.loadEnvFile(new URL('../.env.local', import.meta.url)); } catch { /* Runtime environment is sufficient. */ }
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key?.startsWith('sb_publishable_')) throw Error('Missing valid public Supabase settings');
const response = await fetch(`${url.replace(/\/$/, '')}/auth/v1/settings`, { headers: { apikey: key }, signal: AbortSignal.timeout(15000) });
if (!response.ok) throw Error(`Supabase settings request failed (${response.status})`);
const settings = await response.json();
console.log(JSON.stringify({ reachable: true, email_login_enabled: settings.external?.email === true, signups_enabled: settings.disable_signup !== true, email_confirmation_required: settings.mailer_autoconfirm === false }));
