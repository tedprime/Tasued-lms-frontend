import { activateAccount, clearDevice } from "../pwa/device";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Navigate, Outlet, useLocation, useOutletContext, useParams } from "react-router-dom";
import type { ReactNode } from "react";
import { ShieldAlert } from "lucide-react";
import { api, can as canFn, isApiError, type Permission, type Session } from "@tasued/api-client";
import { buttonClasses, EmptyState, PageLoader } from "@tasued/ui";
import { Link } from "react-router-dom";

export const SESSION_KEY = ["auth", "session"] as const;

async function fetchSession({signal}:{signal:AbortSignal}): Promise<Session | null> {
  try {
    const session=await api.auth.session(); signal.throwIfAborted();
    if (session.user.authMethod !== 'microsoft' || !session.user.roles.some(r => r.role !== 'student')) {
      await clearDevice(false).catch(()=>undefined); return null;
    }
    await activateAccount(session.user.id).catch(()=>undefined); return session;
  } catch (e) {
    if (isApiError(e) && (e.status === 401 || e.status === 403)) {await clearDevice(false).catch(()=>undefined); return null;}
    throw e;
  }
}

export function useSessionQuery() {
  return useQuery({ queryKey: SESSION_KEY, queryFn: fetchSession, staleTime: 5 * 60_000, retry: false });
}

/** The signed-in session. Only call inside <RequireAuth>. */
export function useSession(): Session {
  const { data } = useSessionQuery();
  if (!data) throw new Error("useSession used outside an authenticated route");
  return data;
}

/** Returns a checker: can("people.manage") or can(["a","b"]) (any of). */
export function useCan() {
  const { data } = useSessionQuery();
  return (p: Permission | Permission[]) => (Array.isArray(p) ? p.some((x) => canFn(data, x)) : canFn(data, p));
}

/** Can the session act as staff on this course? Admins with a broader scope resolve to all ids server-side. */
export function useCanStaffCourse() {
  const { data } = useSessionQuery();
  return (courseId: string) => !!data?.staffCourseIds.includes(courseId) || canFn(data, "courses.manage");
}

/**
 * Does the session lecture or assist on this course (or, with no argument, on any course)?
 * Teaching tools — content editing, classes, attendance, assignments, quizzes, grading, the course
 * forum and course announcements — are only for the course's own lecturer and teaching assistants.
 */
export function useTeaches() {
  const { data } = useSessionQuery();
  return (courseId?: string) => (courseId ? !!data?.teachingCourseIds.includes(courseId) : !!data?.teachingCourseIds.length);
}

export function useIsSuperAdmin() {
  const { data } = useSessionQuery();
  return !!data?.user.roles.some((r) => r.role === "super_admin");
}

export function useSignOut() {
  const qc = useQueryClient();
  return async () => {
    await qc.cancelQueries();
    await clearDevice().catch(()=>undefined);
    try {
      await api.auth.logout();
    } catch {
      /* ignore */
    }
    qc.clear();
    qc.setQueryData(SESSION_KEY, null);
    window.location.assign("/sign-in");
  };
}

export function RequireAuth() {
  const { data, isLoading, isError, refetch } = useSessionQuery();
  const loc = useLocation();
  if (isLoading) return <PageLoader label="Checking your session…" />;
  if (isError)
    return (
      <div className="flex min-h-screen items-center justify-center">
        <EmptyState
          title="Couldn't reach the LMS"
          description="We couldn't check your session. Check your connection and try again."
          action={<button className={buttonClasses("outline", "sm")} onClick={() => refetch()}>Try again</button>}
        />
      </div>
    );
  if (!data || data.user.authMethod !== 'microsoft' || !data.user.roles.some(r => r.role !== 'student')) {
    const returnTo = loc.pathname + loc.search;
    return <Navigate to={`/sign-in?returnTo=${encodeURIComponent(returnTo)}`} replace />;
  }
  return <Outlet />;
}

export function NoAccess({ what }: { what?: string }) {
  return (
    <EmptyState
      icon={<ShieldAlert className="size-6" />}
      title="You don't have access to this"
      description={`Your roles don't include permission to ${what ?? "view this page"}. If you think this is wrong, ask a super admin to update your roles.`}
      action={<Link to="/" className={buttonClasses("outline", "sm")}>Back to overview</Link>}
    />
  );
}

/** Route/section guard: renders children (or <Outlet/>) only when the session has the permission (any of, for arrays). */
export function RequirePermission({ perm, children, what }: { perm: Permission | Permission[]; children?: ReactNode; what?: string }) {
  const can = useCan();
  const outletContext = useOutletContext();
  if (!can(perm)) return <NoAccess what={what} />;
  return <>{children ?? <Outlet context={outletContext} />}</>;
}

/** Route guard for a course's teaching pages: only its lecturer and teaching assistants get through. */
export function RequireTeaching() {
  const { courseId } = useParams();
  const teaches = useTeaches();
  const outletContext = useOutletContext();
  if (!teaches(courseId)) {
    return (
      <EmptyState
        icon={<ShieldAlert className="size-6" />}
        title="For the course's teaching staff"
        description="Classes, attendance, assignments, quizzes, grading, the course forum and course announcements are run by the course's lecturer and teaching assistants. Administrators can see the course content, students and report."
        action={<Link to={`/courses/${courseId}/content`} className={buttonClasses("outline", "sm")}>Back to content</Link>}
      />
    );
  }
  return <Outlet context={outletContext} />;
}

/** Inline helper: render children only when allowed. */
export function Can({ perm, children, fallback = null }: { perm: Permission | Permission[]; children: ReactNode; fallback?: ReactNode }) {
  const can = useCan();
  return <>{can(perm) ? children : fallback}</>;
}
