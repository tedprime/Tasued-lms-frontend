import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, CheckCircle2, CloudOff, Cloud, Loader2, Lock, Upload, Info, MessageSquareText } from "lucide-react";
import { api, errorMessage, fmtBytes, fmtDate, fmtDateTime, fmtTime, isApiError, type Assignment, type Submission } from "@tasued/api-client";
import { Editor } from "../../components/Editor";
import { Alert, Badge, Button, Card, CardBody, CardHeader, KeyValue, PageHeader, RichContent, useToast } from "@tasued/ui";
import { Async, PageSkeleton } from "../../components/Async";
import { AttachmentList, Breadcrumbs, Page, submissionBadge } from "../../components/bits";
import { LATE_POLICY_TEXT, fetchMySubmission, submissionKey, submissionWindow } from "./queries";
import { ReceiptCard } from "./ReceiptCard";
import { SubmitFinalDialog } from "./SubmitFinalDialog";

const textOf = (html?: string) => (html ?? "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").trim();
const countWords = (html?: string) => {
  const t = textOf(html);
  return t ? t.split(/\s+/).length : 0;
};

export default function AssignmentDetailPage() {
  const { assignmentId } = useParams();
  const aq = useQuery({ queryKey: ["assignments", assignmentId], queryFn: () => api.assignments.get(assignmentId!), enabled: !!assignmentId });
  const sq = useQuery({ queryKey: submissionKey(assignmentId!), queryFn: () => fetchMySubmission(assignmentId!), enabled: !!assignmentId });

  return (
    <Page>
      <Async query={aq} skeleton={<PageSkeleton />}>
        {(a) => (
          <>
            <PageHeader
              breadcrumb={<Breadcrumbs items={[{ label: "Assignments", to: "/assignments" }, { label: a.courseCode, to: `/courses/${a.courseId}/assignments` }, { label: a.title }]} />}
              title={a.title}
              description={<span className="inline-flex flex-wrap items-center gap-2">{a.courseCode} · {a.maxScore} marks · {a.weightPercent}% of final grade {sq.data !== undefined && submissionBadge(sq.data?.state, !!sq.data?.grade?.released)}</span>}
            />
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="min-w-0 space-y-6 lg:col-span-2">
                <Card>
                  <CardHeader title="Instructions" />
                  <CardBody>
                    {a.instructionsHtml ? <RichContent html={a.instructionsHtml} /> : <p className="text-sm text-neutral-500">No instructions provided.</p>}
                    {a.attachments.length > 0 && (
                      <div className="mt-5">
                        <p className="mb-2 text-xs font-semibold tracking-wide text-neutral-500 uppercase">Attachments</p>
                        <AttachmentList items={a.attachments} />
                      </div>
                    )}
                  </CardBody>
                </Card>

                <Async query={sq} skeleton={<PageSkeleton />}>
                  {(sub) => <SubmissionPanel assignment={a} submission={sub} />}
                </Async>
              </div>
              <aside className="space-y-4">
                <DetailsCard a={a} sub={sq.data} />
              </aside>
            </div>
          </>
        )}
      </Async>
    </Page>
  );
}

function DetailsCard({ a, sub }: { a: Assignment; sub: Submission | null | undefined }) {
  const win = submissionWindow(a, sub);
  return (
    <Card>
      <CardHeader title="Details" />
      <CardBody className="space-y-4">
        <KeyValue
          className="sm:grid-cols-1"
          items={[
            { label: "Opens", value: fmtDateTime(a.opensAt) },
            {
              label: win.extended ? "Extended due date" : "Due",
              value: (
                <span className="inline-flex flex-wrap items-center gap-1.5">
                  {fmtDate(sub?.extensionDueAt ?? a.dueAt, { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })}
                  {win.extended && <Badge tone="purple">Extension granted</Badge>}
                </span>
              ),
            },
            ...(win.extended ? [{ label: "Original due date", value: fmtDateTime(a.dueAt) }] : []),
            ...(a.closesAt && a.latePolicy !== "not_accepted" ? [{ label: "Late submissions close", value: fmtDateTime(a.closesAt) }] : []),
            {
              label: "Late policy",
              value: `${LATE_POLICY_TEXT[a.latePolicy]}${a.latePolicy === "accepted_with_penalty" && a.latePenaltyPercentPerDay ? ` (${a.latePenaltyPercentPerDay}% per day)` : ""}`,
            },
            { label: "Answer format", value: [a.allowText && "Written answer", a.allowFiles && "File upload"].filter(Boolean).join(" + ") || "—" },
            ...(a.allowFiles ? [{ label: "Accepted files", value: `${a.allowedFileTypes.map((t) => "." + t).join(", ") || "Any"} · max ${a.maxFileSizeMb} MB each` }] : []),
          ]}
        />
      </CardBody>
    </Card>
  );
}

/* ───────────────────────── Submission panel ───────────────────────── */

function SubmissionPanel({ assignment: a, submission }: { assignment: Assignment; submission: Submission | null }) {
  if (submission?.state === "submitted") return <SubmittedView a={a} sub={submission} />;
  const win = submissionWindow(a, submission);
  if (win.state === "not_open") {
    return (
      <Card className="p-5">
        <Alert tone="blue" icon={<CalendarClock className="size-4" />} title="Not open yet">
          You can start working on this from {fmtDateTime(a.opensAt)}.
        </Alert>
      </Card>
    );
  }
  if (win.state === "closed") {
    return (
      <Card className="space-y-4 p-5">
        <Alert tone="red" icon={<Lock className="size-4" />} title="Submissions are closed">
          The deadline has passed{a.latePolicy === "not_accepted" ? " and late submissions are not accepted" : " and the late window has ended"}. Contact your lecturer if you have a valid reason.
        </Alert>
        {submission?.state === "draft" && (
          <div>
            <p className="mb-2 text-xs font-semibold text-neutral-500 uppercase">Your unsubmitted draft</p>
            {submission.textHtml && <RichContent html={submission.textHtml} className="rounded-lg border border-neutral-200 p-4 text-sm" />}
            <div className="mt-3"><AttachmentList items={submission.files} /></div>
          </div>
        )}
      </Card>
    );
  }
  return <DraftEditor a={a} sub={submission} late={win.state === "late"} />;
}

function SubmittedView({ a, sub }: { a: Assignment; sub: Submission }) {
  const g = sub.grade?.released ? sub.grade : undefined;
  return (
    <div className="space-y-6">
      <ReceiptCard assignment={a} submission={sub} />
      {g ? (
        <Card>
          <CardHeader title="Grade & feedback" subtitle={`Graded ${fmtDateTime(g.gradedAt)} by ${g.gradedBy}`} />
          <CardBody className="space-y-4">
            <div className="flex items-end gap-2">
              <span className="font-headline text-4xl font-extrabold text-primary-500">{g.score}</span>
              <span className="pb-1 text-lg font-semibold text-neutral-500">/ {g.maxScore}</span>
              <span className="pb-1.5 text-sm text-neutral-500">({Math.round((g.score / g.maxScore) * 100)}%)</span>
            </div>
            {g.latePenaltyApplied > 0 && <Alert tone="amber">A late penalty of {g.latePenaltyApplied} mark{g.latePenaltyApplied === 1 ? "" : "s"} was applied.</Alert>}
            {g.feedbackHtml ? (
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-neutral-500 uppercase"><MessageSquareText className="size-3.5" /> Feedback</p>
                <RichContent html={g.feedbackHtml} className="rounded-lg bg-secondary-50/60 p-4 text-sm" />
              </div>
            ) : (
              <p className="text-sm text-neutral-500">No written feedback.</p>
            )}
          </CardBody>
        </Card>
      ) : (
        <Alert tone="blue" icon={<Info className="size-4" />} title="Awaiting grading">Your grade and feedback will appear here once your lecturer releases them.</Alert>
      )}
      <Card>
        <CardHeader title="Your submission" subtitle="Read-only — final submissions can't be changed." />
        <CardBody className="space-y-4">
          {a.allowText && (sub.textHtml ? <RichContent html={sub.textHtml} /> : <p className="text-sm text-neutral-500">No written answer.</p>)}
          {sub.files.length > 0 && <AttachmentList items={sub.files} />}
        </CardBody>
      </Card>
    </div>
  );
}

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

function DraftEditor({ a, sub, late }: { a: Assignment; sub: Submission | null; late: boolean }) {
  const qc = useQueryClient();
  const toast = useToast();
  const key = submissionKey(a.id);
  const [html, setHtml] = useState(sub?.textHtml ?? "");
  const htmlRef = useRef(html);
  const savedRef = useRef(sub?.textHtml ?? "");
  const [saveState, setSaveState] = useState<SaveState>(sub?.state === "draft" ? "saved" : "idle");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string[]>([]);
  const [removing, setRemoving] = useState<string | null>(null);
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const files = sub?.files ?? [];

  /** Shared handling for write conflicts (another tab submitted, or the window closed). */
  const handleConflict = useCallback(
    (e: unknown) => {
      if (isApiError(e) && (e.code === "SUBMISSION_FINAL" || e.status === 409)) {
        toast.info("Already submitted", "This assignment has a final submission, so it can no longer be changed.");
        void qc.invalidateQueries({ queryKey: key });
        return true;
      }
      if (isApiError(e) && (e.code === "SUBMISSION_CLOSED" || e.status === 422)) {
        toast.error("Submissions are closed", e.message);
        void qc.invalidateQueries({ queryKey: key });
        void qc.invalidateQueries({ queryKey: ["assignments", a.id] });
        return true;
      }
      return false;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [a.id],
  );

  const saveNow = useCallback(async () => {
    const value = htmlRef.current;
    if (value === savedRef.current) return true;
    setSaveState("saving");
    try {
      const s = await api.assignments.saveDraft(a.id, { textHtml: value });
      savedRef.current = value;
      qc.setQueryData(key, s);
      setSavedAt(new Date().toISOString());
      setSaveState(htmlRef.current === value ? "saved" : "dirty");
      return true;
    } catch (e) {
      setSaveState("error");
      if (!handleConflict(e)) toast.error("Couldn't save draft", errorMessage(e));
      return false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a.id, handleConflict]);

  // Debounced autosave.
  useEffect(() => {
    if (html === savedRef.current) return;
    setSaveState("dirty");
    const t = setTimeout(() => void saveNow(), 1500);
    return () => clearTimeout(t);
  }, [html, saveNow]);

  // Warn before leaving with unsaved text.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (htmlRef.current !== savedRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      // Flush on in-app navigation away.
      if (htmlRef.current !== savedRef.current) void api.assignments.saveDraft(a.id, { textHtml: htmlRef.current }).catch(() => undefined);
    };
  }, [a.id]);

  const onFiles = async (list: FileList | null) => {
    if (!list?.length) return;
    const allowed = a.allowedFileTypes.map((t) => t.toLowerCase().replace(/^\./, ""));
    const errs: string[] = [];
    const ok: File[] = [];
    Array.from(list).forEach((f) => {
      const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
      if (allowed.length && !allowed.includes(ext)) errs.push(`${f.name}: .${ext || "?"} files aren't accepted (allowed: ${allowed.map((x) => "." + x).join(", ")}).`);
      else if (f.size > a.maxFileSizeMb * 1024 * 1024) errs.push(`${f.name} is ${fmtBytes(f.size)} — the limit is ${a.maxFileSizeMb} MB.`);
      else if (f.size === 0) errs.push(`${f.name} is empty.`);
      else ok.push(f);
    });
    setFileErrors(errs);
    if (fileInput.current) fileInput.current.value = "";
    for (const f of ok) {
      setUploading((u) => [...u, f.name]);
      try {
        const att = await api.assignments.uploadDraftFile(a.id, f);
        qc.setQueryData<Submission | null>(key, (s) =>
          s ? { ...s, state: s.state === "not_started" ? "draft" : s.state, files: [...s.files, att] } : s,
        );
        toast.success("File added to draft", f.name);
      } catch (e) {
        if (!handleConflict(e)) toast.error(`Couldn't upload ${f.name}`, errorMessage(e));
      } finally {
        setUploading((u) => u.filter((n) => n !== f.name));
      }
    }
    void qc.invalidateQueries({ queryKey: key });
  };

  const removeFile = async (id: string) => {
    setRemoving(id);
    try {
      await api.assignments.removeDraftFile(a.id, id);
      qc.setQueryData<Submission | null>(key, (s) => (s ? { ...s, files: s.files.filter((f) => f.id !== id) } : s));
    } catch (e) {
      if (!handleConflict(e)) toast.error("Couldn't remove file", errorMessage(e));
    } finally {
      setRemoving(null);
    }
  };

  const submit = async () => {
    setSubmitting(true);
    setSubmitError(null);
    const flushed = await saveNow();
    if (!flushed) {
      setSubmitting(false);
      setSubmitError("Your latest draft couldn't be saved, so nothing was submitted. Check your connection and try again.");
      return;
    }
    try {
      const s = await api.assignments.submitFinal(a.id, { confirm: true });
      qc.setQueryData(key, s);
      setConfirmOpen(false);
      toast.success("Submitted", `Receipt ${s.receiptCode ?? ""} — a copy has been emailed to you.`);
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
      void qc.invalidateQueries({ queryKey: ["notifications"] });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      if (handleConflict(e)) setConfirmOpen(false);
      else setSubmitError(errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  const hasText = a.allowText && textOf(html).length > 0;
  const canSubmit = (hasText || files.length > 0) && uploading.length === 0;

  return (
    <Card>
      <CardHeader
        title="Your submission"
        subtitle="Drafts save automatically and are only visible to you until you submit."
        action={<SaveIndicator state={saveState} savedAt={savedAt} />}
      />
      <CardBody className="space-y-5">
        <Alert tone="gold" icon={<Lock className="size-4" />} title="One final submission">
          You can edit your draft as often as you like. When you press <strong>Submit final</strong>, your work is locked permanently — nobody can change or reopen it.
        </Alert>
        {late && <Alert tone="amber" title="The due date has passed">You can still submit, but it will be marked late. {LATE_POLICY_TEXT[a.latePolicy]}</Alert>}

        {a.allowText && (
          <div>
            <p className="mb-1.5 text-[13px] font-semibold text-tertiary-500" id="answer-label">Written answer</p>
            <div aria-labelledby="answer-label">
              <Editor
                variant="simple"
                value={sub?.textHtml ?? ""}
                onChange={(v) => {
                  htmlRef.current = v;
                  setHtml(v);
                }}
                placeholder="Write your answer here…"
                minHeight={220}
              />
            </div>
            <p className="mt-1 text-xs text-neutral-500">{countWords(html)} words</p>
          </div>
        )}

        {a.allowFiles && (
          <div>
            <p className="mb-1.5 text-[13px] font-semibold text-tertiary-500">Files</p>
            <AttachmentList items={files} onRemove={(f) => void removeFile(f.id)} removing={removing} />
            {uploading.map((n) => (
              <p key={n} className="mt-2 flex items-center gap-2 text-sm text-neutral-500"><Loader2 className="size-4 animate-spin" /> Uploading {n}…</p>
            ))}
            <label className="mt-3 flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-neutral-300 bg-neutral-50 px-4 py-6 text-center transition-colors hover:border-primary-500 hover:bg-primary-50/30 focus-within:border-primary-500">
              <Upload className="size-5 text-primary-500" aria-hidden />
              <span className="text-sm font-semibold text-tertiary-500">Choose files to upload</span>
              <span className="text-xs text-neutral-500">{a.allowedFileTypes.map((t) => "." + t).join(", ") || "Any type"} · up to {a.maxFileSizeMb} MB each</span>
              <input
                ref={fileInput}
                type="file"
                multiple
                className="sr-only"
                accept={a.allowedFileTypes.map((t) => "." + t.replace(/^\./, "")).join(",") || undefined}
                onChange={(e) => void onFiles(e.target.files)}
              />
            </label>
            {fileErrors.length > 0 && (
              <Alert tone="red" className="mt-3" title="Some files weren't added">
                <ul className="list-disc pl-4">{fileErrors.map((e) => <li key={e}>{e}</li>)}</ul>
              </Alert>
            )}
          </div>
        )}

        <div className="flex flex-col-reverse gap-3 border-t border-neutral-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-neutral-500">
            {canSubmit ? "Ready when you are. Review your work before submitting." : "Add your answer or a file before submitting."}
          </p>
          <div className="flex gap-2">
            {a.allowText && (
              <Button variant="outline" onClick={() => void saveNow()} disabled={saveState === "saving" || html === savedRef.current}>
                Save draft
              </Button>
            )}
            <Button onClick={() => setConfirmOpen(true)} disabled={!canSubmit} icon={<Lock className="size-4" />}>
              Submit final
            </Button>
          </div>
        </div>
      </CardBody>

      <SubmitFinalDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => void submit()}
        loading={submitting}
        error={submitError}
        assignment={a}
        wordCount={a.allowText ? countWords(html) : null}
        files={files}
        late={late}
      />
    </Card>
  );
}

function SaveIndicator({ state, savedAt }: { state: SaveState; savedAt: string | null }) {
  const map: Record<SaveState, { icon: ReactNode; text: string; cls: string }> = {
    idle: { icon: <Cloud className="size-3.5" />, text: "Not started", cls: "text-neutral-400" },
    dirty: { icon: <Cloud className="size-3.5" />, text: "Unsaved changes", cls: "text-neutral-500" },
    saving: { icon: <Loader2 className="size-3.5 animate-spin" />, text: "Saving…", cls: "text-neutral-500" },
    saved: { icon: <CheckCircle2 className="size-3.5" />, text: savedAt ? `Draft saved ${fmtTime(savedAt)}` : "Draft saved", cls: "text-primary-500" },
    error: { icon: <CloudOff className="size-3.5" />, text: "Not saved", cls: "text-danger" },
  };
  const s = map[state];
  return (
    <span role="status" aria-live="polite" className={`inline-flex items-center gap-1.5 text-xs font-semibold ${s.cls}`}>
      {s.icon} {s.text}
    </span>
  );
}

