import { test } from 'node:test';
import assert from 'node:assert/strict';
import { signInErrorMessage } from '../apps/admin/src/features/auth/sign-in-errors';
test('staff access failures explain how to regain access', () => {
  assert.match(signInErrorMessage('STAFF_NOT_PROVISIONED'), /administrator/);
  assert.match(signInErrorMessage('STAFF_NOT_PROVISIONED'), /activate/);
  assert.match(signInErrorMessage('INVALID_OIDC_STATE'), /expired/);
  assert.match(signInErrorMessage('MICROSOFT_CANCELLED'), /cancelled/);
  assert.match(signInErrorMessage('RATE_LIMITED'), /wait/);
});
test('unknown query text is never displayed as an error', () => {
  for (const value of ['<script>secret</script>', 'constructor', '__proto__', 'private-token']) {
    assert.equal(typeof signInErrorMessage(value), 'string');
    assert.ok(!signInErrorMessage(value).includes(value));
  }
});
