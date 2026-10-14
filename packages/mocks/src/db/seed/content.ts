import { DAY, HOUR, iso } from "../../lib/dates";
import type { Random } from "../../lib/random";
import type { DB } from "../schema";
import { AIIE_COURSE_ID, moduleId, unitId } from "./ids";
import raw from "./aiie111-content.json";

/**
 * Course text of the AIIE 111 student handout, extracted from the PDF by
 * scripts/extract-aiie111.py (re-run it if the handout changes).
 */
export interface HandoutUnit {
  code: string;
  title: string;
  objective: string;
  html: string;
  words: number;
}
export interface HandoutModule {
  number: number;
  title: string;
  part: string;
  intro: string;
  units: HandoutUnit[];
}
export interface HandoutPart {
  letter: string;
  title: string;
  summary: string;
  modules: number[];
}
export interface Handout {
  course: { code: string; title: string; description: string; outcomes: string[] };
  parts: HandoutPart[];
  modules: HandoutModule[];
}

export const HANDOUT = raw as Handout;
export const HANDOUT_UNITS: HandoutUnit[] = HANDOUT.modules.flatMap((m) => m.units);

/** "1.1 What Is Artificial Intelligence?" */
export const unitTitle = (u: Pick<HandoutUnit, "code" | "title">) => `${u.code} ${u.title}`;

export function seedContent(db: DB, now: number, r: Random) {
  for (const m of HANDOUT.modules) {
    db.modules.push({ id: moduleId(m.number), courseId: AIIE_COURSE_ID, title: `Module ${m.number}: ${m.title}`, summary: m.intro, order: m.number, state: "published" });
    m.units.forEach((u, ui) => {
      db.units.push({
        id: unitId(u.code),
        moduleId: moduleId(m.number),
        courseId: AIIE_COURSE_ID,
        title: unitTitle(u),
        order: ui + 1,
        state: "published",
        estimatedReadMinutes: Math.ceil(u.words / 200),
        objectives: [u.objective],
        courseTextHtml: u.html,
        attachments: [],
        updatedAt: iso(now - r.int(30, 45) * DAY - r.int(0, 23) * HOUR),
      });
    });
  }
}

/** Ordered published units for a course (module order, then unit order). */
export function orderedUnits(db: DB, courseId: string, includeDraft = false) {
  const mods = db.modules.filter((m) => m.courseId === courseId && (includeDraft || m.state === "published")).sort((a, b) => a.order - b.order);
  return mods.flatMap((m) =>
    db.units.filter((u) => u.moduleId === m.id && (includeDraft || u.state === "published")).sort((a, b) => a.order - b.order),
  );
}

export function seedProgress(db: DB, now: number, r: Random) {
  // userId -> number of units fully read (the next one is part-read)
  const plan: Record<string, number> = { "stu-adaeze": 24, "stu-tunde": 9, "stu-chiamaka": 17 };
  for (const [userId, done] of Object.entries(plan)) {
    const units = orderedUnits(db, AIIE_COURSE_ID);
    units.slice(0, done + 1).forEach((u, i) => {
      const complete = i < done;
      db.progress.push({
        userId,
        unitId: u.id,
        readPercent: complete ? 100 : r.int(20, 70),
        watchedSeconds: complete ? r.int(1800, 6800) : r.int(0, 900),
        completed: complete,
        lastVisitedAt: iso(now - (done - i) * 0.8 * DAY - r.int(1, 10) * HOUR),
      });
    });
  }
}
