import { iso, ms } from "../lib/dates";
import { newId } from "../lib/random";
import { classStatus } from "./ops/classes";
import { finaliseAttempt } from "./ops/quiz";
import { linkRecording, RECORDING_LOOKUP_AFTER_MS } from "./ops/recordings";
import type { DB } from "./schema";

/**
 * Time-driven state changes, evaluated lazily on every request (no timers):
 * - ended auto-record classes get a "pending" recording (waiting for Teams to save it to OneDrive),
 * - pending recordings are found in the organiser's OneDrive and become ready 30 s later
 *   (linked, not copied — playback streams from OneDrive through short-lived links),
 * - quiz attempts past their deadline are auto-submitted.
 * Returns true if anything changed.
 */
export function tick(db: DB, now: number): boolean {
  let changed = false;

  for (const c of db.classes) {
    if (c.recordingTriggered || classStatus(c, now) !== "ended") continue;
    c.recordingTriggered = true;
    changed = true;
    if (!c.autoRecord) continue;
    db.recordings.push({
      id: newId("rec"),
      classSessionId: c.id,
      courseId: c.courseId,
      title: c.title,
      recordedAt: c.startsAt,
      durationSeconds: Math.round((ms(c.endsAt) - ms(c.startsAt)) / 1000),
      status: "pending",
      source: "teams_onedrive",
      unitIds: [...c.unitIds],
      chapters: [],
      published: false,
      createdAt: iso(now),
      pipelineStartedAt: iso(now),
      views: 0,
      avgWatchPercent: 0,
    });
  }

  for (const r of db.recordings) {
    if (!r.pipelineStartedAt || r.status !== "pending") continue;
    if (now - ms(r.pipelineStartedAt) < RECORDING_LOOKUP_AFTER_MS) continue;
    changed = true;
    linkRecording(db, r, now);
  }

  for (const a of db.attempts) {
    if (a.state === "in_progress" && now > ms(a.deadlineAt)) {
      finaliseAttempt(db, a, "auto_submitted", ms(a.deadlineAt));
      changed = true;
    }
  }

  return changed;
}
