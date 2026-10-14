import type { Chapter, OneDriveFileRef, PlaybackLink } from "@tasued/api-client";
import { lagosParts } from "../../lib/dates";
import { rand, type Random } from "../../lib/random";
import { activeStudentIds, courseOf, notify } from "./common";
import type { DB, RecordingRow } from "../schema";

/** Public sample MP4 standing in for the organiser's OneDrive file. */
export const SAMPLE_MP4 = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";
/** Teams usually saves the recording to OneDrive shortly after the meeting ends; the mock waits 30 s. */
export const RECORDING_LOOKUP_AFTER_MS = 30_000;
export const PLAYBACK_LINK_TTL_MS = 10 * 60_000;
export const DEFAULT_ORGANISER_EMAIL = "classes@lms.tasued-online.ng";
/** All class meetings are organised by one account, so every recording lives in the same drive. */
export const ORGANISER_DRIVE_ID = "b!xT4s9QmVnE2kLr7YpZ3aWd8uHc1oJfGq6bNiM0eR5sKtXyA2vB7wCgDhP";
export const RELINK_SUCCESS_RATE = 0.7;
export const NOT_FOUND_REASON = "Recording not found in the organiser's OneDrive — it may have been moved or deleted.";

/** "AIIE111-S07-Recording-2026-10-05.mp4" */
export function recordingFileName(classCode: string, startsAt: string) {
  const p = lagosParts(new Date(startsAt).getTime());
  return `${classCode}-Recording-${p.y}-${String(p.m + 1).padStart(2, "0")}-${String(p.d).padStart(2, "0")}.mp4`;
}

export function oneDriveRef(db: DB, fileName: string, r: Random = rand): OneDriveFileRef {
  const ownerEmail = db.settings.organiserAccountEmail;
  const personal = ownerEmail.toLowerCase().replace(/[^a-z0-9]/g, "_");
  return {
    driveId: ORGANISER_DRIVE_ID,
    itemId: `01${r.alnum(32)}`,
    fileName,
    ownerEmail,
    webUrl: `https://tasuedonline-my.sharepoint.com/personal/${personal}/Documents/Recordings/${encodeURIComponent(fileName)}`,
  };
}

/** A fresh, pre-authenticated, short-lived link (differs on every call). */
export function playbackLink(now: number): PlaybackLink {
  const exp = now + PLAYBACK_LINK_TTL_MS;
  return {
    url: `${SAMPLE_MP4}?sig=${rand.token(32)}&exp=${Math.floor(exp / 1000)}`,
    mimeType: "video/mp4",
    expiresAt: new Date(exp).toISOString(),
  };
}

export function makeChapters(unitTitles: string[], durationSeconds: number, r: Random, idPrefix: string): Chapter[] {
  const middle = unitTitles.length ? unitTitles : ["Main lecture"];
  const titles = ["Welcome and recap of last class", ...middle.map((t) => t.replace(/^.*?:\s*/, "")), "Worked examples", "Questions and wrap-up"];
  const n = Math.min(6, Math.max(4, titles.length));
  const chosen = titles.slice(0, n - 1).concat(titles[titles.length - 1]!);
  const step = durationSeconds / chosen.length;
  return chosen.map((title, i) => ({
    id: `${idPrefix}-ch${i + 1}`,
    title,
    startSeconds: i === 0 ? 0 : Math.round(i * step + r.int(-90, 90)),
  }));
}

/** File found in the organiser's OneDrive: link it, publish under its units and tell the students. */
export function linkRecording(db: DB, r: RecordingRow, now: number, fileName?: string) {
  const cls = db.classes.find((c) => c.id === r.classSessionId);
  r.status = "ready";
  r.failureReason = undefined;
  r.pipelineStartedAt = undefined;
  r.oneDrive = oneDriveRef(db, fileName ?? recordingFileName(cls?.classCode ?? courseOf(db, r.courseId).code.replace(/\s/g, ""), r.recordedAt));
  r.published = true;
  r.sizeBytes ??= Math.round(r.durationSeconds * 120_000);
  if (!r.chapters.length) {
    const titles = r.unitIds.map((id) => db.units.find((u) => u.id === id)?.title ?? "").filter(Boolean);
    r.chapters = makeChapters(titles, r.durationSeconds, rand, r.id);
  }
  const { code, course } = courseOf(db, r.courseId);
  if (course?.status !== "published") return;
  const unitId = r.unitIds[0];
  notify(db, activeStudentIds(db, r.courseId), {
    kind: "recording_ready",
    title: `${code}: new recording available`,
    body: `"${r.title}" is now available.`,
    link: unitId ? `/courses/${r.courseId}/units/${unitId}` : `/courses/${r.courseId}`,
  }, now);
}
