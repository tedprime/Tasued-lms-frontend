import { useId, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, MailCheck } from "lucide-react";
import { api, errorMessage } from "@tasued/api-client";
import { Alert, Button, Field, Input } from "@tasued/ui";
import { AuthLayout } from "./AuthLayout";

export default function ForgotPasswordPage() {
  const id = useId();
  const [email, setEmail] = useState("");
  const [tried, setTried] = useState(false);
  const emailOk = /^\S+@\S+\.\S+$/.test(email.trim());

  const send = useMutation({ mutationFn: () => api.auth.requestPasswordReset({ email: email.trim() }) });
  // The API answers the same whether or not the address exists, so the message never reveals it.
  const done = send.isSuccess;
  const failed = send.isError;

  return (
    <AuthLayout title="Forgot your password?" description="Enter the email you sign in with and we'll send you a link to choose a new password.">
      {done ? (
        <div className="mt-8 space-y-5">
          <Alert tone="green" icon={<MailCheck className="size-4" aria-hidden />} title="Check your email">
            If that email is registered, we've sent a reset link. It may take a few minutes — check your spam folder too.
          </Alert>
          <Button variant="outline" onClick={() => { send.reset(); setTried(false); }}>Use a different email</Button>
        </div>
      ) : (
        <form
          noValidate
          className="mt-8 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setTried(true);
            if (emailOk) send.mutate();
          }}
        >
          <Field label="Email" htmlFor={id} error={tried && !emailOk ? "Enter a valid email address." : undefined}>
            <Input id={id} type="email" inputMode="email" autoComplete="username" autoCapitalize="none" spellCheck={false} value={email} onChange={(e) => setEmail(e.target.value)} invalid={tried && !emailOk} required />
          </Field>
          {failed && <Alert tone="red">{errorMessage(send.error, "Couldn't send the reset link. Check your connection and try again.")}</Alert>}
          <Button type="submit" size="lg" className="w-full" loading={send.isPending}>{send.isPending ? "Sending…" : "Send reset link"}</Button>
        </form>
      )}
      <Link to="/sign-in" className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-primary-500 hover:underline">
        <ArrowLeft className="size-4" aria-hidden /> Back to sign in
      </Link>
    </AuthLayout>
  );
}
