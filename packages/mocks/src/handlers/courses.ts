import type { CourseInput, CourseStatus, Enrolment } from "@tasued/api-client";
import { audit, find } from "../db/ops/common";
import type { CourseRow, DB } from "../db/schema";
import { courseView } from "../db/views/core";
import { asNumber, asString, readableCourse } from "../lib/access";
import { can, isStaffFor, requirePerm } from "../lib/auth";
import { iso } from "../lib/dates";
import { conflict, forbidden, validation } from "../lib/http";
import { matches, paginate } from "../lib/pagination";
import { newId } from "../lib/random";
import type { Ctx, Router } from "../lib/route";

const STATUSES: CourseStatus[] = ["draft", "published", "archived"];
const PREFIX_RE = /^[A-Z0-9]{2,12}$/;
const normCode = (s: string) => s.replace(/\s+/g, " ").trim().toUpperCase();
const codeKey = (s: string) => s.replace(/\s+/g, "").toUpperCase();

function listFilter(c: Ctx, rows: CourseRow[]) {
  const status = c.q("status") as CourseStatus | undefined;
  const term = c.q("search");
  return rows
    .filter((o) => (!status || o.status === status) && matches(term, o.code, o.title, o.classCodePrefix))
    .sort((a, b) => a.code.localeCompare(b.code) || b.createdAt.localeCompare(a.createdAt));
}

/** Keep course-scoped lecturer/TA role assignments in sync with the course's staff lists. */
export function syncStaffRoles(db: DB, o: CourseRow) {
  for (const u of db.users) {
    const want: ("lecturer" | "teaching_assistant")[] = [];
    if (o.lecturerIds.includes(u.id)) want.push("lecturer");
    if (o.assistantIds.includes(u.id)) want.push("teaching_assistant");
    u.roles = u.roles.filter((r) => !(r.scopeType === "course" && r.scopeId === o.id && (r.role === "lecturer" || r.role === "teaching_assistant") && !want.includes(r.role)));
    for (const role of want) {
      if (!u.roles.some((r) => r.role === role && r.scopeType === "course" && r.scopeId === o.id)) {
        u.roles.push({ id: newId("rol"), role, scopeType: "course", scopeId: o.id });
      }
    }
  }
}

function validateStaffIds(db: DB, ids: unknown, field: string): string[] {
  if (ids === undefined || ids === null) return [];
  if (!Array.isArray(ids)) throw validation({ [field]: "Expected a list of staff ids" });
  const out = ids.filter((x): x is string => typeof x === "string");
  const bad = out.find((id) => !db.users.some((u) => u.id === id && u.authMethod === "microsoft" && !u.roles.some((r) => r.role === "student")));
  if (bad) throw validation({ [field]: "Choose existing staff members only" });
  return [...new Set(out)];
}

/** Validates the editable fields present in `b` and applies them to `o`. */
function applyInput(db: DB, o: CourseRow, b: Partial<CourseInput>, creating: boolean) {
  const errs: Record<string, string> = {};
  if (creating || b.code !== undefined) {
    const code = normCode(asString(b.code));
    if (!code) errs.code = "Enter a course code, e.g. AIIE 111";
    else if (!/^[A-Z]{2,6} ?\d{3}[A-Z]?$/.test(code)) errs.code = "Use a code like AIIE 111";
    else if (db.courses.some((x) => x.id !== o.id && codeKey(x.code) === codeKey(code))) {
      throw conflict("COURSE_CODE_TAKEN", `There is already a course with code ${code}.`);
    } else o.code = code;
  }
  if (creating || b.title !== undefined) {
    const t = asString(b.title);
    if (!t) errs.title = "Enter a course title";
    else o.title = t;
  }
  if (creating || b.description !== undefined) o.description = asString(b.description);
  if (b.creditUnits !== undefined) {
    const n = b.creditUnits === null ? undefined : asNumber(b.creditUnits);
    if (b.creditUnits !== null && (n === undefined || n < 0 || n > 12 || !Number.isInteger(n))) errs.creditUnits = "Enter a whole number of credit units";
    else o.creditUnits = n;
  }
  if (b.level !== undefined) {
    const n = b.level === null ? undefined : asNumber(b.level);
    if (b.level !== null && (n === undefined || n < 100 || n > 900 || n % 100 !== 0)) errs.level = "Level must be 100, 200, … 900";
    else o.level = n;
  }
  if (creating || b.classCodePrefix !== undefined) {
    const p = asString(b.classCodePrefix).toUpperCase().replace(/\s+/g, "");
    if (!p) errs.classCodePrefix = "Enter the Teams class code prefix, e.g. AIIE111";
    else if (!PREFIX_RE.test(p)) errs.classCodePrefix = "Use letters and digits only, e.g. AIIE111";
    else o.classCodePrefix = p;
  }
  if (b.status !== undefined) {
    if (!STATUSES.includes(b.status)) errs.status = "Invalid status";
    else o.status = b.status;
  }
  if (Object.keys(errs).length) throw validation(errs);
  if (creating || b.lecturerIds !== undefined) o.lecturerIds = validateStaffIds(db, b.lecturerIds, "lecturerIds");
  if (creating || b.assistantIds !== undefined) o.assistantIds = validateStaffIds(db, b.assistantIds, "assistantIds");
}

export function registerCourses(r: Router) {
  r.get("/courses", (c) => {
    const v = c.viewer;
    const rows = v.isStaff
      ? c.db.courses.filter((o) => v.staffCourseIds.has(o.id))
      : c.db.courses.filter((o) => v.enrolledCourseIds.has(o.id) && o.status !== "draft");
    return paginate(listFilter(c, rows).map((o) => courseView(c.db, o, isStaffFor(v, o.id))), c.url);
  });

  /** Students may open any published course, any time. */
  r.get("/courses/catalogue", (c) => {
    const rows = c.db.courses.filter((o) => o.status === "published");
    return paginate(listFilter(c, rows).map((o) => courseView(c.db, o, isStaffFor(c.viewer, o.id))), c.url);
  });

  r.get("/courses/:id", (c) => {
    const o = readableCourse(c, c.params.id);
    return courseView(c.db, o, isStaffFor(c.viewer, o.id));
  });

  r.post("/courses", async (c) => {
    requirePerm(c.viewer, "courses.manage");
    const b = await c.json<Partial<CourseInput>>();
    const o: CourseRow = {
      id: newId("crs"),
      code: "",
      title: "",
      description: "",
      status: "draft",
      lecturerIds: [],
      assistantIds: [],
      classCodePrefix: "",
      createdAt: iso(c.now),
    };
    applyInput(c.db, o, { ...b, status: undefined }, true);
    o.status = "draft"; // new courses always start as drafts with no modules
    c.db.courses.push(o);
    syncStaffRoles(c.db, o);
    c.db.categories.push({ id: newId("cat"), courseId: o.id, name: `${o.code} discussion`, description: `Questions and discussion for ${o.code}.` });
    audit(c.db, c.viewer.user, "course.created", "course", o.id, `Created course ${o.code} — ${o.title}`);
    return courseView(c.db, o, true);
  });

  r.patch("/courses/:id", async (c) => {
    const o = find(c.db.courses, c.params.id, "course");
    const b = await c.json<Partial<CourseInput>>();
    const onlyStatus = Object.keys(b).every((k) => k === "status");
    if (onlyStatus && can(c.viewer, "content.publish") && c.viewer.staffCourseIds.has(o.id)) {
      /* lecturers may publish/unpublish/archive their own course */
    } else requirePerm(c.viewer, "courses.manage");
    const before = { lecturers: o.lecturerIds.join(), assistants: o.assistantIds.join() };
    applyInput(c.db, o, b, false);
    syncStaffRoles(c.db, o);
    const what = Object.keys(b).join(", ");
    audit(c.db, c.viewer.user, b.status && onlyStatus ? `course.${b.status}` : "course.updated", "course", o.id, `Updated ${o.code} (${what})`);
    if (before.lecturers !== o.lecturerIds.join() || before.assistants !== o.assistantIds.join()) {
      audit(c.db, c.viewer.user, "course.staff_changed", "course", o.id, `Changed teaching staff on ${o.code}: ${o.lecturerIds.length} lecturer(s), ${o.assistantIds.length} TA(s)`);
    }
    return courseView(c.db, o, true);
  });

  r.delete("/courses/:id", (c) => {
    requirePerm(c.viewer, "courses.manage");
    const o = find(c.db.courses, c.params.id, "course");
    const hasEnrolments = c.db.enrolments.some((e) => e.courseId === o.id);
    const hasClasses = c.db.classes.some((x) => x.courseId === o.id);
    if (hasEnrolments || hasClasses) {
      throw conflict("COURSE_IN_USE", `${o.code} has ${hasEnrolments ? "enrolled students" : "scheduled classes"}, so it can't be deleted. Archive it instead.`);
    }
    // remove the (empty) course and everything hanging off it
    const moduleIds = new Set(c.db.modules.filter((m) => m.courseId === o.id).map((m) => m.id));
    c.db.units = c.db.units.filter((u) => !moduleIds.has(u.moduleId) && u.courseId !== o.id);
    c.db.modules = c.db.modules.filter((m) => m.courseId !== o.id);
    const bankIds = new Set(c.db.banks.filter((b) => b.courseId === o.id).map((b) => b.id));
    c.db.questions = c.db.questions.filter((q) => !bankIds.has(q.bankId));
    c.db.banks = c.db.banks.filter((b) => b.courseId !== o.id);
    c.db.assignments = c.db.assignments.filter((a) => a.courseId !== o.id);
    c.db.quizzes = c.db.quizzes.filter((q) => q.courseId !== o.id);
    c.db.recordings = c.db.recordings.filter((x) => x.courseId !== o.id);
    c.db.gradeItems = c.db.gradeItems.filter((g) => g.courseId !== o.id);
    c.db.announcements = c.db.announcements.filter((a) => a.courseId !== o.id);
    const catIds = new Set(c.db.categories.filter((x) => x.courseId === o.id).map((x) => x.id));
    const threadIds = new Set(c.db.threads.filter((t) => catIds.has(t.categoryId)).map((t) => t.id));
    c.db.posts = c.db.posts.filter((p) => !threadIds.has(p.threadId));
    c.db.threads = c.db.threads.filter((t) => !threadIds.has(t.id));
    c.db.categories = c.db.categories.filter((x) => !catIds.has(x.id));
    o.lecturerIds = [];
    o.assistantIds = [];
    syncStaffRoles(c.db, o);
    c.db.courses = c.db.courses.filter((x) => x.id !== o.id);
    audit(c.db, c.viewer.user, "course.deleted", "course", o.id, `Deleted course ${o.code} — ${o.title}`);
  });

  r.get("/courses/:id/enrolments", (c) => {
    const o = find(c.db.courses, c.params.id, "course");
    if (!isStaffFor(c.viewer, o.id)) throw forbidden();
    const term = c.q("search");
    const items: Enrolment[] = c.db.enrolments
      .filter((e) => e.courseId === o.id && e.status === "active")
      .map((e) => {
        const u = c.db.users.find((x) => x.id === e.userId)!;
        return { ...e, user: { id: u.id, fullName: u.fullName, email: u.email, matricNumber: u.matricNumber, avatarUrl: u.avatarUrl } };
      })
      .filter((e) => matches(term, e.user?.fullName, e.user?.email, e.user?.matricNumber))
      .sort((a, b) => (a.user?.fullName ?? "").localeCompare(b.user?.fullName ?? ""));
    return paginate(items, c.url);
  });

  r.post("/courses/:id/enrolments", async (c) => {
    const o = find(c.db.courses, c.params.id, "course");
    requirePerm(c.viewer, "people.manage", o.id);
    const b = await c.json<{ userIds?: string[] }>();
    if (!Array.isArray(b.userIds) || !b.userIds.length) throw validation({ userIds: "Choose at least one student" });
    let added = 0;
    for (const uid of new Set(b.userIds)) {
      const u = c.db.users.find((x) => x.id === uid);
      if (!u || !u.roles.some((r) => r.role === "student")) continue;
      const e = c.db.enrolments.find((x) => x.courseId === o.id && x.userId === uid);
      if (e?.status === "active") continue;
      if (e) {
        e.status = "active";
        e.enrolledAt = iso(c.now);
      } else c.db.enrolments.push({ id: newId("enr"), courseId: o.id, userId: uid, enrolledAt: iso(c.now), status: "active" });
      added++;
    }
    audit(c.db, c.viewer.user, "enrolment.added", "course", o.id, `Enrolled ${added} student(s) in ${o.code}`);
    return { added };
  });

  r.delete("/courses/:id/enrolments/:userId", (c) => {
    const o = find(c.db.courses, c.params.id, "course");
    requirePerm(c.viewer, "people.manage", o.id);
    const e = c.db.enrolments.find((x) => x.courseId === o.id && x.userId === c.params.userId && x.status === "active");
    if (!e) throw validation({ userId: "That student isn't enrolled in this course" });
    e.status = "dropped";
    audit(c.db, c.viewer.user, "enrolment.removed", "course", o.id, `Removed ${c.db.users.find((u) => u.id === e.userId)?.fullName} from ${o.code}`);
  });

  r.get("/courses/:id/progress", (c) => {
    const o = readableCourse(c, c.params.id);
    const unitIds = new Set(c.db.units.filter((u) => u.courseId === o.id).map((u) => u.id));
    return c.db.progress
      .filter((p) => p.userId === c.viewer.user.id && unitIds.has(p.unitId))
      .map(({ userId: _u, ...p }) => p);
  });
}
