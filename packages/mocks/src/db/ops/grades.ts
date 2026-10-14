import type { GradebookItem, ID } from "@tasued/api-client";
import { iso } from "../../lib/dates";
import { newId } from "../../lib/random";
import type { DB, GradeItemRow } from "../schema";

export const itemFor = (db: DB, kind: GradebookItem["kind"], refId: ID) =>
  db.gradeItems.find((i) => i.kind === kind && i.refId === refId);

export function ensureItem(
  db: DB,
  init: Omit<GradeItemRow, "id" | "released"> & { id?: ID; released?: boolean },
): GradeItemRow {
  const existing = init.refId ? itemFor(db, init.kind, init.refId) : undefined;
  if (existing) {
    existing.title = init.title;
    existing.maxScore = init.maxScore;
    existing.weightPercent = init.weightPercent;
    return existing;
  }
  const item: GradeItemRow = { released: false, ...init, id: init.id ?? newId("gbi") };
  db.gradeItems.push(item);
  return item;
}

export const getCellScore = (db: DB, itemId: ID, userId: ID) =>
  db.gradeCells.find((c) => c.itemId === itemId && c.userId === userId)?.score ?? null;

export function putCell(db: DB, itemId: ID, userId: ID, score: number | null) {
  const cell = db.gradeCells.find((c) => c.itemId === itemId && c.userId === userId);
  const from = cell?.score ?? null;
  if (cell) cell.score = score;
  else db.gradeCells.push({ itemId, userId, score });
  return { from, to: score };
}

export function logChange(
  db: DB,
  courseId: ID,
  itemId: ID,
  userId: ID,
  from: number | null,
  to: number | null,
  reason: string,
  changedBy: string,
  at: number = Date.now(),
) {
  db.gradeChanges.unshift({ id: newId("gch"), courseId, itemId, userId, from, to, reason, changedBy, changedAt: iso(at) });
}

export const round1 = (n: number) => Math.round(n * 10) / 10;
