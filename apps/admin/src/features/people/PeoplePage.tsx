import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { FileUp, UserPlus, Users } from "lucide-react";
import { api, fromNow, ROLE_LABELS, type AccountStatus, type RoleKey, type User } from "@tasued/api-client";
import { Avatar, Badge, Button, EmptyState, Field, Input, Modal, PageHeader, Pagination, SearchInput, SegmentedControl, Select, Table, TBody, TD, TH, THead, TR, buttonClasses, type Tone } from "../../components/ui";
import { ListSkeleton, QueryView, SectionCard } from "../../components/common";
import { hasErrors, useApiMutation, type Errors } from "../../components/mutation";
import { useCan } from "../../app/session";
import { RoleScopeFields, roleDraft, validateRole, type RoleDraft } from "./roleScope";
import { isStudent, LmsAccountPill, TeamsGuestPill, type LmsFilter, type TeamsFilter } from "./invites";

const PAGE_SIZE = 25;

export const STATUS_TONE: Record<AccountStatus, Tone> = { active: "green", invited: "blue", suspended: "amber", deactivated: "neutral" };

/** Users table — replaces SLAN admin's pages/Users.tsx + AddAdmin.tsx. */
export function PeoplePage() {
  const navigate = useNavigate();
  const can = useCan();
  const [params] = useSearchParams();
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<RoleKey | "">((params.get("role") as RoleKey | null) ?? "");
  const [status, setStatus] = useState<AccountStatus | "">("");
  const [lms, setLms] = useState<LmsFilter>((params.get("lms") as LmsFilter | null) ?? "");
  const [teams, setTeams] = useState<TeamsFilter>((params.get("teams") as TeamsFilter | null) ?? "");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const inviteFiltering = !!(lms || teams);
  const q = useQuery({
    queryKey: ["people", "list", { search, role, status, lms, teams, page }],
    queryFn: () =>
      api.people.list({
        search,
        role: role || undefined,
        status: status || undefined,
        lmsInvite: lms || undefined,
        teamsGuest: teams || undefined,
        page,
        pageSize: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
  });
  const view = q;
  const reset = <T,>(fn: (v: T) => void) => (v: T) => { fn(v); setPage(1); };
  const showInviteCols = role === "student" || inviteFiltering;

  return (
    <div>
      <PageHeader
        title="People"
        description="Students sign in to the LMS with a password and join Teams classes as guests of our organisation. Staff are members of our Microsoft 365 organisation and sign in with Microsoft."
        actions={
          <>
            {can("people.import") && <Link to="/people/import" className={buttonClasses("outline")}><FileUp className="size-4" /> Invite students</Link>}
            <Button icon={<UserPlus className="size-4" />} onClick={() => setCreating(true)}>New person</Button>
          </>
        }
      />
      <SectionCard
        action={
          <div className="flex w-full flex-wrap gap-2">
            <SearchInput className="w-full sm:w-64" placeholder="Name, email, matric or staff ID" aria-label="Search people" value={search} onChange={(e) => reset(setSearch)(e.target.value)} />
            <Select aria-label="Role" className="w-full py-2 sm:w-44" value={role} onChange={(e) => reset(setRole)(e.target.value as RoleKey | "")}>
              <option value="">Any role</option>
              {(Object.keys(ROLE_LABELS) as RoleKey[]).map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </Select>
            <Select aria-label="LMS account" className="w-full py-2 sm:w-44" value={lms} onChange={(e) => reset(setLms)(e.target.value as LmsFilter)}>
              <option value="">Any LMS account</option>
              <option value="invited">LMS: Invited</option>
              <option value="active">LMS: Active</option>
              <option value="expired">LMS: Invite expired</option>
            </Select>
            <Select aria-label="Teams guest" className="w-full py-2 sm:w-44" value={teams} onChange={(e) => reset(setTeams)(e.target.value as TeamsFilter)}>
              <option value="">Any Teams guest</option>
              <option value="invited">Teams: Invited</option>
              <option value="accepted">Teams: Accepted</option>
              <option value="expired">Teams: Expired</option>
            </Select>
            <SegmentedControl<AccountStatus | ""> value={status} onChange={reset(setStatus)} options={[{ key: "", label: "All" }, { key: "active", label: "Active" }, { key: "invited", label: "Invited" }, { key: "deactivated", label: "Deactivated" }]} />
          </div>
        }
      >
        {inviteFiltering && <p className="border-b border-neutral-100 px-5 py-2 text-xs text-neutral-500">Showing students only — LMS account and Teams guest filters apply to students.</p>}
        <QueryView query={view} loading={<ListSkeleton rows={8} />} isEmpty={(d) => !d.items.length} empty={<EmptyState icon={<Users className="size-6" />} title="No people match" />}>
          {(d) => (
            <>
              <Table>
                <THead><tr><TH>Person</TH><TH>ID</TH><TH>Roles</TH><TH>Department / level</TH><TH>{showInviteCols ? "LMS account" : "Sign-in"}</TH>{showInviteCols && <TH>Teams guest</TH>}<TH>Status</TH><TH>Last seen</TH></tr></THead>
                <TBody>
                  {d.items.map((u) => (
                    <TR key={u.id} onClick={() => navigate(`/people/${u.id}`)}>
                      <TD>
                        <Link to={`/people/${u.id}`} className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                          <Avatar name={u.fullName} src={u.avatarUrl} size={32} />
                          <span className="min-w-0"><span className="block truncate font-semibold text-tertiary-500 hover:text-primary-500">{u.fullName}</span><span className="block truncate text-xs text-neutral-500">{u.email}</span></span>
                        </Link>
                      </TD>
                      <TD className="font-mono text-xs">{u.matricNumber ?? u.staffId ?? "—"}</TD>
                      <TD><RoleBadges user={u} /></TD>
                      <TD className="text-xs">{u.department ?? (u.level ? "" : "—")}{u.level ? `${u.department ? " · " : ""}${u.level}L` : ""}</TD>
                      <TD>{isStudent(u) ? <LmsAccountPill user={u} /> : <span className="text-xs text-neutral-500">Microsoft</span>}</TD>
                      {showInviteCols && <TD>{isStudent(u) ? <TeamsGuestPill user={u} /> : <span className="text-xs text-neutral-400">—</span>}</TD>}
                      <TD><Badge tone={STATUS_TONE[u.status]}>{u.status}</Badge></TD>
                      <TD className="text-xs text-neutral-500">{u.lastSeenAt ? fromNow(u.lastSeenAt) : "Never"}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
              <Pagination page={d.page} pageSize={d.pageSize} total={d.total} onPage={setPage} />
            </>
          )}
        </QueryView>
      </SectionCard>
      {creating && <CreatePersonModal onClose={() => setCreating(false)} />}
    </div>
  );
}

export function RoleBadges({ user }: { user: User }) {
  const roles = [...new Set(user.roles.map((r) => r.role))];
  return (
    <div className="flex flex-wrap gap-1">
      {roles.map((r) => <Badge key={r} tone={r === "student" ? "neutral" : r === "super_admin" ? "gold" : "green"}>{ROLE_LABELS[r]}</Badge>)}
      {!roles.length && <span className="text-xs text-neutral-400">None</span>}
    </div>
  );
}

type F = { kind: "student" | "staff"; fullName: string; email: string; matricNumber: string; staffId: string; department: string; level: string };

function CreatePersonModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [f, setF] = useState<F>({ kind: "student", fullName: "", email: "", matricNumber: "", staffId: "", department: "", level: "100" });
  const [role, setRole] = useState<RoleDraft>(roleDraft("lecturer"));
  const [errors, setErrors] = useState<Errors<keyof F | "role">>({});
  const save = useApiMutation({
    mutationFn: () =>
      api.people.create({
        fullName: f.fullName.trim(),
        email: f.email.trim().toLowerCase(),
        matricNumber: f.kind === "student" ? f.matricNumber.trim() : undefined,
        staffId: f.kind === "staff" ? f.staffId.trim() : undefined,
        department: f.kind === "student" ? f.department.trim() || undefined : undefined,
        level: f.kind === "student" ? Number(f.level) : undefined,
        roles: f.kind === "student" ? [{ role: "student", scopeType: "global", scopeId: null }] : [role],
      }),
    success: (u) => (isStudent(u) ? "Student created — LMS invitation and Teams guest invitation queued" : "Staff member added — they sign in with Microsoft"),
    invalidate: [["people"]],
    onSuccess: (u) => navigate(`/people/${u.id}`),
  });
  const submit = () => {
    const e: Errors<keyof F | "role"> = {
      fullName: f.fullName.trim() ? undefined : "Full name is required",
      email: /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.trim()) ? undefined : "Enter a valid email address",
      matricNumber: f.kind === "student" && !f.matricNumber.trim() ? "Matric number is required" : undefined,
      staffId: f.kind === "staff" && !f.staffId.trim() ? "Staff ID is required" : undefined,
      role: f.kind === "staff" ? validateRole(role) : undefined,
    };
    setErrors(e);
    if (!hasErrors(e)) save.mutate(undefined);
  };
  const set = (k: keyof F) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal open size="lg" onClose={onClose} title="New person" description={f.kind === "student" ? "Creates the LMS account, emails a link to set their LMS password and sends a Microsoft Teams guest invitation to our organisation." : "Staff must already be members of our Microsoft 365 organisation. They sign in with Microsoft."} footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={submit} loading={save.isPending}>Create</Button></>}>
      <div className="space-y-4">
        <SegmentedControl<F["kind"]> value={f.kind} onChange={(kind) => setF({ ...f, kind })} options={[{ key: "student", label: "Student" }, { key: "staff", label: "Staff" }]} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" required error={errors.fullName} htmlFor="np-name"><Input id="np-name" value={f.fullName} onChange={set("fullName")} invalid={!!errors.fullName} /></Field>
          <Field label={f.kind === "student" ? "Email (from TASFUED's list)" : "Microsoft work email"} required error={errors.email} htmlFor="np-email" hint={f.kind === "student" ? "Invitations go here. It's also their Teams guest identity." : undefined}><Input id="np-email" type="email" value={f.email} onChange={set("email")} invalid={!!errors.email} placeholder={f.kind === "student" ? "student@example.com" : "name@tedprimehub.org"} /></Field>
          {f.kind === "student" ? (
            <>
              <Field label="Matric number" required error={errors.matricNumber} htmlFor="np-matric"><Input id="np-matric" value={f.matricNumber} onChange={set("matricNumber")} invalid={!!errors.matricNumber} /></Field>
              <Field label="Level" htmlFor="np-level"><Select id="np-level" value={f.level} onChange={set("level")}>{[100, 200, 300, 400, 500].map((l) => <option key={l} value={l}>{l} level</option>)}</Select></Field>
            </>
          ) : (
            <Field label="Staff ID" required error={errors.staffId} htmlFor="np-staff"><Input id="np-staff" value={f.staffId} onChange={set("staffId")} invalid={!!errors.staffId} /></Field>
          )}
          {f.kind === "student" && (
            <Field className="sm:col-span-2" label="Department" htmlFor="np-dep" hint="As written in TASFUED's list.">
              <Input id="np-dep" value={f.department} onChange={set("department")} />
            </Field>
          )}
        </div>
        {f.kind === "staff" && (
          <div className="rounded-xl border border-neutral-200 p-4">
            <p className="mb-3 text-sm font-semibold text-tertiary-500">Initial role</p>
            <RoleScopeFields value={role} onChange={setRole} error={errors.role} />
          </div>
        )}
      </div>
    </Modal>
  );
}
