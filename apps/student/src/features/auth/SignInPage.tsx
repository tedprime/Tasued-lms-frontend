import { useId, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, LogIn } from "lucide-react";
import { api, errorMessage, isApiError, ROLE_LABELS, type Session } from "@tasued/api-client";
import { Alert, Avatar, Badge, Button, Field, Input, PageLoader, Skeleton } from "@tasued/ui";
import { SESSION_KEY, useSessionQuery } from "../../app/session";
import { AuthLayout, safeReturnTo } from "./AuthLayout";
import { PasswordInput } from "./password";

/** Where to go after a successful sign-in. A temporary password forces a change first. */
function afterSignIn(session: Session, returnTo: string) {
  if (session.mustChangePassword) return returnTo === "/" ? "/change-password" : `/change-password?returnTo=${encodeURIComponent(returnTo)}`;
  return returnTo;
}

/** Demo-account picker (hidden for now). To show it again, import USE_MOCKS from "../../app/config" and render {USE_MOCKS && <DemoAccounts returnTo={returnTo} />} below. */
export function DemoAccounts({ returnTo }: { returnTo: string }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const accounts = useQuery({ queryKey: ["auth", "dev-accounts"], queryFn: () => api.auth.devAccounts() });
  const [pending, setPending] = useState<string | null>(null);
  const login = useMutation({
    mutationFn: (id: string) => api.auth.devLogin(id),
    onMutate: (id) => setPending(id),
    onSuccess: (session) => {
      qc.setQueryData(SESSION_KEY, session);
      navigate(afterSignIn(session, returnTo), { replace: true });
    },
    onSettled: () => setPending(null),
  });

  // Students first — this is the student app.
  const list = [...(accounts.data ?? [])].sort((a, b) => {
    const sa = a.roles.some((r) => r.role === "student") ? 0 : 1;
    const sb = b.roles.some((r) => r.role === "student") ? 0 : 1;
    return sa - sb;
  });

  return (
    <section aria-labelledby="demo-h" className="mt-8">
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-neutral-200" />
        <h2 id="demo-h" className="text-xs font-bold tracking-wider text-neutral-400 uppercase">Demo accounts</h2>
        <span className="h-px flex-1 bg-neutral-200" />
      </div>
      <p className="mt-2 text-center text-xs text-neutral-500">Mock mode only — sign in as a seeded account.</p>
      {login.isError && <Alert tone="red" className="mt-3">{errorMessage(login.error)}</Alert>}
      <div className="mt-3 space-y-2">
        {accounts.isPending ? (
          <>
            <Skeleton className="h-14 rounded-xl" />
            <Skeleton className="h-14 rounded-xl" />
          </>
        ) : accounts.isError ? (
          <Alert tone="red">Couldn't load demo accounts. {errorMessage(accounts.error)}</Alert>
        ) : (
          list.map((a) => (
            <button
              key={a.id}
              type="button"
              disabled={!!pending}
              onClick={() => login.mutate(a.id)}
              className="flex w-full items-center gap-3 rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 text-left transition-colors hover:border-primary-500 hover:bg-primary-50/40 disabled:opacity-60"
            >
              <Avatar name={a.fullName} size={36} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-tertiary-500">{a.fullName}</span>
                <span className="block truncate text-xs text-neutral-500">{a.email}</span>
              </span>
              <span className="hidden flex-wrap justify-end gap-1 sm:flex">
                {[...new Set(a.roles.map((r) => r.role))].slice(0, 2).map((r) => (
                  <Badge key={r} tone={r === "student" ? "green" : "navy"}>{ROLE_LABELS[r]}</Badge>
                ))}
              </span>
              {pending === a.id ? <span className="size-4 animate-spin rounded-full border-2 border-neutral-200 border-t-primary-500" /> : <ChevronRight className="size-4 text-neutral-400" />}
            </button>
          ))
        )}
      </div>
    </section>
  );
}

/** Friendly explanation for each sign-in error code; the API message is shown as the title. */
function SignInError({ error }: { error: unknown }) {
  const code = isApiError(error) ? error.code : "";
  const message = errorMessage(error);
  switch (code) {
    case "INVALID_CREDENTIALS":
      return <Alert tone="red" title={message}>Check your email and password and try again. Forgotten it? Use “Forgot password?” to reset it.</Alert>;
    case "ACCOUNT_NOT_ACTIVATED":
      return (
        <Alert tone="amber" title={message}>
          You haven't set your password yet. Open the invitation email from TASUED LMS and use the link in it to choose a password. Can't find it? Check your spam folder, or contact the course team to send it again.
        </Alert>
      );
    case "ACCOUNT_DEACTIVATED":
      return <Alert tone="red" title={message}>Your account has been deactivated. If you think this is a mistake, contact the course team.</Alert>;
    case "USE_MICROSOFT":
      return <Alert tone="blue" title={message}>This email belongs to a staff account. Staff sign in with Microsoft on the staff portal, not here.</Alert>;
    default:
      return <Alert tone="red">{message}</Alert>;
  }
}

export default function SignInPage() {
  const [params] = useSearchParams();
  const returnTo = safeReturnTo(params.get("returnTo"));
  const session = useSessionQuery();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const ids = { email: useId(), pw: useId(), note: useId() };
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tried, setTried] = useState(false);

  const login = useMutation({
    mutationFn: () => api.auth.passwordLogin({ email: email.trim(), password }),
    onSuccess: (s) => {
      qc.setQueryData(SESSION_KEY, s);
      navigate(afterSignIn(s, returnTo), { replace: true });
    },
  });

  if (session.isPending) return <PageLoader label="Checking your session…" />;
  if (session.data) return <Navigate to={afterSignIn(session.data, returnTo)} replace />;

  const emailOk = /^\S+@\S+\.\S+$/.test(email.trim());

  return (
    <AuthLayout title="Sign in" description="Sign in with your email and the password you set for TASUED LMS.">
      <form
        noValidate
        className="mt-8 space-y-4"
        aria-describedby={ids.note}
        onSubmit={(e) => {
          e.preventDefault();
          setTried(true);
          if (!emailOk || !password) return;
          login.mutate();
        }}
      >
        <Field label="Email" htmlFor={ids.email} error={tried && !emailOk ? "Enter your email address." : undefined}>
          <Input
            id={ids.email}
            type="email"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            invalid={tried && !emailOk}
            placeholder="you@example.com"
            required
          />
        </Field>
        <div className="relative">
          <Field label="Password" htmlFor={ids.pw} error={tried && !password ? "Enter your password." : undefined}>
            <PasswordInput id={ids.pw} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} invalid={tried && !password} required />
          </Field>
          <Link to="/forgot-password" className="absolute top-0 right-0 text-xs font-semibold text-primary-500 hover:underline">Forgot password?</Link>
        </div>

        {login.isError && <SignInError error={login.error} />}

        <Button type="submit" size="lg" className="w-full" loading={login.isPending} icon={<LogIn className="size-4" aria-hidden />}>
          {login.isPending ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      {/* <p id={ids.note} className="mt-4 flex gap-2 rounded-lg bg-neutral-50 px-3 py-2.5 text-xs text-neutral-600">
        <Info className="mt-0.5 size-3.5 shrink-0 text-primary-500" aria-hidden />
        <span>Use the email TASUED gave us for you — the same one your Teams invitation was sent to.</span>
      </p> */}
      <p className="mt-3 text-center text-xs text-neutral-500">
        New student? Open the invitation email from TASUED LMS to set your password.
      </p>

      {/* {USE_MOCKS && <DemoAccounts returnTo={returnTo} />} */}
    </AuthLayout>
  );
}
