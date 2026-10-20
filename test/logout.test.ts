import test from 'node:test';
import assert from 'node:assert/strict';
import { configureApi } from '../packages/api-client/src/client';
import { logoutAndClearDevice } from '../packages/api-client/src/logout';

test('logout waits for server revocation before cleanup can broadcast a reload', async () => {
  const original = globalThis.fetch;
  let finish!: (response: Response) => void;
  let cleaned = false;
  let requested!: RequestInit;
  configureApi({ baseUrl: 'https://api.example.test/api/v1', portal: 'admin' });
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://api.example.test/api/v1/auth/logout');
    requested = options!;
    return new Promise<Response>(resolve => { finish = resolve; });
  };
  try {
    const pending = logoutAndClearDevice(async () => { cleaned = true; });
    await Promise.resolve();
    assert.equal(cleaned, false, 'device cleanup must not reload a still-authenticated page');
    assert.equal(requested.method, 'POST');
    assert.equal(requested.credentials, 'include');
    assert.equal((requested.headers as Record<string,string>)['X-LMS-Portal'], 'admin');
    finish(new Response(null, { status: 204 }));
    await pending;
    assert.equal(cleaned, true);
  } finally { globalThis.fetch = original; }
});

test('failed logout preserves local state and exposes the error for retry', async () => {
  const original = globalThis.fetch;
  let cleaned = false;
  try {
    for (const status of [403, 429, 500]) {
      globalThis.fetch = async () => new Response(JSON.stringify({code:'FAILED',message:'Try again'}),{status});
      await assert.rejects(logoutAndClearDevice(async () => { cleaned = true; }), { status });
      assert.equal(cleaned, false);
    }
    globalThis.fetch = async () => { throw new TypeError('Network unavailable'); };
    await assert.rejects(logoutAndClearDevice(async () => { cleaned = true; }), /Network unavailable/);
    assert.equal(cleaned, false);
  } finally { globalThis.fetch = original; }
});

test('local cleanup errors do not prevent navigation after confirmed logout', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(null, {status:204});
  try { await logoutAndClearDevice(async () => { throw new Error('Device storage unavailable'); }); }
  finally { globalThis.fetch = original; }
});
