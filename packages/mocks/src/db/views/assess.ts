import type * as T from "@tasued/api-client";
import { attemptTotals, correctOptionIds, resultsVisible } from "../ops/quiz";
import type { AssignmentRow, AttemptRow, DB, QuestionRow, QuizRow, SubmissionRow } from "../schema";

const codeOf = (db: DB, courseId: string) =>
  db.courses.find((c) => c.id === courseId)?.code ?? "";

export function assignmentView(db: DB, a: AssignmentRow, staff: boolean): T.Assignment {
  const subs = db.submissions.filter((s) => s.assignmentId === a.id && s.state === "submitted");
  return {
    ...a,
    courseCode: codeOf(db, a.courseId),
    ...(staff ? { submissionCount: subs.length, gradedCount: subs.filter((s) => s.grade).length } : {}),
  };
}

export function submissionView(db: DB, s: SubmissionRow, opts: { staff?: boolean } = {}): T.Submission {
  const u = db.users.find((x) => x.id === s.userId);
  const ext = db.extensions.find((e) => e.assignmentId === s.assignmentId && e.userId === s.userId);
  const hideDraft = opts.staff && s.state !== "submitted";
  const studentGrade = !opts.staff && s.grade && !s.grade.released ? undefined : s.grade;
  return {
    ...s,
    textHtml: hideDraft ? undefined : s.textHtml,
    files: hideDraft ? [] : s.files,
    studentName: u?.fullName,
    matricNumber: u?.matricNumber,
    extensionDueAt: ext?.newDueAt,
    grade: studentGrade,
  };
}

export function virtualSubmission(db: DB, assignmentId: string, userId: string): T.Submission {
  return submissionView(db, { id: `new-${assignmentId}-${userId}`, assignmentId, userId, state: "not_started", files: [], isLate: false });
}

export function quizView(db: DB, q: QuizRow, staff: boolean): T.Quiz {
  return {
    ...q,
    courseCode: codeOf(db, q.courseId),
    ...(staff ? { attemptCount: db.attempts.filter((a) => a.quizId === q.id && a.state !== "in_progress").length } : {}),
  };
}

export function questionView(q: QuestionRow, staff: boolean): T.Question {
  if (staff) return q;
  const { acceptedAnswers: _a, explanation: _e, ...rest } = q;
  return { ...rest, options: q.options.map((o) => ({ id: o.id, text: o.text })) };
}

export function attemptView(db: DB, a: AttemptRow, staff: boolean, now: number): T.QuizAttempt {
  const quiz = db.quizzes.find((q) => q.id === a.quizId);
  const finished = a.state !== "in_progress";
  const visible = finished && (staff || (!!quiz && resultsVisible(db, quiz, now)));
  const totals = attemptTotals(db, a);
  const user = db.users.find((u) => u.id === a.userId);
  return {
    id: a.id,
    quizId: a.quizId,
    userId: a.userId,
    studentName: user?.fullName,
    state: a.state,
    startedAt: a.startedAt,
    deadlineAt: a.deadlineAt,
    submittedAt: a.submittedAt,
    maxScore: totals.maxScore,
    score: visible ? totals.score : undefined,
    pendingManualMarks: finished ? totals.pending : 0,
    questions: a.questions.map((aq) => {
      const q = db.questions.find((x) => x.id === aq.questionId);
      const opts = aq.optionOrder
        .map((id) => q?.options.find((o) => o.id === id))
        .filter((o): o is T.QuestionOption => !!o)
        .map((o) => ({ id: o.id, text: o.text }));
      return {
        questionId: aq.questionId,
        type: q?.type ?? "essay",
        promptHtml: q?.promptHtml ?? "<p>(question removed)</p>",
        options: opts,
        points: q?.points ?? 0,
        answer: aq.answer,
        result: visible && aq.awarded !== null
          ? {
              awarded: aq.awarded ?? 0,
              correct: aq.correct,
              correctOptionIds: q && q.options.length ? correctOptionIds(q) : undefined,
              explanation: q?.explanation,
            }
          : undefined,
      };
    }),
  };
}
