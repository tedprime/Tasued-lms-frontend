import type { AttendanceMark, AttendanceRecord, ID, StudentAttendanceSummary } from "@tasued/api-client";
import { applyRule, simulateTeamsImport } from "../db/ops/attendance";
import { classStatus } from "../db/ops/classes";
import { activeStudentIds, audit, courseOf, find } from "../db/ops/common";
import type { ClassRow, DB, SheetRow } from "../db/schema";
import { emptySheet, sheetView } from "../db/views/core";
import { defaultCourseScope } from "../lib/access";
import { requirePerm } from "../lib/auth";
import { fmtShort, iso, MIN, ms } from "../lib/dates";
import { conflict, csvResponse, notFound, validation } from "../lib/http";
import { rand } from "../lib/random";
import type { Ctx, Router } from "../lib/route";

const MARKS: AttendanceMark[] = ["present", "late", "absent", "excused"];

function getClass(c: Ctx, perm: "attendance.manage" | "attendance.finalise" = "attendance.manage") {
  const cls = find(c.db.classes, c.params.id, "class");
  requirePerm(c.viewer, perm, cls.courseId);
  return cls;
}

function ensureSheet(db: DB, cls: ClassRow): SheetRow {
  let s = db.sheets.find((x) => x.classSessionId === cls.id);
  if (!s) {
    s = emptySheet(db, cls.id);
    db.sheets.push(s);
  }
  return s;
}

function assertOpen(s: SheetRow) {
  if (s.status === "finalised") throw conflict("ATTENDANCE_FINALISED", "Attendance for this class has been finalised and can't be changed.");
}

function assertStarted(c: Ctx, cls: ClassRow) {
  const st = classStatus(cls, c.now);
  if (st === "scheduled" || st === "cancelled") throw conflict("CLASS_NOT_ENDED", st === "cancelled" ? "This class was cancelled." : "Attendance is available once the class has started.");
}

export function attendanceSummary(db: DB, userId: ID, courseIds: Iterable<ID>, _now: number): StudentAttendanceSummary[] {
  const out: StudentAttendanceSummary[] = [];
  for (const cid of courseIds) {
    const { code, title } = courseOf(db, cid);
    const classes = db.classes.filter((c) => c.courseId === cid);
    const records: StudentAttendanceSummary["records"] = [];
    for (const cls of classes) {
      const s = db.sheets.find((x) => x.classSessionId === cls.id && x.status === "finalised");
      if (!s) continue;
      const rec = s.records.find((x) => x.userId === userId);
      records.push({ classSessionId: cls.id, title: cls.title, startsAt: cls.startsAt, mark: rec?.mark ?? "absent", minutesAttended: rec?.minutesAttended ?? 0 });
    }
    records.sort((a, b) => b.startsAt.localeCompare(a.startsAt));
    const count = (m: AttendanceMark) => records.filter((x) => x.mark === m).length;
    const present = count("present");
    const late = count("late");
    const excused = count("excused");
    const denom = records.length - excused;
    out.push({ courseId: cid, courseCode: code, courseTitle: title, totalClasses: records.length, present, late, absent: count("absent"), excused, percent: denom > 0 ? Math.round(((present + late) / denom) * 100) : 0, records });
  }
  return out;
}

export function registerAttendance(r: Router) {
  r.get("/classes/:id/attendance.csv", (c) => {
    const cls = getClass(c);
    const s = c.db.sheets.find((x) => x.classSessionId === cls.id);
    const rows = (s?.records ?? []).map((x) => [x.studentName, x.matricNumber, x.mark, x.minutesAttended, x.joinedAt, x.leftAt, x.source, x.note]);
    return csvResponse(`${cls.classCode}-attendance.csv`, [["Student", "Matric number", "Mark", "Minutes attended", "Joined", "Left", "Source", "Note"], ...rows]);
  });

  r.get("/classes/:id/attendance", (c) => {
    const cls = getClass(c);
    return sheetView(c.db, c.db.sheets.find((x) => x.classSessionId === cls.id) ?? emptySheet(c.db, cls.id), cls, c.now);
  });

  r.post("/classes/:id/attendance/import", (c) => {
    const cls = getClass(c);
    assertStarted(c, cls);
    const s = ensureSheet(c.db, cls);
    assertOpen(s);
    const sim = simulateTeamsImport(c.db, cls, s.rule, rand, () => rand.float(0.65, 0.95));
    s.records = sim.records;
    s.unmatched = sim.unmatched;
    s.mode = "teams";
    s.status = sim.unmatched.length ? "in_review" : "imported";
    s.importedAt = iso(c.now);
    audit(c.db, c.viewer.user, "attendance.imported", "class", cls.id, `Imported Teams attendance for ${cls.classCode} (${s.records.length} students, ${s.unmatched.length} unmatched)`);
    return sheetView(c.db, s, cls, c.now);
  });

  r.post("/classes/:id/attendance/manual", (c) => {
    const cls = getClass(c);
    assertStarted(c, cls);
    const s = ensureSheet(c.db, cls);
    assertOpen(s);
    s.mode = "manual";
    s.unmatched = [];
    const existing = new Map(s.records.map((x) => [x.userId, x]));
    s.records = activeStudentIds(c.db, cls.courseId)
      .map((uid): AttendanceRecord => {
        const prev = existing.get(uid);
        const u = c.db.users.find((x) => x.id === uid)!;
        return prev ? { ...prev, source: "manual" } : { id: `att-${cls.id}-${uid}`, classSessionId: cls.id, userId: uid, studentName: u.fullName, matricNumber: u.matricNumber, mark: "absent", minutesAttended: 0, source: "manual" };
      })
      .sort((a, b) => a.studentName.localeCompare(b.studentName));
    s.status = "in_review";
    return sheetView(c.db, s, cls, c.now);
  });

  r.put("/classes/:id/attendance/:userId", async (c) => {
    const cls = getClass(c);
    const s = ensureSheet(c.db, cls);
    assertOpen(s);
    const b = await c.json<{ mark?: AttendanceMark; note?: string }>();
    if (!b.mark || !MARKS.includes(b.mark)) throw validation({ mark: "Choose present, late, absent or excused" });
    const uid = c.params.userId!;
    if (!activeStudentIds(c.db, cls.courseId).includes(uid)) throw notFound("student");
    let rec = s.records.find((x) => x.userId === uid);
    if (!rec) {
      const u = c.db.users.find((x) => x.id === uid)!;
      rec = { id: `att-${cls.id}-${uid}`, classSessionId: cls.id, userId: uid, studentName: u.fullName, matricNumber: u.matricNumber, mark: b.mark, minutesAttended: 0, source: "manual" };
      s.records.push(rec);
      s.records.sort((a, b2) => a.studentName.localeCompare(b2.studentName));
    }
    rec.mark = b.mark;
    if (b.note !== undefined) rec.note = String(b.note).trim() || undefined;
    if (s.status === "pending_import" || s.status === "imported") s.status = "in_review";
    return rec;
  });

  r.post("/classes/:id/attendance/match", async (c) => {
    const cls = getClass(c);
    const s = ensureSheet(c.db, cls);
    assertOpen(s);
    const b = await c.json<{ displayName?: string; userId?: string }>();
    const um = s.unmatched.find((x) => x.displayName === b.displayName);
    if (!um) throw notFound("participant");
    if (!b.userId || !activeStudentIds(c.db, cls.courseId).includes(b.userId)) throw validation({ userId: "Choose a student enrolled in this course" });
    const u = c.db.users.find((x) => x.id === b.userId)!;
    const duration = Math.round((ms(cls.endsAt) - ms(cls.startsAt)) / MIN);
    const joinedAfter = Math.max(0, duration - um.minutesAttended - 5);
    const mark = applyRule(s.rule, um.minutesAttended, duration, joinedAfter);
    const rec: AttendanceRecord = {
      id: `att-${cls.id}-${u.id}`,
      classSessionId: cls.id,
      userId: u.id,
      studentName: u.fullName,
      matricNumber: u.matricNumber,
      mark,
      minutesAttended: um.minutesAttended,
      joinedAt: iso(ms(cls.startsAt) + joinedAfter * MIN),
      leftAt: iso(ms(cls.startsAt) + (joinedAfter + um.minutesAttended) * MIN),
      source: "teams",
      note: `Matched from Teams participant "${um.displayName}"`,
    };
    s.records = s.records.filter((x) => x.userId !== u.id).concat(rec).sort((a, b2) => a.studentName.localeCompare(b2.studentName));
    s.unmatched = s.unmatched.filter((x) => x !== um);
    return sheetView(c.db, s, cls, c.now);
  });

  r.post("/classes/:id/attendance/finalise", (c) => {
    const cls = getClass(c, "attendance.finalise");
    const s = ensureSheet(c.db, cls);
    assertOpen(s);
    if (!s.records.length) throw conflict("NOTHING_TO_FINALISE", "Import attendance from Teams or switch to manual marking first.");
    s.status = "finalised";
    s.finalisedAt = iso(c.now);
    s.finalisedBy = c.viewer.user.fullName;
    s.unmatched = [];
    const n = (m: AttendanceMark) => s.records.filter((x) => x.mark === m).length;
    audit(c.db, c.viewer.user, "attendance.finalised", "class", cls.id, `Finalised attendance for ${cls.classCode} on ${fmtShort(ms(cls.startsAt))} (${n("present")} present, ${n("late")} late, ${n("absent")} absent, ${n("excused")} excused)`);
    return sheetView(c.db, s, cls, c.now);
  });

  r.get("/me/attendance", (c) => attendanceSummary(c.db, c.viewer.user.id, defaultCourseScope(c.db, c.viewer), c.now));
}
