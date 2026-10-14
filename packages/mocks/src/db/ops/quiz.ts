import type { QuizAnswer } from "@tasued/api-client";
import { iso, ms } from "../../lib/dates";
import type { Random } from "../../lib/random";
import type { AttemptQuestionRow, AttemptRow, DB, QuestionRow, QuizRow } from "../schema";
import { ensureItem, putCell, round1 } from "./grades";

export function drawQuestions(db: DB, quiz: QuizRow, r: Random): AttemptQuestionRow[] {
  const pool = db.questions.filter((q) => quiz.bankIds.includes(q.bankId));
  return r.sample(pool, quiz.drawCount).map((q) => {
    const ids = q.options.map((o) => o.id);
    return {
      questionId: q.id,
      optionOrder: quiz.shuffleOptions && q.type !== "true_false" ? r.shuffle(ids) : ids,
      awarded: null,
      correct: null,
    };
  });
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ").replace(/[.!]+$/, "");

export function correctOptionIds(q: QuestionRow) {
  return q.options.filter((o) => o.isCorrect).map((o) => o.id);
}

/** Objective marking. Returns awarded=null when the answer needs manual marking. */
export function autoMark(q: QuestionRow, answer?: QuizAnswer): { awarded: number | null; correct: boolean | null } {
  const picked = answer?.optionIds ?? [];
  const text = answer?.text?.trim() ?? "";
  switch (q.type) {
    case "single_choice":
    case "true_false":
    case "multiple_choice": {
      const want = correctOptionIds(q).sort();
      const got = [...new Set(picked)].sort();
      const ok = want.length === got.length && want.every((w, i) => w === got[i]);
      return { awarded: ok ? q.points : 0, correct: ok };
    }
    case "short_answer": {
      if (!text) return { awarded: 0, correct: false };
      if (q.acceptedAnswers?.length) {
        const ok = q.acceptedAnswers.some((a) => norm(a) === norm(text));
        return { awarded: ok ? q.points : 0, correct: ok };
      }
      return { awarded: null, correct: null };
    }
    case "essay":
      return text ? { awarded: null, correct: null } : { awarded: 0, correct: false };
  }
}

export function attemptTotals(db: DB, a: AttemptRow) {
  let score = 0;
  let maxScore = 0;
  let pending = 0;
  for (const aq of a.questions) {
    const q = db.questions.find((x) => x.id === aq.questionId);
    maxScore += q?.points ?? 0;
    if (a.state === "in_progress") continue;
    if (aq.awarded === null) pending++;
    else score += aq.awarded;
  }
  return { score: round1(score), maxScore, pending };
}

export function syncQuizCell(db: DB, quiz: QuizRow, userId: string) {
  const item = ensureItem(db, {
    courseId: quiz.courseId,
    kind: "quiz",
    refId: quiz.id,
    title: quiz.title,
    maxScore: quiz.maxScore,
    weightPercent: quiz.weightPercent,
  });
  let best: number | null = null;
  for (const a of db.attempts) {
    if (a.quizId !== quiz.id || a.userId !== userId || a.state === "in_progress") continue;
    const t = attemptTotals(db, a);
    const scaled = t.maxScore ? round1((t.score / t.maxScore) * quiz.maxScore) : 0;
    best = best === null ? scaled : Math.max(best, scaled);
  }
  putCell(db, item.id, userId, best);
}

export function finaliseAttempt(db: DB, a: AttemptRow, state: "submitted" | "auto_submitted", at: number) {
  for (const aq of a.questions) {
    const q = db.questions.find((x) => x.id === aq.questionId);
    if (!q) continue;
    const m = autoMark(q, aq.answer);
    aq.awarded = m.awarded;
    aq.correct = m.correct;
  }
  a.state = state;
  a.submittedAt = iso(Math.min(at, ms(a.deadlineAt)));
  const quiz = db.quizzes.find((x) => x.id === a.quizId);
  if (quiz) syncQuizCell(db, quiz, a.userId);
}

/** Whether a student may see scores/answers for a finished attempt. */
export function resultsVisible(db: DB, quiz: QuizRow, now: number) {
  if (quiz.showResults === "immediately") return true;
  if (quiz.showResults === "after_close") return now > ms(quiz.closesAt);
  return !!db.gradeItems.find((i) => i.kind === "quiz" && i.refId === quiz.id)?.released;
}
