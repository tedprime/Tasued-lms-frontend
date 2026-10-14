import type { QuestionOption, QuizAnswer } from "@tasued/api-client";
import { DAY, HOUR, iso, lagosAt, MIN, ms } from "../../lib/dates";
import type { Random } from "../../lib/random";
import { activeStudentIds } from "../ops/common";
import { ensureItem } from "../ops/grades";
import { drawQuestions, finaliseAttempt, syncQuizCell } from "../ops/quiz";
import type { AttemptRow, DB, QuestionRow, QuizRow } from "../schema";
import { AIIE_COURSE_ID, unitId } from "./ids";
import { diligence, participates } from "./people";
import { BANKS } from "./question-data";

interface QuizSpec {
  id: string;
  courseId: string;
  title: string;
  desc: string;
  banks: string[];
  draw: number;
  minutes: number;
  attempts: number;
  window: [number, number]; // epoch ms
  show: QuizRow["showResults"];
  maxScore: number;
  weight: number;
  draft?: boolean;
  released?: boolean;
  /** handout unit codes */
  units: string[];
  /** demo user ids that have a finished attempt */
  demo: string[];
  /** share of other students who attempted */
  others: number;
  pendingEssays?: number;
}

export function seedQuestionBanks(db: DB) {
  for (const b of BANKS) {
    db.banks.push({ id: b.id, courseId: b.courseId, name: b.name });
    b.questions.forEach((q, i) => {
      const id = `${b.id}-q${String(i + 1).padStart(2, "0")}`;
      const opt = (texts: string[], correct: number[]): QuestionOption[] =>
        texts.map((text, j) => ({ id: `${id}-o${j + 1}`, text, isCorrect: correct.includes(j) }));
      const base = { id, bankId: b.id, promptHtml: `<p>${q[1]}</p>`, tags: b.tags, points: 1 };
      let row: QuestionRow;
      switch (q[0]) {
        case "sc": row = { ...base, type: "single_choice", options: opt(q[2], [q[3]]), explanation: q[4] }; break;
        case "mc": row = { ...base, type: "multiple_choice", options: opt(q[2], q[3]), explanation: q[4], points: 2 }; break;
        case "tf": row = { ...base, type: "true_false", options: [{ id: `${id}-t`, text: "True", isCorrect: q[2] }, { id: `${id}-f`, text: "False", isCorrect: !q[2] }], explanation: q[3] }; break;
        case "sa": row = { ...base, type: "short_answer", options: [], acceptedAnswers: q[2], explanation: q[3] }; break;
        case "es": row = { ...base, type: "essay", options: [], points: q[2] }; break;
      }
      db.questions.push(row);
    });
  }
}

function answerFor(q: QuestionRow, good: boolean, r: Random): QuizAnswer {
  const correct = q.options.filter((o) => o.isCorrect).map((o) => o.id);
  const wrong = q.options.filter((o) => !o.isCorrect).map((o) => o.id);
  switch (q.type) {
    case "single_choice":
    case "true_false":
      return { optionIds: good ? correct : [r.pick(wrong)] };
    case "multiple_choice":
      return { optionIds: good ? correct : r.sample([...correct, ...wrong], 2) };
    case "short_answer":
      return { text: good ? q.acceptedAnswers?.[0] ?? "" : r.pick(["not sure", "data", "model"]) };
    case "essay":
      return { text: "<p>The key point is that AI predicts from patterns in its training data; it does not know or check facts. For example, in my teaching practice school… so a person must stay responsible for the final decision.</p>" };
  }
}

export function seedQuizzes(db: DB, now: number, r: Random) {
  seedQuestionBanks(db);
  const d = (days: number, h = 9, m = 0) => lagosAt(now, days, h, m);
  const specs: QuizSpec[] = [
    { id: "quiz-aiie-1", courseId: AIIE_COURSE_ID, title: "Quiz 1: Understanding AI (Part A)", desc: "<p>Covers Modules 1–5: what AI is, its history, how machine learning and generative AI work, and prompting. Ten questions drawn at random, <strong>20 minutes</strong>, one attempt. Results are shown after the quiz closes.</p>", banks: ["bank-aiie-part-a"], draw: 10, minutes: 20, attempts: 1, window: [d(-6), d(-2, 23, 59)], show: "after_close", maxScore: 10, weight: 10, released: true, units: ["1.1", "2.4", "3.3", "4.2", "5.2"], demo: ["stu-adaeze", "stu-tunde"], others: 0.85, pendingEssays: 3 },
    { id: "quiz-aiie-2", courseId: AIIE_COURSE_ID, title: "Quiz 2: AI for Productivity and Learning (Part B)", desc: "<p>Covers Modules 6–7: documents, slides and spreadsheets with AI, and AI as a research and study assistant. Ten questions drawn at random from the Part B bank. You have <strong>20 minutes</strong> and two attempts; your best score counts. The timer keeps running if you leave the page.</p>", banks: ["bank-aiie-part-b"], draw: 10, minutes: 20, attempts: 2, window: [d(-1), d(6, 23, 59)], show: "immediately", maxScore: 10, weight: 10, units: ["6.2", "6.3", "6.4", "7.2", "7.4"], demo: [], others: 0.3 },
    { id: "quiz-aiie-3", courseId: AIIE_COURSE_ID, title: "Quiz 3: Entrepreneurship and Responsible Use (Parts C–D)", desc: "<p>Covers Modules 8–12: opportunity thinking, needs finding, AI ethics and bias, intellectual property and academic integrity, and data protection under the NDPA 2023. Twelve questions, 25 minutes, one attempt.</p>", banks: ["bank-aiie-part-c", "bank-aiie-part-d"], draw: 12, minutes: 25, attempts: 1, window: [d(36), d(40, 23, 59)], show: "after_close", maxScore: 12, weight: 10, units: ["8.4", "9.3", "10.2", "11.4", "12.2"], demo: [], others: 0 },
  ];

  for (const s of specs) {
    const quiz: QuizRow = {
      id: s.id,
      courseId: s.courseId,
      title: s.title,
      descriptionHtml: s.desc,
      unitIds: s.units.map(unitId).filter((id) => db.units.some((u) => u.id === id)),
      bankIds: s.banks,
      drawCount: s.draw,
      timeLimitMinutes: s.minutes,
      attemptsAllowed: s.attempts,
      opensAt: iso(s.window[0]),
      closesAt: iso(s.window[1]),
      shuffleOptions: true,
      showResults: s.show,
      maxScore: s.maxScore,
      weightPercent: s.weight,
      state: s.draft ? "draft" : "published",
      createdAt: iso(s.window[0] - 5 * DAY),
    };
    db.quizzes.push(quiz);
    if (quiz.state === "draft") continue;
    ensureItem(db, { id: `gbi-${s.id}`, courseId: s.courseId, kind: "quiz", refId: s.id, title: s.title, maxScore: s.maxScore, weightPercent: s.weight, released: !!s.released });

    const [open, close] = s.window;
    if (open > now) continue;
    let pending = s.pendingEssays ?? 0;
    for (const userId of activeStudentIds(db, s.courseId).filter((id) => participates(db, id))) {
      const isDemo = userId.startsWith("stu-") && ["stu-adaeze", "stu-tunde", "stu-chiamaka"].includes(userId);
      if (isDemo ? !s.demo.includes(userId) : !r.chance(s.others)) continue;
      const latest = Math.min(close, now - 30 * MIN);
      const startedAt = open + r.float(0, Math.max(HOUR, latest - open - s.minutes * MIN));
      const attempt: AttemptRow = {
        id: `att-${s.id}-${userId}`,
        quizId: s.id,
        userId,
        state: "in_progress",
        startedAt: iso(startedAt),
        deadlineAt: iso(Math.min(startedAt + s.minutes * MIN, close)),
        questions: drawQuestions(db, quiz, r),
      };
      const dil = diligence(userId);
      for (const aq of attempt.questions) {
        const q = db.questions.find((x) => x.id === aq.questionId)!;
        aq.answer = answerFor(q, r.chance(Math.min(0.97, dil + r.float(-0.1, 0.1))), r);
      }
      db.attempts.push(attempt);
      const timedOut = r.chance(0.08);
      finaliseAttempt(db, attempt, timedOut ? "auto_submitted" : "submitted", timedOut ? ms(attempt.deadlineAt) : startedAt + r.int(6, s.minutes - 1) * MIN);
      const hasPending = attempt.questions.some((x) => x.awarded === null);
      if (hasPending && !isDemo && pending > 0 && close < now) {
        pending--;
        continue;
      }
      if (hasPending && (close < now || isDemo)) {
        for (const aq of attempt.questions) {
          if (aq.awarded !== null) continue;
          const q = db.questions.find((x) => x.id === aq.questionId)!;
          aq.awarded = Math.round(q.points * Math.min(1, dil + r.float(-0.2, 0.1)) * 2) / 2;
          aq.correct = aq.awarded >= q.points / 2;
        }
        attempt.state = "marked";
        syncQuizCell(db, quiz, userId);
      }
    }
  }
}

