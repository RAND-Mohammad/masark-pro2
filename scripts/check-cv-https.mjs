import { mkdir, readFile, writeFile } from 'node:fs/promises';

if (!process.env.REPLIT_DEV_DOMAIN) throw new Error('Development domain unavailable');
const origin = `https://${process.env.REPLIT_DEV_DOMAIN}`;
const get = (url, options = {}) => fetch(url, { ...options, signal: AbortSignal.timeout(90000) });
const health = await get(`${origin}/api/cv/health`);
const healthBody = await health.json();
// Deliberately not a document: a parser would fail if auth did not run first.
const denied = await get(`${origin}/api/cv/analyze-cv`, {
  method: 'POST', headers: { 'Content-Type': 'multipart/form-data' },
  body: 'invalid multipart; no file, no token, no consent',
});
await denied.arrayBuffer();
const forbiddenRoute = await get(`${origin}/api/cv/api/auth/send-email`);
await forbiddenRoute.arrayBuffer();
const favicon = await get(`${origin}/favicon.ico`);
await favicon.arrayBuffer();
const tcp6 = await readFile('/proc/net/tcp6', 'utf8').catch(error => {
  if (error.code === 'ENOENT') return ''; // IPv6 is disabled in this container.
  throw error;
});
const tcp = (await readFile('/proc/net/tcp', 'utf8')) + tcp6;
const noCvTcpListener = !tcp.split('\n').some(line => {
  const fields = line.trim().split(/\s+/);
  return fields[1]?.endsWith(':0BB9') && fields[3] === '0A';
});
const unix = await readFile('/proc/net/unix', 'utf8');
const privateSocketPresent = unix.split('\n').some(line => /\/tmp\/masarak-cv-\d+\.sock$/.test(line));
const native = [];
for (const platform of ['android', 'ios']) {
  const manifestResponse = await get(origin, {
    headers: { accept: 'application/expo+json', 'expo-platform': platform, 'expo-protocol-version': '1' },
  });
  const manifest = await manifestResponse.json();
  const open = await get(`${origin}/_expo/open?platform=${platform}&runtime=expo`);
  const opening = await open.json();
  const link = new URL(opening.url);
  const asset = new URL(manifest.launchAsset.url);
  // Download exactly what Expo generated, never rewrite host, port or path.
  const bundle = await get(manifest.launchAsset.url);
  const decoder = new TextDecoder();
  let tail = '';
  let bytes = 0;
  let hasCvHttpsUrl = false;
  for await (const chunk of bundle.body) {
    bytes += chunk.byteLength;
    const text = tail + decoder.decode(chunk, { stream: true });
    hasCvHttpsUrl ||= text.includes(`${origin}/api/cv`);
    tail = text.slice(-512);
  }
  const result = {
    platform, manifest_http: manifestResponse.status, expo_open_http: open.status,
    generated_link_host_correct: link.hostname === new URL(origin).hostname,
    generated_link_default_port: !link.port || ['80', '443'].includes(link.port),
    asset_https_same_origin: asset.protocol === 'https:' && asset.origin === origin,
    bundle_requested_unmodified: true, bundle_http: bundle.status,
    bundle_javascript: /javascript/i.test(bundle.headers.get('content-type') || ''),
    bundle_bytes: bytes, bundle_contains_configured_cv_https_url: hasCvHttpsUrl,
  };
  result.pass = result.manifest_http === 200 && result.expo_open_http === 200
    && result.generated_link_host_correct && result.generated_link_default_port
    && result.asset_https_same_origin && result.bundle_http === 200 && result.bundle_javascript && hasCvHttpsUrl;
  native.push(result);
}
const report = {
  checked_at: new Date().toISOString(), scope: 'Development HTTPS and generated bundles only. No CV, consent, provider call or device test.',
  health_http: health.status, groq_key_configured: healthBody.configured,
  unauthenticated_malformed_multipart_http: denied.status,
  email_hook_not_proxied_http: forbiddenRoute.status, favicon_http: favicon.status,
  no_cv_tcp_listener: noCvTcpListener, private_unix_socket_present: privateSocketPresent, native,
};
report.pass = health.status === 200 && denied.status === 401 && forbiddenRoute.status === 404
  && favicon.status === 200 && noCvTcpListener && privateSocketPresent && native.every(item => item.pass);
await mkdir('generated-artifacts/cv-https', { recursive: true });
await writeFile('generated-artifacts/cv-https/verification.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (!report.pass) process.exitCode = 1;
