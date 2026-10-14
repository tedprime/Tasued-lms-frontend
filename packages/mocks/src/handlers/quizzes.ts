import type { PublishState, Question, QuestionType, Quiz, QuizAnswer } from "@tasued/api-client";
import { audit, courseOf, activeStudentIds, find, notify } from "../db/ops/common";
import { ensureItem, itemFor } from "../db/ops/grades";
import { attemptTotals, drawQuestions, finaliseAttempt, syncQuizCell } from "../db/ops/quiz";
import type { AttemptRow, DB, QuestionRow, QuizRow } from "../db/schema";
import { attemptView, questionView, quizView } from "../db/views/assess";
import { asNumber, asString, isIsoDate, courseFilter, readableCourse, requireEnrolled } from "../lib/access";
import { isStaffFor, requirePerm } from "../lib/auth";
import { iso, MIN, ms } from "../lib/dates";
import { conflict, forbidden, invalid, notFound, validation } from "../lib/http";
import { newId, rand } from "../lib/random";
import type { Ctx, Router } from "../lib/route";

const TYPES: QuestionType[] = ["single_choice", "multiple_choice", "true_false", "short_answer", "essay"];

function readableQuiz(c: Ctx, id: string) {
  const q = find(c.db.quizzes, id, "quiz");
  readableCourse(c, q.courseId);
  const staff = isStaffFor(c.viewer, q.courseId);
  if (!staff && q.state !== "published") throw notFound("quiz");
  return { q, staff };
}

function validateQuiz(db: DB, courseId: string, b: Partial<Quiz>, base?: QuizRow): Omit<QuizRow, "id" | "courseId" | "createdAt"> {
  const m = { ...base, ...b } as Partial<Quiz>;
  const errs: Record<string, string> = {};
  const title = asString(m.title);
  if (!title) errs.title = "Title is required";
  const bankIds = Array.isArray(m.bankIds) ? m.bankIds : [];
  if (!bankIds.length || bankIds.some((id) => !db.banks.some((bk) => bk.id === id && bk.courseId === courseId))) errs.bankIds = "Choose at least one question bank from this course";
  const pool = db.questions.filter((q) => bankIds.includes(q.bankId)).length;
  const draw = asNumber(m.drawCount);
  if (!draw || draw < 1) errs.drawCount = "Draw at least one question";
  else if (draw > pool) errs.drawCount = `The selected banks only have ${pool} questions`;
  const limit = asNumber(m.timeLimitMinutes);
  if (!limit || limit < 1 || limit > 240) errs.timeLimitMinutes = "Time limit must be 1–240 minutes";
  const attempts = asNumber(m.attemptsAllowed);
  if (!attempts || attempts < 1 || attempts > 10) errs.attemptsAllowed = "Attempts must be 1–10";
  if (!isIsoDate(m.opensAt)) errs.opensAt = "Opening time is required";
  if (!isIsoDate(m.closesAt)) errs.closesAt = "Closing time is required";
  if (isIsoDate(m.opensAt) && isIsoDate(m.closesAt) && ms(m.closesAt) <= ms(m.opensAt)) errs.closesAt = "Closing time must be after opening time";
  if (m.showResults && !["immediately", "after_close", "manual"].includes(m.showResults)) errs.showResults = "Invalid option";
  const maxScore = asNumber(m.maxScore);
  if (!maxScore || maxScore <= 0) errs.maxScore = "Maximum score must be greater than 0";
  const weight = asNumber(m.weightPercent);
  if (weight === undefined || weight < 0 || weight > 100) errs.weightPercent = "Weight must be 0–100%";
  if (Object.keys(errs).length) throw validation(errs);
  return {
    title,
    descriptionHtml: m.descriptionHtml ?? "",
    unitIds: Array.isArray(m.unitIds) ? m.unitIds : [],
    bankIds,
    drawCount: draw!,
    timeLimitMinutes: limit!,
    attemptsAllowed: attempts!,
    opensAt: m.opensAt!,
    closesAt: m.closesAt!,
    shuffleOptions: m.shuffleOptions !== false,
    showResults: m.showResults ?? "after_close",
    maxScore: maxScore!,
    weightPercent: weight!,
    state: (m.state as PublishState) === "published" ? "published" : "draft",
  };
}

function validateQuestion(b: Partial<Question>, base?: QuestionRow): Omit<QuestionRow, "id" | "bankId"> {
  const m = { ...base, ...b } as Partial<Question>;
  const errs: Record<string, string> = {};
  const type = m.type as QuestionType;
  if (!TYPES.includes(type)) errs.type = "Choose a question type";
  const prompt = (m.promptHtml ?? "").trim();
  if (!prompt.replace(/<[^>]+>/g, "").trim()) errs.promptHtml = "Question text is required";
  let options = Array.isArray(m.options) ? m.options.map((o) => ({ id: o.id || newId("opt"), text: asString(o.text), isCorrect: !!o.isCorrect })) : [];
  if (type === "true_false" && options.length !== 2) {
    const correctTrue = options.find((o) => /true/i.test(o.text))?.isCorrect ?? true;
    options = [{ id: newId("opt"), text: "True", isCorrect: correctTrue }, { id: newId("opt"), text: "False", isCorrect: !correctTrue }];
  }
  if (type === "single_choice" || type === "multiple_choice" || type === "true_false") {
    if (options.length < 2 || options.some((o) => !o.text)) errs.options = "Add at least two options with text";
    const correct = options.filter((o) => o.isCorrect).length;
    if (type !== "multiple_choice" && correct !== 1) errs.options = "Mark exactly one correct option";
    if (type === "multiple_choice" && correct < 1) errs.options = "Mark at least one correct option";
  } else options = [];
  const points = asNumber(m.points) ?? 1;
  if (points <= 0 || points > 100) errs.points = "Points must be between 0 and 100";
  if (Object.keys(errs).length) throw validation(errs);
  return {
    type,
    promptHtml: prompt,
    options,
    acceptedAnswers: type === "short_answer" ? (m.acceptedAnswers ?? []).map((x) => String(x).trim()).filter(Boolean) : undefined,
    points,
    explanation: m.explanation || undefined,
    tags: Array.isArray(m.tags) ? m.tags.map(String) : [],
  };
}

function ownAttempt(c: Ctx, id: string): AttemptRow {
  const a = find(c.db.attempts, id, "attempt");
  if (a.userId !== c.viewer.user.id) {
    const quiz = c.db.quizzes.find((q) => q.id === a.quizId);
    if (!quiz || !isStaffFor(c.viewer, quiz.courseId)) throw notFound("attempt");
  }
  return a;
}

export function registerQuizzes(r: Router) {
  r.get("/quizzes", (c) => {
    const courseIds = courseFilter(c);
    const state = c.q("state") as PublishState | undefined;
    return c.db.quizzes
      .filter((q) => courseIds.has(q.courseId) && (isStaffFor(c.viewer, q.courseId) || q.state === "published") && (!state || q.state === state))
      .sort((a, b) => a.opensAt.localeCompare(b.opensAt))
      .map((q) => quizView(c.db, q, isStaffFor(c.viewer, q.courseId)));
  });

  r.get("/quizzes/:id", (c) => {
    const { q, staff } = readableQuiz(c, c.params.id!);
    return quizView(c.db, q, staff);
  });

  r.post("/quizzes", async (c) => {
    const b = await c.json<Partial<Quiz>>();
    const o = find(c.db.courses, b.courseId, "course");
    requirePerm(c.viewer, "quizzes.manage", o.id);
    const row: QuizRow = { ...validateQuiz(c.db, o.id, b), id: newId("quiz"), courseId: o.id, createdAt: iso(c.now) };
    c.db.quizzes.push(row);
    ensureItem(c.db, { courseId: o.id, kind: "quiz", refId: row.id, title: row.title, maxScore: row.maxScore, weightPercent: row.weightPercent });
    if (row.state === "published") quizNotice(c, row);
    audit(c.db, c.viewer.user, "quiz.created", "quiz", row.id, `Created quiz "${row.title}" (${row.state})`);
    return quizView(c.db, row, true);
  });

  r.patch("/quizzes/:id", async (c) => {
    const q = find(c.db.quizzes, c.params.id, "quiz");
    requirePerm(c.viewer, "quizzes.manage", q.courseId);
    const b = await c.json<Partial<Quiz>>();
    const wasDraft = q.state === "draft";
    Object.assign(q, validateQuiz(c.db, q.courseId, b, q));
    ensureItem(c.db, { courseId: q.courseId, kind: "quiz", refId: q.id, title: q.title, maxScore: q.maxScore, weightPercent: q.weightPercent });
    if (wasDraft && q.state === "published") quizNotice(c, q);
    audit(c.db, c.viewer.user, "quiz.updated", "quiz", q.id, `Updated quiz "${q.title}"`);
    return quizView(c.db, q, true);
  });

  r.delete("/quizzes/:id", (c) => {
    const q = find(c.db.quizzes, c.params.id, "quiz");
    requirePerm(c.viewer, "quizzes.manage", q.courseId);
    if (c.db.attempts.some((a) => a.quizId === q.id)) throw conflict("HAS_ATTEMPTS", "Students have attempted this quiz, so it can't be deleted. Unpublish it instead.");
    c.db.quizzes = c.db.quizzes.filter((x) => x.id !== q.id);
    const item = itemFor(c.db, "quiz", q.id);
    if (item) c.db.gradeItems = c.db.gradeItems.filter((i) => i.id !== item.id);
  });

  /* banks & questions */
  r.get("/courses/:id/question-banks", (c) => {
    const o = find(c.db.courses, c.params.id, "course");
    requirePerm(c.viewer, ["quizzes.manage", "quizzes.grade"], o.id);
    return c.db.banks.filter((b) => b.courseId === o.id).map((b) => ({ ...b, questionCount: c.db.questions.filter((q) => q.bankId === b.id).length }));
  });
  r.post("/courses/:id/question-banks", async (c) => {
    const o = find(c.db.courses, c.params.id, "course");
    requirePerm(c.viewer, "quizzes.manage", o.id);
    const name = asString((await c.json<{ name?: string }>()).name);
    if (!name) throw validation({ name: "Bank name is required" });
    const bank = { id: newId("bank"), courseId: o.id, name };
    c.db.banks.push(bank);
    return { ...bank, questionCount: 0 };
  });
  r.get("/question-banks/:id/questions", (c) => {
    const bank = find(c.db.banks, c.params.id, "question bank");
    requirePerm(c.viewer, ["quizzes.manage", "quizzes.grade"], bank.courseId);
    return c.db.questions.filter((q) => q.bankId === bank.id).map((q) => questionView(q, true));
  });
  r.post("/question-banks/:id/questions", async (c) => {
    const bank = find(c.db.banks, c.params.id, "question bank");
    requirePerm(c.viewer, "quizzes.manage", bank.courseId);
    const q: QuestionRow = { ...validateQuestion(await c.json<Partial<Question>>()), id: newId("q"), bankId: bank.id };
    c.db.questions.push(q);
    return q;
  });
  r.patch("/questions/:id", async (c) => {
    const q = find(c.db.questions, c.params.id, "question");
    const bank = find(c.db.banks, q.bankId, "question bank");
    requirePerm(c.viewer, "quizzes.manage", bank.courseId);
    Object.assign(q, validateQuestion(await c.json<Partial<Question>>(), q));
    return q;
  });
  r.delete("/questions/:id", (c) => {
    const q = find(c.db.questions, c.params.id, "question");
    const bank = find(c.db.banks, q.bankId, "question bank");
    requirePerm(c.viewer, "quizzes.manage", bank.courseId);
    c.db.questions = c.db.questions.filter((x) => x.id !== q.id);
  });

  /* student attempts */
  r.get("/quizzes/:id/attempts/mine", (c) => {
    const { q } = readableQuiz(c, c.params.id!);
    return c.db.attempts
      .filter((a) => a.quizId === q.id && a.userId === c.viewer.user.id)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
      .map((a) => attemptView(c.db, a, false, c.now));
  });

  r.post("/quizzes/:id/attempts", (c) => {
    const { q } = readableQuiz(c, c.params.id!);
    if (q.state !== "published") throw forbidden("This quiz isn't published.");
    requireEnrolled(c.viewer, q.courseId);
    if (c.now < ms(q.opensAt)) throw invalid("QUIZ_NOT_OPEN", "This quiz hasn't opened yet.");
    if (c.now >= ms(q.closesAt)) throw invalid("QUIZ_CLOSED", "This quiz has closed.");
    const mine = c.db.attempts.filter((a) => a.quizId === q.id && a.userId === c.viewer.user.id);
    const open = mine.find((a) => a.state === "in_progress");
    if (open) return attemptView(c.db, open, false, c.now);
    if (mine.length >= q.attemptsAllowed) throw conflict("ATTEMPTS_EXHAUSTED", `You have used all ${q.attemptsAllowed} attempt${q.attemptsAllowed === 1 ? "" : "s"} for this quiz.`);
    const a: AttemptRow = {
      id: newId("att"),
      quizId: q.id,
      userId: c.viewer.user.id,
      state: "in_progress",
      startedAt: iso(c.now),
      deadlineAt: iso(Math.min(c.now + q.timeLimitMinutes * MIN, ms(q.closesAt))),
      questions: drawQuestions(c.db, q, rand),
    };
    c.db.attempts.push(a);
    return attemptView(c.db, a, false, c.now);
  });

  r.get("/quiz-attempts/:id", (c) => {
    const a = ownAttempt(c, c.params.id!);
    const quiz = c.db.quizzes.find((q) => q.id === a.quizId);
    return attemptView(c.db, a, a.userId !== c.viewer.user.id && !!quiz && isStaffFor(c.viewer, quiz.courseId), c.now);
  });

  r.put("/quiz-attempts/:id/answers/:questionId", async (c) => {
    const a = find(c.db.attempts, c.params.id, "attempt");
    if (a.userId !== c.viewer.user.id) throw notFound("attempt");
    if (a.state !== "in_progress") throw conflict("ATTEMPT_CLOSED", "This attempt has already been submitted.");
    if (c.now > ms(a.deadlineAt)) {
      finaliseAttempt(c.db, a, "auto_submitted", ms(a.deadlineAt));
      throw conflict("ATTEMPT_CLOSED", "Time is up — your attempt was submitted automatically.");
    }
    const aq = a.questions.find((x) => x.questionId === c.params.questionId);
    if (!aq) throw notFound("question");
    const b = await c.json<QuizAnswer>();
    const answer: QuizAnswer = {};
    if (Array.isArray(b.optionIds)) {
      const valid = new Set(aq.optionOrder);
      if (b.optionIds.some((id) => !valid.has(id))) throw validation({ optionIds: "Invalid option" });
      answer.optionIds = [...new Set(b.optionIds)];
    }
    if (typeof b.text === "string") answer.text = b.text.slice(0, 20000);
    aq.answer = answer;
  });

  r.post("/quiz-attempts/:id/submit", (c) => {
    const a = find(c.db.attempts, c.params.id, "attempt");
    if (a.userId !== c.viewer.user.id) throw notFound("attempt");
    if (a.state === "in_progress") {
      const late = c.now > ms(a.deadlineAt) + 30_000;
      finaliseAttempt(c.db, a, late ? "auto_submitted" : "submitted", c.now);
      const quiz = c.db.quizzes.find((q) => q.id === a.quizId)!;
      audit(c.db, c.viewer.user, "quiz.submitted", "attempt", a.id, `Submitted "${quiz.title}" (${attemptTotals(c.db, a).score}/${attemptTotals(c.db, a).maxScore})`);
    }
    return attemptView(c.db, a, false, c.now);
  });

  /* staff */
  r.get("/quizzes/:id/attempts", (c) => {
    const q = find(c.db.quizzes, c.params.id, "quiz");
    requirePerm(c.viewer, ["quizzes.grade", "quizzes.manage"], q.courseId);
    return c.db.attempts
      .filter((a) => a.quizId === q.id)
      .sort((a, b) => (b.submittedAt ?? b.startedAt).localeCompare(a.submittedAt ?? a.startedAt))
      .map((a) => attemptView(c.db, a, true, c.now));
  });

  r.get("/quizzes/:id/marking-queue", (c) => {
    const q = find(c.db.quizzes, c.params.id, "quiz");
    requirePerm(c.viewer, "quizzes.grade", q.courseId);
    return c.db.attempts
      .filter((a) => a.quizId === q.id && a.state !== "in_progress" && a.questions.some((x) => x.awarded === null))
      .sort((a, b) => (a.submittedAt ?? "").localeCompare(b.submittedAt ?? ""))
      .map((a) => attemptView(c.db, a, true, c.now));
  });

  r.put("/quiz-attempts/:id/marks/:questionId", async (c) => {
    const a = find(c.db.attempts, c.params.id, "attempt");
    const quiz = find(c.db.quizzes, a.quizId, "quiz");
    requirePerm(c.viewer, "quizzes.grade", quiz.courseId);
    if (a.state === "in_progress") throw conflict("ATTEMPT_IN_PROGRESS", "This attempt hasn't been submitted yet.");
    const aq = a.questions.find((x) => x.questionId === c.params.questionId);
    if (!aq) throw notFound("question");
    const q = c.db.questions.find((x) => x.id === aq.questionId);
    const awarded = asNumber((await c.json<{ awarded?: number }>()).awarded);
    const max = q?.points ?? 0;
    if (awarded === undefined || awarded < 0 || awarded > max) throw validation({ awarded: `Award between 0 and ${max} points` });
    aq.awarded = awarded;
    aq.correct = awarded >= max ? true : awarded === 0 ? false : null;
    if (a.questions.every((x) => x.awarded !== null)) a.state = "marked";
    syncQuizCell(c.db, quiz, a.userId);
    audit(c.db, c.viewer.user, "quiz.marked", "attempt", a.id, `Marked a question in "${quiz.title}" for ${c.db.users.find((u) => u.id === a.userId)?.fullName}: ${awarded}/${max}`);
    return attemptView(c.db, a, true, c.now);
  });
}

function quizNotice(c: Ctx, q: QuizRow) {
  notify(c.db, activeStudentIds(c.db, q.courseId), { kind: "quiz_open", title: `${courseOf(c.db, q.courseId).code}: quiz published`, body: `"${q.title}" opens ${new Date(q.opensAt) <= new Date(c.now) ? "now" : "soon"}.`, link: `/quizzes/${q.id}` }, c.now);
}
