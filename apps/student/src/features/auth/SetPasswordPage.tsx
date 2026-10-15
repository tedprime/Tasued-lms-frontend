import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MailWarning } from "lucide-react";
import { api, errorMessage, fmtDateTime, isApiError } from "@tasued/api-client";
import { Alert, Button, KeyValue, Skeleton, buttonClasses } from "@tasued/ui";
import { SESSION_KEY } from "../../app/session";
import { AuthLayout } from "./AuthLayout";
import { NewPasswordFields, newPasswordValid } from "./password";

function InviteProblem({ expired }: { expired: boolean }) {
  return (
    <div className="mt-8 space-y-5">
      <Alert tone="amber" icon={<MailWarning className="size-4" aria-hidden />} title={expired ? "This invitation link has expired" : "This invitation link isn't valid"}>
        {expired
          ? "Invitation links only work for a limited time. Please contact the course team and ask them to send you a new invitation."
          : "The link may be incomplete or already used. Open the latest invitation email and use its link exactly as sent, or contact the course team for a new invitation."}
      </Alert>
      <p className="text-sm text-neutral-600">
        Already set your password?{" "}
        <Link to="/sign-in" className="font-semibold text-primary-500 hover:underline">Sign in</Link>
      </p>
    </div>
  );
}

/** Opened from the LMS invitation email: choose a password, then go to /welcome. */
export default function SetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [tried, setTried] = useState(false);

  const info = useQuery({
    queryKey: ["auth", "invite", token],
    queryFn: () => api.auth.inviteInfo(token),
    enabled: !!token,
    retry: false,
  });

  const accept = useMutation({
    mutationFn: () => api.auth.acceptInvite({ token, password }),
    onSuccess: (session) => {
      qc.setQueryData(SESSION_KEY, session);
      navigate("/welcome", { replace: true });
    },
  });

  const isExpired = (e: unknown) => isApiError(e) && (e.status === 410 || /EXPIRED/.test(e.code));
  const tokenProblem = (e: unknown) => isApiError(e) && (e.status === 404 || e.status === 410 || /INVITE|TOKEN/.test(e.code));

  if (!token) {
    return (
      <AuthLayout title="Set your password">
        <InviteProblem expired={false} />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Set your password" description="Welcome to TASFUED LMS. Choose a password — you'll use it with your email to sign in.">
      {info.isPending ? (
        <div className="mt-8 space-y-3" aria-busy="true" aria-label="Loading your invitation">
          <Skeleton className="h-16 rounded-xl" />
          <Skeleton className="h-10 rounded-lg" />
          <Skeleton className="h-10 rounded-lg" />
        </div>
      ) : info.isError ? (
        tokenProblem(info.error) ? (
          <InviteProblem expired={isExpired(info.error)} />
        ) : (
          <div className="mt-8 space-y-3">
            <Alert tone="red" title="Couldn't load your invitation">{errorMessage(info.error)}</Alert>
            <Button variant="outline" onClick={() => void info.refetch()}>Try again</Button>
          </div>
        )
      ) : accept.isError && tokenProblem(accept.error) ? (
        <InviteProblem expired={isExpired(accept.error)} />
      ) : (
        <form
          noValidate
          className="mt-8 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setTried(true);
            if (newPasswordValid(password, confirm)) accept.mutate();
          }}
        >
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
            <KeyValue
              items={[
                { label: "Name", value: info.data.fullName },
                { label: "Email (your sign-in)", value: <span className="break-all">{info.data.email}</span> },
              ]}
            />
            <p className="mt-2 text-xs text-neutral-500">This link works until {fmtDateTime(info.data.expiresAt)}.</p>
          </div>
          {/* Lets password managers save the right username with the new password. */}
          <input type="email" name="username" autoComplete="username" value={info.data.email} readOnly hidden />
          <NewPasswordFields password={password} confirm={confirm} onPassword={setPassword} onConfirm={setConfirm} showErrors={tried} label="Password" />
          {accept.isError && <Alert tone="red">{errorMessage(accept.error)}</Alert>}
          <Button type="submit" size="lg" className="w-full" loading={accept.isPending}>
            {accept.isPending ? "Setting your password…" : "Set password and continue"}
          </Button>
          <p className="text-center text-xs text-neutral-500">
            Not you? <Link to="/sign-in" className={buttonClasses("ghost", "xs", "px-1")}>Go to sign in</Link>
          </p>
        </form>
      )}
    </AuthLayout>
  );
}
