import { blocksCachedData } from "@tasued/api-client";
import type { ReactNode } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import { EmptyState, ErrorState, Skeleton, cn } from "@tasued/ui";
import { errorMessage, isApiError } from "@tasued/api-client";
import { WifiOff } from "lucide-react";

/**
 * Renders the loading / error / empty / data states of a query consistently.
 * `isEmpty` decides whether to show `empty` instead of children.
 */
export function Async<T>({
  query,
  children,
  skeleton,
  empty,
  isEmpty,
  errorTitle,
}: {
  query: UseQueryResult<T>;
  children: (data: T) => ReactNode;
  skeleton?: ReactNode;
  empty?: ReactNode;
  isEmpty?: (data: T) => boolean;
  errorTitle?: string;
}) {
  if (query.isPending && query.fetchStatus === "paused")
    return <EmptyState icon={<WifiOff className="size-6" />} title="You're offline" description="This hasn't been saved for offline use yet. It will load when you're back online." />;
  if (query.isPending) return <>{skeleton ?? <ListSkeleton />}</>;
  if (query.data === undefined || blocksCachedData(query.error)) {
    const notFound = isApiError(query.error) && query.error.status === 404;
    return notFound ? (
      <EmptyState title="Not found" description="This item doesn't exist or is no longer available." />
    ) : (
      <ErrorState title={errorTitle} description={errorMessage(query.error)} onRetry={() => void query.refetch()} />
    );
  }
  if (query.data === undefined) return null;
  if (empty && isEmpty?.(query.data)) return <>{empty}</>;
  return <>{children(query.data)}</>;
}

export function ListSkeleton({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-3", className)} aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white p-4">
          <Skeleton className="size-10 shrink-0 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
          <Skeleton className="h-24 rounded-none" />
          <div className="space-y-2 p-5">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="mt-4 h-2 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-8 w-1/2" />
      <Skeleton className="h-4 w-1/3" />
      <ListSkeleton rows={4} />
    </div>
  );
}
