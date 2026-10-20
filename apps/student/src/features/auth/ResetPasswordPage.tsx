import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { api, errorMessage, isApiError } from "@tasued/api-client";
import { Alert, Button, buttonClasses, useToast } from "@tasued/ui";
import { AuthLayout } from "./AuthLayout";
import { NewPasswordFields, newPasswordValid, usePasswordPolicy } from "./password";

function BadLink() {
  return (
    <div className="mt-8 space-y-4">
      <Alert tone="amber" title="This reset link has expired or isn't valid">
        Reset links only work once and for a limited time. Request a new one and use the link in the latest email.
      </Alert>
      <Link to="/forgot-password" className={buttonClasses("primary", "md")}>Request a new link</Link>
    </div>
  );
}

export default function ResetPasswordPage() {
  const policy = usePasswordPolicy();
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const navigate = useNavigate();
  const toast = useToast();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [tried, setTried] = useState(false);

  const reset = useMutation({
    onError: () => { void policy.refetch(); },
    mutationFn: () => api.auth.resetPassword({ token, password }),
    onSuccess: () => {
      toast.success("Password changed", "Sign in with your new password.");
      navigate("/sign-in", { replace: true });
    },
  });
  const badToken = reset.isError && isApiError(reset.error) && (reset.error.status === 404 || reset.error.status === 410 || /TOKEN|EXPIRED/.test(reset.error.code));

  return (
    <AuthLayout title="Choose a new password" description="Pick a password you haven't used here before.">
      {!token || badToken ? (
        <BadLink />
      ) : (
        <form
          noValidate
          className="mt-8 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setTried(true);
            if (policy.data && newPasswordValid(password, confirm, policy.data)) reset.mutate();
          }}
        >
          <NewPasswordFields password={password} confirm={confirm} onPassword={(value) => { setPassword(value); reset.reset(); }} onConfirm={(value) => { setConfirm(value); reset.reset(); }} showErrors={tried} />
          {reset.isError && <Alert tone="red">{errorMessage(reset.error)}</Alert>}
          <Button disabled={!policy.data} type="submit" size="lg" className="w-full" loading={reset.isPending}>{reset.isPending ? "Saving…" : "Save new password"}</Button>
        </form>
      )}
      <Link to="/sign-in" className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-primary-500 hover:underline">
        <ArrowLeft className="size-4" aria-hidden /> Back to sign in
      </Link>
    </AuthLayout>
  );
}
