import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Clock, Layers, PlayCircle, RotateCcw, Target, ClipboardCheck } from "lucide-react";
import { api, errorMessage, fmtDateTime } from "@tasued/api-client";
import { Alert, Badge, Button, Card, CardBody, CardHeader, ConfirmDialog, PageHeader, RichContent, buttonClasses, useToast } from "@tasued/ui";
import { Async, PageSkeleton } from "../../components/Async";
import { Breadcrumbs, Page, quizWindow, quizWindowBadge } from "../../components/bits";
import { attemptKey, attemptStateLabel } from "./meta";


export default function QuizDetailPage() {
  const { quizId } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const quiz = useQuery({ queryKey: ["quizzes", quizId], queryFn: () => api.quizzes.get(quizId!), enabled: !!quizId });
  const attempts = useQuery({ queryKey: ["quizzes", quizId, "attempts", "mine"], queryFn: () => api.quizzes.myAttempts(quizId!), enabled: !!quizId });

  const start = useMutation({
    mutationFn: () => api.quizzes.start(quizId!),
    onSuccess: (att) => {
      qc.setQueryData(attemptKey(att.id), att);
      void qc.invalidateQueries({ queryKey: ["quizzes", quizId, "attempts", "mine"] });
      navigate(`/quizzes/attempts/${att.id}`);
    },
    onError: (e) => {
      setConfirm(false);
      toast.error("Couldn't start the quiz", errorMessage(e));
    },
  });

  return (
    <Page narrow>
      <Async query={quiz} skeleton={<PageSkeleton />}>
        {(qz) => {
          const win = quizWindow(qz);
          const list = [...(attempts.data ?? [])].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
          const inProgress = list.find((a) => a.state === "in_progress" && new Date(a.deadlineAt).getTime() > Date.now());
          const used = list.length;
          const left = Math.max(0, qz.attemptsAllowed - used);
          return (
            <>
              <PageHeader
                breadcrumb={<Breadcrumbs items={[{ label: "Quizzes", to: "/quizzes" }, { label: qz.courseCode, to: `/courses/${qz.courseId}/quizzes` }, { label: qz.title }]} />}
                title={qz.title}
                description={<span className="inline-flex items-center gap-2">{qz.courseCode} {quizWindowBadge(win)}</span>}
              />

              {/* Intro (SLAN AssessmentView intro screen) */}
              <Card className="overflow-hidden">
                <div className="grid grid-cols-2 gap-px bg-neutral-200 sm:grid-cols-4">
                  {[
                    { icon: Clock, label: "Time limit", value: `${qz.timeLimitMinutes} min` },
                    { icon: Layers, label: "Questions", value: qz.drawCount },
                    { icon: RotateCcw, label: "Attempts", value: attempts.data ? `${used} of ${qz.attemptsAllowed} used` : `${qz.attemptsAllowed} allowed` },
                    { icon: Target, label: "Worth", value: `${qz.maxScore} marks · ${qz.weightPercent}%` },
                  ].map((s) => (
                    <div key={s.label} className="bg-white p-4">
                      <s.icon className="size-4 text-primary-500" aria-hidden />
                      <p className="mt-2 text-xs text-neutral-500">{s.label}</p>
                      <p className="font-headline text-sm font-extrabold text-tertiary-500">{s.value}</p>
                    </div>
                  ))}
                </div>
                <CardBody className="space-y-5">
                  {qz.descriptionHtml && <RichContent html={qz.descriptionHtml} />}
                  <p className="flex items-center gap-2 text-sm text-neutral-600">
                    <CalendarClock className="size-4 text-neutral-400" aria-hidden /> Open {fmtDateTime(qz.opensAt)} – {fmtDateTime(qz.closesAt)}
                  </p>
                  <div className="rounded-lg bg-neutral-100 p-4">
                    <p className="mb-2 text-xs font-bold tracking-wide text-neutral-500 uppercase">Before you start</p>
                    <ul className="list-disc space-y-1 pl-5 text-sm text-neutral-700">
                      <li>The timer starts when you press Start and keeps running even if you close the page.</li>
                      <li>Each answer saves automatically. You can move between questions and flag them for review.</li>
                      <li>When time runs out your quiz is submitted automatically with the answers saved so far.</li>
                      <li>Questions are drawn at random, so each attempt may differ.</li>
                      <li>
                        {qz.showResults === "immediately"
                          ? "You'll see your results as soon as you submit."
                          : qz.showResults === "after_close"
                            ? "Results are released after the quiz closes."
                            : "Results are released by your lecturer."}
                      </li>
                    </ul>
                  </div>
                  {inProgress ? (
                    <Link to={`/quizzes/attempts/${inProgress.id}`} className={buttonClasses("primary", "lg", "w-full sm:w-auto")}>
                      <PlayCircle className="size-4" /> Resume attempt
                    </Link>
                  ) : win === "upcoming" ? (
                    <Alert tone="blue">This quiz opens {fmtDateTime(qz.opensAt)}.</Alert>
                  ) : win === "closed" ? (
                    <Alert tone="neutral">This quiz closed {fmtDateTime(qz.closesAt)}.</Alert>
                  ) : left === 0 ? (
                    <Alert tone="neutral">You've used all {qz.attemptsAllowed} attempt{qz.attemptsAllowed === 1 ? "" : "s"}.</Alert>
                  ) : (
                    <Button size="lg" className="w-full sm:w-auto" icon={<PlayCircle className="size-4" />} onClick={() => setConfirm(true)} disabled={attempts.isPending}>
                      Start {used > 0 ? `attempt ${used + 1}` : "quiz"}
                    </Button>
                  )}
                </CardBody>
              </Card>

              <Card className="mt-6">
                <CardHeader title="Your attempts" />
                <Async query={attempts} isEmpty={(d) => d.length === 0} empty={<p className="px-5 py-6 text-sm text-neutral-500">You haven't attempted this quiz yet.</p>}>
                  {() => (
                    <ul className="divide-y divide-neutral-100">
                      {list.map((a, i) => (
                        <li key={a.id}>
                          <Link to={`/quizzes/attempts/${a.id}`} className="flex flex-wrap items-center gap-3 px-5 py-3.5 hover:bg-neutral-50">
                            <ClipboardCheck className="size-4 text-neutral-400" aria-hidden />
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-semibold text-tertiary-500">Attempt {list.length - i}</span>
                              <span className="block text-xs text-neutral-500">Started {fmtDateTime(a.startedAt)}{a.submittedAt ? ` · submitted ${fmtDateTime(a.submittedAt)}` : ""}</span>
                            </span>
                            <Badge tone={a.state === "in_progress" ? "amber" : a.state === "marked" ? "gold" : "green"}>{attemptStateLabel[a.state]}</Badge>
                            <span className="w-20 text-right text-sm font-bold text-tertiary-500">
                              {a.score !== undefined && a.score !== null ? `${a.score}/${a.maxScore}` : a.state === "in_progress" ? "—" : "Hidden"}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </Async>
              </Card>

              <ConfirmDialog
                open={confirm}
                onClose={() => setConfirm(false)}
                onConfirm={() => start.mutate()}
                loading={start.isPending}
                title="Start the quiz now?"
                confirmLabel="Start timer"
                description={`You'll have ${qz.timeLimitMinutes} minutes. The timer can't be paused once it starts.`}
              />
            </>
          );
        }}
      </Async>
    </Page>
  );
}
