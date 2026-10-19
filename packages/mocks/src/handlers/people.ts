import { ROLE_LABELS } from "@tasued/api-client";
import type { AccountStatus, ImportPreview, ImportResult, RoleAssignment, RoleKey, ScopeType, User } from "@tasued/api-client";
import { audit, find } from "../db/ops/common";
import type { DB, ImportRowData, UserRow } from "../db/schema";
import { DEFAULT_PREFERENCES } from "../db/schema";
import { userView } from "../db/views/core";
import { isStudent, issueToken, logEmailLink, sendInvites } from "../db/ops/accounts";
import { asNumber, asString } from "../lib/access";
import { ROLE_PERMISSIONS, requirePerm, type Viewer } from "../lib/auth";
import { iso } from "../lib/dates";
import { conflict, forbidden, invalid, notFound, parseCsv, validation } from "../lib/http";
import { matches, paginate } from "../lib/pagination";
import { newId } from "../lib/random";
import type { Ctx, Router } from "../lib/route";

const ROLES: RoleKey[] = ["super_admin", "lecturer", "teaching_assistant", "student"];
const SCOPES: ScopeType[] = ["global", "course"];
const EMAIL_RE = /^[^@\s,;]+@[^@\s,;]+\.[^@\s,;]+$/;

/** Super admins see everyone; other staff see themselves, colleagues on their courses and students enrolled in them. */
function visibleUser(db: DB, v: Viewer, u: UserRow) {
  if (v.isSuperAdmin || u.id === v.user.id) return true;
  if (db.courses.some((o) => v.staffCourseIds.has(o.id) && (o.lecturerIds.includes(u.id) || o.assistantIds.includes(u.id)))) return true;
  return db.enrolments.some((e) => e.userId === u.id && e.status === "active" && v.staffCourseIds.has(e.courseId));
}

/** super_admin and student are global; lecturer and teaching_assistant are scoped to one course. */
function validateRole(db: DB, v: Viewer, b: Partial<RoleAssignment>): Omit<RoleAssignment, "id" | "scopeName"> {
  const errs: Record<string, string> = {};
  if (!b.role || !ROLES.includes(b.role)) errs.role = "Choose a role";
  if (b.scopeType !== undefined && !SCOPES.includes(b.scopeType)) errs.scopeType = "Choose a scope";
  const courseRole = b.role === "lecturer" || b.role === "teaching_assistant";
  const scopeType: ScopeType = courseRole ? "course" : "global";
  const scopeId = courseRole ? b.scopeId ?? null : null;
  if (courseRole && b.scopeType === "global") errs.scopeType = "Lecturers and teaching assistants are assigned to a course";
  if (!courseRole && b.scopeType === "course") errs.scopeType = b.role === "super_admin" ? "Super admin must be global" : "Students aren't scoped to a course — enrol them instead";
  if (courseRole && !db.courses.some((o) => o.id === scopeId)) errs.scopeId = "Choose a course";
  if (Object.keys(errs).length) throw validation(errs);
  if (!v.isSuperAdmin) throw forbidden("Only a super admin can assign roles.");
  return { role: b.role!, scopeType, scopeId };
}

function syncCourseStaff(db: DB, userId: string, r: Omit<RoleAssignment, "id" | "scopeName">, add: boolean) {
  if (r.scopeType !== "course" || !r.scopeId) return;
  const o = db.courses.find((x) => x.id === r.scopeId);
  if (!o) return;
  const key = r.role === "lecturer" ? "lecturerIds" : r.role === "teaching_assistant" ? "assistantIds" : null;
  if (!key) return;
  o[key] = add ? [...new Set([...o[key], userId])] : o[key].filter((x) => x !== userId);
}

type InviteFilter = "invited" | "active" | "accepted" | "expired";
const lmsStatusOf = (u: UserRow) => u.lmsInvite?.status ?? (u.status === "active" ? "accepted" : "not_sent");
const teamsStatusOf = (u: UserRow) => u.teamsGuest?.status ?? "not_sent";
const inviteMatch = (s: string, f: InviteFilter) =>
  f === "invited" ? s === "sent" || s === "not_sent" : f === "expired" ? s === "expired" : s === "accepted";

/** Invite filters apply to students only. */
export function matchesInviteFilter(u: UserRow, lms?: InviteFilter, teams?: InviteFilter) {
  if (!lms && !teams) return true;
  if (!isStudent(u)) return false;
  return (!lms || inviteMatch(lmsStatusOf(u), lms)) && (!teams || inviteMatch(teamsStatusOf(u), teams));
}

export function registerPeople(r: Router) {
  r.get("/roles/permissions", (c) => {
    if (!c.viewer.isStaff) throw forbidden();
    return ROLE_PERMISSIONS;
  });

  r.get("/users", (c) => {
    requirePerm(c.viewer, ["people.manage", "roles.manage"]);
    const role = c.q("role") as RoleKey | undefined;
    const status = c.q("status") as AccountStatus | undefined;
    const term = c.q("search");
    const lmsF = c.q("lmsInvite") as InviteFilter | undefined;
    const teamsF = c.q("teamsGuest") as InviteFilter | undefined;
    const rows = c.db.users
      .filter((u) => visibleUser(c.db, c.viewer, u))
      .filter((u) => (!role || u.roles.some((x) => x.role === role)) && (!status || u.status === status))
      .filter((u) => matchesInviteFilter(u, lmsF, teamsF))
      .filter((u) => matches(term, u.fullName, u.email, u.matricNumber, u.staffId))
      .sort((a, b) => a.fullName.localeCompare(b.fullName))
      .map((u) => userView(c.db, u));
    return paginate(rows, c.url);
  });

  r.get("/users/:id", (c) => {
    const u = find(c.db.users, c.params.id, "user");
    if (u.id !== c.viewer.user.id) {
      requirePerm(c.viewer, ["people.manage", "roles.manage"]);
      if (!visibleUser(c.db, c.viewer, u)) throw notFound("user");
    }
    return userView(c.db, u);
  });

  r.post("/users", async (c) => {
    requirePerm(c.viewer, "people.manage");
    const b = await c.json<Partial<User> & { roles?: Partial<RoleAssignment>[] }>();
    const errs: Record<string, string> = {};
    const fullName = asString(b.fullName);
    const email = asString(b.email).toLowerCase();
    if (!fullName) errs.fullName = "Full name is required";
    const studentAccount = Array.isArray(b.roles) && b.roles.length > 0 && b.roles.every((x) => x?.role === "student");
    if (!EMAIL_RE.test(email)) errs.email = "Enter a valid email address";
    if (!Array.isArray(b.roles) || !b.roles.length) errs.roles = "Assign at least one role";
    if (Object.keys(errs).length) throw validation(errs);
    if (c.db.users.some((u) => u.email.toLowerCase() === email)) throw conflict("EMAIL_EXISTS", "An account with that email already exists.");
    if (b.matricNumber && c.db.users.some((u) => u.matricNumber === b.matricNumber)) throw conflict("MATRIC_EXISTS", "That matric number is already in use.");
    const roles = b.roles!.map((x) => ({ ...validateRole(c.db, c.viewer, x), id: newId("rol") }));
    const u: UserRow = {
      id: newId("usr"),
      fullName,
      email,
      matricNumber: asString(b.matricNumber) || undefined,
      staffId: asString(b.staffId) || undefined,
      department: asString(b.department) || undefined,
      level: asNumber(b.level),
      status: studentAccount ? "invited" : "active",
      authMethod: studentAccount ? "password" : "microsoft",
      roles,
      createdAt: iso(c.now),
    };
    c.db.users.push(u);
    c.db.preferences[u.id] = { ...DEFAULT_PREFERENCES };
    roles.forEach((x) => syncCourseStaff(c.db, u.id, x, true));
    if (studentAccount) sendInvites(c.db, u, c.now, { lms: true, teams: true });
    audit(c.db, c.viewer.user, "user.created", "user", u.id, studentAccount ? `Created ${fullName} (${email}) — LMS and Teams guest invitations sent` : `Created ${fullName} (${email}) — signs in with Microsoft`);
    return userView(c.db, u);
  });

  r.patch("/users/:id", async (c) => {
    requirePerm(c.viewer, "people.manage");
    const u = find(c.db.users, c.params.id, "user");
    if (!visibleUser(c.db, c.viewer, u)) throw notFound("user");
    const b = await c.json<Partial<User>>();
    if (b.fullName !== undefined) u.fullName = asString(b.fullName) || u.fullName;
    if (b.phone !== undefined) u.phone = asString(b.phone) || undefined;
    if (b.department !== undefined) u.department = asString(b.department) || undefined;
    if (b.level !== undefined) u.level = asNumber(b.level);
    if (b.status !== undefined) {
      if (!["active", "invited", "suspended", "deactivated"].includes(b.status)) throw validation({ status: "Invalid status" });
      u.status = b.status;
    }
    audit(c.db, c.viewer.user, "user.updated", "user", u.id, `Updated ${u.fullName}`);
    return userView(c.db, u);
  });

  r.post("/users/:id/deactivate", (c) => {
    requirePerm(c.viewer, "people.manage");
    const u = find(c.db.users, c.params.id, "user");
    if (u.id === c.viewer.user.id) throw conflict("SELF", "You can't deactivate your own account.");
    u.status = "deactivated";
    audit(c.db, c.viewer.user, "user.deactivated", "user", u.id, `Deactivated ${u.fullName} — LMS sign-in blocked`);
    return userView(c.db, u);
  });

  /** Students: resend the LMS set-password email and/or the Teams guest invitation. */
  r.post("/users/:id/invites/resend", async (c) => {
    requirePerm(c.viewer, "people.manage");
    const u = find(c.db.users, c.params.id, "user");
    if (!visibleUser(c.db, c.viewer, u)) throw notFound("user");
    if (!isStudent(u)) throw conflict("NOT_A_STUDENT", "Staff sign in with Microsoft — there are no invitations to resend.");
    const b = await c.json<{ lms?: boolean; teams?: boolean }>();
    const both = !b.lms && !b.teams;
    const sent = sendInvites(c.db, u, c.now, { lms: both || !!b.lms, teams: both || !!b.teams });
    const what = [sent.lms ? "LMS set-password invitation" : "", sent.teams ? "Teams guest invitation" : ""].filter(Boolean).join(" and ");
    if (what) audit(c.db, c.viewer.user, "invite.sent", "user", u.id, `Resent ${what} to ${u.fullName}`);
    return userView(c.db, u);
  });

  /** Admin-issued password reset email for a student. */
  r.post("/users/:id/password-reset", (c) => {
    requirePerm(c.viewer, "people.manage");
    const u = find(c.db.users, c.params.id, "user");
    if (!visibleUser(c.db, c.viewer, u)) throw notFound("user");
    if (!isStudent(u)) throw conflict("NOT_A_STUDENT", "Staff sign in with Microsoft — reset their password in Microsoft Entra ID.");
    if (u.lmsInvite?.status !== "accepted") throw conflict("ACCOUNT_NOT_ACTIVATED", "This student hasn't set a password yet — resend the invitation instead.");
    const t = issueToken(c.db, "reset", u.id, c.now);
    logEmailLink("reset", u, t.token);
    audit(c.db, c.viewer.user, "password.reset_requested", "user", u.id, `Sent a password reset email to ${u.fullName}`);
    return undefined;
  });

  r.post("/users/:id/reactivate", (c) => {
    requirePerm(c.viewer, "people.manage");
    const u = find(c.db.users, c.params.id, "user");
    u.status = "active";
    audit(c.db, c.viewer.user, "user.reactivated", "user", u.id, `Reactivated ${u.fullName}`);
    return userView(c.db, u);
  });

  r.post("/users/:id/roles", async (c) => {
    requirePerm(c.viewer, "roles.manage");
    const u = find(c.db.users, c.params.id, "user");
    const role = validateRole(c.db, c.viewer, await c.json<Partial<RoleAssignment>>());
    if (u.roles.some((x) => x.role === role.role && x.scopeType === role.scopeType && x.scopeId === role.scopeId)) throw conflict("ROLE_EXISTS", "This person already has that role.");
    u.roles.push({ ...role, id: newId("rol") });
    syncCourseStaff(c.db, u.id, role, true);
    audit(c.db, c.viewer.user, "role.assigned", "user", u.id, `Assigned ${ROLE_LABELS[role.role]}${role.scopeId ? ` on ${c.db.courses.find((o) => o.id === role.scopeId)?.code ?? "a course"}` : ""} to ${u.fullName}`);
    return userView(c.db, u);
  });

  r.delete("/users/:id/roles/:roleId", (c) => {
    requirePerm(c.viewer, "roles.manage");
    const u = find(c.db.users, c.params.id, "user");
    const role = u.roles.find((x) => x.id === c.params.roleId);
    if (!role) throw notFound("role");
    if (!c.viewer.isSuperAdmin) throw forbidden("Only a super admin can remove roles.");
    if (role.role === "super_admin" && c.db.users.filter((x) => x.roles.some((y) => y.role === "super_admin")).length === 1) throw conflict("LAST_SUPER_ADMIN", "There must be at least one super admin.");
    u.roles = u.roles.filter((x) => x.id !== role.id);
    syncCourseStaff(c.db, u.id, role, false);
    audit(c.db, c.viewer.user, "role.removed", "user", u.id, `Removed ${ROLE_LABELS[role.role]}${role.scopeId ? ` on ${c.db.courses.find((o) => o.id === role.scopeId)?.code ?? "a course"}` : ""} from ${u.fullName}`);
    return userView(c.db, u);
  });

  /* CSV import */
  r.post("/imports/preview", async (c) => {
    requirePerm(c.viewer, "people.import");
    const fd = await c.form();
    const kind = fd.get("kind") === "staff" ? "staff" : "students";
    const courseId = String(fd.get("courseId") ?? "") || undefined;
    if (courseId) requirePerm(c.viewer, "people.import", find(c.db.courses, courseId, "course").id);
    const file = fd.get("file");
    if (!file || typeof file === "string") throw validation({ file: "Choose a CSV file" });
    const rows = parseCsv(await (file as File).text());
    if (!rows.length) throw invalid("EMPTY_FILE", "The CSV file is empty.");
    const header = rows[0]!.map((h) => h.trim().toLowerCase().replace(/[\s_]/g, ""));
    const hasHeader = header.includes("fullname") || header.includes("email");
    const col = (name: string, fallback: number) => (hasHeader ? header.indexOf(name) : fallback);
    const idx = { fullName: col("fullname", 0), email: col("email", 1), matric: hasHeader ? Math.max(header.indexOf("matricnumber"), header.indexOf("staffid")) : 2, level: col("level", 3), department: col("department", 4) };
    if (idx.fullName < 0 || idx.email < 0) throw invalid("BAD_HEADER", "The CSV must have fullName and email columns.");

    const out: ImportRowData[] = [];
    const seenEmail = new Map<string, number>();
    const seenMatric = new Map<string, number>();
    (hasHeader ? rows.slice(1) : rows).forEach((cells, i) => {
      const row = i + (hasHeader ? 2 : 1);
      const get = (k: number) => (k >= 0 ? (cells[k] ?? "").trim() : "");
      const fullName = get(idx.fullName);
      const email = get(idx.email).toLowerCase();
      const matric = get(idx.matric);
      const levelRaw = get(idx.level);
      const dept = get(idx.department).replace(/\s+/g, " ") || undefined;
      const base: ImportRowData = { row, fullName, email, matricNumber: matric || undefined, action: "create", level: levelRaw ? Number(levelRaw) : undefined, department: dept };
      const err = (message: string) => out.push({ ...base, action: "error", message });
      if (!fullName) return err("Full name is missing");
      if (!EMAIL_RE.test(email)) return err(`"${email || "(blank)"}" is not a valid email address`);
      if (seenEmail.has(email)) return err(`Duplicate email — same as row ${seenEmail.get(email)}`);
      if (kind === "students" && !matric) return err("Matric number is missing");
      if (matric && seenMatric.has(matric)) return err(`Duplicate matric number — same as row ${seenMatric.get(matric)}`);
      if (levelRaw && ![100, 200, 300, 400, 500].includes(Number(levelRaw))) return err(`Level "${levelRaw}" is not valid`);
      seenEmail.set(email, row);
      if (matric) seenMatric.set(matric, row);
      const existing = c.db.users.find((u) => u.email.toLowerCase() === email);
      const byMatric = matric && kind === "students" ? c.db.users.find((u) => u.matricNumber === matric) : undefined;
      if (byMatric && byMatric !== existing) return err(`Matric number already belongs to ${byMatric.fullName}`);
      if (existing) {
        const changes: string[] = [];
        if (existing.fullName !== fullName) changes.push("name");
        if (base.level && existing.level !== base.level) changes.push("level");
        if (dept && existing.department !== dept) changes.push("department");
        const needsEnrol = courseId && !c.db.enrolments.some((e) => e.courseId === courseId && e.userId === existing.id && e.status === "active");
        if (!changes.length && !needsEnrol) return out.push({ ...base, action: "skip", message: "Already up to date", existingUserId: existing.id });
        return out.push({ ...base, action: "update", message: [changes.length ? `Update ${changes.join(", ")}` : "", needsEnrol ? "enrol in course" : ""].filter(Boolean).join("; "), existingUserId: existing.id });
      }
      out.push({ ...base, message: kind === "students" ? "New LMS account — set-password and Teams guest invitations will be emailed" : "New staff account — signs in with Microsoft" });
    });

    const job = { id: newId("imp"), kind, courseId, rows: out, committed: false, createdAt: iso(c.now) } as const;
    c.db.imports.push({ ...job, rows: out });
    const count = (a: ImportRowData["action"]) => out.filter((x) => x.action === a).length;
    const preview: ImportPreview = {
      importId: job.id,
      kind,
      rows: out.map(({ level: _l, department: _d, existingUserId: _e, ...x }) => x),
      summary: { create: count("create"), update: count("update"), skip: count("skip"), error: count("error") },
    };
    return preview;
  });

  r.post("/imports/:id/commit", (c) => commitImport(c));
}

function commitImport(c: Ctx): ImportResult {
  requirePerm(c.viewer, "people.import");
  const job = find(c.db.imports, c.params.id, "import");
  if (job.committed) throw conflict("ALREADY_COMMITTED", "This import has already been committed.");
  let created = 0;
  let updated = 0;
  let lmsInvitesSent = 0;
  let teamsGuestInvitesSent = 0;
  const enrol = (userId: string) => {
    if (!job.courseId) return;
    const e = c.db.enrolments.find((x) => x.courseId === job.courseId && x.userId === userId);
    if (e) e.status = "active";
    else c.db.enrolments.push({ id: newId("enr"), courseId: job.courseId, userId, enrolledAt: iso(c.now), status: "active" });
  };
  for (const row of job.rows) {
    if (row.action === "create") {
      const staffRoles: UserRow["roles"] = job.courseId ? [{ id: newId("rol"), role: "lecturer", scopeType: "course", scopeId: job.courseId }] : [];
      const u: UserRow = {
        id: newId("usr"),
        fullName: row.fullName,
        email: row.email,
        matricNumber: job.kind === "students" ? row.matricNumber : undefined,
        staffId: job.kind === "staff" ? row.matricNumber : undefined,
        department: row.department,
        level: job.kind === "students" ? row.level ?? 100 : undefined,
        status: job.kind === "students" ? "invited" : "active",
        authMethod: job.kind === "students" ? "password" : "microsoft",
        // students: global student role. Staff: lecturer on the import's course, or unassigned until a super admin adds them to a course.
        roles: job.kind === "students" ? [{ id: newId("rol"), role: "student", scopeType: "global", scopeId: null }] : staffRoles,
        createdAt: iso(c.now),
      };
      c.db.users.push(u);
      c.db.preferences[u.id] = { ...DEFAULT_PREFERENCES };
      staffRoles.forEach((x) => syncCourseStaff(c.db, u.id, x, true));
      if (job.kind === "students") {
        enrol(u.id);
        const sent = sendInvites(c.db, u, c.now, { lms: true, teams: true });
        lmsInvitesSent += sent.lms;
        teamsGuestInvitesSent += sent.teams;
      }
      created++;
    } else if (row.action === "update" && row.existingUserId) {
      const u = c.db.users.find((x) => x.id === row.existingUserId);
      if (!u) continue;
      u.fullName = row.fullName;
      if (row.level) u.level = row.level;
      if (row.department) u.department = row.department;
      if (job.kind === "students") enrol(u.id);
      updated++;
    }
  }
  job.committed = true;
  const result: ImportResult = {
    importId: job.id,
    created,
    updated,
    skipped: job.rows.filter((x) => x.action === "skip").length,
    errors: job.rows.filter((x) => x.action === "error").length,
    lmsInvitesSent,
    teamsGuestInvitesSent,
  };
  audit(
    c.db, c.viewer.user, "people.imported", "import", job.id,
    `Imported ${job.kind}: ${created} created, ${updated} updated` + (job.kind === "students" ? ` (${lmsInvitesSent} LMS invitations and ${teamsGuestInvitesSent} Teams guest invitations sent)` : ""),
  );
  return result;
}
