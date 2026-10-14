import type { Gradebook, GradeCell, StudentGradeRow } from "@tasued/api-client";
import { activeStudentIds, audit, courseOf, find, notify } from "../db/ops/common";
import { ensureItem, getCellScore, logChange, putCell } from "../db/ops/grades";
import type { DB } from "../db/schema";
import { asNumber, asString, defaultCourseScope } from "../lib/access";
import { requirePerm } from "../lib/auth";
import { iso } from "../lib/dates";
import { csvResponse, invalid, notFound, validation } from "../lib/http";
import type { Ctx, Router } from "../lib/route";

const VIEW_PERMS = ["assignments.grade", "quizzes.grade", "grades.release", "reports.view"] as const;

function itemsFor(db: DB, courseId: string) {
  const order = { assignment: 0, quiz: 1, manual: 2 } as const;
  return db.gradeItems.filter((i) => i.courseId === courseId).sort((a, b) => order[a.kind] - order[b.kind] || a.title.localeCompare(b.title));
}

export function gradebookFor(db: DB, courseId: string): Gradebook {
  const items = itemsFor(db, courseId);
  const students = activeStudentIds(db, courseId)
    .map((id) => db.users.find((u) => u.id === id)!)
    .sort((a, b) => a.fullName.localeCompare(b.fullName))
    .map((u) => ({ id: u.id, fullName: u.fullName, matricNumber: u.matricNumber }));
  const cells: GradeCell[] = [];
  for (const it of items) for (const s of students) cells.push({ itemId: it.id, userId: s.id, score: getCellScore(db, it.id, s.id), released: it.released });
  return { courseId, items, students, cells };
}

function weightedTotal(rows: { score: number | null; maxScore: number; weightPercent: number }[]) {
  const scored = rows.filter((r) => r.score !== null && r.maxScore > 0);
  const w = scored.reduce((s, r) => s + r.weightPercent, 0);
  if (!w) return null;
  return Math.round((scored.reduce((s, r) => s + (r.score! / r.maxScore) * r.weightPercent, 0) / w) * 1000) / 10;
}

export function registerGrades(r: Router) {
  const course = (c: Ctx) => find(c.db.courses, c.params.id, "course");

  r.get("/courses/:id/gradebook.xlsx", (c) => {
    const o = course(c);
    requirePerm(c.viewer, [...VIEW_PERMS], o.id);
    const gb = gradebookFor(c.db, o.id);
    const head = ["Student", "Matric number", ...gb.items.map((i) => `${i.title} (/${i.maxScore}, ${i.weightPercent}%)`), "Weighted total %"];
    const rows = gb.students.map((s) => {
      const scores = gb.items.map((i) => gb.cells.find((x) => x.itemId === i.id && x.userId === s.id)?.score ?? null);
      return [s.fullName, s.matricNumber, ...scores, weightedTotal(gb.items.map((i, k) => ({ score: scores[k] ?? null, maxScore: i.maxScore, weightPercent: i.weightPercent })))];
    });
    return csvResponse(`${courseOf(c.db, o.id).code.replace(/\s/g, "")}-gradebook.csv`, [head, ...rows]);
  });

  r.get("/courses/:id/gradebook", (c) => {
    const o = course(c);
    requirePerm(c.viewer, [...VIEW_PERMS], o.id);
    return gradebookFor(c.db, o.id);
  });

  r.post("/courses/:id/gradebook/items", async (c) => {
    const o = course(c);
    requirePerm(c.viewer, "assignments.manage", o.id);
    const b = await c.json<{ title?: string; maxScore?: number; weightPercent?: number }>();
    const errs: Record<string, string> = {};
    const title = asString(b.title);
    const max = asNumber(b.maxScore);
    const weight = asNumber(b.weightPercent);
    if (!title) errs.title = "Title is required";
    if (!max || max <= 0) errs.maxScore = "Maximum score must be greater than 0";
    if (weight === undefined || weight < 0 || weight > 100) errs.weightPercent = "Weight must be 0–100%";
    if (Object.keys(errs).length) throw validation(errs);
    const item = ensureItem(c.db, { courseId: o.id, kind: "manual", title, maxScore: max!, weightPercent: weight! });
    audit(c.db, c.viewer.user, "gradebook.item_added", "gradebook", item.id, `Added "${title}" to the ${courseOf(c.db, o.id).code} gradebook`);
    return item;
  });

  r.put("/courses/:id/gradebook/cells", async (c) => {
    const o = course(c);
    requirePerm(c.viewer, "assignments.grade", o.id);
    const b = await c.json<{ itemId?: string; userId?: string; score?: number | null; reason?: string }>();
    const reason = asString(b.reason);
    if (!reason) throw invalid("REASON_REQUIRED", "Give a reason for this grade change.", { reason: "Required" });
    const item = c.db.gradeItems.find((i) => i.id === b.itemId && i.courseId === o.id);
    if (!item) throw notFound("gradebook item");
    if (!b.userId || !activeStudentIds(c.db, o.id).includes(b.userId)) throw notFound("student");
    const score = b.score === null || b.score === undefined ? null : asNumber(b.score);
    if (score === undefined || (score !== null && (score < 0 || score > item.maxScore))) throw validation({ score: `Score must be between 0 and ${item.maxScore}` });
    const { from, to } = putCell(c.db, item.id, b.userId, score);
    if (item.kind === "assignment") {
      const sub = c.db.submissions.find((s) => s.assignmentId === item.refId && s.userId === b.userId);
      if (sub?.grade && to !== null) {
        sub.grade.score = to;
        sub.grade.gradedBy = c.viewer.user.fullName;
        sub.grade.gradedAt = iso(c.now);
      }
    }
    logChange(c.db, o.id, item.id, b.userId, from, to, reason, c.viewer.user.fullName, c.now);
    const student = c.db.users.find((u) => u.id === b.userId)!;
    audit(c.db, c.viewer.user, "grade.changed", "grade", item.id, `Changed "${item.title}" for ${student.fullName} from ${from ?? "—"} to ${to ?? "—"} (${reason})`);
    return { itemId: item.id, userId: b.userId, score: to, released: item.released } satisfies GradeCell;
  });

  r.post("/courses/:id/gradebook/items/:itemId/release", async (c) => {
    const o = course(c);
    requirePerm(c.viewer, "grades.release", o.id);
    const item = c.db.gradeItems.find((i) => i.id === c.params.itemId && i.courseId === o.id);
    if (!item) throw notFound("gradebook item");
    const b = await c.json<{ released?: boolean }>();
    const released = b.released !== false;
    const changed = item.released !== released;
    item.released = released;
    if (item.kind === "assignment") c.db.submissions.forEach((s) => s.assignmentId === item.refId && s.grade && (s.grade.released = released));
    if (changed && released) {
      const users = c.db.gradeCells.filter((x) => x.itemId === item.id && x.score !== null).map((x) => x.userId);
      const link = item.kind === "assignment" ? `/assignments/${item.refId}` : item.kind === "quiz" ? `/quizzes/${item.refId}` : "/grades";
      notify(c.db, users, { kind: "grade_released", title: "Grade released", body: `${courseOf(c.db, o.id).code}: your score for "${item.title}" is available.`, link }, c.now);
    }
    audit(c.db, c.viewer.user, released ? "grades.released" : "grades.withheld", "gradebook", item.id, `${released ? "Released" : "Withheld"} "${item.title}"`);
    return item;
  });

  r.get("/courses/:id/gradebook/history", (c) => {
    const o = course(c);
    requirePerm(c.viewer, [...VIEW_PERMS], o.id);
    return c.db.gradeChanges.filter((g) => g.courseId === o.id).map(({ courseId: _o, ...g }) => g);
  });

  r.get("/me/grades", (c): StudentGradeRow[] =>
    [...defaultCourseScope(c.db, c.viewer)].map((cid) => {
      const { code, title } = courseOf(c.db, cid);
      const items = itemsFor(c.db, cid).map((i) => ({
        itemId: i.id,
        title: i.title,
        kind: i.kind,
        score: i.released ? getCellScore(c.db, i.id, c.viewer.user.id) : null,
        maxScore: i.maxScore,
        weightPercent: i.weightPercent,
      }));
      return { courseId: cid, courseCode: code, courseTitle: title, items, runningTotalPercent: weightedTotal(items) };
    }).sort((a, b) => a.courseCode.localeCompare(b.courseCode)),
  );
}
