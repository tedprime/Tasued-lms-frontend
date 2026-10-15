import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useBlocker, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  X,
  Clock,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Bookmark,
  BookmarkCheck,
  Award,
  ClipboardCheck,
  Grid3x3,
  Loader2,
  CloudOff,
  Check,
  MinusCircle,
  Hourglass,
} from "lucide-react";
import { api, errorMessage, fmtDateTime, isApiError, type QuizAnswer, type QuizAttempt, type QuizAttemptQuestion, type Quiz } from "@tasued/api-client";
import { Alert, Badge, Button, Card, ConfirmDialog, ErrorState, Logo, PageLoader, RichContent, Textarea, buttonClasses, cn, useDeadlineCountdown, useIsMobile, useToast } from "@tasued/ui";
import { attemptKey, attemptStateLabel } from "./meta";
import { OfflineBanner } from "../../layout/OfflineBanner";

/**
 * Quiz attempt — a port of SLAN's AssessmentView exam UX (full-screen takeover, one question per
 * screen, navigator grid, mark for review, progress bar, results breakdown), re-wired to
 * TASFUED's server-authoritative quiz API: per-answer autosave, absolute deadline, auto-submit.
 */
export default function QuizAttemptPage() {
  const { attemptId } = useParams();
  const attempt = useQuery({
    queryKey: attemptKey(attemptId!),
    queryFn: () => api.quizzes.attempt(attemptId!),
    enabled: !!attemptId,
    staleTime: 0,
  });
  const quiz = useQuery({
    queryKey: ["quizzes", attempt.data?.quizId],
    queryFn: () => api.quizzes.get(attempt.data!.quizId),
    enabled: !!attempt.data?.quizId,
  });

  if (attempt.isPending) return <PageLoader label="Loading your quiz…" />;
  if (attempt.isError)
    return (
      <div className="flex min-h-dvh items-center justify-center bg-neutral p-6">
        <Card className="w-full max-w-md">
          <ErrorState title="Couldn't load this attempt" description={errorMessage(attempt.error)} onRetry={() => void attempt.refetch()} />
          <div className="pb-6 text-center"><Link to="/quizzes" className="text-sm font-semibold text-primary-500 hover:underline">Back to quizzes</Link></div>
        </Card>
      </div>
    );

  const a = attempt.data;
  return a.state === "in_progress" ? <TakeQuiz key={a.id} attempt={a} quiz={quiz.data} /> : <Results attempt={a} quiz={quiz.data} />;
}

/* ───────────────────────── Taking ───────────────────────── */

type SaveStatus = "saving" | "saved" | "error";

const isAnswered = (a: QuizAnswer | undefined) => !!a && ((a.optionIds?.length ?? 0) > 0 || !!a.text?.trim());

function loadSet(key: string) {
  try {
    return new Set<string>(JSON.parse(sessionStorage.getItem(key) ?? "[]") as string[]);
  } catch {
    return new Set<string>();
  }
}

function TakeQuiz({ attempt, quiz }: { attempt: QuizAttempt; quiz?: Quiz }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const isMobile = useIsMobile();
  const questions = attempt.questions;
  const total = questions.length;
  const flagKey = `quiz-flags-${attempt.id}`;
  const idxKey = `quiz-idx-${attempt.id}`;

  const [answers, setAnswers] = useState<Record<string, QuizAnswer>>(() => Object.fromEntries(questions.filter((q) => q.answer).map((q) => [q.questionId, q.answer!])));
  const [status, setStatus] = useState<Record<string, SaveStatus>>({});
  const [flags, setFlags] = useState<Set<string>>(() => loadSet(flagKey));
  const [index, setIndex] = useState(() => Math.min(total - 1, Math.max(0, Number(sessionStorage.getItem(idxKey) ?? 0) || 0)));
  const [view, setView] = useState<"question" | "review">("question");
  const [navOpen, setNavOpen] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [submitting, setSubmitting] = useState<null | "manual" | "auto">(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string>("");
  const finishedRef = useRef(false);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const pending = useRef<Record<string, QuizAnswer>>({});
  const inflight = useRef<Set<Promise<unknown>>>(new Set());

  useEffect(() => {
    try {
      sessionStorage.setItem(flagKey, JSON.stringify([...flags]));
    } catch {
      /* ignore */
    }
  }, [flags, flagKey]);
  useEffect(() => {
    try {
      sessionStorage.setItem(idxKey, String(index));
    } catch {
      /* ignore */
    }
  }, [index, idxKey]);

  /* ── Save one answer to the server ── */
  const persist = useCallback(
    (qid: string, ans: QuizAnswer) => {
      setStatus((s) => ({ ...s, [qid]: "saving" }));
      const p = api.quizzes
        .answer(attempt.id, qid, ans)
        .then(() => setStatus((s) => ({ ...s, [qid]: "saved" })))
        .catch((e: unknown) => {
          setStatus((s) => ({ ...s, [qid]: "error" }));
          if (isApiError(e) && (e.status === 409 || e.status === 422 || e.status === 410)) {
            // The attempt is no longer open (deadline passed / already submitted) — show results.
            finishedRef.current = true;
            void qc.invalidateQueries({ queryKey: attemptKey(attempt.id) });
          }
        })
        .finally(() => inflight.current.delete(p));
      inflight.current.add(p);
      return p;
    },
    [attempt.id, qc],
  );

  const flushAll = useCallback(async () => {
    Object.entries(timers.current).forEach(([qid, t]) => {
      clearTimeout(t);
      const ans = pending.current[qid];
      if (ans) void persist(qid, ans);
    });
    timers.current = {};
    pending.current = {};
    await Promise.allSettled([...inflight.current]);
  }, [persist]);

  const setAnswer = (q: QuizAttemptQuestion, ans: QuizAnswer, debounce = false) => {
    setAnswers((a) => ({ ...a, [q.questionId]: ans }));
    if (debounce) {
      clearTimeout(timers.current[q.questionId]);
      pending.current[q.questionId] = ans;
      setStatus((s) => ({ ...s, [q.questionId]: "saving" }));
      timers.current[q.questionId] = setTimeout(() => {
        delete timers.current[q.questionId];
        delete pending.current[q.questionId];
        void persist(q.questionId, ans);
      }, 800);
    } else void persist(q.questionId, ans);
  };

  /* ── Submit (manual or on expiry) ── */
  const doSubmit = useCallback(
    async (mode: "manual" | "auto") => {
      if (finishedRef.current && mode === "manual") return;
      finishedRef.current = true;
      setSubmitting(mode);
      setSubmitError(null);
      await flushAll();
      try {
        const res = await api.quizzes.submit(attempt.id);
        try {
          sessionStorage.removeItem(flagKey);
          sessionStorage.removeItem(idxKey);
        } catch {
          /* ignore */
        }
        qc.setQueryData(attemptKey(attempt.id), res);
        void qc.invalidateQueries({ queryKey: ["quizzes", attempt.quizId, "attempts", "mine"] });
        void qc.invalidateQueries({ queryKey: ["dashboard"] });
        if (mode === "auto") toast.info("Time's up", "Your quiz was submitted automatically.");
        else toast.success("Quiz submitted");
      } catch (e) {
        if (isApiError(e) && (e.status === 409 || e.status === 422)) {
          // Server already closed it (e.g. its own auto-submit) — load the final state.
          await qc.invalidateQueries({ queryKey: attemptKey(attempt.id) });
          return;
        }
        finishedRef.current = false;
        setSubmitting(null);
        setSubmitError(errorMessage(e));
        if (mode === "auto") toast.error("Couldn't submit automatically", "Check your connection — we'll keep trying when you press Submit.");
      }
    },
    [attempt.id, attempt.quizId, flushAll, qc, toast, flagKey, idxKey],
  );

  const { secondsLeft, label } = useDeadlineCountdown(attempt.deadlineAt, () => void doSubmit("auto"));

  // Warnings at 5 minutes and 1 minute.
  const warned = useRef<{ five: boolean; one: boolean }>({ five: secondsLeft <= 300, one: secondsLeft <= 60 });
  useEffect(() => {
    if (!warned.current.five && secondsLeft <= 300 && secondsLeft > 60) {
      warned.current.five = true;
      setWarning("5 minutes remaining.");
      toast.info("5 minutes left", "Review flagged questions and submit when ready.");
    }
    if (!warned.current.one && secondsLeft <= 60 && secondsLeft > 0) {
      warned.current.one = true;
      setWarning("1 minute remaining. Your quiz will submit automatically.");
      toast.error("1 minute left", "Your quiz submits automatically when the timer ends.");
    }
  }, [secondsLeft, toast]);

  // Prevent accidental navigation away.
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (finishedRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, []);
  const blocker = useBlocker(({ currentLocation, nextLocation }) => !finishedRef.current && currentLocation.pathname !== nextLocation.pathname);

  const q = questions[index]!;
  const answeredCount = questions.filter((x) => isAnswered(answers[x.questionId])).length;
  const unanswered = total - answeredCount;
  const pct = Math.round((answeredCount / Math.max(1, total)) * 100);
  const anySaving = Object.values(status).includes("saving");
  const anyError = Object.values(status).includes("error");
  const flagged = flags.has(q.questionId);
  const toggleFlag = (id: string) =>
    setFlags((f) => {
      const n = new Set(f);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const go = (i: number) => {
    setIndex(i);
    setView("question");
    setNavOpen(false);
    window.scrollTo({ top: 0 });
  };

  const timerTone = secondsLeft <= 60 ? "bg-danger text-white" : secondsLeft <= 300 ? "bg-warning-50 text-warning border border-amber-300" : "bg-tertiary-50 text-tertiary-500";

  const navigator = (
    <div>
      <p className="mb-2 text-xs font-bold tracking-wide text-neutral-500 uppercase">Questions</p>
      <div className="grid grid-cols-5 gap-2" role="list">
        {questions.map((x, i) => {
          const ans = isAnswered(answers[x.questionId]);
          const fl = flags.has(x.questionId);
          return (
            <button
              key={x.questionId}
              type="button"
              role="listitem"
              onClick={() => go(i)}
              aria-current={view === "question" && i === index ? "step" : undefined}
              aria-label={`Question ${i + 1}${ans ? ", answered" : ", not answered"}${fl ? ", flagged for review" : ""}`}
              className={cn(
                "relative flex aspect-square items-center justify-center rounded-lg border text-sm font-bold transition-colors",
                ans ? "border-primary-500 bg-primary-500 text-white" : "border-neutral-300 bg-white text-neutral-600 hover:border-primary-500",
                view === "question" && i === index && "ring-2 ring-secondary-500 ring-offset-2",
              )}
            >
              {i + 1}
              {fl && <Bookmark className="absolute -top-1.5 -right-1.5 size-3.5 fill-secondary-500 text-secondary-600" aria-hidden />}
            </button>
          );
        })}
      </div>
      <ul className="mt-4 space-y-1.5 text-xs text-neutral-500">
        <li className="flex items-center gap-2"><span className="size-3 rounded bg-primary-500" /> Answered ({answeredCount})</li>
        <li className="flex items-center gap-2"><span className="size-3 rounded border border-neutral-300 bg-white" /> Not answered ({unanswered})</li>
        <li className="flex items-center gap-2"><Bookmark className="size-3 fill-secondary-500 text-secondary-600" /> Flagged ({flags.size})</li>
      </ul>
      <Button variant="outline" size="sm" className="mt-4 w-full" onClick={() => { setView("review"); setNavOpen(false); }}>
        Review & submit
      </Button>
    </div>
  );

  return (
    <div className="flex min-h-dvh flex-col bg-neutral">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white">
        <div className="flex items-center gap-3 px-3 py-3 sm:px-6">
          <button type="button" onClick={() => navigate(`/quizzes/${attempt.quizId}`)} aria-label="Leave quiz" className="rounded-lg p-1.5 text-neutral-600 hover:bg-neutral-100">
            <X className="size-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate font-headline text-[15px] font-extrabold text-tertiary-500">{quiz?.title ?? "Quiz"}</p>
            <p className="truncate text-xs tracking-wide text-neutral-500 uppercase">{quiz?.courseCode ?? ""} · Quiz</p>
          </div>
          <span className="hidden items-center gap-1.5 text-xs font-semibold sm:inline-flex" role="status" aria-live="polite">
            {anySaving ? (
              <><Loader2 className="size-3.5 animate-spin text-neutral-400" /> <span className="text-neutral-500">Saving…</span></>
            ) : anyError ? (
              <><CloudOff className="size-3.5 text-danger" /> <span className="text-danger">Some answers not saved</span></>
            ) : Object.keys(status).length ? (
              <><Check className="size-3.5 text-primary-500" /> <span className="text-primary-500">All answers saved</span></>
            ) : null}
          </span>
          <div className={cn("flex items-center gap-1.5 rounded-full px-3 py-1.5 font-mono text-sm font-bold tabular-nums", timerTone)} role="timer" aria-label={`Time remaining ${label}`}>
            <Clock className="size-4" aria-hidden /> {label}
          </div>
        </div>
        <div className="h-1 bg-neutral-200" aria-hidden><div className="h-full bg-primary-500 transition-[width] duration-300" style={{ width: `${pct}%` }} /></div>
      </header>
      <OfflineBanner />
      <p className="sr-only" role="alert">{warning}</p>

      <div className="mx-auto flex w-full max-w-6xl flex-1 gap-8 px-4 py-6 sm:px-6 sm:py-10">
        <main className="min-w-0 flex-1">
          {submitError && <Alert tone="red" className="mb-4" title="Couldn't submit your quiz">{submitError} Your answers are saved — try again.</Alert>}
          {secondsLeft <= 300 && secondsLeft > 0 && (
            <Alert tone={secondsLeft <= 60 ? "red" : "amber"} className="mb-4" icon={<Clock className="size-4" />}>
              {secondsLeft <= 60 ? "Less than a minute left — your quiz will be submitted automatically." : "Less than 5 minutes left."}
            </Alert>
          )}

          {view === "question" ? (
            <>
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <p className="text-xs font-bold tracking-[0.08em] text-primary-500 uppercase">Question {index + 1} of {total}</p>
                  <p className="mt-1 text-xs text-neutral-500">{q.points} mark{q.points === 1 ? "" : "s"} · {q.type === "multiple_choice" ? "Select all that apply" : q.type === "short_answer" ? "Short answer" : q.type === "essay" ? "Written answer" : "Choose one"}</p>
                </div>
                <span className="text-xs font-semibold text-neutral-500">{answeredCount}/{total} answered</span>
              </div>

              <Card className="mt-4 p-5 sm:p-7">
                <RichContent html={q.promptHtml} className="text-base font-medium" />
                <div className="mt-6">
                  <AnswerInput q={q} value={answers[q.questionId]} onChange={(ans, debounce) => setAnswer(q, ans, debounce)} />
                </div>
                <p className="mt-3 h-4 text-right text-xs" aria-live="polite">
                  {status[q.questionId] === "saving" && <span className="text-neutral-400">Saving…</span>}
                  {status[q.questionId] === "saved" && <span className="text-primary-500">Saved</span>}
                  {status[q.questionId] === "error" && (
                    <button type="button" className="font-semibold text-danger underline" onClick={() => answers[q.questionId] && void persist(q.questionId, answers[q.questionId]!)}>Not saved — retry</button>
                  )}
                </p>
              </Card>
            </>
          ) : (
            <ReviewScreen
              questions={questions}
              answers={answers}
              flags={flags}
              onJump={go}
              onSubmit={() => setConfirmSubmit(true)}
              submitting={!!submitting}
            />
          )}
        </main>

        {!isMobile && (
          <aside className="w-60 shrink-0">
            <div className="sticky top-28 rounded-xl border border-neutral-200 bg-white p-4 shadow-card">{navigator}</div>
          </aside>
        )}
      </div>

      {/* Bottom nav (SLAN) */}
      <footer className="sticky bottom-0 z-20 border-t border-neutral-200 bg-white px-3 py-3 sm:px-6">
        <div className="mx-auto flex max-w-6xl items-center gap-2">
          {view === "question" ? (
            <>
              <Button variant="outline" onClick={() => go(index - 1)} disabled={index === 0} aria-label="Previous question" icon={<ChevronLeft className="size-4" />}>
                <span className="hidden sm:inline">Previous</span>
              </Button>
              <Button variant={flagged ? "secondary" : "subtle"} onClick={() => toggleFlag(q.questionId)} aria-pressed={flagged} icon={flagged ? <BookmarkCheck className="size-4" /> : <Bookmark className="size-4" />}>
                <span className="hidden sm:inline">{flagged ? "Flagged" : "Flag for review"}</span>
                <span className="sm:hidden">{flagged ? "Flagged" : "Flag"}</span>
              </Button>
              {isMobile && (
                <Button variant="subtle" onClick={() => setNavOpen(true)} aria-label="Question navigator" icon={<Grid3x3 className="size-4" />}>
                  {index + 1}/{total}
                </Button>
              )}
              <div className="ml-auto" />
              {index < total - 1 ? (
                <Button onClick={() => go(index + 1)}>
                  Next <ChevronRight className="size-4" />
                </Button>
              ) : (
                <Button onClick={() => setView("review")}>Review</Button>
              )}
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setView("question")} icon={<ChevronLeft className="size-4" />}>Back to questions</Button>
              <div className="ml-auto" />
              <Button onClick={() => setConfirmSubmit(true)} loading={submitting === "manual"}>Submit quiz</Button>
            </>
          )}
        </div>
      </footer>

      {/* Mobile navigator sheet */}
      {isMobile && navOpen && (
        <div className="fixed inset-0 z-[90]" role="dialog" aria-modal="true" aria-label="Question navigator">
          <div className="absolute inset-0 bg-tertiary-500/40" onClick={() => setNavOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-2xl bg-white p-5 shadow-pop">
            <div className="mb-3 flex items-center justify-between">
              <p className="font-headline font-extrabold text-tertiary-500">Jump to question</p>
              <button type="button" onClick={() => setNavOpen(false)} aria-label="Close" className="rounded-lg p-1.5 hover:bg-neutral-100"><X className="size-5" /></button>
            </div>
            {navigator}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmSubmit}
        onClose={() => setConfirmSubmit(false)}
        onConfirm={() => {
          setConfirmSubmit(false);
          void doSubmit("manual");
        }}
        title="Submit your quiz?"
        confirmLabel="Submit quiz"
        description={
          unanswered > 0
            ? `You have ${unanswered} unanswered question${unanswered === 1 ? "" : "s"}${flags.size ? ` and ${flags.size} flagged` : ""}. You can't change your answers after submitting.`
            : `All ${total} questions answered${flags.size ? ` (${flags.size} flagged)` : ""}. You can't change your answers after submitting.`
        }
      />

      <ConfirmDialog
        open={blocker.state === "blocked"}
        onClose={() => blocker.reset?.()}
        onConfirm={() => blocker.proceed?.()}
        title="Leave the quiz?"
        confirmLabel="Leave"
        tone="danger"
        description="Your answers are saved, but the timer keeps running while you're away. If time runs out, the quiz is submitted automatically."
      />

      {submitting && (
        <div className="fixed inset-0 z-[150] flex flex-col items-center justify-center gap-3 bg-white/90 backdrop-blur-sm" role="alert" aria-busy="true">
          <Loader2 className="size-8 animate-spin text-primary-500" />
          <p className="font-headline text-lg font-extrabold text-tertiary-500">{submitting === "auto" ? "Time's up — submitting your answers…" : "Submitting your quiz…"}</p>
        </div>
      )}
    </div>
  );
}

function AnswerInput({ q, value, onChange }: { q: QuizAttemptQuestion; value?: QuizAnswer; onChange: (a: QuizAnswer, debounce?: boolean) => void }) {
  const selected = new Set(value?.optionIds ?? []);
  if (q.type === "short_answer" || q.type === "essay") {
    return (
      <div>
        <label htmlFor={`ans-${q.questionId}`} className="sr-only">Your answer</label>
        <Textarea
          id={`ans-${q.questionId}`}
          rows={q.type === "essay" ? 10 : 3}
          value={value?.text ?? ""}
          onChange={(e) => onChange({ text: e.target.value }, true)}
          placeholder={q.type === "essay" ? "Write your answer…" : "Type your answer…"}
        />
      </div>
    );
  }
  const multi = q.type === "multiple_choice";
  const options = q.type === "true_false" && q.options.length === 0 ? [{ id: "true", text: "True" }, { id: "false", text: "False" }] : q.options;
  return (
    <div role={multi ? "group" : "radiogroup"} aria-label="Answer options" className="flex flex-col gap-3">
      {options.map((o, i) => {
        const on = selected.has(o.id);
        return (
          <button
            key={o.id}
            type="button"
            role={multi ? "checkbox" : "radio"}
            aria-checked={on}
            onClick={() => {
              if (multi) {
                const n = new Set(selected);
                if (n.has(o.id)) n.delete(o.id);
                else n.add(o.id);
                onChange({ optionIds: [...n] });
              } else onChange({ optionIds: [o.id] });
            }}
            className={cn(
              "flex items-center gap-3 rounded-xl border p-4 text-left transition-all",
              on ? "border-primary-500 bg-primary-500/5 shadow-sm" : "border-neutral-300 bg-white hover:border-primary-300",
            )}
          >
            <span className={cn("flex size-5 shrink-0 items-center justify-center border-2", multi ? "rounded-md" : "rounded-full", on ? "border-primary-500 bg-primary-500 text-white" : "border-neutral-300")}>
              {on && (multi ? <Check className="size-3.5" /> : <span className="size-2 rounded-full bg-white" />)}
            </span>
            <span className="text-xs font-bold text-neutral-400">{String.fromCharCode(65 + i)}</span>
            <span className="text-[15px] leading-relaxed text-neutral-700">{o.text}</span>
          </button>
        );
      })}
    </div>
  );
}

function ReviewScreen({
  questions,
  answers,
  flags,
  onJump,
  onSubmit,
  submitting,
}: {
  questions: QuizAttemptQuestion[];
  answers: Record<string, QuizAnswer>;
  flags: Set<string>;
  onJump: (i: number) => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  const answered = questions.filter((q) => isAnswered(answers[q.questionId])).length;
  return (
    <div>
      <h1 className="font-headline text-2xl font-extrabold text-tertiary-500">Review your answers</h1>
      <p className="mt-1 text-sm text-neutral-500">
        {answered} of {questions.length} answered{flags.size ? ` · ${flags.size} flagged for review` : ""}. Select a question to change your answer.
      </p>
      <Card className="mt-5 divide-y divide-neutral-100">
        {questions.map((q, i) => {
          const ans = answers[q.questionId];
          const done = isAnswered(ans);
          const summary = done ? (ans?.text ? ans.text.slice(0, 80) : q.options.filter((o) => ans?.optionIds?.includes(o.id)).map((o) => o.text).join(", ")) : "Not answered";
          return (
            <button key={q.questionId} type="button" onClick={() => onJump(i)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-neutral-50">
              <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold", done ? "bg-primary-500 text-white" : "border border-neutral-300 text-neutral-500")}>{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="line-clamp-1 block text-sm text-tertiary-500" dangerouslySetInnerHTML={{ __html: q.promptHtml.replace(/<[^>]+>/g, " ") }} />
                <span className={cn("line-clamp-1 block text-xs", done ? "text-neutral-500" : "font-semibold text-warning")}>{summary || "Answered"}</span>
              </span>
              {flags.has(q.questionId) && <Badge tone="gold"><Bookmark className="size-3" /> Flagged</Badge>}
              <ChevronRight className="size-4 shrink-0 text-neutral-400" />
            </button>
          );
        })}
      </Card>
      <div className="mt-6 flex justify-end">
        <Button size="lg" onClick={onSubmit} loading={submitting}>Submit quiz</Button>
      </div>
    </div>
  );
}

/* ───────────────────────── Results ───────────────────────── */

function Results({ attempt, quiz }: { attempt: QuizAttempt; quiz?: Quiz }) {
  const hasScore = attempt.score !== undefined && attempt.score !== null;
  const showBreakdown = attempt.questions.some((q) => q.result);
  const pct = hasScore ? Math.round(((attempt.score ?? 0) / Math.max(1, attempt.maxScore)) * 100) : null;
  const correct = attempt.questions.filter((q) => q.result?.correct === true).length;
  const incorrect = attempt.questions.filter((q) => q.result?.correct === false).length;
  const pendingQ = attempt.questions.filter((q) => q.result && q.result.correct === null).length;

  const items = useMemo(() => attempt.questions, [attempt.questions]);

  return (
    <div className="min-h-dvh bg-neutral">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3">
          <Link to="/" aria-label="Dashboard"><Logo compact /></Link>
          <div className="min-w-0 flex-1">
            <p className="truncate font-headline text-[15px] font-extrabold text-tertiary-500">{quiz?.title ?? "Quiz results"}</p>
            <p className="text-xs text-neutral-500 uppercase">{quiz?.courseCode} · Results</p>
          </div>
          <Link to={`/quizzes/${attempt.quizId}`} className={buttonClasses("outline", "sm")}>Back to quiz</Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        <Card className="overflow-hidden">
          <div className="bg-[linear-gradient(135deg,#091222_0%,#142647_55%,#192f59_100%)] px-6 py-8 text-center text-white">
            <Award className="mx-auto size-10 text-secondary-400" aria-hidden />
            <h1 className="mt-3 font-headline text-2xl font-extrabold">{attempt.state === "auto_submitted" ? "Time's up — quiz submitted" : "Quiz submitted"}</h1>
            <p className="mt-1 text-sm text-white/75">
              {attemptStateLabel[attempt.state]}{attempt.submittedAt ? ` · ${fmtDateTime(attempt.submittedAt)}` : ""}
            </p>
            {hasScore ? (
              <div className="mx-auto mt-6 flex size-32 flex-col items-center justify-center rounded-full border-4 border-secondary-500">
                <span className="font-headline text-3xl font-extrabold">{attempt.score}</span>
                <span className="text-xs text-white/70">of {attempt.maxScore} · {pct}%</span>
              </div>
            ) : (
              <p className="mx-auto mt-6 max-w-sm rounded-lg bg-white/10 px-4 py-3 text-sm">
                {quiz?.showResults === "after_close" ? "Your score will be available after the quiz closes." : "Your score will be released by your lecturer."}
              </p>
            )}
          </div>
          <div className="grid grid-cols-3 divide-x divide-neutral-100 text-center">
            <Stat icon={<CheckCircle2 className="size-4 text-success" />} label="Correct" value={showBreakdown ? correct : "—"} />
            <Stat icon={<XCircle className="size-4 text-danger" />} label="Incorrect" value={showBreakdown ? incorrect : "—"} />
            <Stat icon={<Hourglass className="size-4 text-warning" />} label="Pending marking" value={attempt.pendingManualMarks || pendingQ} />
          </div>
        </Card>

        {attempt.pendingManualMarks > 0 && (
          <Alert tone="amber" className="mt-5" icon={<ClipboardCheck className="size-4" />} title="Pending manual marking">
            {attempt.pendingManualMarks} written answer{attempt.pendingManualMarks === 1 ? " is" : "s are"} waiting to be marked by your lecturer. Your score may change.
          </Alert>
        )}

        {showBreakdown ? (
          <section className="mt-8" aria-labelledby="review-h">
            <h2 id="review-h" className="mb-3 font-headline text-lg font-extrabold text-tertiary-500">Review answers</h2>
            <div className="space-y-4">
              {items.map((q, i) => <ResultItem key={q.questionId} q={q} index={i} />)}
            </div>
          </section>
        ) : (
          <Card className="mt-6 p-6 text-center text-sm text-neutral-500">
            Per-question feedback isn't available for this quiz yet.
          </Card>
        )}
      </main>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <div className="px-3 py-4">
      <p className="flex items-center justify-center gap-1.5 text-xs text-neutral-500">{icon} {label}</p>
      <p className="mt-1 font-headline text-xl font-extrabold text-tertiary-500">{value}</p>
    </div>
  );
}

function ResultItem({ q, index }: { q: QuizAttemptQuestion; index: number }) {
  const r = q.result;
  const correctIds = new Set(r?.correctOptionIds ?? []);
  const chosen = new Set(q.answer?.optionIds ?? []);
  const state = r?.correct === true ? "correct" : r?.correct === false ? "incorrect" : "pending";
  return (
    <Card className={cn("border-l-4 p-5", state === "correct" ? "border-l-success" : state === "incorrect" ? "border-l-danger" : "border-l-warning")}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-bold tracking-wide text-neutral-500 uppercase">Question {index + 1}</p>
        <span className="flex items-center gap-1.5 text-xs font-semibold">
          {state === "correct" ? <><CheckCircle2 className="size-4 text-success" /> Correct</> : state === "incorrect" ? <><XCircle className="size-4 text-danger" /> Incorrect</> : <><MinusCircle className="size-4 text-warning" /> Awaiting marking</>}
          {r && <span className="text-neutral-500">· {r.awarded}/{q.points}</span>}
        </span>
      </div>
      <RichContent html={q.promptHtml} className="mt-2 text-[15px]" />
      {q.options.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {q.options.map((o) => {
            const isCorrect = correctIds.has(o.id);
            const isChosen = chosen.has(o.id);
            return (
              <li key={o.id} className={cn("flex items-center gap-2 rounded-lg border px-3 py-2 text-sm", isCorrect ? "border-success/40 bg-success-50" : isChosen ? "border-danger/40 bg-danger-50" : "border-neutral-200")}>
                {isCorrect ? <CheckCircle2 className="size-4 shrink-0 text-success" aria-label="Correct answer" /> : isChosen ? <XCircle className="size-4 shrink-0 text-danger" aria-label="Your answer" /> : <span className="size-4 shrink-0" />}
                <span className="flex-1 text-neutral-700">{o.text}</span>
                {isChosen && <span className="text-[11px] font-semibold text-neutral-500">Your answer</span>}
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="mt-3 rounded-lg bg-neutral-100 p-3 text-sm whitespace-pre-wrap text-neutral-700">
          <p className="mb-1 text-[11px] font-semibold text-neutral-500 uppercase">Your answer</p>
          {q.answer?.text || <span className="text-neutral-400">No answer</span>}
        </div>
      )}
      {r?.explanation && (
        <div className="mt-3 rounded-lg bg-secondary-50 p-3 text-sm text-neutral-700">
          <p className="mb-0.5 text-[11px] font-bold text-secondary-800 uppercase">{state === "correct" ? "Feedback" : "Explanation"}</p>
          {r.explanation}
        </div>
      )}
    </Card>
  );
}
