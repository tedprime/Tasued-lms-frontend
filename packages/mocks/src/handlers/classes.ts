import type { ClassSeriesInput, ClassSessionInput, ClassSessionStatus } from "@tasued/api-client";
import { classCode, classStatus, nextSeq, teamsMeeting } from "../db/ops/classes";
import { activeStudentIds, audit, courseOf, find, notify } from "../db/ops/common";
import type { ClassRow, DB } from "../db/schema";
import { classView } from "../db/views/core";
import { asNumber, asString, isIsoDate, courseFilter, readableCourse } from "../lib/access";
import { requirePerm } from "../lib/auth";
import { DAY, fmtShort, iso, lagosParts, MIN, ms } from "../lib/dates";
import { conflict, invalid, validation } from "../lib/http";
import { newId, rand } from "../lib/random";
import type { Ctx, Router } from "../lib/route";

function validateUnitsAndLecturer(db: DB, courseId: string, unitIds: unknown, lecturerId: unknown) {
  const errs: Record<string, string> = {};
  const units = Array.isArray(unitIds) ? unitIds.filter((x): x is string => typeof x === "string") : [];
  if (units.some((id) => !db.units.some((u) => u.id === id && u.courseId === courseId))) errs.unitIds = "Choose units from this course";
  const o = db.courses.find((x) => x.id === courseId)!;
  if (typeof lecturerId !== "string" || !(o.lecturerIds.includes(lecturerId) || o.assistantIds.includes(lecturerId))) errs.lecturerId = "Choose a lecturer on this course";
  return { errs, units };
}

function makeClass(c: Ctx, courseId: string, title: string, start: number, end: number, unitIds: string[], lecturerId: string, autoRecord: boolean, seriesId?: string): ClassRow {
  const o = c.db.courses.find((x) => x.id === courseId)!;
  const seq = nextSeq(c.db, courseId);
  const row: ClassRow = {
    id: newId("cls"),
    courseId,
    title,
    classCode: classCode(o.classCodePrefix, seq),
    seq,
    startsAt: iso(start),
    endsAt: iso(end),
    cancelled: false,
    unitIds,
    lecturerId,
    ...teamsMeeting(rand),
    autoRecord,
    seriesId,
    recordingTriggered: false,
  };
  c.db.classes.push(row);
  return row;
}

export function registerClasses(r: Router) {
  r.get("/classes", (c) => {
    const courseIds = courseFilter(c);
    const from = c.q("from");
    const to = c.q("to");
    const status = c.q("status") as ClassSessionStatus | undefined;
    return c.db.classes
      .filter((x) => courseIds.has(x.courseId))
      .filter((x) => (!from || x.endsAt >= iso(ms(from))) && (!to || x.startsAt <= iso(ms(to))))
      .filter((x) => !status || classStatus(x, c.now) === status)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
      .map((x) => classView(c.db, x, c.now));
  });

  r.get("/classes/:id", (c) => {
    const cls = find(c.db.classes, c.params.id, "class");
    readableCourse(c, cls.courseId);
    return classView(c.db, cls, c.now);
  });

  r.post("/classes", async (c) => {
    const b = await c.json<Partial<ClassSessionInput>>();
    const o = find(c.db.courses, b.courseId, "course");
    requirePerm(c.viewer, "classes.schedule", o.id);
    const title = asString(b.title);
    const { errs, units } = validateUnitsAndLecturer(c.db, o.id, b.unitIds, b.lecturerId);
    if (!title) errs.title = "Title is required";
    if (!isIsoDate(b.startsAt)) errs.startsAt = "Start time is required";
    if (!isIsoDate(b.endsAt)) errs.endsAt = "End time is required";
    if (Object.keys(errs).length) throw validation(errs);
    const start = ms(b.startsAt!);
    const end = ms(b.endsAt!);
    if (start < c.now) throw invalid("START_IN_PAST", "A class can't start in the past.", { startsAt: "Choose a future time" });
    if (end <= start) throw validation({ endsAt: "End time must be after the start time" });
    if (end - start > 6 * 60 * MIN) throw validation({ endsAt: "Classes can be at most 6 hours long" });
    const row = makeClass(c, o.id, title, start, end, units, b.lecturerId!, b.autoRecord !== false);
    audit(c.db, c.viewer.user, "class.scheduled", "class", row.id, `Scheduled ${row.classCode} "${title}" — Teams meeting created`);
    notify(c.db, activeStudentIds(c.db, o.id), { kind: "class_reminder", title: `${courseOf(c.db, o.id).code}: new class scheduled`, body: `"${title}" on ${fmtShort(start)}.`, link: `/classes/${row.id}` }, c.now);
    return classView(c.db, row, c.now);
  });

  r.post("/classes/series", async (c) => {
    const b = await c.json<Partial<ClassSeriesInput>>();
    const o = find(c.db.courses, b.courseId, "course");
    requirePerm(c.viewer, "classes.schedule", o.id);
    const title = asString(b.title);
    const { errs, units } = validateUnitsAndLecturer(c.db, o.id, b.unitIds, b.lecturerId);
    const duration = asNumber(b.durationMinutes);
    const occurrences = asNumber(b.occurrences);
    const weekdays = Array.isArray(b.weekdays) ? [...new Set(b.weekdays.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))] : [];
    if (!title) errs.title = "Title is required";
    if (!isIsoDate(b.firstStartsAt)) errs.firstStartsAt = "First class date and time is required";
    if (!duration || duration < 15 || duration > 360) errs.durationMinutes = "Duration must be 15–360 minutes";
    if (!occurrences || occurrences < 1 || occurrences > 52) errs.occurrences = "Occurrences must be 1–52";
    if (!weekdays.length) errs.weekdays = "Choose at least one weekday";
    if (Object.keys(errs).length) throw validation(errs);
    const first = ms(b.firstStartsAt!);
    if (first < c.now) throw invalid("START_IN_PAST", "The first class can't start in the past.", { firstStartsAt: "Choose a future time" });

    const { hour, minute } = lagosParts(first);
    const seriesId = newId("ser");
    const rows: ClassRow[] = [];
    for (let day = 0; rows.length < occurrences! && day < 7 * 60; day++) {
      const p = lagosParts(first + day * DAY);
      if (!weekdays.includes(p.weekday)) continue;
      const start = Date.UTC(p.y, p.m, p.d, hour, minute) - 3_600_000;
      if (start < first) continue;
      const n = rows.length + 1;
      rows.push(makeClass(c, o.id, occurrences! > 1 ? `${title} (${n} of ${occurrences})` : title, start, start + duration! * MIN, units, b.lecturerId!, b.autoRecord !== false, seriesId));
    }
    audit(c.db, c.viewer.user, "class.scheduled", "class", seriesId, `Scheduled weekly series of ${rows.length} classes for ${courseOf(c.db, o.id).code}`);
    return rows.map((x) => classView(c.db, x, c.now));
  });

  r.patch("/classes/:id", async (c) => {
    const cls = find(c.db.classes, c.params.id, "class");
    requirePerm(c.viewer, "classes.schedule", cls.courseId);
    const status = classStatus(cls, c.now);
    if (status === "ended" || status === "cancelled") throw conflict("CLASS_LOCKED", `This class has ${status === "ended" ? "already ended" : "been cancelled"} and can't be edited.`);
    const b = await c.json<Partial<ClassSessionInput>>();
    if (b.courseId && b.courseId !== cls.courseId) throw validation({ courseId: "A class can't be moved to another course" });
    const start = b.startsAt !== undefined ? (isIsoDate(b.startsAt) ? ms(b.startsAt) : NaN) : ms(cls.startsAt);
    const end = b.endsAt !== undefined ? (isIsoDate(b.endsAt) ? ms(b.endsAt) : NaN) : ms(cls.endsAt);
    if (Number.isNaN(start) || Number.isNaN(end)) throw validation({ startsAt: "Invalid date" });
    if (b.startsAt !== undefined && start < c.now && status !== "live") throw invalid("START_IN_PAST", "A class can't start in the past.", { startsAt: "Choose a future time" });
    if (end <= start) throw validation({ endsAt: "End time must be after the start time" });
    if (b.unitIds !== undefined || b.lecturerId !== undefined) {
      const { errs, units } = validateUnitsAndLecturer(c.db, cls.courseId, b.unitIds ?? cls.unitIds, b.lecturerId ?? cls.lecturerId);
      if (Object.keys(errs).length) throw validation(errs);
      cls.unitIds = units;
      cls.lecturerId = b.lecturerId ?? cls.lecturerId;
    }
    const timeChanged = iso(start) !== cls.startsAt || iso(end) !== cls.endsAt;
    if (b.title !== undefined) cls.title = asString(b.title) || cls.title;
    if (typeof b.autoRecord === "boolean") cls.autoRecord = b.autoRecord;
    cls.startsAt = iso(start);
    cls.endsAt = iso(end);
    if (timeChanged) {
      notify(c.db, activeStudentIds(c.db, cls.courseId), { kind: "class_changed", title: `${courseOf(c.db, cls.courseId).code}: class time changed`, body: `"${cls.title}" now starts ${fmtShort(start)}.`, link: `/classes/${cls.id}` }, c.now);
    }
    audit(c.db, c.viewer.user, "class.updated", "class", cls.id, `Updated ${cls.classCode}`);
    return classView(c.db, cls, c.now);
  });

  r.post("/classes/:id/cancel", async (c) => {
    const cls = find(c.db.classes, c.params.id, "class");
    requirePerm(c.viewer, "classes.schedule", cls.courseId);
    const status = classStatus(cls, c.now);
    if (status === "cancelled") throw conflict("ALREADY_CANCELLED", "This class is already cancelled.");
    if (status === "ended") throw conflict("CLASS_LOCKED", "This class has already ended.");
    const b = await c.json<{ reason?: string }>();
    cls.cancelled = true;
    cls.cancelReason = asString(b.reason) || undefined;
    notify(c.db, activeStudentIds(c.db, cls.courseId), { kind: "class_changed", title: `${courseOf(c.db, cls.courseId).code}: class cancelled`, body: `"${cls.title}" has been cancelled.${cls.cancelReason ? ` ${cls.cancelReason}` : ""}`, link: `/classes/${cls.id}` }, c.now);
    audit(c.db, c.viewer.user, "class.cancelled", "class", cls.id, `Cancelled ${cls.classCode}${cls.cancelReason ? ` — ${cls.cancelReason}` : ""}`);
    return classView(c.db, cls, c.now);
  });
}
