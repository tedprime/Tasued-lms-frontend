import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, FlaskConical, ShieldCheck } from "lucide-react";
import { api, apiBaseUrl, errorMessage, ROLE_LABELS, type Session } from "@tasued/api-client";
import { Alert, Avatar, Badge, Button, Spinner, Crest } from "@tasued/ui";
import { USE_MOCKS } from "../../app/env";
import { SESSION_KEY, useSessionQuery } from "../../app/session";
import { scopeLabel } from "../../layout/Header";

function MicrosoftMark() {
  return (
    <svg viewBox="0 0 21 21" className="size-5" aria-hidden>
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  );
}

function safeReturnTo(v: string | null) {
  return v && v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/sign-in") ? v : "/";
}

/** Two-panel layout ported from SLAN admin's pages/Auth.tsx; email/password/OTP replaced with Microsoft 365 only. */
export function SignInPage() {
  const [params] = useSearchParams();
  const returnTo = safeReturnTo(params.get("returnTo"));
  const session = useSessionQuery();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const error = params.get("error");

  const accounts = useQuery({ queryKey: ["auth", "dev-accounts"], queryFn: () => api.auth.devAccounts(), enabled: USE_MOCKS });
  const devLogin = useMutation({
    mutationFn: (id: string) => api.auth.devLogin(id),
    onSuccess: (s: Session) => {
      qc.clear();
      qc.setQueryData(SESSION_KEY, s);
      navigate(returnTo, { replace: true });
    },
  });

  if (session.data) return <Navigate to={returnTo} replace />;

  const signInWithMicrosoft = () => {
    window.location.href = api.auth.microsoftLoginUrl(apiBaseUrl(), returnTo);
  };

  const staffAccounts = accounts.data?.filter((a) => a.roles.some((r) => r.role !== "student")) ?? [];

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-neutral-100 via-white to-primary-50 p-3 sm:p-6 md:p-8">
      <div className="grid w-full max-w-5xl animate-fade-in-up overflow-hidden rounded-3xl bg-white shadow-pop lg:grid-cols-2">
        <div className="relative flex flex-col justify-between overflow-hidden bg-gradient-to-br from-primary-600 via-primary-700 to-primary-800 p-8 text-white sm:p-10 lg:p-12">
          <div className="absolute top-0 right-0 size-64 translate-x-1/2 -translate-y-1/2 rounded-full bg-white/5" aria-hidden />
          <div className="absolute bottom-0 left-0 size-48 -translate-x-1/2 translate-y-1/2 rounded-full bg-white/5" aria-hidden />
          <div className="relative z-10">
            <div className="mb-10 flex items-center gap-2 lg:mb-20">
              <span className="rounded-xl bg-white p-1.5"><Crest size={44} /></span>
              <p className="text-sm font-bold tracking-widest uppercase opacity-90">TASFUED LMS Admin</p>
            </div>
            <h1 className="font-headline text-3xl leading-tight font-extrabold lg:text-5xl">
              Staff<br />administration<br /><span className="text-secondary-400">portal</span>
            </h1>
            <p className="mt-4 max-w-sm text-sm text-white/70 lg:text-base">
              Schedule Teams classes, publish recordings and course text, review attendance and grade work for Tai Solarin Federal University of Education.
            </p>
          </div>
          <div className="relative z-10 mt-8 flex gap-1.5" aria-hidden>
            {[0, 1, 2, 3, 4].map((i) => <span key={i} className={i === 0 ? "size-2 rounded-full bg-secondary-500" : "size-2 rounded-full bg-white/30"} />)}
          </div>
        </div>

        <div className="flex flex-col justify-center p-6 sm:p-8 lg:p-12">
          <h2 className="font-headline text-2xl font-extrabold text-tertiary-500">Sign in</h2>
          <p className="mt-1 mb-7 text-sm text-neutral-500">Use your TASFUED Microsoft 365 staff account.</p>

          {error && <Alert tone="red" className="mb-4" title="Sign-in didn't complete">{error === "not_staff" ? "This account doesn't have a staff role in the LMS." : "Please try again. If it keeps failing, contact LMS support."}</Alert>}

          <Button size="lg" variant="inverted" className="w-full" onClick={signInWithMicrosoft} icon={<MicrosoftMark />}>
            Sign in with Microsoft
          </Button>
          <p className="mt-3 flex items-center gap-1.5 text-xs text-neutral-500">
            <ShieldCheck className="size-3.5 text-primary-500" /> Single sign-on with your university account. We never see your password.
          </p>

          {USE_MOCKS && (
            <div className="mt-8 rounded-2xl border border-secondary-200 bg-secondary-50/50 p-4">
              <p className="flex items-center gap-2 text-sm font-bold text-tertiary-500">
                <FlaskConical className="size-4 text-secondary-700" /> Demo accounts
                <Badge tone="gold">Mock mode</Badge>
              </p>
              <p className="mt-0.5 text-xs text-neutral-600">Sign in as a seeded account to try each role.</p>
              <div className="mt-3">
                {accounts.isPending && <div className="flex items-center gap-2 text-sm text-neutral-500"><Spinner className="size-4" /> Loading accounts…</div>}
                {accounts.isError && <p className="text-sm text-danger">Couldn't load demo accounts: {errorMessage(accounts.error)}</p>}
                {devLogin.isError && <p className="mb-2 text-sm text-danger">{errorMessage(devLogin.error)}</p>}
                <ul className="max-h-80 space-y-1.5 overflow-y-auto">
                  {staffAccounts.map((a) => (
                    <li key={a.id}>
                      <button
                        type="button"
                        onClick={() => devLogin.mutate(a.id)}
                        disabled={devLogin.isPending}
                        className="flex w-full items-center gap-3 rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-left transition hover:border-primary-300 hover:shadow-card disabled:opacity-60"
                      >
                        <Avatar name={a.fullName} size={34} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-tertiary-500">{a.fullName}</span>
                          <span className="block truncate text-xs text-neutral-500">
                            {a.roles.filter((r) => r.role !== "student").map((r) => `${ROLE_LABELS[r.role]} · ${scopeLabel(r)}`).join("; ")}
                          </span>
                        </span>
                        {devLogin.isPending && devLogin.variables === a.id ? <Spinner className="size-4" /> : <ArrowRight className="size-4 text-neutral-400" />}
                      </button>
                    </li>
                  ))}
                  {accounts.data && !staffAccounts.length && <li className="text-sm text-neutral-500">No staff demo accounts are seeded.</li>}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
