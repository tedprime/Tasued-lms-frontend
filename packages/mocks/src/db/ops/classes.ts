import type { ClassSessionStatus, ID } from "@tasued/api-client";
import { ms } from "../../lib/dates";
import type { Random } from "../../lib/random";
import type { ClassRow, DB } from "../schema";

export function classStatus(c: Pick<ClassRow, "startsAt" | "endsAt" | "cancelled">, now: number): ClassSessionStatus {
  if (c.cancelled) return "cancelled";
  if (now < ms(c.startsAt)) return "scheduled";
  if (now < ms(c.endsAt)) return "live";
  return "ended";
}

export const classCode = (prefix: string, seq: number) => `${prefix}-S${String(seq).padStart(2, "0")}`;

export function nextSeq(db: DB, courseId: ID) {
  return db.classes.filter((c) => c.courseId === courseId).reduce((m, c) => Math.max(m, c.seq), 0) + 1;
}

export function teamsMeeting(r: Random) {
  const token = r.token(48);
  return {
    teamsJoinUrl: `https://teams.microsoft.com/l/meetup-join/19%3ameeting_${token}%40thread.v2/0`,
    teamsMeetingId: `MSo${r.token(10)}_${r.token(24)}`,
  };
}
