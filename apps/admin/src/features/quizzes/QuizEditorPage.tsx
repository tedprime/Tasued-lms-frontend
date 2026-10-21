import { blocksCachedData } from "@tasued/api-client";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Trash2 } from "lucide-react";
import { Editor as RichTextEditor } from "../../components/Editor";
import { api, errorMessage, type Quiz } from "@tasued/api-client";
import { Button, Checkbox, ConfirmDialog, ErrorState, Field, Input, PageLoader, Select, Switch } from "../../components/ui";
import { PublishBadge, SectionCard } from "../../components/common";
import { hasErrors, useApiMutation, type Errors } from "../../components/mutation";
import { UnitCoveragePicker } from "../../components/pickers";
import { useCourseId } from "../../components/queries";
import { fromLagosInput, toLagosInput } from "../../components/time";
import { NoAccess, useCan } from "../../app/session";

export function QuizEditorPage() {
  const { quizId } = useParams();
  const can = useCan();
  const q = useQuery({ queryKey: ["quizzes", "get", quizId], queryFn: () => api.quizzes.get(quizId!), enabled: !!quizId });
  if (!can("quizzes.manage")) return <NoAccess what="create or edit quizzes" />;
  if (quizId && q.isPending) return <PageLoader />;
  if (quizId && q.isError && (q.data === undefined || blocksCachedData(q.error))) return <ErrorState description={errorMessage(q.error)} onRetry={() => q.refetch()} />;
  return <Editor key={quizId ?? "new"} existing={q.data} />;
}

type Form = {
  title: string; descriptionHtml: string; unitIds: string[]; bankIds: string[]; drawCount: string; timeLimitMinutes: string;
  attemptsAllowed: string; opensAt: string; closesAt: string; shuffleOptions: boolean; showResults: Quiz["showResults"]; maxScore: string; weightPercent: string;
};

function Editor({ existing }: { existing?: Quiz }) {
  const courseId = useCourseId();
  const navigate = useNavigate();
  const banks = useQuery({ queryKey: ["quizzes", "banks", courseId], queryFn: () => api.quizzes.banks(courseId) });
  const [f, setF] = useState<Form>({
    title: existing?.title ?? "",
    descriptionHtml: existing?.descriptionHtml ?? "",
    unitIds: existing?.unitIds ?? [],
    bankIds: existing?.bankIds ?? [],
    drawCount: String(existing?.drawCount ?? 20),
    timeLimitMinutes: String(existing?.timeLimitMinutes ?? 30),
    attemptsAllowed: String(existing?.attemptsAllowed ?? 1),
    opensAt: toLagosInput(existing?.opensAt),
    closesAt: toLagosInput(existing?.closesAt),
    shuffleOptions: existing?.shuffleOptions ?? true,
    showResults: existing?.showResults ?? "after_close",
    maxScore: String(existing?.maxScore ?? 20),
    weightPercent: String(existing?.weightPercent ?? 10),
  });
  const [errors, setErrors] = useState<Errors<keyof Form>>({});
  const [del, setDel] = useState(false);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((c) => ({ ...c, [k]: v }));
  const pool = banks.data?.filter((b) => f.bankIds.includes(b.id)).reduce((n, b) => n + b.questionCount, 0) ?? 0;

  const body = (state: Quiz["state"]) => ({
    title: f.title.trim(), descriptionHtml: f.descriptionHtml, unitIds: f.unitIds, bankIds: f.bankIds, drawCount: Number(f.drawCount),
    timeLimitMinutes: Number(f.timeLimitMinutes), attemptsAllowed: Number(f.attemptsAllowed), opensAt: fromLagosInput(f.opensAt), closesAt: fromLagosInput(f.closesAt),
    shuffleOptions: f.shuffleOptions, showResults: f.showResults, maxScore: Number(f.maxScore), weightPercent: Number(f.weightPercent), state,
  });
  const save = useApiMutation({
    mutationFn: (state: Quiz["state"]) => (existing ? api.quizzes.update(existing.id, body(state)) : api.quizzes.create({ courseId, ...body(state) })),
    success: (_q, state) => (state === "published" ? "Quiz published" : "Quiz saved as draft"),
    invalidate: [["quizzes"], ["grades"]],
    onSuccess: () => navigate(`/courses/${courseId}/quizzes`),
  });
  const remove = useApiMutation({ mutationFn: () => api.quizzes.delete(existing!.id), success: "Quiz deleted", invalidate: [["quizzes"]], onSuccess: () => navigate(`/courses/${courseId}/quizzes`) });

  const submit = (state: Quiz["state"]) => {
    const n = (s: string) => Number(s);
    const e: Errors<keyof Form> = {
      title: f.title.trim() ? undefined : "Title is required",
      bankIds: f.bankIds.length ? undefined : "Choose at least one question bank",
      drawCount: !(n(f.drawCount) >= 1) ? "At least 1" : banks.data && n(f.drawCount) > pool ? `Only ${pool} questions in the selected banks` : undefined,
      timeLimitMinutes: n(f.timeLimitMinutes) >= 1 && n(f.timeLimitMinutes) <= 600 ? undefined : "1–600",
      attemptsAllowed: n(f.attemptsAllowed) >= 1 && n(f.attemptsAllowed) <= 10 ? undefined : "1–10",
      opensAt: f.opensAt ? undefined : "Required",
      closesAt: !f.closesAt ? "Required" : f.closesAt <= f.opensAt ? "Must be after it opens" : undefined,
      maxScore: n(f.maxScore) > 0 ? undefined : "Must be more than 0",
      weightPercent: n(f.weightPercent) >= 0 && n(f.weightPercent) <= 100 ? undefined : "0–100",
    };
    setErrors(e);
    if (!hasErrors(e)) save.mutate(state);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link to={`/courses/${courseId}/quizzes`} className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100" aria-label="Back to quizzes"><ArrowLeft className="size-5" /></Link>
          <div>
            <h2 className="font-headline text-xl font-extrabold text-tertiary-500">{existing ? "Edit quiz" : "New quiz"}</h2>
            {existing && <PublishBadge state={existing.state} />}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {existing && <Button variant="ghost" className="text-danger" icon={<Trash2 className="size-4" />} onClick={() => setDel(true)} disabled={(existing.attemptCount ?? 0) > 0}>Delete</Button>}
          <Button variant="outline" onClick={() => submit("draft")} loading={save.isPending && save.variables === "draft"}>{existing?.state === "published" ? "Unpublish" : "Save draft"}</Button>
          <Button onClick={() => submit("published")} loading={save.isPending && save.variables === "published"}>{existing?.state === "published" ? "Save changes" : "Publish"}</Button>
        </div>
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-5">
          <SectionCard title="Details" bodyClassName="space-y-4 p-5">
            <Field label="Title" required error={errors.title} htmlFor="qz-title"><Input id="qz-title" value={f.title} onChange={(e) => set("title", e.target.value)} invalid={!!errors.title} /></Field>
            <Field label="Description / instructions"><RichTextEditor value={f.descriptionHtml} onChange={(h) => set("descriptionHtml", h)} variant="simple" minHeight={140} /></Field>
            <Field label="Related units"><UnitCoveragePicker courseId={courseId} value={f.unitIds} onChange={(v) => set("unitIds", v)} /></Field>
          </SectionCard>
          <SectionCard title="Questions" subtitle="Each student gets a random draw from these banks." action={<Link to={`/courses/${courseId}/question-banks`} className="text-sm font-semibold text-primary-500 hover:underline">Manage banks</Link>} bodyClassName="space-y-4 p-5">
            {banks.isPending ? <p className="text-sm text-neutral-500">Loading banks…</p> : !banks.data?.length ? (
              <p className="text-sm text-neutral-500">No question banks yet. <Link to={`/courses/${courseId}/question-banks`} className="font-semibold text-primary-500 hover:underline">Create one</Link> first.</p>
            ) : (
              <fieldset>
                <legend className="mb-2 text-[13px] font-semibold text-tertiary-500">Banks <span className="text-danger">*</span></legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {banks.data.map((b) => (
                    <Checkbox key={b.id} className="rounded-lg border border-neutral-200 p-3" label={b.name} description={`${b.questionCount} questions`} checked={f.bankIds.includes(b.id)} onChange={(e) => set("bankIds", e.target.checked ? [...f.bankIds, b.id] : f.bankIds.filter((x) => x !== b.id))} />
                  ))}
                </div>
                {errors.bankIds && <p className="mt-1 text-xs text-danger">{errors.bankIds}</p>}
              </fieldset>
            )}
            <Field label="Questions drawn per attempt" required error={errors.drawCount} htmlFor="qz-draw" hint={`${pool} questions available in the selected banks.`} className="max-w-xs">
              <Input id="qz-draw" type="number" min={1} value={f.drawCount} onChange={(e) => set("drawCount", e.target.value)} invalid={!!errors.drawCount} />
            </Field>
          </SectionCard>
        </div>
        <aside className="space-y-5">
          <SectionCard title="Window (Lagos time)" bodyClassName="space-y-4 p-5">
            <Field label="Opens" required error={errors.opensAt} htmlFor="qz-open"><Input id="qz-open" type="datetime-local" value={f.opensAt} onChange={(e) => set("opensAt", e.target.value)} invalid={!!errors.opensAt} /></Field>
            <Field label="Closes" required error={errors.closesAt} htmlFor="qz-close" hint="Attempts in progress are auto-submitted at their own deadline."><Input id="qz-close" type="datetime-local" value={f.closesAt} onChange={(e) => set("closesAt", e.target.value)} invalid={!!errors.closesAt} /></Field>
          </SectionCard>
          <SectionCard title="Rules" bodyClassName="space-y-4 p-5">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Time limit (min)" required error={errors.timeLimitMinutes} htmlFor="qz-time"><Input id="qz-time" type="number" min={1} value={f.timeLimitMinutes} onChange={(e) => set("timeLimitMinutes", e.target.value)} invalid={!!errors.timeLimitMinutes} /></Field>
              <Field label="Attempts" required error={errors.attemptsAllowed} htmlFor="qz-att"><Input id="qz-att" type="number" min={1} max={10} value={f.attemptsAllowed} onChange={(e) => set("attemptsAllowed", e.target.value)} invalid={!!errors.attemptsAllowed} /></Field>
              <Field label="Max score" required error={errors.maxScore} htmlFor="qz-max"><Input id="qz-max" type="number" min={1} value={f.maxScore} onChange={(e) => set("maxScore", e.target.value)} invalid={!!errors.maxScore} /></Field>
              <Field label="Weight (%)" required error={errors.weightPercent} htmlFor="qz-w"><Input id="qz-w" type="number" min={0} max={100} value={f.weightPercent} onChange={(e) => set("weightPercent", e.target.value)} invalid={!!errors.weightPercent} /></Field>
            </div>
            <Switch checked={f.shuffleOptions} onChange={(v) => set("shuffleOptions", v)} label="Shuffle answer options" />
            <Field label="Show results" htmlFor="qz-res">
              <Select id="qz-res" value={f.showResults} onChange={(e) => set("showResults", e.target.value as Quiz["showResults"])}>
                <option value="immediately">Immediately after submitting</option>
                <option value="after_close">After the quiz closes</option>
                <option value="manual">When I release them</option>
              </Select>
            </Field>
          </SectionCard>
        </aside>
      </div>
      <ConfirmDialog open={del} onClose={() => setDel(false)} onConfirm={() => remove.mutate(undefined)} loading={remove.isPending} tone="danger" title="Delete this quiz?" description="Quizzes with attempts can't be deleted." confirmLabel="Delete quiz" />
    </div>
  );
}
