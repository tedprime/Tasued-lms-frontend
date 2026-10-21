import { eligible, installDataSync } from "./data-sync";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useIsFetching, useQueryClient, type Query } from '@tanstack/react-query';
import { errorMessage } from '@tasued/api-client';
import { RefreshCw } from 'lucide-react';
import { useToast } from './components/overlays';

export const refreshDefaults = {
  staleTime: 15_000,
  refetchOnWindowFocus: (query: Query) => eligible(query),
  refetchOnReconnect: (query: Query) => eligible(query),
  // Re-entering a quiz/player still fetches fresh state; protection applies while it stays mounted.
  refetchOnMount: (query: Query) => eligible(query) ? 'always' as const : true,
  refetchInterval: (query: Query) => eligible(query) && (query.queryKey[0] !== 'auth' || (query.queryKey[1] === 'session' && !!query.state.data)) ? 60_000 : false as const,
  refetchIntervalInBackground: false,
};

/** Shared by student and staff shells; uses only the current authenticated query cache. */
export function DataRefresh() {
  const qc = useQueryClient();
  const toast = useToast();
  const [refreshing, setRefreshing] = useState(false);
  const inFlight = useRef(false);
  const fetching = useIsFetching({ predicate: eligible });
  const stale = useSyncExternalStore(
    useCallback((notify) => qc.getQueryCache().subscribe(notify), [qc]),
    () => qc.getQueryCache().getAll().some(q => q.isActive() && eligible(q) && q.state.status === 'error' && q.state.data !== undefined),
    () => false,
  );
  useEffect(() => {
    return installDataSync(qc);
  }, [qc]);
  const refresh = async () => {
    if (inFlight.current || fetching) return;
    if (!navigator.onLine) { toast.error('You are offline', 'Reconnect to retrieve the latest data.'); return; }
    inFlight.current = true; setRefreshing(true);
    try {
      await qc.refetchQueries({ type: 'active', predicate: eligible }, { cancelRefetch: false, throwOnError: true });
      toast.success('Data refreshed');
    } catch (error) { toast.error('Some data could not be refreshed', errorMessage(error)); }
    finally { inFlight.current = false; setRefreshing(false); }
  };
  const busy = refreshing || fetching > 0;
  return <button type="button" onClick={() => void refresh()} disabled={busy} aria-label={busy ? 'Refreshing data' : 'Refresh data'} title={stale ? 'Some data could not be updated. Refresh to try again.' : 'Refresh data'} aria-busy={busy}
    className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-neutral-200 bg-white p-2 text-sm font-semibold text-neutral-600 hover:bg-neutral-50 disabled:opacity-50">
    <RefreshCw className={`size-4 ${busy ? 'animate-spin' : ''}`} aria-hidden /><span className="hidden lg:inline">Refresh</span>{stale && <span role="status" className="size-2 rounded-full bg-amber-500" aria-label="Some data could not be updated" />}
  </button>;
}
