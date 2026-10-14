import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Lock, Pencil } from "lucide-react";
import { Link } from "react-router-dom";
import { api, errorMessage, ROLE_LABELS, type Session } from "@tasued/api-client";
import { Alert, Avatar, Badge, Button, Card, CardBody, CardHeader, Field, Input, KeyValue, useToast } from "@tasued/ui";
import { SESSION_KEY, useSession } from "../../app/session";
import { TeamsInviteBadge } from "../../components/bits";

const PHONE_RE = /^\+?[0-9 ()-]{7,20}$/;

/** Profile — SLAN ProfileView hero + details. University-managed fields are read-only; phone is editable. */
export default function ProfilePage() {
  const { user } = useSession();
  const qc = useQueryClient();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [phone, setPhone] = useState(user.phone ?? "");
  const valid = !phone.trim() || PHONE_RE.test(phone.trim());

  const save = useMutation({
    mutationFn: () => api.auth.updateProfile({ phone: phone.trim() || undefined }),
    onSuccess: (u) => {
      qc.setQueryData<Session | null>(SESSION_KEY, (s) => (s ? { ...s, user: { ...s.user, ...u } } : s));
      setEditing(false);
      toast.success("Phone number updated");
    },
    onError: (e) => toast.error("Couldn't save", errorMessage(e)),
  });

  const roles = [...new Set(user.roles.map((r) => r.role))];

  return (
    <div className="animate-fade-in-up">
      <section className="relative overflow-hidden bg-[linear-gradient(135deg,#091222_0%,#142647_55%,#192f59_100%)] px-4 py-12 sm:px-8">
        <div className="relative mx-auto flex max-w-4xl items-center gap-4">
          <Avatar name={user.fullName} src={user.avatarUrl} size={64} className="border-2 border-white/30 bg-white/10 text-white" />
          <div className="min-w-0">
            <h1 className="truncate font-headline text-2xl font-extrabold text-white">{user.fullName}</h1>
            <p className="truncate text-sm text-white/75">{user.email}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">{roles.map((r) => <Badge key={r} tone="gold">{ROLE_LABELS[r]}</Badge>)}</div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-6">
        <Card>
          <CardHeader title="Account" subtitle="Managed by the university. Contact the course team to correct these details." action={<Lock className="size-4 text-neutral-400" aria-label="Read-only" />} />
          <CardBody>
            <KeyValue
              items={[
                { label: "Full name", value: user.fullName },
                { label: "Email (sign-in)", value: <span className="break-all">{user.email}</span> },
                {
                  label: "Teams invitation",
                  value: user.teamsGuest ? (
                    <span className="flex flex-col items-start gap-1">
                      <TeamsInviteBadge status={user.teamsGuest.status} />
                      {user.teamsGuest.status === "accepted" && <span className="text-xs font-normal text-neutral-500">Sign in to Teams with this email to join classes.</span>}
                    </span>
                  ) : (
                    "—"
                  ),
                },
                { label: "Matric number", value: user.matricNumber ?? "—" },
                { label: "Department", value: user.department ?? "—" },
                { label: "Level", value: user.level ? `${user.level} level` : "—" },
                { label: "Account status", value: <Badge tone={user.status === "active" ? "green" : "amber"}>{user.status[0]!.toUpperCase() + user.status.slice(1)}</Badge> },
              ]}
            />
            <Link to="/settings#change-password" className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary-500 hover:underline">
              <KeyRound className="size-4" aria-hidden /> Change password
            </Link>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Contact"
            subtitle="Your phone number is only visible to university staff."
            action={!editing && <Button variant="outline" size="sm" icon={<Pencil className="size-3.5" />} onClick={() => setEditing(true)}>Edit</Button>}
          />
          <CardBody>
            {editing ? (
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (valid) save.mutate();
                }}
              >
                <Field label="Phone number" htmlFor="phone" error={!valid ? "Enter a valid phone number, e.g. +234 803 000 0000." : undefined}>
                  <Input id="phone" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+234 803 000 0000" invalid={!valid} />
                </Field>
                {save.isError && <Alert tone="red">{errorMessage(save.error)}</Alert>}
                <div className="flex gap-2">
                  <Button type="submit" loading={save.isPending} disabled={!valid}>Save</Button>
                  <Button variant="outline" onClick={() => { setPhone(user.phone ?? ""); setEditing(false); }}>Cancel</Button>
                </div>
              </form>
            ) : (
              <KeyValue items={[{ label: "Phone number", value: user.phone || <span className="font-normal text-neutral-500">Not set</span> }]} />
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
