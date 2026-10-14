import { useEffect, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { api, isApiError, type Session, type UserPreferences } from "@tasued/api-client";
import { PageLoader, ErrorState } from "@tasued/ui";

export const SESSION_KEY = ["auth", "session"] as const;

/** Fetches the cookie session. A 401 resolves to `null` (signed out) instead of throwing. */
async function fetchSession(): Promise<Session | null> {
  try {
    return await api.auth.session();
  } catch (e) {
    if (isApiError(e) && e.status === 401) return null;
    throw e;
  }
}

export function useSessionQuery() {
  return useQuery({ queryKey: SESSION_KEY, queryFn: fetchSession, staleTime: 5 * 60_000 });
}

/** The signed-in session. Only use below <RequireAuth>, where it is guaranteed. */
export function useSession(): Session {
  const { data } = useSessionQuery();
  if (!data) throw new Error("useSession used outside <RequireAuth>");
  return data;
}

export function usePreferences(): UserPreferences {
  return useSession().preferences;
}

export function useUpdatePreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: Partial<UserPreferences>) => api.auth.updatePreferences(p),
    onMutate: async (p) => {
      await qc.cancelQueries({ queryKey: SESSION_KEY });
      const prev = qc.getQueryData<Session | null>(SESSION_KEY);
      if (prev) qc.setQueryData<Session>(SESSION_KEY, { ...prev, preferences: { ...prev.preferences, ...p } });
      return { prev };
    },
    onError: (_e, _p, ctx) => {
      if (ctx?.prev) qc.setQueryData(SESSION_KEY, ctx.prev);
    },
    onSuccess: (prefs) => {
      const cur = qc.getQueryData<Session | null>(SESSION_KEY);
      if (cur && prefs) qc.setQueryData<Session>(SESSION_KEY, { ...cur, preferences: { ...cur.preferences, ...prefs } });
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: () => api.auth.logout(),
    onSettled: () => {
      qc.clear();
      qc.setQueryData(SESSION_KEY, null);
      navigate("/sign-in", { replace: true });
    },
  });
}

/** Keeps <html class="low-data"> in sync with the preference. */
function LowDataSync({ on }: { on: boolean }) {
  useEffect(() => {
    document.documentElement.classList.toggle("low-data", on);
  }, [on]);
  return null;
}

export function signInPath(returnTo: string) {
  return returnTo && returnTo !== "/" ? `/sign-in?returnTo=${encodeURIComponent(returnTo)}` : "/sign-in";
}

/**
 * Auth guard: no session → /sign-in?returnTo=<current url>.
 * A temporary password (session.mustChangePassword) sends every route to /change-password until it's changed.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { data, isPending, isError, refetch, fetchStatus } = useSessionQuery();
  const location = useLocation();
  if (isPending && fetchStatus === "paused")
    return <div className="p-6"><ErrorState title="You're offline" description="Connect to the internet to sign in to TASUED LMS." onRetry={() => void refetch()} /></div>;
  if (isPending) return <PageLoader label="Checking your session…" />;
  if (isError) return <div className="p-6"><ErrorState title="Couldn't reach TASUED LMS" onRetry={() => void refetch()} /></div>;
  if (!data) return <Navigate to={signInPath(location.pathname + location.search)} replace />;
  if (data.mustChangePassword && location.pathname !== "/change-password") {
    const here = location.pathname + location.search;
    return <Navigate to={here === "/" ? "/change-password" : `/change-password?returnTo=${encodeURIComponent(here)}`} replace />;
  }
  return (
    <>
      <LowDataSync on={data.preferences.lowDataMode} />
      {children}
    </>
  );
}
