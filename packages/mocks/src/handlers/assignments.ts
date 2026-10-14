import type { Assignment, LatePolicy, PublishState, Submission } from "@tasued/api-client";
import { activeStudentIds, audit, courseOf, find, notify } from "../db/ops/common";
import { ensureItem, getCellScore, itemFor, logChange, putCell } from "../db/ops/grades";
import type { AssignmentRow, DB, SubmissionRow } from "../db/schema";
import { assignmentView, submissionView, virtualSubmission } from "../db/views/assess";
import { asNumber, asString, isIsoDate, courseFilter, readableCourse, requireEnrolled } from "../lib/access";
import { isStaffFor, requirePerm } from "../lib/auth";
import { DAY, fmtShort, iso, ms } from "../lib/dates";
import { conflict, invalid, notFound, validation } from "../lib/http";
import { newId, rand } from "../lib/random";
import type { Ctx, Router } from "../lib/route";
import { attachmentFromFile, fileFromForm } from "./content";

const LATE: LatePolicy[] = ["not_accepted", "accepted_with_penalty", "accepted_no_penalty"];

function readableAssignment(c: Ctx, id: string) {
  const a = find(c.db.assignments, id, "assignment");
  readableCourse(c, a.courseId);
  const staff = isStaffFor(c.viewer, a.courseId);
  if (!staff && a.state !== "published") throw notFound("assignment");
  return { a, staff };
}

function validateAssignment(db: DB, b: Partial<Assignment>, base?: AssignmentRow): Omit<AssignmentRow, "id" | "courseId" | "createdAt" | "attachments"> {
  const m = { ...base, ...b } as Partial<Assignment>;
  const errs: Record<string, string> = {};
  const title = asString(m.title);
  if (!title) errs.title = "Title is required";
  if (!isIsoDate(m.opensAt)) errs.opensAt = "Opening date is required";
  if (!isIsoDate(m.dueAt)) errs.dueAt = "Due date is required";
  if (isIsoDate(m.opensAt) && isIsoDate(m.dueAt) && ms(m.dueAt) <= ms(m.opensAt)) errs.dueAt = "Due date must be after the opening date";
  const late = m.latePolicy ?? db.settings.defaultLatePolicy;
  if (!LATE.includes(late)) errs.latePolicy = "Invalid late policy";
  if (m.closesAt && (!isIsoDate(m.closesAt) || (isIsoDate(m.dueAt) && ms(m.closesAt) < ms(m.dueAt)))) errs.closesAt = "Late submissions must close after the due date";
  const maxScore = asNumber(m.maxScore);
  if (!maxScore || maxScore <= 0) errs.maxScore = "Maximum score must be greater than 0";
  const weight = asNumber(m.weightPercent);
  if (weight === undefined || weight < 0 || weight > 100) errs.weightPercent = "Weight must be 0–100%";
  if (m.allowText === false && m.allowFiles === false) errs.allowFiles = "Allow text, files or both";
  if (Object.keys(errs).length) throw validation(errs);
  return {
    title,
    instructionsHtml: m.instructionsHtml ?? "",
    unitIds: Array.isArray(m.unitIds) ? m.unitIds : [],
    opensAt: m.opensAt!,
    dueAt: m.dueAt!,
    closesAt: late === "not_accepted" ? undefined : m.closesAt || undefined,
    latePolicy: late,
    latePenaltyPercentPerDay: late === "accepted_with_penalty" ? asNumber(m.latePenaltyPercentPerDay) ?? 10 : undefined,
    maxScore: maxScore!,
    weightPercent: weight!,
    allowText: m.allowText !== false,
    allowFiles: m.allowFiles !== false,
    allowedFileTypes: Array.isArray(m.allowedFileTypes) && m.allowedFileTypes.length ? m.allowedFileTypes.map((x) => String(x).toLowerCase().replace(/^\./, "")) : ["pdf", "docx"],
    maxFileSizeMb: Math.min(db.settings.maxUploadMb, asNumber(m.maxFileSizeMb) ?? 10),
    state: (m.state as PublishState) === "published" ? "published" : "draft",
  };
}

/* ── student-side helpers ── */
function mySubmissionCtx(c: Ctx, id: string) {
  const { a } = readableAssignment(c, id);
  requireEnrolled(c.viewer, a.courseId);
  const sub = c.db.submissions.find((s) => s.assignmentId === a.id && s.userId === c.viewer.user.id);
  const ext = c.db.extensions.find((e) => e.assignmentId === a.id && e.userId === c.viewer.user.id);
  return { a, sub, ext };
}

/** Final submissions are immutable (409). Otherwise the submission window must be open (422). */
function assertWritable(c: Ctx, a: AssignmentRow, sub: SubmissionRow | undefined, extDue?: string) {
  if (sub?.state === "submitted") throw conflict("SUBMISSION_FINAL", "This submission is final and can't be changed.");
  if (c.now < ms(a.opensAt)) throw invalid("NOT_OPEN", "This assignment isn't open for submissions yet.");
  const due = ms(extDue ?? a.dueAt);
  if (c.now > due) {
    if (a.latePolicy === "not_accepted") throw invalid("SUBMISSION_CLOSED", "The deadline has passed and late submissions aren't accepted.");
    if (a.closesAt && c.now > ms(a.closesAt)) throw invalid("SUBMISSION_CLOSED", "Late submissions for this assignment have closed.");
  }
}

function draftFor(c: Ctx, a: AssignmentRow, sub: SubmissionRow | undefined): SubmissionRow {
  if (sub) return sub;
  const row: SubmissionRow = { id: newId("sub"), assignmentId: a.id, userId: c.viewer.user.id, state: "draft", files: [], isLate: false };
  c.db.submissions.push(row);
  return row;
}

export function registerAssignments(r: Router) {
  r.get("/assignments", (c) => {
    const courseIds = courseFilter(c);
    const state = c.q("state") as PublishState | undefined;
    return c.db.assignments
      .filter((a) => courseIds.has(a.courseId) && (isStaffFor(c.viewer, a.courseId) || a.state === "published") && (!state || a.state === state))
      .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
      .map((a) => assignmentView(c.db, a, isStaffFor(c.viewer, a.courseId)));
  });

  r.get("/assignments/:id", (c) => {
    const { a, staff } = readableAssignment(c, c.params.id!);
    return assignmentView(c.db, a, staff);
  });

  r.post("/assignments", async (c) => {
    const b = await c.json<Partial<Assignment>>();
    const o = find(c.db.courses, b.courseId, "course");
    requirePerm(c.viewer, "assignments.manage", o.id);
    const row: AssignmentRow = { ...validateAssignment(c.db, b), id: newId("asg"), courseId: o.id, attachments: [], createdAt: iso(c.now) };
    c.db.assignments.push(row);
    ensureItem(c.db, { courseId: o.id, kind: "assignment", refId: row.id, title: row.title, maxScore: row.maxScore, weightPercent: row.weightPercent });
    if (row.state === "published") publishedNotice(c, row);
    audit(c.db, c.viewer.user, "assignment.created", "assignment", row.id, `Created "${row.title}" (${row.state})`);
    return assignmentView(c.db, row, true);
  });

  r.patch("/assignments/:id", async (c) => {
    const a = find(c.db.assignments, c.params.id, "assignment");
    requirePerm(c.viewer, "assignments.manage", a.courseId);
    const b = await c.json<Partial<Assignment>>();
    const wasDraft = a.state === "draft";
    Object.assign(a, validateAssignment(c.db, b, a));
    if (Array.isArray(b.attachments)) a.attachments = b.attachments;
    ensureItem(c.db, { courseId: a.courseId, kind: "assignment", refId: a.id, title: a.title, maxScore: a.maxScore, weightPercent: a.weightPercent });
    if (wasDraft && a.state === "published") publishedNotice(c, a);
    audit(c.db, c.viewer.user, "assignment.updated", "assignment", a.id, `Updated "${a.title}"`);
    return assignmentView(c.db, a, true);
  });

  r.delete("/assignments/:id", (c) => {
    const a = find(c.db.assignments, c.params.id, "assignment");
    requirePerm(c.viewer, "assignments.manage", a.courseId);
    if (c.db.submissions.some((s) => s.assignmentId === a.id && s.state === "submitted")) {
      throw conflict("HAS_SUBMISSIONS", "Students have already submitted final work for this assignment, so it can't be deleted.");
    }
    c.db.assignments = c.db.assignments.filter((x) => x.id !== a.id);
    c.db.submissions = c.db.submissions.filter((s) => s.assignmentId !== a.id);
    const item = itemFor(c.db, "assignment", a.id);
    if (item) {
      c.db.gradeItems = c.db.gradeItems.filter((i) => i.id !== item.id);
      c.db.gradeCells = c.db.gradeCells.filter((x) => x.itemId !== item.id);
    }
    audit(c.db, c.viewer.user, "assignment.deleted", "assignment", a.id, `Deleted "${a.title}"`);
  });

  /* ── student ── */
  r.get("/assignments/:id/submission", (c) => {
    const { a } = readableAssignment(c, c.params.id!);
    const sub = c.db.submissions.find((s) => s.assignmentId === a.id && s.userId === c.viewer.user.id);
    return sub ? submissionView(c.db, sub) : virtualSubmission(c.db, a.id, c.viewer.user.id);
  });

  r.put("/assignments/:id/submission/draft", async (c) => {
    const { a, sub, ext } = mySubmissionCtx(c, c.params.id!);
    assertWritable(c, a, sub, ext?.newDueAt);
    const b = await c.json<{ textHtml?: string }>();
    if (b.textHtml !== undefined && !a.allowText) throw invalid("TEXT_NOT_ALLOWED", "This assignment only accepts file uploads.");
    const row = draftFor(c, a, sub);
    if (b.textHtml !== undefined) row.textHtml = String(b.textHtml);
    return submissionView(c.db, row);
  });

  r.post("/assignments/:id/submission/files", async (c) => {
    const { a, sub, ext } = mySubmissionCtx(c, c.params.id!);
    assertWritable(c, a, sub, ext?.newDueAt);
    if (!a.allowFiles) throw invalid("FILES_NOT_ALLOWED", "This assignment only accepts typed answers.");
    const file = await fileFromForm(c);
    const extn = (file.name.split(".").pop() ?? "").toLowerCase();
    if (a.allowedFileTypes.length && !a.allowedFileTypes.includes(extn)) {
      throw invalid("FILE_TYPE_NOT_ALLOWED", `Only ${a.allowedFileTypes.map((t) => t.toUpperCase()).join(", ")} files are accepted.`);
    }
    const row = draftFor(c, a, sub);
    if (row.files.length >= 5) throw invalid("TOO_MANY_FILES", "You can attach at most 5 files.");
    const att = attachmentFromFile(file, a.maxFileSizeMb);
    row.files.push(att);
    return att;
  });

  r.delete("/assignments/:id/submission/files/:fileId", (c) => {
    const { a, sub, ext } = mySubmissionCtx(c, c.params.id!);
    assertWritable(c, a, sub, ext?.newDueAt);
    if (!sub || !sub.files.some((f) => f.id === c.params.fileId)) throw notFound("file");
    sub.files = sub.files.filter((f) => f.id !== c.params.fileId);
  });

  r.post("/assignments/:id/submission/final", async (c) => {
    const { a, sub, ext } = mySubmissionCtx(c, c.params.id!);
    assertWritable(c, a, sub, ext?.newDueAt);
    const b = await c.json<{ confirm?: boolean }>();
    if (b.confirm !== true) throw invalid("CONFIRMATION_REQUIRED", "Confirm that you understand this submission is final.");
    const hasText = !!sub?.textHtml?.replace(/<[^>]+>/g, "").trim();
    if (!sub || (!hasText && !sub.files.length)) throw invalid("EMPTY_SUBMISSION", "Add your answer or attach a file before submitting.");
    const prefix = c.db.courses.find((o) => o.id === a.courseId)!.classCodePrefix;
    sub.state = "submitted";
    sub.submittedAt = iso(c.now);
    sub.isLate = c.now > ms(ext?.newDueAt ?? a.dueAt);
    sub.receiptCode = `TAS-${prefix}-${rand.alnum(5)}`;
    notify(c.db, [c.viewer.user.id], {
      kind: "submission_receipt",
      title: "Submission received",
      body: `${courseOf(c.db, a.courseId).code} "${a.title}" submitted${sub.isLate ? " (late)" : ""}. Receipt ${sub.receiptCode}.`,
      link: `/assignments/${a.id}`,
    }, c.now);
    audit(c.db, c.viewer.user, "submission.finalised", "submission", sub.id, `Final submission for "${a.title}" — receipt ${sub.receiptCode}${sub.isLate ? " (late)" : ""}`);
    return submissionView(c.db, sub);
  });

  /* ── staff ── */
  r.get("/assignments/:id/submissions", (c) => {
    const a = find(c.db.assignments, c.params.id, "assignment");
    requirePerm(c.viewer, ["assignments.grade", "assignments.manage"], a.courseId);
    const out: Submission[] = activeStudentIds(c.db, a.courseId).map((uid) => {
      const s = c.db.submissions.find((x) => x.assignmentId === a.id && x.userId === uid);
      return s ? submissionView(c.db, s, { staff: true }) : virtualSubmission(c.db, a.id, uid);
    });
    const rank = (s: Submission) => (s.state === "submitted" ? (s.grade ? 1 : 0) : s.state === "draft" ? 2 : 3);
    return out.sort((x, y) => rank(x) - rank(y) || (x.studentName ?? "").localeCompare(y.studentName ?? ""));
  });

  r.put("/assignments/:id/submissions/:submissionId/grade", async (c) => {
    const a = find(c.db.assignments, c.params.id, "assignment");
    requirePerm(c.viewer, "assignments.grade", a.courseId);
    const sub = c.db.submissions.find((s) => s.id === c.params.submissionId && s.assignmentId === a.id);
    if (!sub) throw notFound("submission");
    if (sub.state !== "submitted") throw conflict("NOT_SUBMITTED", "Only final submissions can be graded.");
    const b = await c.json<{ score?: number; feedbackHtml?: string }>();
    const raw = asNumber(b.score);
    if (raw === undefined || raw < 0 || raw > a.maxScore) throw validation({ score: `Score must be between 0 and ${a.maxScore}` });
    let penalty = 0;
    if (sub.isLate && a.latePolicy === "accepted_with_penalty" && sub.submittedAt) {
      const ext = c.db.extensions.find((e) => e.assignmentId === a.id && e.userId === sub.userId);
      const days = Math.ceil((ms(sub.submittedAt) - ms(ext?.newDueAt ?? a.dueAt)) / DAY);
      penalty = Math.round(raw * ((a.latePenaltyPercentPerDay ?? 0) * Math.max(0, days)) / 100 * 10) / 10;
    }
    const score = Math.max(0, Math.round((raw - penalty) * 10) / 10);
    const item = ensureItem(c.db, { courseId: a.courseId, kind: "assignment", refId: a.id, title: a.title, maxScore: a.maxScore, weightPercent: a.weightPercent });
    sub.grade = {
      score,
      maxScore: a.maxScore,
      latePenaltyApplied: penalty,
      feedbackHtml: b.feedbackHtml ?? sub.grade?.feedbackHtml,
      gradedBy: c.viewer.user.fullName,
      gradedAt: iso(c.now),
      released: item.released,
    };
    const prev = getCellScore(c.db, item.id, sub.userId);
    putCell(c.db, item.id, sub.userId, score);
    if (prev !== null && prev !== score) logChange(c.db, a.courseId, item.id, sub.userId, prev, score, "Submission re-graded", c.viewer.user.fullName, c.now);
    if (item.released) notify(c.db, [sub.userId], { kind: "grade_released", title: "Grade updated", body: `Your grade for "${a.title}" is available.`, link: `/assignments/${a.id}` }, c.now);
    audit(c.db, c.viewer.user, "submission.graded", "submission", sub.id, `Graded ${c.db.users.find((u) => u.id === sub.userId)?.fullName}: ${score}/${a.maxScore}${penalty ? ` (late penalty ${penalty})` : ""}`);
    return submissionView(c.db, sub, { staff: true });
  });

  r.post("/assignments/:id/release", (c) => {
    const a = find(c.db.assignments, c.params.id, "assignment");
    requirePerm(c.viewer, "grades.release", a.courseId);
    const item = ensureItem(c.db, { courseId: a.courseId, kind: "assignment", refId: a.id, title: a.title, maxScore: a.maxScore, weightPercent: a.weightPercent });
    item.released = true;
    const newly = c.db.submissions.filter((s) => s.assignmentId === a.id && s.grade && !s.grade.released);
    c.db.submissions.forEach((s) => s.assignmentId === a.id && s.grade && (s.grade.released = true));
    notify(c.db, newly.map((s) => s.userId), { kind: "grade_released", title: "Grade released", body: `Your grade for "${a.title}" is now available.`, link: `/assignments/${a.id}` }, c.now);
    audit(c.db, c.viewer.user, "grades.released", "assignment", a.id, `Released grades for "${a.title}" (${newly.length} students)`);
    return { released: newly.length };
  });

  r.get("/assignments/:id/extensions", (c) => {
    const a = find(c.db.assignments, c.params.id, "assignment");
    requirePerm(c.viewer, ["assignments.manage", "assignments.grade"], a.courseId);
    return c.db.extensions.filter((e) => e.assignmentId === a.id).sort((x, y) => y.grantedAt.localeCompare(x.grantedAt));
  });

  r.post("/assignments/:id/extensions", async (c) => {
    const a = find(c.db.assignments, c.params.id, "assignment");
    requirePerm(c.viewer, "assignments.manage", a.courseId);
    const b = await c.json<{ userId?: string; newDueAt?: string; reason?: string }>();
    const errs: Record<string, string> = {};
    if (!b.userId || !activeStudentIds(c.db, a.courseId).includes(b.userId)) errs.userId = "Choose a student enrolled in this course";
    if (!isIsoDate(b.newDueAt) || ms(b.newDueAt) <= Math.max(c.now, ms(a.dueAt))) errs.newDueAt = "New due date must be in the future and after the original due date";
    if (!asString(b.reason)) errs.reason = "Give a reason for the extension";
    if (Object.keys(errs).length) throw validation(errs);
    if (c.db.submissions.some((s) => s.assignmentId === a.id && s.userId === b.userId && s.state === "submitted")) {
      throw conflict("SUBMISSION_FINAL", "This student has already submitted final work.");
    }
    c.db.extensions = c.db.extensions.filter((e) => !(e.assignmentId === a.id && e.userId === b.userId));
    const ext = { id: newId("ext"), assignmentId: a.id, userId: b.userId!, studentName: c.db.users.find((u) => u.id === b.userId)!.fullName, newDueAt: b.newDueAt!, reason: asString(b.reason), grantedBy: c.viewer.user.fullName, grantedAt: iso(c.now) };
    c.db.extensions.push(ext);
    notify(c.db, [ext.userId], { kind: "assignment_due_soon", title: "Extension granted", body: `You have an extension for "${a.title}".`, link: `/assignments/${a.id}` }, c.now);
    audit(c.db, c.viewer.user, "extension.granted", "assignment", a.id, `Granted extension to ${ext.studentName} for "${a.title}"`);
    return ext;
  });
}

function publishedNotice(c: Ctx, a: AssignmentRow) {
  notify(c.db, activeStudentIds(c.db, a.courseId), { kind: "assignment_published", title: `${courseOf(c.db, a.courseId).code}: new assignment`, body: `"${a.title}" is due ${fmtShort(ms(a.dueAt))}.`, link: `/assignments/${a.id}` }, c.now);
}
