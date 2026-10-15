import { useNavigate, useSearchParams } from "react-router-dom";
import { KeyRound, LogOut } from "lucide-react";
import { Alert, Button, Card, Logo, useToast } from "@tasued/ui";
import { useLogout, useSession } from "../../app/session";
import { safeReturnTo } from "./AuthLayout";
import { ChangePasswordForm } from "./password";

/** Focused page. Forced (every route redirects here) while session.mustChangePassword is true. */
export default function ChangePasswordPage() {
  const session = useSession();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const logout = useLogout();
  const forced = session.mustChangePassword;
  const returnTo = safeReturnTo(params.get("returnTo"));

  return (
    <div className="min-h-dvh bg-neutral-50 px-4 py-8 sm:py-14">
      <div className="mx-auto w-full max-w-md">
        <div className="flex items-center justify-between gap-3">
          <Logo compact />
          <Button variant="ghost" size="sm" icon={<LogOut className="size-4" aria-hidden />} onClick={() => logout.mutate()} loading={logout.isPending}>
            Sign out
          </Button>
        </div>
        <Card className="mt-6 p-5 sm:p-7">
          <span className="flex size-11 items-center justify-center rounded-full bg-primary-50 text-primary-500"><KeyRound className="size-5" aria-hidden /></span>
          <h1 className="mt-4 font-headline text-2xl font-extrabold tracking-tight text-tertiary-500">{forced ? "Change your password to continue" : "Change password"}</h1>
          <p className="mt-1.5 text-sm text-neutral-500">
            Signed in as <span className="font-semibold break-all text-tertiary-500">{session.user.email}</span>
          </p>
          {forced && (
            <Alert tone="amber" className="mt-4">
              You signed in with a temporary password. Choose your own password before using TASFUED LMS — enter the temporary one as your current password.
            </Alert>
          )}
          <div className="mt-6">
            <ChangePasswordForm
              submitLabel={forced ? "Save and continue" : "Change password"}
              onDone={() => {
                toast.success("Password changed", "Use your new password next time you sign in.");
                navigate(returnTo, { replace: true });
              }}
            />
          </div>
        </Card>
      </div>
    </div>
  );
}
