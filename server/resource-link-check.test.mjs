import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createResourceLinkChecker, isPublicAddress } from './resource-link-check.mjs';

function fakeRequest(statusCodes, calls) {
  let index = 0;
  return (_url, options, callback) => {
    const req = new EventEmitter();
    req.setTimeout = () => req;
    req.destroy = error => { if (error) req.emit('error', error); };
    req.end = () => {
      calls.push(options);
      queueMicrotask(() => {
        const entry = statusCodes[index++] ?? { statusCode: 200 };
        callback({ statusCode: entry.statusCode, headers: { location: entry.location }, destroy() {} });
      });
    };
    return req;
  };
}

test('public address check rejects local, private, reserved and documentation ranges', () => {
  for (const address of ['8.8.8.8', '1.1.1.1', '2606:4700:4700::1111']) assert.equal(isPublicAddress(address), true, address);
  for (const address of ['127.0.0.1', '10.4.3.2', '100.64.0.1', '169.254.1.2', '172.31.2.3', '192.168.1.9', '198.51.100.10', '203.0.113.9', '224.0.0.1', '::1', 'fc00::1', 'fe80::1', '2001:db8::1', '2002:7f00:1::']) {
    assert.equal(isPublicAddress(address), false, address);
  }
});

test('checker only accepts public HTTPS hostnames and pins requests to a resolved public address', async () => {
  const calls = [];
  let lookupOptions;
  const check = createResourceLinkChecker({
    lookupImpl: async (_host, options) => { lookupOptions = options; return [{ address: '8.8.8.8', family: 4 }]; },
    requestImpl: fakeRequest([{ statusCode: 200 }], calls),
    now: () => new Date('2026-11-01T00:00:00.000Z'),
  });
  const result = await check('https://learn.example.org/course');
  assert.deepEqual(result, { statusCode: 200, checkedAt: '2026-11-01T00:00:00.000Z', redirected: false });
  assert.equal(lookupOptions.all, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].servername, 'learn.example.org');
  let pinned;
  calls[0].lookup('learn.example.org', {}, (_error, address, family) => { pinned = { address, family }; });
  assert.deepEqual(pinned, { address: '8.8.8.8', family: 4 });
  await assert.rejects(check('http://learn.example.org/course'), /Only public HTTPS/);
  await assert.rejects(check('https://127.0.0.1/admin'), /Only public HTTPS/);
  await assert.rejects(check('https://learn.example.org:8443/course'), /Only public HTTPS/);
});

test('checker refuses a hostname when any resolved address is private before sending a request', async () => {
  const calls = [];
  const check = createResourceLinkChecker({
    lookupImpl: async () => [{ address: '8.8.8.8', family: 4 }, { address: '10.0.0.5', family: 4 }],
    requestImpl: fakeRequest([{ statusCode: 200 }], calls),
  });
  await assert.rejects(check('https://mixed.example.org/course'), /public address/);
  assert.equal(calls.length, 0);
});

test('checker verifies redirects independently and rejects redirects to private hosts', async () => {
  const calls = [];
  const check = createResourceLinkChecker({
    lookupImpl: async host => {
      if (host === 'learn.example.org') return [{ address: '8.8.4.4', family: 4 }];
      throw new Error('private hostname must not be resolved');
    },
    requestImpl: fakeRequest([{ statusCode: 302, location: 'http://127.0.0.1/admin' }], calls),
  });
  await assert.rejects(check('https://learn.example.org/course'), /Only public HTTPS/);
  assert.equal(calls.length, 1);
});

test('checker falls back to a bounded range GET when the host does not support HEAD', async () => {
  const calls = [];
  const check = createResourceLinkChecker({
    lookupImpl: async () => [{ address: '1.1.1.1', family: 4 }],
    requestImpl: fakeRequest([{ statusCode: 405 }, { statusCode: 206 }], calls),
  });
  const result = await check('https://courses.example.org/item');
  assert.equal(result.statusCode, 206);
  assert.equal(calls[0].method, 'HEAD');
  assert.equal(calls[1].method, 'GET');
  assert.equal(calls[1].headers.Range, 'bytes=0-0');
});

test('checker reports a public redirect destination without treating the original link as publishable', async () => {
  const calls = [];
  const check = createResourceLinkChecker({
    lookupImpl: async () => [{ address: '1.1.1.1', family: 4 }],
    requestImpl: fakeRequest([
      { statusCode: 301, location: 'https://canonical.example.org/course?private=token' },
      { statusCode: 200 },
    ], calls),
  });
  const result = await check('https://short.example.org/go?secret=token');
  assert.equal(result.redirected, true);
  assert.equal(result.destination, 'https://canonical.example.org/course');
  assert.equal(calls.length, 2);
});

test('checker rejects provider errors instead of marking the URL reachable', async () => {
  const check = createResourceLinkChecker({
    lookupImpl: async () => [{ address: '1.0.0.1', family: 4 }],
    requestImpl: fakeRequest([{ statusCode: 404 }], []),
  });
  await assert.rejects(check('https://courses.example.org/missing'), error => error.statusCode === 404);
});
