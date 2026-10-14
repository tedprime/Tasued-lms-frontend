import type { AttendanceMark, AttendanceRecord, AttendanceRule, AttendanceSheet } from "@tasued/api-client";
import { iso, MIN, ms } from "../../lib/dates";
import type { Random } from "../../lib/random";
import type { ClassRow, DB } from "../schema";
import { activeStudentIds } from "./common";

export function applyRule(rule: AttendanceRule, minutesAttended: number, durationMinutes: number, joinedAfterMinutes: number): AttendanceMark {
  if (minutesAttended <= 0) return "absent";
  const pct = (minutesAttended / Math.max(1, durationMinutes)) * 100;
  if (pct < rule.presentThresholdPercent) return "absent";
  return joinedAfterMinutes > rule.lateAfterMinutes ? "late" : "present";
}

const GUESTS = [
  { displayName: "Oluwaseun's iPhone", minutesAttended: 96 },
  { displayName: "Guest (Unverified)", email: "temiloluwa2007@gmail.com", minutesAttended: 74 },
  { displayName: "+234 803 *** 4471 (Dial-in)", minutesAttended: 41 },
  { displayName: "STUDENT PC LAB 3", minutesAttended: 110 },
];

/** Simulate a Teams attendance report for a class. `propensity` (0-1) biases a student's attendance. */
export function simulateTeamsImport(
  db: DB,
  cls: ClassRow,
  rule: AttendanceRule,
  r: Random,
  propensity: (userId: string) => number = () => 0.82,
  unmatchedCount = r.int(1, 2),
): Pick<AttendanceSheet, "records" | "unmatched"> {
  const start = ms(cls.startsAt);
  const duration = Math.round((ms(cls.endsAt) - start) / MIN);
  const records: AttendanceRecord[] = [];
  for (const userId of activeStudentIds(db, cls.courseId)) {
    const u = db.users.find((x) => x.id === userId);
    if (!u) continue;
    const p = propensity(userId);
    let minutes = 0;
    let joinedAfter = 0;
    if (r.chance(p)) {
      joinedAfter = r.chance(0.8) ? r.int(0, 8) : r.int(11, 25);
      minutes = Math.max(0, duration - joinedAfter - (r.chance(0.85) ? r.int(0, 6) : r.int(30, 70)));
    } else if (r.chance(0.3)) {
      joinedAfter = r.int(20, 60);
      minutes = r.int(10, 45);
    }
    const mark = applyRule(rule, minutes, duration, joinedAfter);
    records.push({
      id: `att-${cls.id}-${userId}`,
      classSessionId: cls.id,
      userId,
      studentName: u.fullName,
      matricNumber: u.matricNumber,
      mark,
      minutesAttended: minutes,
      joinedAt: minutes > 0 ? iso(start + joinedAfter * MIN) : undefined,
      leftAt: minutes > 0 ? iso(start + (joinedAfter + minutes) * MIN) : undefined,
      source: "teams",
    });
  }
  records.sort((a, b) => a.studentName.localeCompare(b.studentName));
  return { records, unmatched: r.sample(GUESTS, unmatchedCount) };
}
