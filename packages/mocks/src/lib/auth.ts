import type { ID, Permission, RoleKey } from "@tasued/api-client";
import type { DB, UserRow } from "../db/schema";
import { forbidden } from "./http";
import { storage } from "./storage";

export type App = "student" | "admin";

export const ALL_PERMISSIONS: Permission[] = [
  "courses.manage",
  "people.manage",
  "people.import",
  "roles.manage",
  "content.edit",
  "content.publish",
  "classes.schedule",
  "recordings.manage",
  "attendance.manage",
  "attendance.finalise",
  "assignments.manage",
  "assignments.grade",
  "quizzes.manage",
  "quizzes.grade",
  "grades.release",
  "forum.moderate",
  "announcements.send",
  "reports.view",
  "audit.view",
  "integrations.view",
  "settings.manage",
];

/** Management only: super admins run the platform but don't teach, grade or edit course content. */
export const ROLE_PERMISSIONS: Record<RoleKey, Permission[]> = {
  super_admin: [
    "courses.manage",
    "people.manage",
    "people.import",
    "roles.manage",
    "announcements.send", // platform-wide announcements; course announcements need a teaching role
    "reports.view",
    "audit.view",
    "integrations.view",
    "settings.manage",
  ],
  lecturer: [
    "content.edit",
    "content.publish",
    "classes.schedule",
    "recordings.manage",
    "attendance.manage",
    "attendance.finalise",
    "assignments.manage",
    "assignments.grade",
    "quizzes.manage",
    "quizzes.grade",
    "grades.release",
    "forum.moderate",
    "announcements.send",
    "reports.view",
  ],
  teaching_assistant: ["content.edit", "attendance.manage", "assignments.grade", "quizzes.grade", "forum.moderate"],
  student: [],
};

export interface Viewer {
  user: UserRow;
  permissions: Permission[];
  /** Courses the viewer can see as staff (super admins: all). */
  staffCourseIds: Set<ID>;
  /** Courses the viewer lectures or assists on. */
  teachingCourseIds: Set<ID>;
  enrolledCourseIds: Set<ID>;
  isStaff: boolean;
  isSuperAdmin: boolean;
}

/* ── session storage (one per app) ── */
export const sessionKey = (app: App) => `tasued-mock-session-${app}`;
export const getSessionUserId = (app: App) => storage.get(sessionKey(app));
export const setSessionUserId = (app: App, id: ID) => storage.set(sessionKey(app), id);
export const clearSession = (app: App) => storage.remove(sessionKey(app));

/** Courses a staff user can act on: super admins — every course; lecturers/TAs — the courses they're assigned to. */
export function staffScope(db: DB, user: UserRow): Set<ID> {
  if (user.roles.some((r) => r.role === "super_admin")) return new Set(db.courses.map((o) => o.id));
  return teachingScope(db, user);
}

/** Courses the user lectures or assists on (course-scoped roles or the course's staff lists). */
export function teachingScope(db: DB, user: UserRow): Set<ID> {
  const out = new Set<ID>();
  for (const r of user.roles) {
    if ((r.role === "lecturer" || r.role === "teaching_assistant") && r.scopeType === "course" && r.scopeId) out.add(r.scopeId);
  }
  for (const o of db.courses) {
    if (o.lecturerIds.includes(user.id) || o.assistantIds.includes(user.id)) out.add(o.id);
  }
  return new Set([...out].filter((id) => db.courses.some((o) => o.id === id)));
}

export function permissionsFor(user: UserRow): Permission[] {
  const set = new Set<Permission>();
  for (const r of user.roles) ROLE_PERMISSIONS[r.role].forEach((p) => set.add(p));
  return ALL_PERMISSIONS.filter((p) => set.has(p));
}

export function buildViewer(db: DB, user: UserRow): Viewer {
  const isStaff = user.roles.some((r) => r.role !== "student");
  return {
    user,
    permissions: permissionsFor(user),
    staffCourseIds: isStaff ? staffScope(db, user) : new Set(),
    teachingCourseIds: isStaff ? teachingScope(db, user) : new Set(),
    enrolledCourseIds: new Set(
      db.enrolments.filter((e) => e.userId === user.id && e.status === "active").map((e) => e.courseId),
    ),
    isStaff,
    isSuperAdmin: user.roles.some((r) => r.role === "super_admin"),
  };
}

export const can = (v: Viewer | null | undefined, p: Permission) => !!v?.permissions.includes(p);
export const isStaffFor = (v: Viewer, courseId: ID | null | undefined) => !!courseId && v.staffCourseIds.has(courseId);

/** Permissions that act on a course from the outside (setup, enrolment, reporting) rather than teaching it. */
const OVERSIGHT_PERMISSIONS = new Set<Permission>(["courses.manage", "people.manage", "people.import", "reports.view"]);

/**
 * Throws 403 unless the viewer has (any of) the permission(s) and, when a course is given, that
 * course is in scope: oversight permissions need the course to be visible to them (super admins: all);
 * teaching permissions (and course announcements) need them to lecture or assist on it.
 */
export function requirePerm(v: Viewer, perm: Permission | Permission[], courseId?: ID | null) {
  const perms = Array.isArray(perm) ? perm : [perm];
  const held = perms.filter((p) => v.permissions.includes(p));
  if (!held.length) throw forbidden();
  if (courseId === undefined || courseId === null) return;
  const oversight = held.some((p) => OVERSIGHT_PERMISSIONS.has(p));
  if (oversight ? !v.staffCourseIds.has(courseId) : !v.teachingCourseIds.has(courseId)) {
    throw forbidden(oversight ? "This course is outside your admin scope." : "Only the course's lecturers and teaching assistants can do this.");
  }
}

export function requireStaff(v: Viewer) {
  if (!v.isStaff) throw forbidden();
}
