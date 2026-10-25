import type { QueryClient } from '@tanstack/react-query';

/** Another tab's local cache change is a hint, not proof the server session ended. */
export function createAccountRecheck(client: QueryClient) {
  let pending: Promise<void> | undefined;
  return () => {
    if (pending) return pending;
    pending = (async () => {
      await client.cancelQueries();
      // Discard data belonging to the previous account before verifying the cookie.
      client.removeQueries({ predicate: q => !(q.queryKey[0] === 'auth' && q.queryKey[1] === 'session') });
      // Active session observers show their loading state, then use the server result.
      await client.resetQueries({ queryKey: ['auth', 'session'], exact: true });
    })().finally(() => { pending = undefined; });
    return pending;
  };
}
