import { portalUrl } from "@tasued/api-client";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CalendarPlus, Lock, Paperclip, Send } from "lucide-react";
import { Editor as RichTextEditor } from "../../components/Editor";
import { api, errorMessage, fmtBytes, fmtDateTime, type Assignment, type Submission } from "@tasued/api-client";
import { Alert, Badge, Button, ConfirmDialog, Drawer, EmptyState, ErrorState, Field, Input, KeyValue, Modal, PageLoader, RichContent, SegmentedControl, Select, Table, TBody, TD, TH, THead, TR, Tabs, Textarea } from "../../components/ui";
import { ListSkeleton, QueryView, SectionCard } from "../../components/common";
import { hasErrors, useApiMutation } from "../../components/mutation";
import { useCourseId } from "../../components/queries";
import { fromLagosInput, toLagosInput } from "../../components/time";
import { useCan } from "../../app/session";

type Filter = "all" | "to_grade" | "graded" | "not_submitted";

export function SubmissionsPage() {
  const { assignmentId } = useParams();
  const q = useQuery({ queryKey: ["assignments", "get", assignmentId], queryFn: () => api.assignments.get(assignmentId!), enabled: !!assignmentId });
  if (q.isPending) return <PageLoader />;
  if (q.isError) return <ErrorState description={errorMessage(q.error)} onRetry={() => q.refetch()} />;
  return <Submissions assignment={q.data} />;
}

function Submissions({ assignment: a }: { assignment: Assignment }) {
  const courseId = useCourseId();
  const can = useCan();
  const [tab, setTab] = useState<"submissions" | "extensions">("submissions");
  const [filter, setFilter] = useState<Filter>("all");
  const [grading, setGrading] = useState<Submission | null>(null);
  const [releasing, setReleasing] = useState(false);
  const [extending, setExtending] = useState(false);
  const subs = useQuery({ queryKey: ["assignments", "submissions", a.id], queryFn: () => api.assignments.submissions(a.id) });
  const exts = useQuery({ queryKey: ["assignments", "extensions", a.id], queryFn: () => api.assignments.extensions(a.id) });
  const release = useApiMutation({
    mutationFn: () => api.assignments.releaseGrades(a.id),
    success: (r) => `${r.released} grade(s) released to students`,
    invalidate: [["assignments"], ["grades"]],
    onSuccess: () => setReleasing(false),
  });

  const all = subs.data ?? [];
  const unreleased = all.filter((s) => s.grade && !s.grade.released).length;
  const filtered = all.filter((s) =>
    filter === "all" ? true : filter === "to_grade" ? s.state === "submitted" && !s.grade : filter === "graded" ? !!s.grade : s.state !== "submitted",
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <Link to={`/courses/${courseId}/assignments`} className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100" aria-label="Back to assignments"><ArrowLeft className="size-5" /></Link>
          <div>
            <h2 className="font-headline text-xl font-extrabold text-tertiary-500">{a.title}</h2>
            <p className="text-sm text-neutral-500">Due {fmtDateTime(a.dueAt)} · {a.maxScore} marks · late: {a.latePolicy.replace(/_/g, " ")}{a.latePenaltyPercentPerDay ? ` (${a.latePenaltyPercentPerDay}%/day)` : ""}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" icon={<CalendarPlus className="size-4" />} onClick={() => setExtending(true)}>Grant extension</Button>
          {can("grades.release") && <Button icon={<Send className="size-4" />} disabled={!unreleased} onClick={() => setReleasing(true)}>Release grades{unreleased ? ` (${unreleased})` : ""}</Button>}
        </div>
      </div>

      <Alert tone="navy" icon={<Lock className="size-4" />} title="Submissions are final and can't be reopened">
        A submitted answer is locked for good — no one (student, lecturer or admin) can edit, replace, withdraw or reopen it. You can grade it and leave feedback. If a student needs more time, grant an extension <em>before</em> they submit.
      </Alert>

      <Tabs value={tab} onChange={setTab} tabs={[{ key: "submissions", label: "Submissions", count: all.filter((s) => s.state === "submitted").length }, { key: "extensions", label: "Extensions", count: exts.data?.length }]} />

      {tab === "submissions" ? (
        <SectionCard action={<SegmentedControl<Filter> value={filter} onChange={setFilter} options={[{ key: "all", label: "All" }, { key: "to_grade", label: "To grade" }, { key: "graded", label: "Graded" }, { key: "not_submitted", label: "Not submitted" }]} />}>
          <QueryView query={subs} loading={<ListSkeleton />}>
            {() =>
              filtered.length === 0 ? (
                <EmptyState title="No submissions here" />
              ) : (
                <Table>
                  <THead><tr><TH>Student</TH><TH>State</TH><TH>Submitted</TH><TH>Receipt</TH><TH>Grade</TH><TH className="text-right">Action</TH></tr></THead>
                  <TBody>
                    {filtered.map((s) => (
                      <TR key={s.id}>
                        <TD><p className="font-semibold">{s.studentName ?? s.userId}</p><p className="text-xs text-neutral-500">{s.matricNumber ?? ""}{s.extensionDueAt && ` · extended to ${fmtDateTime(s.extensionDueAt)}`}</p></TD>
                        <TD>
                          {s.state === "submitted" ? <Badge tone="green"><Lock className="size-3" /> Final</Badge> : s.state === "draft" ? <Badge tone="gold">Draft (not submitted)</Badge> : <Badge>Not started</Badge>}
                          {s.isLate && <Badge tone="red" className="ml-1">Late</Badge>}
                        </TD>
                        <TD className="text-xs whitespace-nowrap">{s.submittedAt ? fmtDateTime(s.submittedAt) : "—"}</TD>
                        <TD className="font-mono text-xs">{s.receiptCode ?? "—"}</TD>
                        <TD>{s.grade ? <span className="whitespace-nowrap"><strong>{s.grade.score}</strong>/{s.grade.maxScore} {s.grade.released ? <Badge tone="green">Released</Badge> : <Badge>Not released</Badge>}</span> : "—"}</TD>
                        <TD className="text-right">{s.state === "submitted" && can("assignments.grade") && <Button size="xs" variant={s.grade ? "ghost" : "outline"} onClick={() => setGrading(s)}>{s.grade ? "Edit grade" : "Grade"}</Button>}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              )
            }
          </QueryView>
        </SectionCard>
      ) : (
        <SectionCard title="Extensions" subtitle="Extensions move a student's due date. They don't reopen submitted work.">
          <QueryView query={exts} loading={<ListSkeleton />} isEmpty={(d) => !d.length} empty={<EmptyState title="No extensions granted" action={<Button size="sm" variant="outline" onClick={() => setExtending(true)}>Grant extension</Button>} />}>
            {(rows) => (
              <Table>
                <THead><tr><TH>Student</TH><TH>New due date</TH><TH>Reason</TH><TH>Granted</TH></tr></THead>
                <TBody>
                  {rows.map((x) => (
                    <TR key={x.id}>
                      <TD className="font-semibold">{x.studentName}</TD>
                      <TD className="text-sm whitespace-nowrap">{fmtDateTime(x.newDueAt)}</TD>
                      <TD className="text-sm">{x.reason}</TD>
                      <TD className="text-xs text-neutral-500">{x.grantedBy}, {fmtDateTime(x.grantedAt)}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </QueryView>
        </SectionCard>
      )}

      {grading && <GradeDrawer assignment={a} submission={grading} onClose={() => setGrading(null)} />}
      {extending && <ExtensionModal assignment={a} submissions={all} onClose={() => setExtending(false)} />}
      <ConfirmDialog open={releasing} onClose={() => setReleasing(false)} onConfirm={() => release.mutate(undefined)} loading={release.isPending} title="Release grades?" description={`${unreleased} graded submission(s) will become visible to students with your feedback, and students will be notified.`} confirmLabel="Release grades" />
    </div>
  );
}

function GradeDrawer({ assignment, submission: s, onClose }: { assignment: Assignment; submission: Submission; onClose: () => void }) {
  const [score, setScore] = useState(s.grade ? String(s.grade.score) : "");
  const [feedback, setFeedback] = useState(s.grade?.feedbackHtml ?? "");
  const [error, setError] = useState<string>();
  const save = useApiMutation({
    mutationFn: () => api.assignments.grade(assignment.id, s.id, { score: Number(score), feedbackHtml: feedback || undefined }),
    success: "Grade saved",
    invalidate: [["assignments"], ["grades"], ["dashboards"]],
    onSuccess: onClose,
  });
  const submit = () => {
    const n = Number(score);
    const e = score === "" || !Number.isFinite(n) ? "Enter a score" : n < 0 || n > assignment.maxScore ? `0–${assignment.maxScore}` : undefined;
    setError(e);
    if (!e) save.mutate(undefined);
  };
  return (
    <Drawer open onClose={onClose} title={`Grade — ${s.studentName ?? ""}`} width={640} footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={submit} loading={save.isPending}>Save grade</Button></>}>
      <div className="space-y-5">
        <KeyValue items={[
          { label: "Submitted", value: fmtDateTime(s.submittedAt) },
          { label: "Receipt code", value: <span className="font-mono">{s.receiptCode ?? "—"}</span> },
          { label: "Late", value: s.isLate ? <Badge tone="red">Yes</Badge> : "No" },
          { label: "State", value: <Badge tone="green"><Lock className="size-3" /> Final — can't be reopened</Badge> },
        ]} />
        {s.textHtml && (
          <div>
            <p className="mb-1.5 text-[13px] font-semibold text-tertiary-500">Text answer</p>
            <div className="max-h-80 overflow-y-auto rounded-lg border border-neutral-200 bg-neutral-50 p-4"><RichContent html={s.textHtml} className="text-sm" /></div>
          </div>
        )}
        <div>
          <p className="mb-1.5 text-[13px] font-semibold text-tertiary-500">Files ({s.files.length})</p>
          {s.files.length === 0 ? <p className="text-sm text-neutral-500">No files.</p> : (
            <ul className="space-y-1.5">
              {s.files.map((f) => (
                <li key={f.id}><a href={portalUrl(f.url)} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-lg border border-neutral-200 px-3 py-2 text-sm hover:border-primary-300"><Paperclip className="size-4 text-neutral-400" /><span className="flex-1 truncate font-semibold">{f.name}</span><span className="text-xs text-neutral-500">{fmtBytes(f.sizeBytes)}</span></a></li>
              ))}
            </ul>
          )}
        </div>
        <Field label={`Score (out of ${assignment.maxScore})`} required error={error} htmlFor="g-score" hint={s.isLate && assignment.latePolicy === "accepted_with_penalty" ? `The late penalty (${assignment.latePenaltyPercentPerDay}%/day) is applied automatically on top of this.` : undefined}>
          <Input id="g-score" type="number" min={0} max={assignment.maxScore} step="0.5" className="max-w-[160px]" value={score} onChange={(e) => setScore(e.target.value)} invalid={!!error} />
        </Field>
        <Field label="Feedback"><RichTextEditor value={feedback} onChange={setFeedback} variant="simple" minHeight={140} placeholder="Feedback the student sees when grades are released" /></Field>
        {s.grade && <p className="text-xs text-neutral-500">Last graded by {s.grade.gradedBy}, {fmtDateTime(s.grade.gradedAt)}.{s.grade.released && " This grade is already released — students see changes immediately."}</p>}
      </div>
    </Drawer>
  );
}

function ExtensionModal({ assignment, submissions, onClose }: { assignment: Assignment; submissions: Submission[]; onClose: () => void }) {
  const eligible = submissions.filter((s) => s.state !== "submitted");
  const [userId, setUserId] = useState("");
  const [due, setDue] = useState(toLagosInput(new Date(new Date(assignment.dueAt).getTime() + 3 * 864e5).toISOString()));
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<{ userId?: string; due?: string; reason?: string }>({});
  const save = useApiMutation({
    mutationFn: () => api.assignments.grantExtension(assignment.id, { userId, newDueAt: fromLagosInput(due), reason: reason.trim() }),
    success: "Extension granted — the student has been notified",
    invalidate: [["assignments", "extensions", assignment.id], ["assignments", "submissions", assignment.id]],
    onSuccess: onClose,
  });
  const submit = () => {
    const e = {
      userId: userId ? undefined : "Choose a student",
      due: !due ? "Required" : fromLagosInput(due) <= assignment.dueAt ? "Must be after the original due date" : undefined,
      reason: reason.trim() ? undefined : "A reason is required for the record",
    };
    setErrors(e);
    if (!hasErrors(e)) save.mutate(undefined);
  };
  return (
    <Modal open onClose={onClose} title="Grant extension" description="Only students who haven't submitted can get an extension." footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={submit} loading={save.isPending}>Grant</Button></>}>
      <div className="space-y-4">
        <Field label="Student" required error={errors.userId} htmlFor="ext-user">
          <Select id="ext-user" value={userId} onChange={(e) => setUserId(e.target.value)} invalid={!!errors.userId}>
            <option value="">Choose…</option>
            {eligible.map((s) => <option key={s.userId} value={s.userId}>{s.studentName ?? s.userId}{s.matricNumber ? ` (${s.matricNumber})` : ""}</option>)}
          </Select>
        </Field>
        <Field label="New due date (Lagos time)" required error={errors.due} htmlFor="ext-due"><Input id="ext-due" type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} invalid={!!errors.due} /></Field>
        <Field label="Reason" required error={errors.reason} htmlFor="ext-reason"><Textarea id="ext-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} invalid={!!errors.reason} placeholder="e.g. Medical certificate received" /></Field>
      </div>
    </Modal>
  );
}
