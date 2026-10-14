import type { Attachment, LatePolicy } from "@tasued/api-client";
import { DAY, HOUR, iso, lagosAt, ms } from "../../lib/dates";
import type { Random } from "../../lib/random";
import { activeStudentIds } from "../ops/common";
import { ensureItem, putCell } from "../ops/grades";
import type { AssignmentRow, DB, SubmissionRow } from "../schema";
import { AIIE_COURSE_ID, unitId } from "./ids";
import { diligence, participates } from "./people";

type Kind = "open" | "due_soon" | "graded_released" | "graded_unreleased" | "past_due_late" | "past_not_accepted" | "upcoming" | "draft";
type DemoState = "none" | "draft" | "submitted" | "late" | "graded";

interface Spec {
  id: string;
  courseId: string;
  title: string;
  html: string;
  kind: Kind;
  maxScore: number;
  weight: number;
  latePolicy?: LatePolicy;
  text?: boolean;
  files?: boolean;
  /** handout unit codes, e.g. "5.2" */
  units: string[];
  demo?: Record<string, DemoState>;
}

const SPECS: Spec[] = [
  { id: "asg-aiie-myths", courseId: AIIE_COURSE_ID, title: "Assignment 1: AI Myths and Why AI Literacy Matters", kind: "graded_released", maxScore: 10, weight: 10, units: ["1.3", "1.4"],
    html: "<p>Choose <strong>two</strong> of the myths in Unit 1.3 (for example “AI thinks and understands like humans” or “AI is always right”) that you have heard on campus, at home or on social media.</p><ol><li>Describe where you met each myth and why it is persuasive (the “grain of truth”).</li><li>Correct it using the reality column of the myths table and one example of your own.</li><li>In one paragraph, explain why AI literacy matters for you as a future teacher (Unit 1.4).</li></ol><p>400–500 words. Submit as PDF or Word, or type your answer in the box.</p>",
    demo: { "stu-adaeze": "graded", "stu-tunde": "graded", "stu-chiamaka": "graded" } },
  { id: "asg-aiie-prompt-journal", courseId: AIIE_COURSE_ID, title: "Assignment 2: Prompt Journal", kind: "open", maxScore: 20, weight: 15, units: ["5.2", "5.3", "5.4", "5.5"],
    html: "<p>Use an AI assistant for <strong>five real tasks</strong> from your studies this week (for example a summary of lecture notes, practice questions, or an outline). For each task record:</p><ol><li>Your first prompt and the output (paste or screenshot).</li><li>Which of the five components (role, task, context, format, constraints — Unit 5.2) were missing, and an improved prompt that adds them.</li><li>At least one follow-up prompt that narrows, expands, adjusts, restructures or corrects the output (Unit 5.4), and the result.</li><li>Two sentences on what changed and whether the final output was accurate. Note any prompting mistakes from Unit 5.5 you made.</li></ol><p>End with a short AI-use statement (see the sample in Unit 11.4). Max 10 pages, PDF or Word. Keep your best prompts: they become the first item in your portfolio (Module 14).</p><blockquote><p>Remember: once you press <em>Submit final</em> your submission cannot be changed.</p></blockquote>",
    demo: { "stu-adaeze": "draft", "stu-tunde": "submitted", "stu-chiamaka": "none" } },
  { id: "asg-aiie-needs-brief", courseId: AIIE_COURSE_ID, title: "Assignment 3: Problem Identification and Needs-Finding Brief", kind: "upcoming", maxScore: 30, weight: 20, units: ["9.1", "9.2", "9.3", "9.5"],
    html: "<p>Working in groups of four or five, identify a real problem faced by students or teachers on or around campus and investigate it before proposing any solution.</p><ol><li>Interview at least five people affected, using open, non-leading questions (Unit 9.2). Attach your interview guide.</li><li>Summarise what you learned in an empathy map and one user persona (Unit 9.3).</li><li>Write a problem statement using the formula <em>[User] needs a way to [need] because [insight]</em>.</li><li>Describe the cheapest test that could prove your riskiest assumption wrong (Unit 9.5).</li></ol><p>If you used AI to draft questions or group themes, say how, and remove names and identifying details before pasting any notes into an AI tool (Unit 12.3). Three pages maximum.</p>" },
];

function timeline(kind: Kind, now: number) {
  const due = (d: number) => lagosAt(now, d, 23, 59);
  const open = (d: number) => lagosAt(now, d, 8, 0);
  switch (kind) {
    case "graded_released": return { opensAt: open(-24), dueAt: due(-16) };
    case "graded_unreleased": return { opensAt: open(-18), dueAt: due(-7) };
    case "past_due_late": return { opensAt: open(-12), dueAt: due(-2), closesAt: due(4) };
    case "past_not_accepted": return { opensAt: open(-10), dueAt: due(-1) };
    case "open": return { opensAt: open(-8), dueAt: due(3) };
    case "due_soon": return { opensAt: open(-7), dueAt: due(1) };
    case "upcoming": return { opensAt: open(16), dueAt: due(30) };
    case "draft": return { opensAt: open(10), dueAt: due(24) };
  }
}

const TEXTS = [
  "<p>In this submission I have addressed each part of the brief. My main argument is developed in three sections, each supported with examples from the course text and from my own experience in Ijebu-Ode.</p>",
  "<p>Please find my work attached. I used the structure recommended in class and checked all facts against the course text.</p>",
  "<p>My answers are below and in the attached file. AI-use statement: I used Microsoft Copilot to check grammar only; every example and source is my own and was checked.</p>",
];
const FEEDBACK = [
  "<p>Good work — clear structure and relevant examples. Tighten your conclusion.</p>",
  "<p>Solid understanding shown. Your second myth needs a clearer correction — use the reality column from Unit 1.3.</p>",
  "<p>Excellent. Well argued and well referenced.</p>",
  "<p>Fair attempt, but several steps are missing. See me during office hours.</p>",
];

export function receiptCode(prefix: string, r: Random) {
  return `TAS-${prefix}-${r.alnum(5)}`;
}

export function seedAssignments(db: DB, now: number, r: Random) {
  for (const s of SPECS) {
    const t = timeline(s.kind, now);
    const prefix = db.courses.find((o) => o.id === s.courseId)!.classCodePrefix;
    const a: AssignmentRow = {
      id: s.id,
      courseId: s.courseId,
      title: s.title,
      instructionsHtml: s.html,
      attachments: [],
      unitIds: s.units.map(unitId).filter((id) => db.units.some((u) => u.id === id)),
      opensAt: iso(t.opensAt),
      dueAt: iso(t.dueAt),
      closesAt: t.closesAt ? iso(t.closesAt) : undefined,
      latePolicy: s.latePolicy ?? "not_accepted",
      latePenaltyPercentPerDay: s.latePolicy === "accepted_with_penalty" ? 10 : undefined,
      maxScore: s.maxScore,
      weightPercent: s.weight,
      allowText: s.text !== false,
      allowFiles: s.files !== false,
      allowedFileTypes: ["pdf", "docx"],
      maxFileSizeMb: 10,
      state: s.kind === "draft" ? "draft" : "published",
      createdAt: iso(t.opensAt - 3 * DAY),
    };
    db.assignments.push(a);
    if (a.state === "draft") continue;

    const released = s.kind === "graded_released";
    const item = ensureItem(db, { id: `gbi-${s.id}`, courseId: s.courseId, kind: "assignment", refId: s.id, title: s.title, maxScore: s.maxScore, weightPercent: s.weight, released });
    if (s.kind === "upcoming") continue;

    const graded = s.kind.startsWith("graded");
    const lecturer = db.users.find((u) => u.id === db.courses.find((o) => o.id === s.courseId)!.lecturerIds[0]);
    const pSubmit = { open: 0.35, due_soon: 0.45, past_due_late: 0.7, past_not_accepted: 0.85, graded_released: 0.92, graded_unreleased: 0.9, upcoming: 0, draft: 0 }[s.kind];

    for (const userId of activeStudentIds(db, s.courseId).filter((id) => participates(db, id))) {
      const user = db.users.find((u) => u.id === userId)!;
      const dil = diligence(userId);
      let state: DemoState;
      if (s.demo && userId in s.demo) state = s.demo[userId]!;
      else if (r.chance(pSubmit * (0.6 + dil * 0.5))) {
        state = s.kind === "past_due_late" && r.chance(0.2) ? "late" : graded ? "graded" : s.kind === "past_due_late" && r.chance(0.5) ? "graded" : "submitted";
      } else state = (s.kind === "open" || s.kind === "due_soon") && r.chance(0.3) ? "draft" : "none";
      if (state === "none") continue;

      const due = ms(a.dueAt);
      const isLate = state === "late";
      const submittedAt = isLate ? due + r.int(6, 40) * HOUR : Math.min(now - HOUR, due - r.int(1, 120) * HOUR);
      const files: Attachment[] = a.allowFiles && (state !== "draft" || r.chance(0.5))
        ? [{ id: `${s.id}-${userId}-f1`, name: `${user.matricNumber}_${s.id.replace("asg-", "").toUpperCase()}.pdf`, mimeType: "application/pdf", sizeBytes: r.int(120, 2400) * 1024, url: "#", scanStatus: "clean" }]
        : [];
      const sub: SubmissionRow = {
        id: `sub-${s.id}-${userId}`,
        assignmentId: s.id,
        userId,
        state: state === "draft" ? "draft" : "submitted",
        textHtml: a.allowText ? r.pick(TEXTS) : undefined,
        files,
        isLate,
      };
      if (sub.state === "submitted") {
        sub.submittedAt = iso(submittedAt);
        sub.receiptCode = receiptCode(prefix, r);
      }
      if (state === "graded" || (isLate && s.kind === "past_due_late" && r.chance(0.5))) {
        const raw = Math.round(s.maxScore * Math.min(1, Math.max(0.35, dil + r.float(-0.15, 0.08))) * 2) / 2;
        const lateDays = isLate ? Math.ceil((submittedAt - due) / DAY) : 0;
        const penalty = a.latePolicy === "accepted_with_penalty" ? Math.round(raw * ((a.latePenaltyPercentPerDay ?? 0) * lateDays) / 100 * 2) / 2 : 0;
        const score = Math.max(0, raw - penalty);
        sub.grade = {
          score,
          maxScore: s.maxScore,
          latePenaltyApplied: penalty,
          feedbackHtml: r.pick(FEEDBACK),
          gradedBy: lecturer?.fullName ?? "Lecturer",
          gradedAt: iso(Math.min(now - HOUR, Math.max(due, submittedAt) + r.int(1, 4) * DAY)),
          released,
        };
        putCell(db, item.id, userId, score);
      }
      db.submissions.push(sub);
    }
  }

  // An extension on the prompt journal (medical).
  const ext = activeStudentIds(db, AIIE_COURSE_ID).find((id) => participates(db, id) && !id.startsWith("stu-a") && id !== "stu-tunde" && id !== "stu-chiamaka" && !db.submissions.some((x) => x.assignmentId === "asg-aiie-prompt-journal" && x.userId === id));
  if (ext) {
    db.extensions.push({ id: "ext-prompt-journal-1", assignmentId: "asg-aiie-prompt-journal", userId: ext, studentName: db.users.find((u) => u.id === ext)!.fullName, newDueAt: iso(lagosAt(now, 7, 23, 59)), reason: "Admitted at the university health centre — medical report submitted.", grantedBy: "Dr. Adebayo Ogunleye", grantedAt: iso(now - 1 * DAY) });
  }
}
