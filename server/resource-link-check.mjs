import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { request as httpsRequest } from 'node:https';

const redirects = new Set([301, 302, 303, 307, 308]);
const maxRedirects = 4;

function ipv4Number(address) {
  if (isIP(address) !== 4) return null;
  return address.split('.').reduce((value, octet) => (value * 256) + Number(octet), 0);
}

function ipv4InCidr(address, network, bits) {
  const value = ipv4Number(address);
  const base = ipv4Number(network);
  if (value === null || base === null) return false;
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (value & mask) === (base & mask);
}

function ipv6Number(address) {
  if (isIP(address) !== 6 || address.includes('%')) return null;
  const lower = address.toLowerCase();
  if (lower.includes('.')) return null;
  const halves = lower.split('::');
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const missing = 8 - left.length - right.length;
  if ((halves.length === 1 && missing !== 0) || (halves.length === 2 && missing < 1)) return null;
  const words = [...left, ...Array(missing).fill('0'), ...right];
  if (words.some(word => !/^[0-9a-f]{1,4}$/.test(word))) return null;
  return words.reduce((value, word) => (value << 16n) | BigInt(`0x${word}`), 0n);
}

export function isPublicAddress(address) {
  const version = isIP(address);
  if (version === 4) {
    const blocked = [
      ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
      ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
      ['192.88.99.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24],
      ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
    ];
    return !blocked.some(([network, bits]) => ipv4InCidr(address, network, bits));
  }
  if (version !== 6) return false;
  const value = ipv6Number(address);
  if (value === null) return false;
  const globalUnicastStart = 0x20000000000000000000000000000000n; // 2000::/3
  const globalUnicastEnd = 0x40000000000000000000000000000000n;
  const documentationStart = 0x20010db8000000000000000000000000n; // 2001:db8::/32
  const documentationEnd = 0x20010db9000000000000000000000000n;
  const transitionStart = 0x20020000000000000000000000000000n; // 2002::/16
  const transitionEnd = 0x20030000000000000000000000000000n;
  const documentationV2Start = 0x3fff0000000000000000000000000000n; // 3fff::/20
  const documentationV2End = 0x3fff1000000000000000000000000000n;
  return value >= globalUnicastStart && value < globalUnicastEnd
    && !(value >= documentationStart && value < documentationEnd)
    && !(value >= transitionStart && value < transitionEnd)
    && !(value >= documentationV2Start && value < documentationV2End);
}

function parsePublicHttpsUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error('Enter a valid HTTPS URL.'); }
  const hostname = url.hostname.toLowerCase();
  if (url.protocol !== 'https:' || url.port || url.username || url.password || !hostname.includes('.')
    || hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local')
    || hostname.endsWith('.internal') || hostname.endsWith('.test') || hostname.endsWith('.example')
    || isIP(hostname)) throw new Error('Only public HTTPS resource URLs can be checked.');
  return url;
}

function resolvePinnedAddress(hostname, lookupImpl) {
  return lookupImpl(hostname, { all: true, verbatim: true }).then(records => {
    if (!Array.isArray(records) || !records.length || records.some(record => !isPublicAddress(record.address))) {
      throw new Error('The resource host does not resolve to a public address.');
    }
    return records[0];
  });
}

function requestOnce(url, address, requestImpl, timeoutMs, method) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      fn(value);
    };
    const req = requestImpl(url, {
      method,
      agent: false,
      servername: url.hostname,
      timeout: timeoutMs,
      headers: {
        'User-Agent': 'Masarak-Resource-Link-Check/1.0',
        Accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
        ...(method === 'GET' ? { Range: 'bytes=0-0' } : {}),
      },
      lookup: (_hostname, _options, callback) => callback(null, address.address, isIP(address.address)),
    }, response => {
      const result = { statusCode: response.statusCode ?? 0, location: response.headers.location ?? null };
      response.destroy();
      finish(resolve, result);
    });
    req.setTimeout(timeoutMs, () => req.destroy(new Error('Resource check timed out.')));
    req.on('error', error => finish(reject, error));
    req.end();
  });
}

export function createResourceLinkChecker({
  lookupImpl = lookup,
  requestImpl = httpsRequest,
  now = () => new Date(),
  timeoutMs = 8000,
} = {}) {
  return async function checkResourceLink(value) {
    let url = parsePublicHttpsUrl(value);
    let redirected = false;
    for (let hop = 0; hop <= maxRedirects; hop += 1) {
      const address = await resolvePinnedAddress(url.hostname, lookupImpl);
      let result = await requestOnce(url, address, requestImpl, timeoutMs, 'HEAD');
      if (result.statusCode === 405 || result.statusCode === 501) result = await requestOnce(url, address, requestImpl, timeoutMs, 'GET');
      if (redirects.has(result.statusCode) && result.location) {
        if (hop === maxRedirects) throw new Error('The resource link redirected too many times.');
        let next;
        try { next = new URL(result.location, url); } catch { throw new Error('The resource returned an invalid redirect.'); }
        url = parsePublicHttpsUrl(next.href);
        redirected = true;
        continue;
      }
      if (result.statusCode < 200 || result.statusCode >= 400) {
        throw Object.assign(new Error('The resource link did not respond successfully.'), { statusCode: result.statusCode });
      }
      return {
        statusCode: result.statusCode,
        checkedAt: now().toISOString(),
        redirected,
        ...(redirected ? { destination: `${url.origin}${url.pathname}` } : {}),
      };
    }
    throw new Error('The resource link could not be checked.');
  };
}

export const checkResourceLink = createResourceLinkChecker();
