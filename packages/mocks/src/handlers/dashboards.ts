import type { AdminDashboard, StudentDashboard } from "@tasued/api-client";
import { classStatus } from "../db/ops/classes";
import { courseOf } from "../db/ops/common";
import { classView, recordingView, recordingVisibleToStudents } from "../db/views/core";
import { announcementView } from "../db/views/social";
import { defaultCourseScope } from "../lib/access";
import { requireStaff } from "../lib/auth";
import { DAY, ms, startOfLagosDay, startOfLagosWeek } from "../lib/dates";
import type { Router } from "../lib/route";
import { orderedUnits } from "../db/seed/content";
import { attendanceSummary } from "./attendance";
import { matchesInviteFilter } from "./people";
import { isStudent } from "../db/ops/accounts";

export function registerDashboards(r: Router) {
  r.get("/me/dashboard", (c): StudentDashboard => {
    const { db, viewer: v, now } = c;
    const courseIds = defaultCourseScope(db, v);
    const upcomingClasses = db.classes
      .filter((x) => courseIds.has(x.courseId) && ["scheduled", "live"].includes(classStatus(x, now)) && ms(x.startsAt) < now + 7 * DAY)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
      .slice(0, 6)
      .map((x) => classView(db, x, now));

    const latestRecordings = db.recordings
      .filter((x) => courseIds.has(x.courseId) && recordingVisibleToStudents(x))
      .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))
      .slice(0, 6)
      .map((x) => {
        const unit = db.units.find((u) => u.id === x.unitIds[0]);
        return { ...recordingView(x), courseCode: courseOf(db, x.courseId).code, unitTitle: unit?.title, unitId: unit?.id };
      });

    const dueSoon = db.assignments
      .filter((a) => courseIds.has(a.courseId) && a.state === "published" && ms(a.opensAt) <= now)
      .map((a) => {
        const sub = db.submissions.find((s) => s.assignmentId === a.id && s.userId === v.user.id);
        const ext = db.extensions.find((e) => e.assignmentId === a.id && e.userId === v.user.id);
        const due = ext?.newDueAt ?? a.dueAt;
        const lateOpen = a.latePolicy !== "not_accepted" && (!a.closesAt || ms(a.closesAt) > now);
        return { a, sub, due, show: (ms(due) > now || lateOpen) && ms(due) < now + 14 * DAY && sub?.state !== "submitted" };
      })
      .filter((x) => x.show)
      .sort((x, y) => x.due.localeCompare(y.due))
      .slice(0, 6)
      .map(({ a, sub, due }) => ({ id: a.id, title: a.title, dueAt: due, courseCode: courseOf(db, a.courseId).code, courseId: a.courseId, submissionState: sub?.state ?? "not_started" }));

    const openQuizzes = db.quizzes
      .filter((q) => courseIds.has(q.courseId) && q.state === "published" && ms(q.opensAt) <= now && ms(q.closesAt) > now)
      .sort((a, b) => a.closesAt.localeCompare(b.closesAt))
      .map((q) => ({ id: q.id, title: q.title, closesAt: q.closesAt, courseCode: courseOf(db, q.courseId).code, courseId: q.courseId }));

    const announcements = db.announcements
      .filter((a) => a.courseId === null || courseIds.has(a.courseId))
      .sort((a, b) => Number(b.isPinned) - Number(a.isPinned) || b.publishedAt.localeCompare(a.publishedAt))
      .slice(0, 5)
      .map((a) => announcementView(db, a, v));

    const continueRows: { item: StudentDashboard["continueLearning"][number]; at: string }[] = [];
    for (const cid of courseIds) {
      const units = orderedUnits(db, cid);
      if (!units.length) continue;
      const mine = db.progress.filter((p) => p.userId === v.user.id && units.some((u) => u.id === p.unitId));
      const last = mine.sort((a, b) => (b.lastVisitedAt ?? "").localeCompare(a.lastVisitedAt ?? ""))[0];
      let unit = units[0]!;
      let readPercent = 0;
      if (last) {
        const lastUnit = units.find((u) => u.id === last.unitId)!;
        if (last.completed || last.readPercent >= 100) {
          const next = units[units.indexOf(lastUnit) + 1];
          if (!next) continue;
          unit = next;
          readPercent = mine.find((p) => p.unitId === next.id)?.readPercent ?? 0;
        } else {
          unit = lastUnit;
          readPercent = last.readPercent;
        }
      }
      continueRows.push({ item: { courseId: cid, courseCode: courseOf(db, cid).code, unitId: unit.id, unitTitle: unit.title, readPercent }, at: last?.lastVisitedAt ?? "" });
    }
    const continueLearning = continueRows.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 4).map((x) => x.item);

    const summaries = attendanceSummary(db, v.user.id, courseIds, now);
    const tot = summaries.reduce((acc, s) => ({ attended: acc.attended + s.present + s.late, counted: acc.counted + s.totalClasses - s.excused }), { attended: 0, counted: 0 });

    return {
      upcomingClasses,
      latestRecordings,
      dueSoon,
      openQuizzes,
      announcements,
      continueLearning,
      attendancePercent: tot.counted ? Math.round((tot.attended / tot.counted) * 100) : null,
    };
  });

  r.get("/admin/dashboard", (c): AdminDashboard => {
    const { db, viewer: v, now } = c;
    requireStaff(v);
    const scope = v.staffCourseIds;
    // Teaching work (classes, recordings, marking) comes only from courses the viewer lectures or assists on.
    const teaching = v.teachingCourseIds;
    const inScope = <T extends { courseId: string | null }>(x: T) => !!x.courseId && scope.has(x.courseId);
    const inTeaching = <T extends { courseId: string | null }>(x: T) => !!x.courseId && teaching.has(x.courseId);
    const scopedClasses = db.classes.filter(inScope);
    const teachingClasses = db.classes.filter(inTeaching);
    const weekStart = startOfLagosWeek(now);
    const dayStart = startOfLagosDay(now);
    const studentIds = v.isSuperAdmin
      ? new Set(db.users.filter((u) => u.roles.some((r) => r.role === "student") && u.status !== "deactivated").map((u) => u.id))
      : new Set(db.enrolments.filter((e) => scope.has(e.courseId) && e.status === "active").map((e) => e.userId));
    const recs = db.recordings.filter(inTeaching);
    const attendanceToReview = teachingClasses
      .filter((x) => classStatus(x, now) === "ended")
      .filter((x) => {
        const s = db.sheets.find((sh) => sh.classSessionId === x.id);
        return !s || s.status !== "finalised";
      })
      .sort((a, b) => b.startsAt.localeCompare(a.startsAt))
      .slice(0, 8)
      .map((x) => classView(db, x, now));
    const submissionsToGrade = db.assignments
      .filter((a) => teaching.has(a.courseId))
      .map((a) => ({
        assignmentId: a.id,
        title: a.title,
        courseCode: courseOf(db, a.courseId).code,
        ungraded: db.submissions.filter((s) => s.assignmentId === a.id && s.state === "submitted" && !s.grade).length,
      }))
      .filter((x) => x.ungraded > 0)
      .sort((a, b) => b.ungraded - a.ungraded);
    return {
      counts: {
        students: studentIds.size,
        staff: db.users.filter((u) => u.authMethod === "microsoft" && u.status !== "deactivated").length,
        courses: db.courses.filter((o) => scope.has(o.id) && o.status !== "archived").length,
        classesThisWeek: scopedClasses.filter((x) => !x.cancelled && ms(x.startsAt) >= weekStart && ms(x.startsAt) < weekStart + 7 * DAY).length,
      },
      todayClasses: teachingClasses
        .filter((x) => ms(x.startsAt) >= dayStart && ms(x.startsAt) < dayStart + DAY)
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
        .map((x) => classView(db, x, now)),
      recordingQueue: {
        pending: recs.filter((x) => x.status === "pending").length,
        failed: recs.filter((x) => x.status === "failed").length,
        readyThisWeek: recs.filter((x) => x.status === "ready" && ms(x.recordedAt) >= weekStart).length,
      },
      invitations: (() => {
        const students = db.users.filter((u) => isStudent(u) && u.status !== "deactivated");
        return {
          lmsPending: students.filter((u) => matchesInviteFilter(u, "invited")).length,
          teamsPending: students.filter((u) => matchesInviteFilter(u, undefined, "invited")).length,
          expired: students.filter((u) => matchesInviteFilter(u, "expired") || matchesInviteFilter(u, undefined, "expired")).length,
        };
      })(),
      attendanceToReview,
      submissionsToGrade,
      openReports: db.reports.filter((x) => x.status === "open" && (teaching.has(db.threads.find((t) => t.id === x.threadId)?.courseId ?? ""))).length,
      integrationOk: db.health.overall === "ok",
    };
  });
}
