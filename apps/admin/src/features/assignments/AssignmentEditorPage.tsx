import { blocksCachedData } from "@tasued/api-client";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Lock, Trash2 } from "lucide-react";
import { Editor as RichTextEditor } from "../../components/Editor";
import { api, errorMessage, type Assignment, type LatePolicy } from "@tasued/api-client";
import { Alert, Button, Checkbox, ConfirmDialog, ErrorState, Field, Input, PageLoader, Select, Switch } from "../../components/ui";
import { PublishBadge, SectionCard } from "../../components/common";
import { hasErrors, useApiMutation, type Errors } from "../../components/mutation";
import { UnitCoveragePicker } from "../../components/pickers";
import { useCourseId } from "../../components/queries";
import { fromLagosInput, toLagosInput } from "../../components/time";
import { NoAccess, useCan } from "../../app/session";

const FILE_TYPES = ["pdf", "docx", "doc", "pptx", "xlsx", "txt", "jpg", "png", "zip"];

export function AssignmentEditorPage() {
  const { assignmentId } = useParams();
  const can = useCan();
  const q = useQuery({ queryKey: ["assignments", "get", assignmentId], queryFn: () => api.assignments.get(assignmentId!), enabled: !!assignmentId });
  const settings = useQuery({ queryKey: ["settings"], queryFn: () => api.settings.get(), retry: false, enabled: !assignmentId });
  if (!can("assignments.manage")) return <NoAccess what="create or edit assignments" />;
  if (assignmentId && q.isPending) return <PageLoader />;
  if (assignmentId && q.isError && (q.data === undefined || blocksCachedData(q.error))) return <ErrorState description={errorMessage(q.error)} onRetry={() => q.refetch()} />;
  if (!assignmentId && settings.isPending) return <PageLoader />;
  return <Editor key={assignmentId ?? "new"} existing={q.data} defaultLatePolicy={settings.data?.defaultLatePolicy} maxUploadMb={settings.data?.maxUploadMb} />;
}

type Form = {
  title: string; instructionsHtml: string; unitIds: string[]; opensAt: string; dueAt: string; closesAt: string;
  latePolicy: LatePolicy; latePenaltyPercentPerDay: string; maxScore: string; weightPercent: string;
  allowText: boolean; allowFiles: boolean; allowedFileTypes: string[]; maxFileSizeMb: string; state: Assignment["state"];
};

function Editor({ existing, defaultLatePolicy, maxUploadMb }: { existing?: Assignment; defaultLatePolicy?: LatePolicy; maxUploadMb?: number }) {
  const courseId = useCourseId();
  const navigate = useNavigate();
  const [f, setF] = useState<Form>({
    title: existing?.title ?? "",
    instructionsHtml: existing?.instructionsHtml ?? "",
    unitIds: existing?.unitIds ?? [],
    opensAt: toLagosInput(existing?.opensAt),
    dueAt: toLagosInput(existing?.dueAt),
    closesAt: toLagosInput(existing?.closesAt),
    latePolicy: existing?.latePolicy ?? defaultLatePolicy ?? "not_accepted",
    latePenaltyPercentPerDay: String(existing?.latePenaltyPercentPerDay ?? 10),
    maxScore: String(existing?.maxScore ?? 20),
    weightPercent: String(existing?.weightPercent ?? 10),
    allowText: existing?.allowText ?? true,
    allowFiles: existing?.allowFiles ?? true,
    allowedFileTypes: existing?.allowedFileTypes ?? ["pdf", "docx"],
    maxFileSizeMb: String(existing?.maxFileSizeMb ?? Math.min(20, maxUploadMb ?? 20)),
    state: existing?.state ?? "draft",
  });
  const [errors, setErrors] = useState<Errors<keyof Form>>({});
  const [del, setDel] = useState(false);
  const hasSubmissions = (existing?.submissionCount ?? 0) > 0;

  const body = (state: Assignment["state"]) => ({
    title: f.title.trim(),
    instructionsHtml: f.instructionsHtml,
    unitIds: f.unitIds,
    opensAt: fromLagosInput(f.opensAt),
    dueAt: fromLagosInput(f.dueAt),
    closesAt: f.latePolicy !== "not_accepted" && f.closesAt ? fromLagosInput(f.closesAt) : undefined,
    latePolicy: f.latePolicy,
    latePenaltyPercentPerDay: f.latePolicy === "accepted_with_penalty" ? Number(f.latePenaltyPercentPerDay) : undefined,
    maxScore: Number(f.maxScore),
    weightPercent: Number(f.weightPercent),
    allowText: f.allowText,
    allowFiles: f.allowFiles,
    allowedFileTypes: f.allowFiles ? f.allowedFileTypes : [],
    maxFileSizeMb: Number(f.maxFileSizeMb),
    state,
  });

  const save = useApiMutation({
    mutationFn: (state: Assignment["state"]) => (existing ? api.assignments.update(existing.id, body(state)) : api.assignments.create({ courseId, ...body(state) })),
    success: (_a, state) => (state === "published" ? "Assignment published — students have been notified" : "Assignment saved as draft"),
    invalidate: [["assignments"], ["grades"]],
    onSuccess: (a) => navigate(`/courses/${courseId}/assignments${existing ? "" : `/${a.id}`}`, { replace: !existing }),
  });
  const remove = useApiMutation({ mutationFn: () => api.assignments.delete(existing!.id), success: "Assignment deleted", invalidate: [["assignments"]], onSuccess: () => navigate(`/courses/${courseId}/assignments`) });

  const submit = (state: Assignment["state"]) => {
    const n = (s: string) => Number(s);
    const e: Errors<keyof Form> = {
      title: f.title.trim() ? undefined : "Title is required",
      instructionsHtml: f.instructionsHtml.replace(/<[^>]*>/g, "").trim() ? undefined : "Write the instructions",
      opensAt: f.opensAt ? undefined : "Required",
      dueAt: !f.dueAt ? "Required" : f.opensAt && f.dueAt <= f.opensAt ? "Must be after it opens" : undefined,
      closesAt: f.latePolicy !== "not_accepted" && (!f.closesAt ? "Set a hard close for late work" : f.closesAt <= f.dueAt ? "Must be after the due date" : undefined) || undefined,
      latePenaltyPercentPerDay: f.latePolicy === "accepted_with_penalty" && !(n(f.latePenaltyPercentPerDay) > 0 && n(f.latePenaltyPercentPerDay) <= 100) ? "1–100" : undefined,
      maxScore: n(f.maxScore) > 0 ? undefined : "Must be more than 0",
      weightPercent: n(f.weightPercent) >= 0 && n(f.weightPercent) <= 100 ? undefined : "0–100",
      allowText: !f.allowText && !f.allowFiles ? "Allow text, files, or both" : undefined,
      allowedFileTypes: f.allowFiles && !f.allowedFileTypes.length ? "Pick at least one file type" : undefined,
      maxFileSizeMb: f.allowFiles && !(n(f.maxFileSizeMb) > 0 && n(f.maxFileSizeMb) <= (maxUploadMb ?? 500)) ? `1–${maxUploadMb ?? 500} MB` : undefined,
    };
    setErrors(e);
    if (!hasErrors(e)) save.mutate(state);
  };
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((cur) => ({ ...cur, [k]: v }));

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link to={`/courses/${courseId}/assignments`} className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100" aria-label="Back to assignments"><ArrowLeft className="size-5" /></Link>
          <div>
            <h2 className="font-headline text-xl font-extrabold text-tertiary-500">{existing ? "Edit assignment" : "New assignment"}</h2>
            {existing && <PublishBadge state={existing.state} />}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {existing && <Button variant="ghost" className="text-danger" icon={<Trash2 className="size-4" />} onClick={() => setDel(true)} disabled={hasSubmissions} title={hasSubmissions ? "Assignments with submissions can't be deleted" : undefined}>Delete</Button>}
          <Button variant="outline" onClick={() => submit("draft")} loading={save.isPending && save.variables === "draft"}>{existing?.state === "published" ? "Unpublish" : "Save draft"}</Button>
          <Button onClick={() => submit("published")} loading={save.isPending && save.variables === "published"}>{existing?.state === "published" ? "Save changes" : "Publish"}</Button>
        </div>
      </div>

      <Alert tone="gold" icon={<Lock className="size-4" />} title="Submissions are final">
        Students get one submission. Once they press <em>Submit final</em>, it can't be edited, replaced, withdrawn or reopened — by anyone. Give extensions before the due date if needed.
      </Alert>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-5">
          <SectionCard title="Details" bodyClassName="space-y-4 p-5">
            <Field label="Title" required error={errors.title} htmlFor="as-title"><Input id="as-title" value={f.title} onChange={(e) => set("title", e.target.value)} invalid={!!errors.title} /></Field>
            <Field label="Instructions" required error={errors.instructionsHtml}>
              <RichTextEditor value={f.instructionsHtml} onChange={(html) => set("instructionsHtml", html)} variant="full" minHeight={260} placeholder="What should students do? Include marking criteria." />
            </Field>
            <Field label="Related units" hint="Shown on these unit pages.">
              <UnitCoveragePicker courseId={courseId} value={f.unitIds} onChange={(v) => set("unitIds", v)} />
            </Field>
          </SectionCard>
        </div>
        <aside className="space-y-5">
          <SectionCard title="Dates (Lagos time)" bodyClassName="space-y-4 p-5">
            <Field label="Opens" required error={errors.opensAt} htmlFor="as-open"><Input id="as-open" type="datetime-local" value={f.opensAt} onChange={(e) => set("opensAt", e.target.value)} invalid={!!errors.opensAt} /></Field>
            <Field label="Due" required error={errors.dueAt} htmlFor="as-due"><Input id="as-due" type="datetime-local" value={f.dueAt} onChange={(e) => set("dueAt", e.target.value)} invalid={!!errors.dueAt} /></Field>
            <Field label="Late submissions" htmlFor="as-late">
              <Select id="as-late" value={f.latePolicy} onChange={(e) => set("latePolicy", e.target.value as LatePolicy)}>
                <option value="not_accepted">Not accepted</option>
                <option value="accepted_with_penalty">Accepted with a penalty</option>
                <option value="accepted_no_penalty">Accepted, no penalty</option>
              </Select>
            </Field>
            {f.latePolicy === "accepted_with_penalty" && (
              <Field label="Penalty per day late (%)" required error={errors.latePenaltyPercentPerDay} htmlFor="as-pen"><Input id="as-pen" type="number" min={1} max={100} value={f.latePenaltyPercentPerDay} onChange={(e) => set("latePenaltyPercentPerDay", e.target.value)} invalid={!!errors.latePenaltyPercentPerDay} /></Field>
            )}
            {f.latePolicy !== "not_accepted" && (
              <Field label="Closes (no submissions after)" required error={errors.closesAt} htmlFor="as-close"><Input id="as-close" type="datetime-local" value={f.closesAt} onChange={(e) => set("closesAt", e.target.value)} invalid={!!errors.closesAt} /></Field>
            )}
          </SectionCard>
          <SectionCard title="Marks" bodyClassName="grid grid-cols-2 gap-4 p-5">
            <Field label="Max score" required error={errors.maxScore} htmlFor="as-max"><Input id="as-max" type="number" min={1} value={f.maxScore} onChange={(e) => set("maxScore", e.target.value)} invalid={!!errors.maxScore} /></Field>
            <Field label="Weight (%)" required error={errors.weightPercent} htmlFor="as-w"><Input id="as-w" type="number" min={0} max={100} value={f.weightPercent} onChange={(e) => set("weightPercent", e.target.value)} invalid={!!errors.weightPercent} /></Field>
          </SectionCard>
          <SectionCard title="Submission format" bodyClassName="space-y-4 p-5">
            <Switch checked={f.allowText} onChange={(v) => set("allowText", v)} label="Text answer" description="Students type in the LMS." />
            <Switch checked={f.allowFiles} onChange={(v) => set("allowFiles", v)} label="File upload" />
            {errors.allowText && <p className="text-xs text-danger">{errors.allowText}</p>}
            {f.allowFiles && (
              <>
                <fieldset>
                  <legend className="mb-1.5 text-[13px] font-semibold text-tertiary-500">Allowed file types <span className="text-danger">*</span></legend>
                  <div className="grid grid-cols-3 gap-2">
                    {FILE_TYPES.map((t) => (
                      <Checkbox key={t} label={`.${t}`} checked={f.allowedFileTypes.includes(t)} onChange={(e) => set("allowedFileTypes", e.target.checked ? [...f.allowedFileTypes, t] : f.allowedFileTypes.filter((x) => x !== t))} />
                    ))}
                  </div>
                  {errors.allowedFileTypes && <p className="mt-1 text-xs text-danger">{errors.allowedFileTypes}</p>}
                </fieldset>
                <Field label="Max file size (MB)" required error={errors.maxFileSizeMb} htmlFor="as-size"><Input id="as-size" type="number" min={1} value={f.maxFileSizeMb} onChange={(e) => set("maxFileSizeMb", e.target.value)} invalid={!!errors.maxFileSizeMb} /></Field>
              </>
            )}
          </SectionCard>
        </aside>
      </div>
      <ConfirmDialog open={del} onClose={() => setDel(false)} onConfirm={() => remove.mutate(undefined)} loading={remove.isPending} tone="danger" title="Delete this assignment?" description="It will be removed for students and from the gradebook." confirmLabel="Delete assignment" />
    </div>
  );
}
