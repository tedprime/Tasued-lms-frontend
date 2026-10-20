import { DEFAULT_PASSWORD_POLICY, passwordBytes, newPasswordValid, type PasswordPolicy } from './password-policy';
export { newPasswordValid } from './password-policy';
import { forwardRef, useId, useState, type InputHTMLAttributes } from "react";
import { Check, Eye, EyeOff, X } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, errorMessage, isApiError, type Session } from "@tasued/api-client";
import { Alert, Button, Field, Input, cn } from "@tasued/ui";
import { SESSION_KEY } from "../../app/session";

export const MIN_PASSWORD = 8;
export function usePasswordPolicy() {
 return useQuery({queryKey:['auth','password-policy'],queryFn:()=>api.auth.passwordPolicy(),staleTime:0,retry:1});
}

/** Password input with a show/hide toggle. */
export const PasswordInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(function PasswordInput(
  { className, ...rest },
  ref,
) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input ref={ref} type={show ? "text" : "password"} className={cn("pr-11", className)} {...rest} />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Hide password" : "Show password"}
        aria-pressed={show}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-neutral-500 hover:text-tertiary-500 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
      >
        {show ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
      </button>
    </div>
  );
});

/** 0–4. Advisory only; the hard rule is the minimum length (the API may enforce more). */
export function passwordScore(pw: string, minLength = MIN_PASSWORD) {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= minLength) s++;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++;
  else if (/\d/.test(pw) || /[^A-Za-z0-9]/.test(pw)) s += 0.5;
  return pw.length < minLength ? Math.min(s, 1) : Math.min(4, Math.floor(s));
}

const LEVELS = [
  { label: "Too short", bar: "bg-danger", text: "text-danger" },
  { label: "Weak", bar: "bg-danger", text: "text-danger" },
  { label: "Fair", bar: "bg-warning", text: "text-warning" },
  { label: "Good", bar: "bg-success", text: "text-success" },
  { label: "Strong", bar: "bg-success", text: "text-success" },
];

/** Strength bar + rule checklist for a new password. */
export function PasswordRules({ password, confirm, id, policy = DEFAULT_PASSWORD_POLICY }: { password: string; confirm?: string; id?: string; policy?: PasswordPolicy }) {
  const score = password.length < policy.minLength || passwordBytes(password) > policy.maxBytes ? 0 : Math.max(1, passwordScore(password, policy.minLength));
  const lvl = passwordBytes(password) > policy.maxBytes ? { label: 'Too long', bar: 'bg-danger', text: 'text-danger' } : LEVELS[score]!;
  const rules = [
    { ok: password.length >= policy.minLength, text: `At least ${policy.minLength} characters` },
    { ok: passwordBytes(password) <= policy.maxBytes, text: "Password is within the supported length" },
    { ok: /[A-Za-z]/.test(password) && /\d/.test(password), text: "Mix letters and numbers (recommended)" },
    ...(confirm !== undefined ? [{ ok: !!confirm && confirm === password, text: "Both passwords match" }] : []),
  ];
  return (
    <div id={id} className="space-y-2" aria-live="polite">
      {password && (
        <div className="flex items-center gap-3">
          <div className="flex flex-1 gap-1" aria-hidden>
            {[1, 2, 3, 4].map((i) => (
              <span key={i} className={cn("h-1.5 flex-1 rounded-full", i <= score ? lvl.bar : "bg-neutral-200")} />
            ))}
          </div>
          <span className={cn("w-16 text-right text-xs font-semibold", lvl.text)}>
            <span className="sr-only">Password strength: </span>{lvl.label}
          </span>
        </div>
      )}
      <ul className="space-y-1 text-xs">
        {rules.map((r) => (
          <li key={r.text} className={cn("flex items-center gap-1.5", r.ok ? "text-success" : "text-neutral-500")}>
            {r.ok ? <Check className="size-3.5" aria-hidden /> : <X className="size-3.5" aria-hidden />}
            <span>
              <span className="sr-only">{r.ok ? "Done: " : "Not yet: "}</span>
              {r.text}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** New password + confirm fields with strength meter. Returns validity via `valid`. */
export function NewPasswordFields({
  password,
  confirm,
  onPassword,
  onConfirm,
  showErrors,
  label = "New password",
}: {
  password: string;
  confirm: string;
  onPassword: (v: string) => void;
  onConfirm: (v: string) => void;
  showErrors: boolean;
  label?: string;
}) {
  const ids = { pw: useId(), cf: useId(), rules: useId() };
  const requirements = usePasswordPolicy();
  const policy = requirements.data ?? DEFAULT_PASSWORD_POLICY;
  const tooShort = password.length < policy.minLength;
  const tooLong = passwordBytes(password) > policy.maxBytes;
  const mismatch = confirm !== password;
  return (
    <>
      <Field label={label} htmlFor={ids.pw} error={showErrors && tooShort ? `Use at least ${policy.minLength} characters.` : showErrors && tooLong ? "This password is too long. Shorten it; emoji and some special characters take more space." : undefined}>
        <PasswordInput
          id={ids.pw}
          autoComplete="new-password"
          value={password}
          onChange={(e) => onPassword(e.target.value)}
          invalid={showErrors && (tooShort || tooLong)}
          aria-describedby={ids.rules}
          required
          minLength={policy.minLength}
        />
      </Field>
      <Field label={`Confirm ${label.toLowerCase()}`} htmlFor={ids.cf} error={showErrors && mismatch ? "The passwords don't match." : undefined}>
        <PasswordInput id={ids.cf} autoComplete="new-password" value={confirm} onChange={(e) => onConfirm(e.target.value)} invalid={showErrors && mismatch} required />
      </Field>
      {requirements.data ? <PasswordRules id={ids.rules} password={password} confirm={confirm} policy={policy} /> : requirements.isError ? <Alert tone="red">Could not load password requirements. <button type="button" className="underline" onClick={() => void requirements.refetch()}>Try again</button></Alert> : <p className="text-sm text-neutral-500">Loading password requirements…</p>}
    </>
  );
}



/** Current + new + confirm. Used by the forced /change-password page and the Settings section. */
export function ChangePasswordForm({ onDone, submitLabel = "Change password" }: { onDone: (s: Session) => void; submitLabel?: string }) {
  const qc = useQueryClient();
  const policy = usePasswordPolicy();
  const curId = useId();
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [tried, setTried] = useState(false);
  const same = !!current && current === password;

  const change = useMutation({
    onError: () => { void policy.refetch(); },
    mutationFn: () => api.auth.changePassword({ currentPassword: current, newPassword: password }),
    onSuccess: (session) => {
      qc.setQueryData(SESSION_KEY, session);
      setCurrent("");
      setPassword("");
      setConfirm("");
      setTried(false);
      onDone(session);
    },
  });

  const wrongCurrent = isApiError(change.error) && /INVALID_CREDENTIALS|WRONG_PASSWORD|CURRENT_PASSWORD/.test(change.error.code);

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setTried(true);
        if (!current || same || !policy.data || !newPasswordValid(password, confirm, policy.data)) return;
        change.mutate();
      }}
    >
      <Field label="Current password" htmlFor={curId} error={tried && !current ? "Enter your current password." : wrongCurrent ? "That isn't your current password." : undefined}>
        <PasswordInput id={curId} autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} invalid={(tried && !current) || wrongCurrent} required />
      </Field>
      <NewPasswordFields password={password} confirm={confirm} onPassword={(value) => { setPassword(value); change.reset(); }} onConfirm={(value) => { setConfirm(value); change.reset(); }} showErrors={tried} />
      {tried && same && <p className="text-xs text-danger">Choose a new password that's different from your current one.</p>}
      {change.isError && !wrongCurrent && <Alert tone="red">{errorMessage(change.error)}</Alert>}
      <Button type="submit" disabled={!policy.data} loading={change.isPending} className="w-full sm:w-auto">{change.isPending ? "Saving…" : submitLabel}</Button>
    </form>
  );
}
