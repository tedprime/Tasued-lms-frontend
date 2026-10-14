import type * as T from "@tasued/api-client";
import { classStatus } from "../ops/classes";
import type { ClassRow, DB, ModuleRow, CourseRow, RecordingRow, SheetRow, UnitRow, UserRow } from "../schema";

/* ── people ── */
export function scopeName(db: DB, r: Pick<T.RoleAssignment, "scopeType" | "scopeId">): string | undefined {
  switch (r.scopeType) {
    case "global":
      return "All courses";
    case "course": {
      const o = db.courses.find((x) => x.id === r.scopeId);
      return o ? `${o.code} — ${o.title}` : undefined;
    }
  }
}

export function userView(db: DB, u: UserRow): T.User {
  return { ...u, roles: u.roles.map((r) => ({ ...r, scopeName: scopeName(db, r) })) };
}

export const personPick = (u: UserRow): Pick<T.User, "id" | "fullName" | "email" | "avatarUrl"> => ({
  id: u.id,
  fullName: u.fullName,
  email: u.email,
  avatarUrl: u.avatarUrl,
});

/* ── courses ── */
export function courseView(db: DB, o: CourseRow, staff: boolean): T.Course {
  const modules = db.modules.filter((m) => m.courseId === o.id && (staff || m.state === "published"));
  const moduleIds = new Set(modules.map((m) => m.id));
  const units = db.units.filter((u) => moduleIds.has(u.moduleId) && (staff || u.state === "published"));
  const people = (ids: string[]) =>
    ids.map((id) => db.users.find((u) => u.id === id)).filter((u): u is UserRow => !!u).map(personPick);
  return {
    id: o.id,
    code: o.code,
    title: o.title,
    description: o.description,
    creditUnits: o.creditUnits,
    level: o.level,
    coverImageUrl: o.coverImageUrl,
    status: o.status,
    lecturers: people(o.lecturerIds),
    assistants: people(o.assistantIds),
    enrolledCount: db.enrolments.filter((e) => e.courseId === o.id && e.status === "active").length,
    moduleCount: modules.length,
    unitCount: units.length,
    classCodePrefix: o.classCodePrefix,
    createdAt: o.createdAt,
  };
}

/* ── recordings ── */
export function recordingView(r: RecordingRow): T.Recording {
  const { pipelineStartedAt: _p, views: _v, avgWatchPercent: _w, ...rest } = r;
  return rest;
}

export const recordingVisibleToStudents = (r: RecordingRow) => r.status === "ready" && r.published;

export function unitRecordings(db: DB, unitId: string, staff: boolean) {
  return db.recordings
    .filter((r) => r.unitIds.includes(unitId) && (staff || recordingVisibleToStudents(r)))
    .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
}

/* ── content ── */
export function unitSummaryView(db: DB, u: UnitRow, staff: boolean): T.UnitSummary {
  const recs = unitRecordings(db, u.id, false);
  return {
    id: u.id,
    moduleId: u.moduleId,
    title: u.title,
    order: u.order,
    state: u.state,
    hasRecording: recs.length > 0,
    recordingCount: staff ? unitRecordings(db, u.id, true).length : recs.length,
    estimatedReadMinutes: u.estimatedReadMinutes,
  };
}

export function moduleView(db: DB, m: ModuleRow, staff: boolean): T.Module {
  return {
    ...m,
    units: db.units
      .filter((u) => u.moduleId === m.id && (staff || u.state === "published"))
      .sort((a, b) => a.order - b.order)
      .map((u) => unitSummaryView(db, u, staff)),
  };
}

export function unitView(db: DB, u: UnitRow, staff: boolean): T.Unit {
  return {
    ...unitSummaryView(db, u, staff),
    courseId: u.courseId,
    objectives: u.objectives,
    courseTextHtml: u.courseTextHtml,
    courseTextJson: u.courseTextJson,
    attachments: u.attachments,
    recordings: unitRecordings(db, u.id, staff).map(recordingView),
    updatedAt: u.updatedAt,
  };
}

/* ── classes ── */
export function classView(db: DB, c: ClassRow, now: number): T.ClassSession {
  const course = db.courses.find((x) => x.id === c.courseId);
  const units = c.unitIds.map((id) => db.units.find((u) => u.id === id)).filter((u): u is UnitRow => !!u);
  const rec = db.recordings
    .filter((r) => r.classSessionId === c.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const sheet = db.sheets.find((s) => s.classSessionId === c.id);
  return {
    id: c.id,
    courseId: c.courseId,
    courseCode: course?.code ?? "",
    courseTitle: course?.title ?? "",
    title: c.title,
    classCode: c.classCode,
    startsAt: c.startsAt,
    endsAt: c.endsAt,
    status: classStatus(c, now),
    unitIds: [...c.unitIds],
    unitTitles: units.map((u) => u.title),
    moduleIds: [...new Set(units.map((u) => u.moduleId))],
    lecturerId: c.lecturerId,
    lecturerName: db.users.find((u) => u.id === c.lecturerId)?.fullName ?? "",
    teamsJoinUrl: c.teamsJoinUrl,
    teamsMeetingId: c.teamsMeetingId,
    autoRecord: c.autoRecord,
    seriesId: c.seriesId,
    recordingStatus: rec ? rec.status : "none",
    attendanceStatus: sheet ? sheet.status : "not_started",
  };
}

/* ── attendance ── */
export function emptySheet(db: DB, classSessionId: string): SheetRow {
  return {
    classSessionId,
    status: "pending_import",
    mode: "teams",
    rule: { ...db.settings.attendanceRule },
    records: [],
    unmatched: [],
  };
}

export function sheetView(db: DB, s: SheetRow, c: ClassRow, now: number): T.AttendanceSheet {
  return { ...s, classSession: classView(db, c, now) };
}
