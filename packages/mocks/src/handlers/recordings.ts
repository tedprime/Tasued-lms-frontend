import type { Chapter, RecordingStatus } from "@tasued/api-client";
import { audit, find } from "../db/ops/common";
import type { RecordingRow } from "../db/schema";
import { recordingView, recordingVisibleToStudents } from "../db/views/core";
import { asString, courseFilter, readableCourse } from "../lib/access";
import { isStaffFor, requirePerm } from "../lib/auth";
import { iso } from "../lib/dates";
import { conflict, forbidden, notFound, validation } from "../lib/http";
import { newId, rand } from "../lib/random";
import { linkRecording, NOT_FOUND_REASON, playbackLink, RELINK_SUCCESS_RATE } from "../db/ops/recordings";
import type { Ctx, Router } from "../lib/route";

function readableRecording(c: Ctx, id: string) {
  const rec = find(c.db.recordings, id, "recording");
  readableCourse(c, rec.courseId);
  const staff = isStaffFor(c.viewer, rec.courseId);
  if (!staff && !recordingVisibleToStudents(rec)) throw notFound("recording");
  return { rec, staff };
}

export function registerRecordings(r: Router) {
  r.get("/recordings", (c) => {
    const courseIds = courseFilter(c);
    const status = c.q("status") as RecordingStatus | undefined;
    const unitId = c.q("unitId");
    return c.db.recordings
      .filter((x) => courseIds.has(x.courseId))
      .filter((x) => isStaffFor(c.viewer, x.courseId) || recordingVisibleToStudents(x))
      .filter((x) => (!status || x.status === status) && (!unitId || x.unitIds.includes(unitId)))
      .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))
      .map(recordingView);
  });

  r.post("/recordings/upload", async (c) => {
    const fd = await c.form();
    const courseId = String(fd.get("courseId") ?? "");
    const o = find(c.db.courses, courseId, "course");
    requirePerm(c.viewer, "recordings.manage", o.id);
    const file = fd.get("file");
    const title = String(fd.get("title") ?? "").trim();
    const classSessionId = String(fd.get("classSessionId") ?? "") || undefined;
    const unitIds = fd.getAll("unitIds").map(String).filter(Boolean);
    const errs: Record<string, string> = {};
    if (!file || typeof file === "string") errs.file = "Choose the MP4 file to upload";
    if (!title) errs.title = "Title is required";
    if (unitIds.some((id) => !c.db.units.some((u) => u.id === id && u.courseId === o.id))) errs.unitIds = "Choose units from this course";
    const cls = classSessionId ? c.db.classes.find((x) => x.id === classSessionId && x.courseId === o.id) : undefined;
    if (classSessionId && !cls) errs.classSessionId = "That class isn't part of this course";
    if (Object.keys(errs).length) throw validation(errs);
    const f = file as File;
    const rec: RecordingRow = {
      id: newId("rec"),
      classSessionId,
      courseId: o.id,
      title,
      recordedAt: cls?.startsAt ?? iso(c.now),
      durationSeconds: cls ? Math.round((new Date(cls.endsAt).getTime() - new Date(cls.startsAt).getTime()) / 1000) : 3600,
      status: "ready",
      source: "lecturer_upload",
      sizeBytes: f.size,
      unitIds: unitIds.length ? unitIds : cls?.unitIds ?? [],
      chapters: [],
      published: false,
      createdAt: iso(c.now),
      views: 0,
      avgWatchPercent: 0,
    };
    c.db.recordings.push(rec);
    // The API stores the upload in the organiser's OneDrive and links it straight away.
    linkRecording(c.db, rec, c.now, f.name || "lecture-upload.mp4");
    audit(c.db, c.viewer.user, "recording.uploaded", "recording", rec.id, `Uploaded "${title}" (${f.name}) to the organiser's OneDrive`);
    return recordingView(rec);
  });

  r.get("/recordings/:id", (c) => recordingView(readableRecording(c, c.params.id).rec));

  r.patch("/recordings/:id", async (c) => {
    const rec = find(c.db.recordings, c.params.id, "recording");
    requirePerm(c.viewer, "recordings.manage", rec.courseId);
    const b = await c.json<{ title?: string; unitIds?: string[]; chapters?: Chapter[]; published?: boolean }>();
    if (b.title !== undefined) rec.title = asString(b.title) || rec.title;
    if (b.unitIds !== undefined) {
      if (!Array.isArray(b.unitIds) || b.unitIds.some((id) => !c.db.units.some((u) => u.id === id && u.courseId === rec.courseId))) {
        throw validation({ unitIds: "Choose units from this course" });
      }
      rec.unitIds = [...new Set(b.unitIds)];
    }
    if (b.chapters !== undefined) {
      if (!Array.isArray(b.chapters)) throw validation({ chapters: "Invalid chapters" });
      rec.chapters = b.chapters
        .map((ch) => ({ id: ch.id || newId("ch"), title: asString(ch.title), startSeconds: Math.max(0, Math.round(Number(ch.startSeconds) || 0)) }))
        .filter((ch) => ch.title && ch.startSeconds <= rec.durationSeconds)
        .sort((a, b2) => a.startSeconds - b2.startSeconds);
    }
    if (typeof b.published === "boolean") {
      if (b.published && rec.status !== "ready") throw conflict("RECORDING_NOT_READY", "Only ready recordings can be published.");
      rec.published = b.published;
      audit(c.db, c.viewer.user, b.published ? "recording.published" : "recording.unpublished", "recording", rec.id, `${b.published ? "Published" : "Unpublished"} "${rec.title}"`);
    }
    return recordingView(rec);
  });

  /** Short-lived link to the MP4 in the organiser's OneDrive. */
  r.get("/recordings/:id/playback", (c) => {
    const rec = find(c.db.recordings, c.params.id, "recording");
    const staff = isStaffFor(c.viewer, rec.courseId);
    const cid = c.db.courses.find((o) => o.id === rec.courseId);
    const courseOk = staff || cid?.status === "published" || (cid?.status === "archived" && c.viewer.enrolledCourseIds.has(rec.courseId));
    if (!courseOk) throw forbidden("You can't watch recordings for this course.");
    if (rec.status !== "ready" || !rec.oneDrive) throw conflict("RECORDING_NOT_READY", rec.status === "failed" ? "This recording couldn't be found in OneDrive." : "This recording isn't available yet. Try again in a few minutes.");
    if (!staff && !rec.published) throw forbidden("This recording hasn't been published yet.");
    return playbackLink(c.now);
  });

  /** Look for a pending/failed recording in the organiser's OneDrive again. */
  r.post("/recordings/:id/relink", (c) => {
    const rec = find(c.db.recordings, c.params.id, "recording");
    requirePerm(c.viewer, "recordings.manage", rec.courseId);
    if (rec.status === "ready") throw conflict("ALREADY_LINKED", "This recording is already linked to its OneDrive file.");
    if (rand.chance(RELINK_SUCCESS_RATE)) {
      linkRecording(c.db, rec, c.now);
      audit(c.db, c.viewer.user, "recording.linked", "recording", rec.id, `Linked "${rec.title}" to ${rec.oneDrive!.fileName} in the organiser's OneDrive`);
    } else {
      rec.status = "failed";
      rec.pipelineStartedAt = undefined;
      rec.oneDrive = undefined;
      rec.published = false;
      rec.failureReason = NOT_FOUND_REASON;
      audit(c.db, c.viewer.user, "recording.not_found", "recording", rec.id, `Relink failed for "${rec.title}" — not found in the organiser's OneDrive`);
    }
    return recordingView(rec);
  });

  r.delete("/recordings/:id", (c) => {
    const rec = find(c.db.recordings, c.params.id, "recording");
    requirePerm(c.viewer, "recordings.manage", rec.courseId);
    c.db.recordings = c.db.recordings.filter((x) => x.id !== rec.id);
    c.db.positions = c.db.positions.filter((p) => p.recordingId !== rec.id);
    audit(c.db, c.viewer.user, "recording.deleted", "recording", rec.id, `Deleted "${rec.title}"`);
  });

  r.get("/recordings/:id/position", (c) => {
    const { rec } = readableRecording(c, c.params.id);
    const p = c.db.positions.find((x) => x.recordingId === rec.id && x.userId === c.viewer.user.id);
    if (!p) return null;
    const { userId: _u, ...out } = p;
    return out;
  });

  r.put("/recordings/:id/position", async (c) => {
    const { rec } = readableRecording(c, c.params.id);
    const b = await c.json<{ positionSeconds?: number }>();
    const pos = Number(b.positionSeconds);
    if (!Number.isFinite(pos) || pos < 0) throw validation({ positionSeconds: "Invalid position" });
    let p = c.db.positions.find((x) => x.recordingId === rec.id && x.userId === c.viewer.user.id);
    if (!p) {
      p = { recordingId: rec.id, userId: c.viewer.user.id, positionSeconds: 0, updatedAt: iso(c.now) };
      c.db.positions.push(p);
      rec.views++;
    }
    p.positionSeconds = Math.min(rec.durationSeconds, Math.round(pos));
    p.updatedAt = iso(c.now);
    const { userId: _u, ...out } = p;
    return out;
  });
}
