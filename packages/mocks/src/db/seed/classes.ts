import { DAY, HOUR, iso, lagosAt, MIN, ms } from "../../lib/dates";
import type { Random } from "../../lib/random";
import { simulateTeamsImport } from "../ops/attendance";
import { classCode, classStatus, teamsMeeting } from "../ops/classes";
import { makeChapters, NOT_FOUND_REASON, oneDriveRef, recordingFileName } from "../ops/recordings";
import type { ClassRow, DB, RecordingRow } from "../schema";
import { HANDOUT_UNITS, type HandoutUnit } from "./content";
import { AIIE_LECTURER_IDS, AIIE_COURSE_ID, AIIE_PREFIX, CLASS_HOURS, CLASS_SLOTS, SEMESTER_WEEKS, unitId } from "./ids";
import { diligence, participates } from "./people";
import { teachingStart } from "./courses";

/**
 * Walk the 73 handout units in order across the semester's classes (Mon/Wed/Fri, two 2-hour
 * classes a day, 13 weeks = 78 classes). Each class takes an equal share of the course text by
 * word count, so it covers 1–2 consecutive units; a long unit can carry over into the next class.
 */
export function planUnits(units: HandoutUnit[], classCount: number): HandoutUnit[][] {
  const total = units.reduce((n, u) => n + u.words, 0);
  const share = total / classCount;
  const spans: { u: HandoutUnit; from: number; to: number }[] = [];
  let at = 0;
  for (const u of units) {
    spans.push({ u, from: at, to: at + u.words });
    at += u.words;
  }
  const plan: HandoutUnit[][] = [];
  for (let k = 0; k < classCount; k++) {
    const a = k * share;
    const b = (k + 1) * share;
    const picked = spans
      .map((s, i) => ({ i, s, overlap: Math.max(0, Math.min(b, s.to) - Math.max(a, s.from)) }))
      .filter((x) => x.overlap > 0 && (x.overlap >= 0.3 * x.s.u.words || x.overlap >= 0.35 * share))
      .sort((x, y) => y.overlap - x.overlap)
      .slice(0, 2)
      .sort((x, y) => x.i - y.i);
    plan.push(picked.map((x) => x.s.u));
  }
  return plan; // (smoke.ts checks that every unit is taught at least once)
}

export function seedClasses(db: DB, now: number, r: Random) {
  const semStart = teachingStart(now);
  const starts: { start: number; slot: number; week: number }[] = [];
  for (let w = 0; w < SEMESTER_WEEKS; w++) {
    CLASS_SLOTS.forEach((s, si) => starts.push({ start: lagosAt(semStart, w * 7 + (s.weekday - 1), s.hour), slot: si, week: w + 1 }));
  }
  starts.sort((a, b) => a.start - b.start);
  const plan = planUnits(HANDOUT_UNITS, starts.length);

  let prevLast = "";
  starts.forEach((s, i) => {
    const units = plan[i]!;
    const continued = units.length === 1 && units[0]!.code === prevLast;
    const label = units.map((u) => `${u.code} ${u.title}`).join(" · ");
    prevLast = units[units.length - 1]?.code ?? prevLast;
    const row: ClassRow = {
      id: `cls-aiie111-${String(i + 1).padStart(2, "0")}`,
      courseId: AIIE_COURSE_ID,
      title: `Week ${s.week} · ${label}${continued ? " (continued)" : ""}`,
      classCode: classCode(AIIE_PREFIX, i + 1),
      seq: i + 1,
      startsAt: iso(s.start),
      endsAt: iso(s.start + CLASS_HOURS * HOUR),
      cancelled: false,
      unitIds: units.map((u) => unitId(u.code)),
      lecturerId: AIIE_LECTURER_IDS[0],
      ...teamsMeeting(r),
      autoRecord: true,
      seriesId: `ser-aiie111-${s.slot + 1}`,
      recordingTriggered: false,
    };
    db.classes.push(row);
  });

  seedRecordingsAndAttendance(db, now, r);
}

function seedRecordingsAndAttendance(db: DB, now: number, r: Random) {
  const ended = db.classes.filter((c) => classStatus(c, now) === "ended").sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const fromEnd = (n: number) => ended[ended.length - 1 - n]?.id;
  // Recording states: the latest ended class is still waiting for Teams to save its recording,
  // one class a week ago was not found in OneDrive, and one early class was uploaded by the lecturer.
  const special: Record<string, "pending" | "failed" | "upload"> = {};
  const set = (id: string | undefined, v: (typeof special)[string]) => id && (special[id] = v);
  set(fromEnd(6), "failed");
  set(ended[2]?.id, "upload");
  set(fromEnd(0), "pending");
  // Attendance: latest ended class not yet imported from Teams, the one before it in review.
  const pendingImport = fromEnd(0);
  const inReview = fromEnd(1);
  const propensity = (uid: string) => {
    const u = db.users.find((x) => x.id === uid);
    return participates(db, uid) && u?.teamsGuest?.status === "accepted" ? diligence(uid) : 0;
  };

  for (const c of ended) {
    c.recordingTriggered = true;
    const end = ms(c.endsAt);
    const kind = special[c.id];
    const unitTitles = c.unitIds.map((id) => db.units.find((u) => u.id === id)?.title ?? "");
    const duration = CLASS_HOURS * 3600 - r.int(60, 420);
    const id = `rec-${c.id.slice(4)}`;
    const rec: RecordingRow = {
      id,
      classSessionId: c.id,
      courseId: c.courseId,
      title: c.title,
      recordedAt: c.startsAt,
      durationSeconds: duration,
      status: "ready",
      source: kind === "upload" ? "lecturer_upload" : "teams_onedrive",
      oneDrive: oneDriveRef(db, kind === "upload" ? `${c.classCode}-lecturer-upload.mp4` : recordingFileName(c.classCode, c.startsAt), r),
      sizeBytes: Math.round(duration * r.int(110_000, 140_000)),
      unitIds: [...c.unitIds],
      chapters: makeChapters(unitTitles, duration, r, id),
      published: true,
      createdAt: iso(end + r.int(15, 90) * MIN),
      views: r.int(18, 52),
      avgWatchPercent: r.int(38, 86),
    };
    if (kind === "pending" || kind === "failed") {
      rec.status = kind;
      rec.oneDrive = undefined;
      rec.sizeBytes = undefined;
      rec.published = false;
      rec.views = 0;
      rec.avgWatchPercent = 0;
      if (kind === "pending") rec.chapters = [];
      if (kind === "failed") rec.failureReason = NOT_FOUND_REASON;
    }
    if (kind === "upload") rec.createdAt = iso(end + 2 * DAY);
    db.recordings.push(rec);

    // Attendance
    if (c.id === pendingImport) {
      db.sheets.push({ classSessionId: c.id, status: "pending_import", mode: "teams", rule: { ...db.settings.attendanceRule }, records: [], unmatched: [] });
      continue;
    }
    const sim = simulateTeamsImport(db, c, db.settings.attendanceRule, r, propensity, c.id === inReview ? 2 : r.int(0, 2));
    if (c.id === inReview) {
      db.sheets.push({ classSessionId: c.id, status: "in_review", mode: "teams", rule: { ...db.settings.attendanceRule }, records: sim.records, unmatched: sim.unmatched, importedAt: iso(end + 40 * MIN) });
      continue;
    }
    for (const rec of sim.records) {
      if (rec.mark === "absent" && participates(db, rec.userId) && r.chance(0.12)) {
        rec.mark = "excused";
        rec.note = r.pick(["Medical — letter submitted to HOD", "Representing TASUED at inter-varsity games", "Approved family emergency"]);
      }
    }
    const lecturer = db.users.find((u) => u.id === c.lecturerId);
    db.sheets.push({
      classSessionId: c.id,
      status: "finalised",
      mode: "teams",
      rule: { ...db.settings.attendanceRule },
      records: sim.records,
      unmatched: [],
      importedAt: iso(end + 40 * MIN),
      finalisedAt: iso(Math.min(now - 10 * MIN, end + r.int(3, 30) * HOUR)),
      finalisedBy: lecturer?.fullName ?? "Lecturer",
    });
  }
}

/** The class that is live now, or else the next one to start (used by notifications). */
export function currentOrNextClass(db: DB, now: number) {
  return db.classes
    .filter((c) => ["live", "scheduled"].includes(classStatus(c, now)))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
}
