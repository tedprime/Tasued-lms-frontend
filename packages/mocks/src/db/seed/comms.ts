import type { IntegrationHealth } from "@tasued/api-client";
import { DAY, HOUR, iso, MIN, ms } from "../../lib/dates";
import type { Random } from "../../lib/random";
import { activeStudentIds } from "../ops/common";
import { ensureItem, logChange, putCell } from "../ops/grades";
import type { AnnouncementRow, DB, NotificationRow } from "../schema";
import { currentOrNextClass } from "./classes";
import { AIIE_COURSE_ID, DEMO_STUDENT_IDS } from "./ids";
import { diligence, participates } from "./people";

export function seedManualGrades(db: DB, now: number, r: Random) {
  const item = ensureItem(db, { id: "gbi-manual-aiie111", courseId: AIIE_COURSE_ID, kind: "manual", title: "Class participation", maxScore: 10, weightPercent: 10, released: false });
  for (const uid of activeStudentIds(db, AIIE_COURSE_ID)) {
    if (!participates(db, uid) || r.chance(0.08)) continue;
    putCell(db, item.id, uid, Math.round(Math.min(10, 10 * (diligence(uid) + r.float(-0.12, 0.08))) * 2) / 2);
  }
  const changes: [string, string, string, number][] = [
    ["gbi-manual-aiie111", "stu-adaeze", "Re-scored after reviewing forum contributions log", 4],
    ["gbi-asg-aiie-myths", "stu-tunde", "Re-marked on appeal — the second myth was overlooked", 9],
  ];
  for (const [itemId, uid, reason, daysAgo] of changes) {
    const cur = db.gradeCells.find((c) => c.itemId === itemId && c.userId === uid)?.score;
    if (cur === undefined || cur === null) continue;
    logChange(db, AIIE_COURSE_ID, itemId, uid, Math.max(0, cur - 1.5), cur, reason, "Dr. Adebayo Ogunleye", now - daysAgo * DAY);
  }
}

export function seedAnnouncements(db: DB, now: number) {
  const a = (x: Omit<AnnouncementRow, "readBy" | "sendEmail" | "isPinned" | "courseId"> & Partial<AnnouncementRow>): AnnouncementRow => ({ courseId: AIIE_COURSE_ID, readBy: [], sendEmail: true, isPinned: false, ...x });
  const next = currentOrNextClass(db, now);
  db.announcements.push(
    a({ id: "ann-01", title: "Welcome to AIIE 111", authorId: "stf-ogunleye", publishedAt: iso(now - 30 * DAY), isPinned: true, readBy: ["stu-adaeze", "stu-chiamaka", "stu-tunde"],
      bodyHtml: "<p>Welcome to <strong>Foundation of Artificial Intelligence and Digital Productivity</strong>. All live classes hold on <strong>Microsoft Teams</strong> on Mondays, Wednesdays and Fridays, 10:00–12:00 and 14:00–16:00. The course text for every unit — the whole student handout — is on this LMS, with the class recordings above it.</p><p>Sign in to the LMS with your email and the password you set from your invitation email, and accept the Teams guest invitation sent to the same address so you can join classes.</p>" }),
    a({ id: "ann-02", title: "Quiz 2 is now open", authorId: "stf-ogunleye", publishedAt: iso(now - 1 * DAY + 2 * HOUR), isPinned: true,
      bodyHtml: "<p>Quiz 2 (Part B: AI for Productivity and Learning, Modules 6–7) is open for a week. You have 20 minutes and two attempts; your best score counts. Read Units 6.2–6.4 and 7.2–7.4 first.</p>" }),
    a({ id: "ann-03", title: "Assignment 1 grades released", authorId: "stf-ogunleye", publishedAt: iso(now - 12 * DAY), readBy: ["stu-adaeze", "stu-tunde"],
      bodyHtml: "<p>Grades and feedback for Assignment 1 (AI Myths and Why AI Literacy Matters) are now available. The strongest answers corrected each myth with the reality column of the table in Unit 1.3 and an example of their own.</p>" }),
    a({ id: "ann-04", title: "Prompt Journal due in 3 days", authorId: "stf-nwosu", publishedAt: iso(now - 6 * HOUR), sendEmail: false,
      bodyHtml: "<p>A reminder that Assignment 2 (Prompt Journal) is due in three days at 23:59. Submission is final: once you press <em>Submit final</em> you cannot change it, so check your AI-use statement before you submit.</p>" }),
    a({ id: "ann-05", title: "This week: Module 6 — bring a document to work on", authorId: "stf-ogunleye", publishedAt: iso(now - 2 * DAY), readBy: ["stu-adaeze"],
      bodyHtml: `<p>This week we start Part B with Module 6, AI for Productivity. Bring a real document, slide deck or spreadsheet from another course to class — we will improve it with AI and check the result together.${next ? ` Next class: <strong>${next.title}</strong>.` : ""}</p>` }),
    a({ id: "ann-06", title: "Quiz 1 results are available", authorId: "stf-ogunleye", publishedAt: iso(now - 1 * DAY - 3 * HOUR), sendEmail: false, readBy: ["stu-chiamaka"],
      bodyHtml: "<p>Quiz 1 (Part A: Understanding AI) has closed and your results are available on the quiz page. Essay answers still being marked will be updated this week.</p>" }),
  );
}

export function seedNotifications(db: DB, now: number) {
  const n = (userId: string, kind: NotificationRow["kind"], title: string, body: string, link: string, hoursAgo: number, read: boolean) =>
    db.notifications.push({ id: `ntf-${userId.slice(4)}-${db.notifications.length + 1}`, userId, kind, title, body, link, createdAt: iso(now - hoursAgo * HOUR), read });
  const rec = db.recordings.filter((x) => x.status === "ready").sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))[0];
  const next = currentOrNextClass(db, now);
  const C = `/courses/${AIIE_COURSE_ID}`;

  for (const uid of DEMO_STUDENT_IDS) {
    if (rec) n(uid, "recording_ready", "AIIE 111: new recording available", `"${rec.title}" is now available.`, `${C}/units/${rec.unitIds[0] ?? ""}`, Math.max(0.2, (now - ms(rec.createdAt)) / HOUR), false);
    n(uid, "quiz_open", "Quiz 2 is open", "AIIE 111 Quiz 2: AI for Productivity and Learning closes in 6 days.", "/quizzes/quiz-aiie-2", 22, false);
    n(uid, "assignment_due_soon", "Due in 3 days", "Assignment 2: Prompt Journal is due soon.", "/assignments/asg-aiie-prompt-journal", 10, uid !== "stu-adaeze");
    n(uid, "grade_released", "Grade released", "Your grade for \"Assignment 1: AI Myths and Why AI Literacy Matters\" is available.", "/assignments/asg-aiie-myths", 12 * 24, true);
    if (next) n(uid, "class_reminder", "Class reminder", `AIIE 111: "${next.title}" is next on Teams.`, `${C}/classes`, 0.85, false);
    n(uid, "announcement", "AIIE 111: Quiz 2 is now open", "Dr. Adebayo Ogunleye posted an announcement.", `${C}/announcements`, 21, true);
  }
  n("stu-adaeze", "forum_reply", "New reply to your question", "Mr. Emeka Nwosu replied to \"My prompts keep giving American examples\".", "/forum/thr-03", 6 * 24, true);
  n("stu-chiamaka", "forum_reply", "Your question has an accepted answer", "Dr. Adebayo Ogunleye answered \"Prompt Journal: do we need screenshots for all five tasks?\"", "/forum/thr-06", 3 * 24, false);
  n("stu-tunde", "forum_reply", "Your question has an accepted answer", "Dr. Adebayo Ogunleye answered \"Is ChatGPT the same thing as Copilot?\"", "/forum/thr-02", 15 * 24, true);
  n("stu-tunde", "submission_receipt", "Submission received", "AIIE 111 Prompt Journal submitted. Keep your receipt code.", "/assignments/asg-aiie-prompt-journal", 26, true);

  // Staff (admin app links)
  const O = `/courses/${AIIE_COURSE_ID}`;
  n("stf-ogunleye", "forum_reply", "Reported post in AIIE 111", "A post in \"Group formation for the needs-finding brief\" was reported twice.", "/forum/threads/thr-12", 8, false);
  n("stf-ogunleye", "recording_ready", "Recording ready", "Your latest AIIE 111 recording was found in OneDrive and is now available to students.", `${O}/recordings`, 30, true);
  n("stf-ogunleye", "recording_ready", "Recording not found", "A recent AIIE 111 recording was not found in the organiser's OneDrive. Relink it or upload the file.", `${O}/recordings`, 6 * 24, false);
  n("stf-nwosu", "forum_reply", "New question in AIIE 111", "\"Does the NDPA apply to our class WhatsApp group?\" has no answer yet.", "/forum/threads/thr-09", 40, false);
}

const AUDIT_TEMPLATES: [string, string, string, (r: Random) => string][] = [
  ["auth.signed_in", "user", "stf-ogunleye", () => "Signed in with Microsoft 365"],
  ["grade.changed", "grade", "gbi-asg-aiie-myths", () => "Changed grade for Tunde Bakare from 6 to 7.5 (re-marked on appeal)"],
  ["submission.finalised", "submission", "asg-aiie-prompt-journal", (r) => `Final submission received — receipt TAS-AIIE111-${r.alnum(5)}`],
  ["attendance.finalised", "class", "cls-aiie111-07", () => "Finalised attendance for AIIE111-S07 (49 present, 3 late, 5 absent)"],
  ["recording.published", "recording", "rec-aiie111-07", () => "Recording published to 2.1 Early Ideas and Foundations"],
  ["recording.not_found", "recording", "rec-aiie111-20", () => "Recording not found in the organiser's OneDrive — it may have been moved or deleted"],
  ["recording.linked", "recording", "rec-aiie111-07", () => "Linked Teams recording AIIE111-S07-Recording.mp4 from the organiser's OneDrive"],
  ["invite.sent", "user", "stu-007", () => "Resent LMS set-password invitation and Teams guest invitation"],
  ["password.reset_requested", "user", "stu-chiamaka", () => "Sent a password reset email to Chiamaka Eze"],
  ["class.scheduled", "class", "ser-aiie111-1", () => "Scheduled weekly series (13 classes, Mondays 10:00) for AIIE 111"],
  ["class.scheduled", "class", "ser-aiie111-2", () => "Scheduled weekly series (13 classes, Mondays 14:00) for AIIE 111"],
  ["content.published", "unit", "unt-aiie111-1-1", () => "Published 73 units of the AIIE 111 handout (15 modules)"],
  ["content.updated", "unit", "unt-aiie111-6-4", () => "Updated course text for 6.4 Spreadsheets"],
  ["quiz.published", "quiz", "quiz-aiie-2", () => "Published Quiz 2: AI for Productivity and Learning (Part B)"],
  ["assignment.published", "assignment", "asg-aiie-prompt-journal", () => "Published Assignment 2: Prompt Journal"],
  ["grades.released", "assignment", "asg-aiie-myths", () => "Released grades for 52 submissions"],
  ["people.imported", "import", "imp-2026-0915", () => "Imported 60 students (60 LMS invitations and 60 Teams guest invitations sent)"],
  ["role.assigned", "user", "stf-nwosu", () => "Assigned Teaching assistant on AIIE 111"],
  ["role.assigned", "user", "stf-ogunleye", () => "Assigned Lecturer on AIIE 111"],
  ["user.deactivated", "user", "stu-019", () => "Suspended account pending disciplinary review"],
  ["forum.post_hidden", "post", "thr-13-p1", () => "Locked thread \"Anyone selling the AIIE 111 handout?\""],
  ["settings.updated", "settings", "platform", () => "Changed maximum upload size from 25 MB to 50 MB"],
  ["integration.subscription_renewed", "subscription", "sub-meetings", () => "Renewed Graph change-notification subscription for online meetings"],
  ["extension.granted", "assignment", "asg-aiie-prompt-journal", () => "Granted extension on the Prompt Journal to an AIIE 111 student (medical)"],
];
const ACTORS: Record<string, string> = {
  "auth.signed_in": "stf-ogunleye", "grade.changed": "stf-ogunleye", "submission.finalised": "stu-adaeze", "attendance.finalised": "stf-ogunleye",
  "recording.published": "stf-ogunleye", "recording.not_found": "system", "recording.linked": "system", "invite.sent": "stf-super", "password.reset_requested": "stf-super", "class.scheduled": "stf-ogunleye",
  "content.published": "stf-ogunleye", "content.updated": "stf-ogunleye", "quiz.published": "stf-ogunleye", "assignment.published": "stf-ogunleye",
  "grades.released": "stf-ogunleye", "people.imported": "stf-super", "role.assigned": "stf-super", "user.deactivated": "stf-super",
  "forum.post_hidden": "stf-ogunleye", "settings.updated": "stf-super", "integration.subscription_renewed": "system", "extension.granted": "stf-ogunleye",
};

export function seedAudit(db: DB, now: number, r: Random) {
  const IPS = ["102.89.34.12", "105.112.40.77", "197.210.53.9", "41.184.22.150", "102.91.4.33"];
  for (let i = 0; i < 42; i++) {
    const [action, targetType, targetId, summary] = AUDIT_TEMPLATES[i % AUDIT_TEMPLATES.length]!;
    const actorId = ACTORS[action] ?? "stf-super";
    const actor = actorId === "system" ? "System (Graph worker)" : db.users.find((u) => u.id === actorId)?.fullName ?? "System";
    db.audit.push({ id: `aud-seed-${String(i + 1).padStart(2, "0")}`, at: iso(now - (i * 7.5 + r.int(0, 6)) * HOUR - r.int(0, 59) * MIN), actor, actorId, action, targetType, targetId, summary: summary(r), ip: actorId === "system" ? undefined : r.pick(IPS) });
  }
  db.audit.sort((a, b) => b.at.localeCompare(a.at));
}

export function makeHealth(now: number): IntegrationHealth {
  const ok = (h: number) => iso(now - h * MIN);
  return {
    checkedAt: iso(now - 4 * MIN),
    overall: "degraded",
    checks: [
      { key: "graph_auth", label: "Microsoft Graph authentication", state: "ok", detail: "App-only token issued; certificate valid for 211 days.", lastSuccessAt: ok(4) },
      { key: "meeting_creation", label: "Teams meeting creation", state: "ok", detail: "Meetings are created by classes@lms.tasued-online.ng with auto-record on. Last: AIIE111 series without errors.", lastSuccessAt: ok(95) },
      { key: "change_notifications", label: "Change notifications", state: "degraded", detail: "Subscription for /communications/onlineMeetings expires in 26 hours; automatic renewal is scheduled but the last renewal attempt was throttled (HTTP 429).", lastSuccessAt: ok(26 * 60) },
      { key: "recording_lookup", label: "Recording lookup in OneDrive", state: "ok", detail: "Recordings found in the organiser's OneDrive for all ended classes except 1 (file not found). 1 waiting for Teams to save.", lastSuccessAt: ok(70) },
      { key: "recording_playback", label: "Recording playback", state: "ok", detail: "Playback links issued from OneDrive (10-minute expiry). 1,284 links issued in the last 24 hours.", lastSuccessAt: ok(2) },
      { key: "attendance_import", label: "Teams attendance import", state: "ok", detail: "Attendance reports fetched for all ended meetings.", lastSuccessAt: ok(40) },
      { key: "guest_invitations", label: "Teams guest invitations", state: "ok", detail: "3 invitations bounced this week; 4 students haven't accepted their invitation yet.", lastSuccessAt: ok(3 * 60) },
      { key: "email_delivery", label: "Email delivery", state: "ok", detail: "Invitation and password-reset emails delivered; 2 soft bounces retried.", lastSuccessAt: ok(20) },
    ],
    subscriptions: [
      { id: "sub-meetings", resource: "/communications/onlineMeetings", expiresAt: iso(now + 26 * HOUR), state: "degraded" },
      { id: "sub-callrecords", resource: "/communications/callRecords", expiresAt: iso(now + 2.5 * DAY), state: "ok" },
      { id: "sub-drive", resource: "/drives/{organiser-drive}/root", expiresAt: iso(now + 2 * DAY), state: "ok" },
    ],
    recentJobs: [
      { id: "job-1", type: "recording.lookup", state: "running", at: iso(now - 12 * MIN), detail: "AIIE111 latest class — waiting for Teams to save the recording" },
      { id: "job-2", type: "attendance.import", state: "succeeded", at: iso(now - 40 * MIN), detail: "AIIE111: 54 participants, 2 unmatched" },
      { id: "job-3", type: "subscription.renew", state: "failed", at: iso(now - 2 * HOUR), detail: "429 Too Many Requests — will retry" },
      { id: "job-4", type: "recording.lookup", state: "failed", at: iso(now - 7 * DAY), detail: "AIIE111: recording not found in the organiser's OneDrive" },
      { id: "job-5", type: "meeting.create", state: "succeeded", at: iso(now - 26 * HOUR), detail: "AIIE111 series (78 meetings)" },
      { id: "job-6", type: "invites.send", state: "succeeded", at: iso(now - 3 * DAY), detail: "60 LMS invitations, 60 Teams guest invitations" },
      { id: "job-7", type: "recording.lookup", state: "succeeded", at: iso(now - 70 * MIN), detail: "AIIE111 — linked from OneDrive" },
    ],
  };
}
