import { blocksCachedData } from "@tasued/api-client";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CheckCheck } from "lucide-react";
import { api, errorMessage, fmtDateTime, type ID, type QuizAttempt, type QuizAttemptQuestion } from "@tasued/api-client";
import { Badge, Button, EmptyState, ErrorState, Input, PageLoader, RichContent, Table, TBody, TD, TH, THead, TR, Tabs } from "../../components/ui";
import { ListSkeleton, QueryView, SectionCard } from "../../components/common";
import { useApiMutation } from "../../components/mutation";
import { useCourseId } from "../../components/queries";
import { useCan } from "../../app/session";

const STATE: Record<QuizAttempt["state"], { label: string; tone: "blue" | "green" | "amber" | "neutral" }> = {
  in_progress: { label: "In progress", tone: "blue" },
  submitted: { label: "Submitted", tone: "neutral" },
  auto_submitted: { label: "Auto-submitted", tone: "amber" },
  marked: { label: "Marked", tone: "green" },
};

export function QuizAttemptsPage() {
  const { quizId } = useParams();
  const courseId = useCourseId();
  const can = useCan();
  const [tab, setTab] = useState<"attempts" | "marking">("attempts");
  const quiz = useQuery({ queryKey: ["quizzes", "get", quizId], queryFn: () => api.quizzes.get(quizId!), enabled: !!quizId });
  const attempts = useQuery({ queryKey: ["quizzes", "attempts", quizId], queryFn: () => api.quizzes.attempts(quizId!), enabled: !!quizId });
  const queue = useQuery({ queryKey: ["quizzes", "marking", quizId], queryFn: () => api.quizzes.markingQueue(quizId!), enabled: !!quizId && can("quizzes.grade") });

  if (quiz.isPending) return <PageLoader />;
  if (quiz.isError && (quiz.data === undefined || blocksCachedData(quiz.error))) return <ErrorState description={errorMessage(quiz.error)} onRetry={() => quiz.refetch()} />;
  const pendingCount = queue.data?.reduce((n, a) => n + a.pendingManualMarks, 0) ?? 0;

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <Link to={`/courses/${courseId}/quizzes`} className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100" aria-label="Back to quizzes"><ArrowLeft className="size-5" /></Link>
        <div>
          <h2 className="font-headline text-xl font-extrabold text-tertiary-500">{quiz.data.title}</h2>
          <p className="text-sm text-neutral-500">{quiz.data.drawCount} questions · {quiz.data.timeLimitMinutes} min · closes {fmtDateTime(quiz.data.closesAt)}</p>
        </div>
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[{ key: "attempts", label: "Attempts", count: attempts.data?.length }, ...(can("quizzes.grade") ? [{ key: "marking" as const, label: "Manual marking", count: pendingCount }] : [])]} />
      {tab === "attempts" ? (
        <SectionCard>
          <QueryView query={attempts} loading={<ListSkeleton />} isEmpty={(d) => !d.length} empty={<EmptyState title="No attempts yet" />}>
            {(rows) => (
              <Table>
                <THead><tr><TH>Student</TH><TH>State</TH><TH>Started</TH><TH>Submitted</TH><TH>Score</TH><TH>To mark</TH></tr></THead>
                <TBody>
                  {rows.map((a) => (
                    <TR key={a.id}>
                      <TD className="font-semibold">{a.studentName ?? a.userId}</TD>
                      <TD><Badge tone={STATE[a.state].tone}>{STATE[a.state].label}</Badge></TD>
                      <TD className="text-xs whitespace-nowrap">{fmtDateTime(a.startedAt)}</TD>
                      <TD className="text-xs whitespace-nowrap">{a.submittedAt ? fmtDateTime(a.submittedAt) : "—"}</TD>
                      <TD>{a.score != null ? <><strong>{a.score}</strong>/{a.maxScore}</> : "—"}</TD>
                      <TD>{a.pendingManualMarks > 0 ? <Badge tone="amber">{a.pendingManualMarks}</Badge> : "—"}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </QueryView>
        </SectionCard>
      ) : (
        <QueryView query={queue} loading={<SectionCard><ListSkeleton /></SectionCard>} isEmpty={(d) => !d.length} empty={<SectionCard><EmptyState icon={<CheckCheck className="size-6" />} title="Nothing to mark" description="Essay and short answers that need a human appear here." /></SectionCard>}>
          {(rows) => (
            <div className="space-y-4">
              {rows.map((a) => <MarkingCard key={a.id} attempt={a} quizId={quizId!} />)}
            </div>
          )}
        </QueryView>
      )}
    </div>
  );
}

const needsMark = (q: QuizAttemptQuestion) => (q.type === "essay" || q.type === "short_answer") && (!q.result || q.result.correct === null);

function MarkingCard({ attempt, quizId }: { attempt: QuizAttempt; quizId: ID }) {
  const items = attempt.questions.filter((q) => q.type === "essay" || q.type === "short_answer");
  return (
    <SectionCard title={attempt.studentName ?? attempt.userId} subtitle={`Submitted ${fmtDateTime(attempt.submittedAt)} · ${attempt.pendingManualMarks} awaiting marks`}>
      <ol className="divide-y divide-neutral-100">
        {items.map((q, i) => <MarkRow key={q.questionId} attemptId={attempt.id} quizId={quizId} q={q} n={i + 1} />)}
      </ol>
    </SectionCard>
  );
}

function MarkRow({ attemptId, quizId, q, n }: { attemptId: ID; quizId: ID; q: QuizAttemptQuestion; n: number }) {
  const [awarded, setAwarded] = useState(q.result && q.result.correct !== null ? String(q.result.awarded) : "");
  const [error, setError] = useState<string>();
  const mark = useApiMutation({
    mutationFn: () => api.quizzes.markAnswer(attemptId, q.questionId, { awarded: Number(awarded) }),
    success: "Mark saved",
    invalidate: [["quizzes", "marking", quizId], ["quizzes", "attempts", quizId], ["grades"]],
  });
  const submit = () => {
    const v = Number(awarded);
    const e = awarded === "" || !Number.isFinite(v) || v < 0 || v > q.points ? `Award 0–${q.points}` : undefined;
    setError(e);
    if (!e) mark.mutate(undefined);
  };
  return (
    <li className="grid gap-3 px-5 py-4 lg:grid-cols-[minmax(0,1fr)_200px]">
      <div className="min-w-0">
        <p className="mb-1 flex items-center gap-2 text-xs font-bold text-primary-500 uppercase">Q{n} · {q.type === "essay" ? "Essay" : "Short answer"} · {q.points} pts {needsMark(q) ? <Badge tone="amber">Needs marking</Badge> : <Badge tone="green">Marked</Badge>}</p>
        <RichContent html={q.promptHtml} className="text-sm" />
        <div className="mt-2 rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-sm whitespace-pre-wrap">{q.answer?.text?.trim() || <span className="text-neutral-500 italic">No answer given</span>}</div>
      </div>
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <label htmlFor={`m-${attemptId}-${q.questionId}`} className="mb-1 block text-xs font-semibold">Award (max {q.points})</label>
          <Input id={`m-${attemptId}-${q.questionId}`} type="number" min={0} max={q.points} step="0.5" value={awarded} onChange={(e) => setAwarded(e.target.value)} invalid={!!error} />
          {error && <p className="mt-1 text-xs text-danger">{error}</p>}
        </div>
        <Button className="mt-5" size="sm" onClick={submit} loading={mark.isPending}>Save</Button>
      </div>
    </li>
  );
}
