import { mkdir, writeFile } from 'node:fs/promises';

const phase = process.argv[2];
if (!['before', 'after'].includes(phase)) throw new Error('Usage: node scripts/check-expo-public-url.mjs before|after');
if (!process.env.REPLIT_DEV_DOMAIN) throw new Error('Replit development domain is unavailable');
const base = new URL(`https://${process.env.REPLIT_DEV_DOMAIN}`);
const get = (url, headers) => fetch(url, { headers, signal: AbortSignal.timeout(90000) });
const results = [];

for (const platform of ['android', 'ios']) {
  const manifestResponse = await get(base, {
    accept: 'application/expo+json', 'expo-platform': platform, 'expo-protocol-version': '1',
  });
  if (!manifestResponse.ok) throw new Error(`${platform}: manifest HTTP ${manifestResponse.status}`);
  const manifest = await manifestResponse.json();
  const asset = new URL(manifest.launchAsset.url);
  const openResponse = await get(new URL(`/_expo/open?platform=${platform}&runtime=expo`, base));
  if (!openResponse.ok) throw new Error(`${platform}: Expo open GET HTTP ${openResponse.status}`);
  const opening = await openResponse.json();
  const link = new URL(opening.url);
  // Fetch precisely what Expo advertises: do not rewrite host, port, path or query.
  const bundle = await get(manifest.launchAsset.url);
  let bytes = 0;
  for await (const chunk of bundle.body) bytes += chunk.byteLength;
  const result = {
    platform, manifest_http: manifestResponse.status, expo_open_http: openResponse.status,
    sdk: manifest.extra?.expoClient?.sdkVersion,
    link_protocol: link.protocol, link_host_matches_public: link.hostname === base.hostname,
    link_port: link.port || '(default)',
    asset_protocol: asset.protocol, asset_host_matches_public: asset.hostname === base.hostname,
    asset_port: asset.port || '(default)', asset_origin_matches_public: asset.origin === base.origin,
    bundle_requested_unmodified: true, bundle_http: bundle.status,
    bundle_is_javascript: /javascript/i.test(bundle.headers.get('content-type') || ''), bundle_bytes: bytes,
  };
  result.pass = result.manifest_http === 200 && result.expo_open_http === 200
    && result.link_host_matches_public && ['', '80', '443'].includes(link.port)
    && result.asset_origin_matches_public && result.bundle_http === 200 && result.bundle_is_javascript;
  results.push(result);
}

const report = {
  phase, checked_at: new Date().toISOString(),
  scope: 'Generated Expo URLs and JavaScript downloads only; no device, native build, auth or email tests.',
  results, pass: results.every(result => result.pass),
};
await mkdir('generated-artifacts/expo-proxy', { recursive: true });
await writeFile(`generated-artifacts/expo-proxy/${phase}.json`, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (phase === 'after' && !report.pass) process.exitCode = 1;
