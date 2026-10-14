import type { ID, NotificationKind } from "@tasued/api-client";
import { iso } from "../../lib/dates";
import { notFound } from "../../lib/http";
import { newId, rand } from "../../lib/random";
import type { DB, UserRow } from "../schema";

export function find<T extends { id: ID }>(arr: T[], id: ID | undefined | null, what = "item"): T {
  const x = id ? arr.find((a) => a.id === id) : undefined;
  if (!x) throw notFound(what);
  return x;
}

export function notify(
  db: DB,
  userIds: Iterable<ID>,
  n: { kind: NotificationKind; title: string; body: string; link: string },
  at: number = Date.now(),
) {
  for (const userId of new Set(userIds)) {
    db.notifications.push({ id: newId("ntf"), userId, ...n, createdAt: iso(at), read: false });
  }
}

const IPS = ["102.89.34.12", "105.112.40.77", "197.210.53.9", "41.184.22.150", "102.91.4.33"];

export function audit(
  db: DB,
  actor: Pick<UserRow, "id" | "fullName">,
  action: string,
  targetType: string,
  targetId: ID,
  summary: string,
  at: number = Date.now(),
) {
  db.audit.unshift({
    id: newId("aud"),
    at: iso(at),
    actor: actor.fullName,
    actorId: actor.id,
    action,
    targetType,
    targetId,
    summary,
    ip: rand.pick(IPS),
  });
}

export const activeStudentIds = (db: DB, courseId: ID) =>
  db.enrolments.filter((e) => e.courseId === courseId && e.status === "active").map((e) => e.userId);

export function courseOf(db: DB, courseId: ID) {
  const c = db.courses.find((x) => x.id === courseId);
  return { course: c, code: c?.code ?? "", title: c?.title ?? "" };
}

export const userName = (db: DB, id: ID) => db.users.find((u) => u.id === id)?.fullName ?? "Unknown user";
