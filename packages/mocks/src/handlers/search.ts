import type { SearchHit } from "@tasued/api-client";
import { courseOf } from "../db/ops/common";
import { recordingVisibleToStudents } from "../db/views/core";
import { isStaffFor } from "../lib/auth";
import type { Router } from "../lib/route";

export function registerSearch(r: Router) {
  r.get("/search", (c) => {
    const term = (c.q("q") ?? "").trim().toLowerCase();
    if (term.length < 2) return [];
    const { db, viewer: v } = c;
    const has = (s: string) => s.toLowerCase().includes(term);
    const readable = (cid: string) => {
      const o = db.courses.find((x) => x.id === cid);
      return !!o && (isStaffFor(v, cid) || o.status === "published");
    };
    const mineFirst = (cid: string | null) => (cid && (v.enrolledCourseIds.has(cid) || v.staffCourseIds.has(cid)) ? 0 : 1);
    const hits: (SearchHit & { rank: number })[] = [];

    for (const o of db.courses) {
      if (!readable(o.id) || o.status === "archived") continue;
      const { code, title } = courseOf(db, o.id);
      if (has(code) || has(code.replace(/\s/g, "")) || has(title)) hits.push({ type: "course", id: o.id, title: `${code} — ${title}`, subtitle: o.status === "draft" ? "Draft course" : "Course", link: `/courses/${o.id}`, rank: mineFirst(o.id) });
    }
    for (const u of db.units) {
      if (!readable(u.courseId) || !has(u.title)) continue;
      const mod = db.modules.find((m) => m.id === u.moduleId);
      if (!isStaffFor(v, u.courseId) && (u.state !== "published" || mod?.state !== "published")) continue;
      hits.push({ type: "unit", id: u.id, title: u.title, subtitle: `${courseOf(db, u.courseId).code} · ${mod?.title ?? ""}`, link: `/courses/${u.courseId}/units/${u.id}`, rank: mineFirst(u.courseId) });
    }
    for (const rec of db.recordings) {
      if (!readable(rec.courseId) || !has(rec.title)) continue;
      if (!isStaffFor(v, rec.courseId) && !recordingVisibleToStudents(rec)) continue;
      const unitId = rec.unitIds[0];
      hits.push({ type: "recording", id: rec.id, title: rec.title, subtitle: `${courseOf(db, rec.courseId).code} · Recording`, link: unitId ? `/courses/${rec.courseId}/units/${unitId}?recording=${rec.id}` : `/recordings/${rec.id}`, rank: mineFirst(rec.courseId) });
    }
    for (const t of db.threads) {
      if ((t.courseId && !readable(t.courseId)) || !has(t.title)) continue;
      hits.push({ type: "thread", id: t.id, title: t.title, subtitle: t.courseId ? `${courseOf(db, t.courseId).code} · Forum` : "General forum", link: `/forum/${t.id}`, rank: mineFirst(t.courseId) });
    }
    for (const a of db.assignments) {
      if (!readable(a.courseId) || !has(a.title) || (!isStaffFor(v, a.courseId) && a.state !== "published")) continue;
      hits.push({ type: "assignment", id: a.id, title: a.title, subtitle: `${courseOf(db, a.courseId).code} · Assignment`, link: `/assignments/${a.id}`, rank: mineFirst(a.courseId) });
    }
    for (const q of db.quizzes) {
      if (!readable(q.courseId) || !has(q.title) || (!isStaffFor(v, q.courseId) && q.state !== "published")) continue;
      hits.push({ type: "quiz", id: q.id, title: q.title, subtitle: `${courseOf(db, q.courseId).code} · Quiz`, link: `/quizzes/${q.id}`, rank: mineFirst(q.courseId) });
    }
    return hits.sort((a, b) => a.rank - b.rank).slice(0, 30).map(({ rank: _r, ...h }) => h);
  });
}
