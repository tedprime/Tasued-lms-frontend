import { test } from 'node:test';
import assert from 'node:assert/strict';
import { beginSignInDiagnostic, clearSignInDiagnostic, recordSessionDiagnostic, sessionDiagnostics, sessionDiagnosticSucceeded } from '../packages/api-client/src/session-diagnostics';
import { configureApi, request } from '../packages/api-client/src/client';

test('diagnostics ignore ordinary signed-out visits and expire without storing account information', () => {
  clearSignInDiagnostic();
  recordSessionDiagnostic('student', 401);
  assert.equal(sessionDiagnostics.snapshot(), '');
  beginSignInDiagnostic();
  recordSessionDiagnostic('student', 401);
  assert.equal(sessionDiagnostics.snapshot(), 'LMS-STUDENT-SESSION-401');
  sessionDiagnosticSucceeded();
  assert.equal(sessionDiagnostics.snapshot(), '');
  const now = Date.now;
  Date.now = () => now() + 16 * 60_000;
  try {
    recordSessionDiagnostic('student', 401);
    assert.equal(sessionDiagnostics.snapshot(), '');
  } finally { Date.now = now; clearSignInDiagnostic(); }
});

test('client records session failures, excludes bad passwords, and clears diagnostics on recovery or logout', async () => {
  const original = globalThis.fetch;
  configureApi({ portal: 'admin', baseUrl: 'https://api.example.test/api/v1' });
  try {
    beginSignInDiagnostic();
    globalThis.fetch = async () => new Response('{}', { status: 401 });
    await assert.rejects(request('/auth/login'));
    assert.equal(sessionDiagnostics.snapshot(), '');
    await assert.rejects(request('/auth/session'));
    assert.equal(sessionDiagnostics.snapshot(), 'LMS-ADMIN-SESSION-401');
    globalThis.fetch = async () => { throw new TypeError('private URL or network details'); };
    await assert.rejects(request('/auth/session'));
    assert.equal(sessionDiagnostics.snapshot(), 'LMS-ADMIN-SESSION-NETWORK');
    globalThis.fetch = async () => new Response('{}', { status: 200 });
    await request('/auth/session');
    assert.equal(sessionDiagnostics.snapshot(), '');
    recordSessionDiagnostic('admin', 403);
    await request('/auth/logout', { method: 'POST' });
    recordSessionDiagnostic('admin', 401);
    assert.equal(sessionDiagnostics.snapshot(), '');
  } finally { globalThis.fetch = original; clearSignInDiagnostic(); }
});
