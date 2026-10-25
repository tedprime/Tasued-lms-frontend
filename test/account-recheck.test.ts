import test from 'node:test';
import assert from 'node:assert/strict';
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { createAccountRecheck } from '../packages/ui/src/recheck-account';

test('a stale tab message rechecks a valid session rather than signing the user out', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const session = { user: { id: 'current' } };
  let checks = 0;
  client.setQueryData(['auth', 'session'], session);
  client.setQueryData(['courses'], ['private account data']);
  const observer = new QueryObserver(client, {
    queryKey: ['auth', 'session'], staleTime: Infinity,
    queryFn: async () => { checks++; return session; },
  });
  const unsubscribe = observer.subscribe(() => {});
  try {
    const recheck = createAccountRecheck(client);
    const first = recheck();
    assert.equal(recheck(), first, 'duplicate events share the in-flight check');
    await first;
    assert.equal(checks, 1);
    assert.deepEqual(client.getQueryData(['auth', 'session']), session);
    assert.equal(client.getQueryData(['courses']), undefined);
  } finally { unsubscribe(); client.clear(); }
});

test('a genuinely ended session remains signed out after an account message', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(['auth', 'session'], { user: { id: 'previous' } });
  const observer = new QueryObserver(client, {
    queryKey: ['auth', 'session'], staleTime: Infinity, queryFn: async () => null,
  });
  const unsubscribe = observer.subscribe(() => {});
  try {
    await createAccountRecheck(client)();
    assert.equal(client.getQueryData(['auth', 'session']), null);
  } finally { unsubscribe(); client.clear(); }
});
