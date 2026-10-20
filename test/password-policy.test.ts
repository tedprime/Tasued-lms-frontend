import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newPasswordValid } from '../apps/student/src/features/auth/password-policy';
test('password validation follows the supplied server minimum and detects long Unicode passwords',()=>{
 const policy={minLength:12,maxBytes:72};
 assert.equal(newPasswordValid('Abc12345678','Abc12345678',policy),false);
 assert.equal(newPasswordValid('Abc123456789','Abc123456789',policy),true);
 assert.equal(newPasswordValid('a'.repeat(72),'a'.repeat(72),policy),true);
 assert.equal(newPasswordValid('a'.repeat(73),'a'.repeat(73),policy),false);
 assert.equal(newPasswordValid('😀'.repeat(19),'😀'.repeat(19),policy),false);
 assert.equal(newPasswordValid('abcd1234','abcd1234',{minLength:8,maxBytes:72}),true);
 assert.equal(newPasswordValid('a'.repeat(12),'a'.repeat(12),{minLength:16,maxBytes:72}),false);
 assert.equal(newPasswordValid('a'.repeat(12),'b'.repeat(12),policy),false);
});

test('default minimum is eight characters', () => {
 assert.equal(newPasswordValid('abcd1234', 'abcd1234'), true);
 assert.equal(newPasswordValid('abc1234', 'abc1234'), false);
});
