import type { ID } from "@tasued/api-client";
import { find } from "../db/ops/common";
import type { DB, CourseRow } from "../db/schema";
import { isStaffFor, type Viewer } from "./auth";
import { forbidden, notFound } from "./http";
import type { Ctx } from "./route";

/** Staff in scope and actively enrolled students may read a course; drafts stay staff-only. */
export function readableCourse(c: Ctx, id: ID | undefined): CourseRow {
  const o = find(c.db.courses, id, "course");
  if (isStaffFor(c.viewer, o.id)) return o;
  if (o.status === 'published' && c.viewer.enrolledCourseIds.has(o.id)) return o;
  if (o.status === "archived" && c.viewer.enrolledCourseIds.has(o.id)) return o;
  throw notFound("course");
}

export function requireEnrolled(v: Viewer, courseId: ID) {
  if (!v.enrolledCourseIds.has(courseId)) {
    throw forbidden("You're not registered for this course, so you can't submit work for it.");
  }
}

/** Courses a list endpoint should cover when no courseId filter is given. */
export function defaultCourseScope(db: DB, v: Viewer): Set<ID> {
  if (v.isStaff) return new Set(v.staffCourseIds);
  return new Set([...v.enrolledCourseIds].filter((id) => db.courses.find((o) => o.id === id)?.status !== "draft"));
}

/** Resolve the course filter for list endpoints (validates read access). */
export function courseFilter(c: Ctx): Set<ID> {
  const id = c.q("courseId");
  if (id) return new Set([readableCourse(c, id).id]);
  return defaultCourseScope(c.db, c.viewer);
}

export const asString = (v: unknown) => (typeof v === "string" ? v.trim() : "");
export const asNumber = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : undefined);
export const isIsoDate = (v: unknown): v is string => typeof v === "string" && !Number.isNaN(new Date(v).getTime());
