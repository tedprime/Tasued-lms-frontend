import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, KeyRound, Mail, Pencil, Plus, ShieldOff, Trash2, UserCheck, UserX, Users } from "lucide-react";
import { api, errorMessage, fmtDateTime, fromNow, ROLE_LABELS, type RoleAssignment, type User } from "@tasued/api-client";
import { Alert, Avatar, Badge, Button, ConfirmDialog, ErrorState, Field, IconButton, Input, KeyValue, Modal, PageLoader, Select } from "../../components/ui";
import { SectionCard } from "../../components/common";
import { hasErrors, useApiMutation } from "../../components/mutation";
import { useCan, useSession } from "../../app/session";
import { scopeLabel } from "../../layout/Header";
import { STATUS_TONE } from "./PeoplePage";
import { RoleScopeFields, roleDraft, validateRole, type RoleDraft } from "./roleScope";
import { isStudent, LmsAccountPill, TeamsGuestPill } from "./invites";

export function UserDetailPage() {
  const { userId } = useParams();
  const q = useQuery({ queryKey: ["people", "get", userId], queryFn: () => api.people.get(userId!), enabled: !!userId });
  if (q.isPending) return <PageLoader />;
  if (q.isError) return <ErrorState title="Couldn't load this person" description={errorMessage(q.error)} onRetry={() => q.refetch()} />;
  return <UserDetail user={q.data} />;
}

function UserDetail({ user: u }: { user: User }) {
  const can = useCan();
  const session = useSession();
  const isSelf = session.user.id === u.id;
  const canRoles = can("roles.manage");
  const [assigning, setAssigning] = useState(false);
  const [editing, setEditing] = useState(false);
  const [removeRole, setRemoveRole] = useState<RoleAssignment | null>(null);
  const [toggling, setToggling] = useState(false);
  const inv = [["people"]];
  const remove = useApiMutation({ mutationFn: (id: string) => api.people.removeRole(u.id, id), success: "Role removed", invalidate: inv, onSuccess: () => setRemoveRole(null) });
  const student = isStudent(u);
  const toggle = useApiMutation({
    mutationFn: () => (u.status === "deactivated" ? api.people.reactivate(u.id) : api.people.deactivate(u.id)),
    success: (x) =>
      x.status === "deactivated"
        ? student ? "Deactivated — LMS sign-in blocked and Teams guest access removed" : "Deactivated — LMS access removed"
        : "Reactivated — they can sign in again",
    invalidate: inv,
    onSuccess: () => setToggling(false),
  });
  const deactivated = u.status === "deactivated";

  return (
    <div className="space-y-5">
      <Link to="/people" className="inline-flex items-center gap-1.5 text-sm font-semibold text-neutral-500 hover:text-primary-500"><ArrowLeft className="size-4" /> People</Link>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Avatar name={u.fullName} src={u.avatarUrl} size={56} />
          <div className="min-w-0">
            <h1 className="font-headline text-2xl font-extrabold text-tertiary-500">{u.fullName}</h1>
            <p className="text-sm text-neutral-500">{u.email}</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              <Badge tone={STATUS_TONE[u.status]}>{u.status}</Badge>
              {student ? <><LmsAccountPill user={u} withLabel /><TeamsGuestPill user={u} withLabel /></> : <Badge tone="blue">Signs in with Microsoft</Badge>}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" icon={<Pencil className="size-4" />} onClick={() => setEditing(true)}>Edit details</Button>
          {!isSelf && (deactivated ? <Button icon={<UserCheck className="size-4" />} onClick={() => setToggling(true)}>Reactivate</Button> : <Button variant="danger" icon={<UserX className="size-4" />} onClick={() => setToggling(true)}>Deactivate</Button>)}
        </div>
      </div>
      {deactivated && <Alert tone="neutral" icon={<ShieldOff className="size-4" />}>{student ? "This account is deactivated. They can't sign in to the LMS and their Teams guest access has been removed. Their records are kept." : "This account is deactivated. They can't use the LMS. Their records are kept."}</Alert>}
      {student && !deactivated && can("people.manage") && <StudentAccessCard user={u} />}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <SectionCard title="Details" bodyClassName="p-5">
          <KeyValue items={[
            { label: u.matricNumber ? "Matric number" : "Staff ID", value: <span className="font-mono">{u.matricNumber ?? u.staffId ?? "—"}</span> },
            ...(student ? [{ label: "Department", value: u.department ?? "—" }, { label: "Level", value: u.level ? `${u.level} level` : "—" }] : []),
            { label: "Phone", value: u.phone ?? "—" },
            { label: "Signs in with", value: u.authMethod === "microsoft" ? "Microsoft (TASFUED work account)" : "LMS password" },
            { label: "Created", value: fmtDateTime(u.createdAt) },
            { label: "Last seen", value: u.lastSeenAt ? fromNow(u.lastSeenAt) : "Never" },
          ]} />
        </SectionCard>
        <SectionCard title="Roles & scopes" subtitle="What this person can do, and where." action={canRoles && <Button size="sm" icon={<Plus className="size-4" />} onClick={() => setAssigning(true)}>Assign role</Button>}>
          {u.roles.length === 0 ? (
            <p className="px-5 py-4 text-sm text-neutral-500">No roles. This person can sign in but sees nothing.</p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {u.roles.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div>
                    <Badge tone={r.role === "super_admin" ? "gold" : r.role === "student" ? "neutral" : "green"}>{ROLE_LABELS[r.role]}</Badge>
                    <p className="mt-1 text-sm text-neutral-600">{scopeLabel(r)}</p>
                  </div>
                  {canRoles && !(isSelf && r.role === "super_admin") && (
                    <IconButton label={`Remove ${ROLE_LABELS[r.role]} role`} className="hover:text-danger" onClick={() => setRemoveRole(r)}><Trash2 className="size-4" /></IconButton>
                  )}
                </li>
              ))}
            </ul>
          )}
          {!canRoles && <p className="border-t border-neutral-100 px-5 py-3 text-xs text-neutral-500">Only users with the roles permission can change roles.</p>}
        </SectionCard>
      </div>

      {assigning && <AssignRoleModal user={u} onClose={() => setAssigning(false)} />}
      {editing && <EditUserModal user={u} onClose={() => setEditing(false)} />}
      <ConfirmDialog open={!!removeRole} onClose={() => setRemoveRole(null)} onConfirm={() => removeRole && remove.mutate(removeRole.id)} loading={remove.isPending} tone="danger" title="Remove this role?" description={removeRole ? `${u.fullName} will no longer be ${ROLE_LABELS[removeRole.role]} ${removeRole.scopeType === "global" ? "" : ` on ${scopeLabel(removeRole).replace(/^Course: /, "")}`}.` : undefined} confirmLabel="Remove role" />
      <ConfirmDialog
        open={toggling}
        onClose={() => setToggling(false)}
        onConfirm={() => toggle.mutate(undefined)}
        loading={toggle.isPending}
        tone={deactivated ? "primary" : "danger"}
        title={deactivated ? `Reactivate ${u.fullName}?` : `Deactivate ${u.fullName}?`}
        description={
          deactivated
            ? student ? "They can sign in to the LMS again. You may need to resend their Teams invitation." : "They can sign in to the LMS with Microsoft again."
            : student ? "This blocks LMS sign-in and removes their Teams guest access. Their submissions, grades and records are kept." : "This blocks their access to the LMS. Their Microsoft account itself is not changed. Their records are kept."
        }
        confirmLabel={deactivated ? "Reactivate" : "Deactivate account"}
      />
    </div>
  );
}

function AssignRoleModal({ user, onClose }: { user: User; onClose: () => void }) {
  const [role, setRole] = useState<RoleDraft>(roleDraft("lecturer"));
  const [error, setError] = useState<string>();
  const save = useApiMutation({ mutationFn: () => api.people.assignRole(user.id, role), success: "Role assigned", invalidate: [["people"]], onSuccess: onClose });
  const submit = () => {
    const e = validateRole(role) ?? (user.roles.some((r) => r.role === role.role && r.scopeType === role.scopeType && r.scopeId === role.scopeId) ? "They already have this role here" : undefined);
    setError(e);
    if (!e) save.mutate(undefined);
  };
  return (
    <Modal open size="lg" onClose={onClose} title={`Assign role — ${user.fullName}`} footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={submit} loading={save.isPending}>Assign</Button></>}>
      <RoleScopeFields value={role} onChange={setRole} error={error} />
      {error && role.scopeType === "global" && <p className="mt-2 text-xs text-danger">{error}</p>}
    </Modal>
  );
}

function EditUserModal({ user, onClose }: { user: User; onClose: () => void }) {
  const [fullName, setFullName] = useState(user.fullName);
  const [phone, setPhone] = useState(user.phone ?? "");
  const [department, setDepartment] = useState(user.department ?? "");
  const [level, setLevel] = useState(String(user.level ?? ""));
  const [errors, setErrors] = useState<{ fullName?: string; phone?: string }>({});
  const isStudentUser = isStudent(user);
  const save = useApiMutation({
    mutationFn: () => api.people.update(user.id, { fullName: fullName.trim(), phone: phone.trim() || undefined, ...(isStudentUser ? { department: department.trim() || undefined, level: level ? Number(level) : undefined } : {}) }),
    success: "Details updated",
    invalidate: [["people"]],
    onSuccess: onClose,
  });
  const submit = () => {
    const e = { fullName: fullName.trim() ? undefined : "Required", phone: phone && !/^\+?[0-9 ]{7,16}$/.test(phone) ? "Enter a valid phone number" : undefined };
    setErrors(e);
    if (!hasErrors(e)) save.mutate(undefined);
  };
  return (
    <Modal open onClose={onClose} title="Edit details" description={isStudentUser ? "Email and matric number come from TASFUED's student list." : "Email and staff ID come from our Microsoft 365 organisation."} footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={submit} loading={save.isPending}>Save</Button></>}>
      <div className="space-y-4">
        <Field label="Full name" required error={errors.fullName} htmlFor="eu-name"><Input id="eu-name" value={fullName} onChange={(e) => setFullName(e.target.value)} invalid={!!errors.fullName} /></Field>
        <Field label="Phone" error={errors.phone} htmlFor="eu-phone"><Input id="eu-phone" value={phone} onChange={(e) => setPhone(e.target.value)} invalid={!!errors.phone} /></Field>
        {isStudentUser && <Field label="Department" htmlFor="eu-dep" hint="As written in TASFUED's list."><Input id="eu-dep" value={department} onChange={(e) => setDepartment(e.target.value)} /></Field>}
        {isStudentUser && <Field label="Level" htmlFor="eu-level"><Select id="eu-level" value={level} onChange={(e) => setLevel(e.target.value)}>{[100, 200, 300, 400, 500].map((l) => <option key={l} value={l}>{l} level</option>)}</Select></Field>}
      </div>
    </Modal>
  );
}

type AccessAction = "lms" | "teams" | "reset";

const ACCESS_COPY: Record<AccessAction, { title: string; body: (u: User) => string; confirm: string; success: string }> = {
  lms: {
    title: "Resend LMS invite?",
    body: (u) => `We'll email ${u.email} a new link to set their LMS password. Any earlier link stops working.`,
    confirm: "Resend LMS invite",
    success: "LMS invite sent",
  },
  teams: {
    title: "Resend Teams invitation?",
    body: (u) => `We'll send a new Microsoft Teams guest invitation to ${u.email}. They must accept it with this email to join classes.`,
    confirm: "Resend Teams invitation",
    success: "Teams invitation sent",
  },
  reset: {
    title: "Send password reset email?",
    body: (u) => `We'll email ${u.email} a link to choose a new LMS password. Their current password keeps working until they change it.`,
    confirm: "Send reset email",
    success: "Password reset email sent",
  },
};

/** Students: LMS password invite, Teams guest invitation and password reset. */
function StudentAccessCard({ user: u }: { user: User }) {
  const [action, setAction] = useState<AccessAction | null>(null);
  const run = useApiMutation({
    mutationFn: async (a: AccessAction) => {
      if (a === "reset") await api.people.sendPasswordReset(u.id);
      else await api.people.resendInvites(u.id, a === "lms" ? { lms: true } : { teams: true });
    },
    success: (_r, a) => ACCESS_COPY[a].success,
    errorTitle: "Couldn't send the email",
    invalidate: [["people"]],
    onSuccess: () => setAction(null),
  });
  const lmsAccepted = u.lmsInvite?.status === "accepted" || (!u.lmsInvite && u.status === "active");
  const teamsAccepted = u.teamsGuest?.status === "accepted";
  const when = (x?: { sentAt?: string; acceptedAt?: string }) => (x?.acceptedAt ? `Accepted ${fmtDateTime(x.acceptedAt)}` : x?.sentAt ? `Sent ${fmtDateTime(x.sentAt)}` : "Not sent yet");
  return (
    <SectionCard title="Sign-in & Teams access" subtitle="Students sign in to the LMS with a password and join Teams classes as guests of our organisation, using the email TASFUED supplied." bodyClassName="grid gap-4 p-5 md:grid-cols-3">
      <div className="space-y-2">
        <p className="flex items-center gap-2 text-sm font-semibold text-tertiary-500"><Mail className="size-4 text-primary-500" /> LMS account</p>
        <LmsAccountPill user={u} />
        <p className="text-xs text-neutral-500">{when(u.lmsInvite)}</p>
        {!lmsAccepted && <Button size="sm" variant="outline" onClick={() => setAction("lms")}>Resend LMS invite</Button>}
      </div>
      <div className="space-y-2">
        <p className="flex items-center gap-2 text-sm font-semibold text-tertiary-500"><Users className="size-4 text-primary-500" /> Teams guest</p>
        <TeamsGuestPill user={u} />
        <p className="text-xs text-neutral-500">{when(u.teamsGuest)}</p>
        {!teamsAccepted && <Button size="sm" variant="outline" onClick={() => setAction("teams")}>Resend Teams invitation</Button>}
      </div>
      <div className="space-y-2">
        <p className="flex items-center gap-2 text-sm font-semibold text-tertiary-500"><KeyRound className="size-4 text-primary-500" /> Password</p>
        <p className="text-xs text-neutral-500">{lmsAccepted ? "Forgotten password? Send them a reset link." : "They set a password from the LMS invite."}</p>
        <Button size="sm" variant="outline" disabled={!lmsAccepted} onClick={() => setAction("reset")}>Send password reset email</Button>
      </div>
      <ConfirmDialog
        open={!!action}
        onClose={() => setAction(null)}
        onConfirm={() => action && run.mutate(action)}
        loading={run.isPending}
        title={action ? ACCESS_COPY[action].title : ""}
        description={action ? ACCESS_COPY[action].body(u) : undefined}
        confirmLabel={action ? ACCESS_COPY[action].confirm : "Send"}
      />
    </SectionCard>
  );
}
