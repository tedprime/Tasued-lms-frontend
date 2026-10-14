import type { CourseReport } from "@tasued/api-client";
import { activeStudentIds, courseOf, find } from "../db/ops/common";
import type { DB } from "../db/schema";
import { requirePerm } from "../lib/auth";
import { DAY, fmtShort, ms, startOfLagosWeek } from "../lib/dates";
import { csvResponse } from "../lib/http";
import type { Router } from "../lib/route";

export function buildReport(db: DB, courseId: string, now: number): CourseReport {
  const { code, title } = courseOf(db, courseId);
  const students = activeStudentIds(db, courseId);
  const classIds = new Set(db.classes.filter((c) => c.courseId === courseId).map((c) => c.id));
  const sheets = db.sheets.filter((s) => classIds.has(s.classSessionId) && s.status === "finalised");
  const pct = (rs: { mark: string }[]) => {
    const counted = rs.filter((r) => r.mark !== "excused");
    return counted.length ? Math.round((counted.filter((r) => r.mark === "present" || r.mark === "late").length / counted.length) * 100) : 0;
  };
  const recs = db.recordings.filter((r) => r.courseId === courseId && r.status === "ready");
  const pastAssignments = db.assignments.filter((a) => a.courseId === courseId && a.state === "published" && ms(a.dueAt) < now);
  const openedAssignments = db.assignments.filter((a) => a.courseId === courseId && a.state === "published" && ms(a.opensAt) < now);
  const submittedFinal = db.submissions.filter((s) => s.state === "submitted" && openedAssignments.some((a) => a.id === s.assignmentId)).length;
  const quizzes = db.quizzes.filter((q) => q.courseId === courseId && q.state === "published" && ms(q.opensAt) < now);
  const quizDone = quizzes.reduce((n, q) => n + new Set(db.attempts.filter((a) => a.quizId === q.id && a.state !== "in_progress").map((a) => a.userId)).size, 0);

  const atRisk = students
    .map((uid) => {
      const u = db.users.find((x) => x.id === uid)!;
      const mine = sheets.map((s) => s.records.find((r) => r.userId === uid) ?? { mark: "absent" });
      const missing = pastAssignments.filter((a) => !db.submissions.some((s) => s.assignmentId === a.id && s.userId === uid && s.state === "submitted")).length;
      return { userId: uid, fullName: u.fullName, matricNumber: u.matricNumber, attendancePercent: pct(mine), missingSubmissions: missing };
    })
    .filter((x) => x.attendancePercent < 65 || x.missingSubmissions > 0)
    .sort((a, b) => a.attendancePercent - b.attendancePercent || b.missingSubmissions - a.missingSubmissions)
    .slice(0, 12);

  const week0 = startOfLagosWeek(now);
  const weekly: CourseReport["weekly"] = [];
  for (let w = 5; w >= 0; w--) {
    const start = week0 - w * 7 * DAY;
    const end = start + 7 * DAY;
    const wk = sheets.filter((s) => {
      const c = db.classes.find((x) => x.id === s.classSessionId)!;
      return ms(c.startsAt) >= start && ms(c.startsAt) < end;
    });
    const views = recs.filter((r) => ms(r.recordedAt) >= start && ms(r.recordedAt) < end).reduce((n, r) => n + r.views, 0);
    weekly.push({ weekLabel: `Wk of ${fmtShort(start)}`, attendancePercent: wk.length ? pct(wk.flatMap((s) => s.records)) : 0, recordingViews: views });
  }

  return {
    courseId,
    courseCode: code,
    courseTitle: title,
    enrolled: students.length,
    averageAttendancePercent: pct(sheets.flatMap((s) => s.records)),
    recordingViews: recs.reduce((n, r) => n + r.views, 0),
    averageWatchPercent: recs.length ? Math.round(recs.reduce((n, r) => n + r.avgWatchPercent, 0) / recs.length) : 0,
    assignmentSubmissionRate: openedAssignments.length && students.length ? Math.round((submittedFinal / (openedAssignments.length * students.length)) * 100) : 0,
    quizCompletionRate: quizzes.length && students.length ? Math.round((quizDone / (quizzes.length * students.length)) * 100) : 0,
    forumThreads: db.threads.filter((t) => t.courseId === courseId).length,
    atRiskStudents: atRisk,
    weekly,
  };
}

export function registerReports(r: Router) {
  r.get("/reports/courses/:id.csv", (c) => {
    const o = find(c.db.courses, c.params.id, "course");
    requirePerm(c.viewer, "reports.view", o.id);
    const rep = buildReport(c.db, o.id, c.now);
    const rows: (string | number | undefined)[][] = [
      ["Course", `${rep.courseCode} ${rep.courseTitle}`],
      ["Enrolled", rep.enrolled],
      ["Average attendance %", rep.averageAttendancePercent],
      ["Recording views", rep.recordingViews],
      ["Average watch %", rep.averageWatchPercent],
      ["Assignment submission rate %", rep.assignmentSubmissionRate],
      ["Quiz completion rate %", rep.quizCompletionRate],
      ["Forum threads", rep.forumThreads],
      [],
      ["Week", "Attendance %", "Recording views"],
      ...rep.weekly.map((w) => [w.weekLabel, w.attendancePercent, w.recordingViews]),
      [],
      ["At-risk student", "Matric number", "Attendance %", "Missing submissions"],
      ...rep.atRiskStudents.map((s) => [s.fullName, s.matricNumber, s.attendancePercent, s.missingSubmissions]),
    ];
    return csvResponse(`${rep.courseCode.replace(/\s/g, "")}-report.csv`, rows);
  });

  r.get("/reports/courses/:id", (c) => {
    const o = find(c.db.courses, c.params.id, "course");
    requirePerm(c.viewer, "reports.view", o.id);
    return buildReport(c.db, o.id, c.now);
  });
}
