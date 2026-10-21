import { type Query, type QueryClient } from "@tanstack/react-query";
import { onApiWrite, refreshProtected } from "@tasued/api-client";

export const eligible = (query: Query) => !refreshProtected(query.queryKey) ||
  (query.queryKey[0] === "quiz-attempts" && !!query.state.data && (query.state.data as { state?: string }).state !== "in_progress");

export function installDataSync(qc: QueryClient) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const roots = new Set<string>();
  let disposed = false;
  const pending = new Map<Query, { promise: Promise<unknown>; updates: number }>();
  const unsubscribe = onApiWrite((changed) => {
    changed.forEach((root) => roots.add(root));
    // A read that started before the write may return an outdated snapshot.
    for (const query of qc.getQueryCache().getAll()) {
      if (query.isActive() && eligible(query) && changed.includes(String(query.queryKey[0])) && query.state.fetchStatus === 'fetching' && query.promise) pending.set(query, { promise: query.promise, updates: query.state.dataUpdateCount });
    }
    // Mark inactive pages stale too, but never download their data in the background.
    void qc.invalidateQueries({ predicate: (q) => changed.includes(String(q.queryKey[0])), refetchType: 'none' });
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      const affected = new Set(roots); roots.clear();
      for (const [query, { promise, updates }] of pending) {
        const reconcile = () => {
          // Let Query finish storing the result and releasing its fetch promise.
          setTimeout(() => {
          if (!disposed && query.isActive() && eligible(query) && (query.promise === undefined || query.promise === promise) && query.state.dataUpdateCount <= updates + 1) {
            void qc.invalidateQueries({ queryKey: query.queryKey, exact: true }, { cancelRefetch: false });
          }
        }, 0);
        };
        void promise.then(reconcile, reconcile);
      }
      pending.clear();
      // Existing feature callbacks may already have refreshed these queries. Do not repeat them.
      void qc.refetchQueries({ type: 'active', predicate: (q) => eligible(q) &&
        affected.has(String(q.queryKey[0])) && q.state.isInvalidated && q.state.fetchStatus === 'idle' },
        { cancelRefetch: false });
    }, 250);
  });
  return () => { disposed = true; pending.clear(); unsubscribe(); if (timer) clearTimeout(timer); };
}
