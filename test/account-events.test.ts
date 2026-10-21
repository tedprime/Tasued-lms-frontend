import test from 'node:test';
import assert from 'node:assert/strict';
import { createAccountEvents } from '../packages/api-client/src/account-events';

test('first sign-in does not invalidate its own document, but other tabs are notified', async () => {
 const current = createAccountEvents();
 const other = createAccountEvents();
 const name = `lms-test-${crypto.randomUUID()}`;
 const sender = new BroadcastChannel(name);
 const listener = new BroadcastChannel(name);
 try {
   const delivered = new Promise<unknown>(resolve => { listener.onmessage = event => resolve(event.data); });
   sender.postMessage(current.message('changed'));
   const message = await delivered;
   assert.equal(current.isExternal(message),false);
   assert.equal(other.isExternal(message),true);
   assert.equal(current.isExternal(current.message('clear')),false);
   assert.equal(other.isExternal(current.message('clear')),true);
 } finally {sender.close();listener.close();}
});

test('legacy tabs still invalidate sessions and unrelated messages are ignored',()=>{
 const events=createAccountEvents();
 assert.equal(events.isExternal('changed'),true);
 assert.equal(events.isExternal('clear'),true);
 for (const value of [null,undefined,{},'hello',{type:'changed'},{type:'other',source:'other'}]) assert.equal(events.isExternal(value),false);
});
