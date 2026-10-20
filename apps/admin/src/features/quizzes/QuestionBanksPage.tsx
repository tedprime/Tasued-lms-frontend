import { BulkQuestionImport } from "./BulkQuestionImport";
import { useState } from "react";
import { Link, NavLink, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Library, Plus, Save, Trash2, X } from "lucide-react";
import { Editor as RichTextEditor } from "../../components/Editor";
import { api, type ID, type Question, type QuestionType } from "@tasued/api-client";
import { Badge, Button, ConfirmDialog, EmptyState, Field, IconButton, Input, Select, Textarea, cn } from "../../components/ui";
import { ListSkeleton, QueryView, SectionCard } from "../../components/common";
import { useApiMutation } from "../../components/mutation";
import { useCourseId } from "../../components/queries";

const TYPE_LABELS: Record<QuestionType, string> = {
  single_choice: "Single choice",
  multiple_choice: "Multiple choice (select all)",
  true_false: "True / False",
  short_answer: "Short answer",
  essay: "Essay (manually marked)",
};

export function QuestionBanksPage() {
  const courseId = useCourseId();
  const { bankId } = useParams();
  const navigate = useNavigate();
  const banks = useQuery({ queryKey: ["quizzes", "banks", courseId], queryFn: () => api.quizzes.banks(courseId) });
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string>();
  const create = useApiMutation({
    mutationFn: () => api.quizzes.createBank(courseId, name.trim()),
    success: "Question bank created",
    invalidate: [["quizzes", "banks", courseId]],
    onSuccess: (b) => {
      setName("");
      navigate(`/courses/${courseId}/question-banks/${b.id}`);
    },
  });
  const current = banks.data?.find((b) => b.id === bankId);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link to={`/courses/${courseId}/quizzes`} className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100" aria-label="Back to quizzes"><ArrowLeft className="size-5" /></Link>
        <div>
          <h2 className="font-headline text-xl font-extrabold text-tertiary-500">Question banks</h2>
          <p className="text-sm text-neutral-500">Quizzes draw questions at random from these banks.</p>
        </div>
      </div>
      <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <SectionCard title="Banks">
          <QueryView query={banks} loading={<ListSkeleton rows={3} />} isEmpty={(d) => !d.length} empty={<p className="px-5 py-4 text-sm text-neutral-500">No banks yet.</p>}>
            {(rows) => (
              <ul className="p-2">
                {rows.map((b) => (
                  <li key={b.id}>
                    <NavLink to={`/courses/${courseId}/question-banks/${b.id}`} className={({ isActive }) => cn("flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm", isActive ? "bg-primary-500 font-semibold text-white" : "text-tertiary-500 hover:bg-primary-50")}>
                      <span className="truncate">{b.name}</span>
                      <span className="text-xs opacity-80">{b.questionCount}</span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            )}
          </QueryView>
          <form className="space-y-2 border-t border-neutral-100 p-3" onSubmit={(e) => { e.preventDefault(); if (!name.trim()) return setNameError("Name the bank"); setNameError(undefined); create.mutate(undefined); }}>
            <Field error={nameError}><Input aria-label="New bank name" placeholder="e.g. Week 1–3 concepts" value={name} onChange={(e) => setName(e.target.value)} invalid={!!nameError} /></Field>
            <Button type="submit" size="sm" variant="outline" className="w-full" icon={<Plus className="size-4" />} loading={create.isPending}>New bank</Button>
          </form>
        </SectionCard>
        {bankId ? (
          <BankQuestions key={bankId} bankId={bankId} bankName={current?.name ?? "Bank"} courseId={courseId} />
        ) : (
          <SectionCard><EmptyState icon={<Library className="size-6" />} title="Choose a question bank" description="Pick a bank on the left or create one to start writing questions." /></SectionCard>
        )}
      </div>
    </div>
  );
}

/* ───────── Questions in a bank — authoring UX ported from SLAN CourseAssessment / ModuleAssessments ───────── */

type Draft = { type: QuestionType; promptHtml: string; options: { id: ID; text: string; isCorrect: boolean }[]; acceptedAnswers: string[]; points: string; explanation: string; tags: string };

const newOpt = (text = "") => ({ id: `opt-${Math.random().toString(36).slice(2, 9)}`, text, isCorrect: false });
const blank = (): Draft => ({ type: "single_choice", promptHtml: "", options: [newOpt(), newOpt(), newOpt(), newOpt()], acceptedAnswers: [], points: "1", explanation: "", tags: "" });
const fromQuestion = (q: Question): Draft => ({
  type: q.type,
  promptHtml: q.promptHtml,
  options: q.options.map((o) => ({ id: o.id, text: o.text, isCorrect: !!o.isCorrect })),
  acceptedAnswers: q.acceptedAnswers ?? [],
  points: String(q.points),
  explanation: q.explanation ?? "",
  tags: q.tags.join(", "),
});

function validate(d: Draft): string | undefined {
  if (!d.promptHtml.replace(/<[^>]*>/g, "").trim()) return "Write the question text";
  if (!(Number(d.points) > 0)) return "Points must be more than 0";
  if (d.type === "single_choice" || d.type === "multiple_choice") {
    const filled = d.options.filter((o) => o.text.trim());
    if (filled.length < 2) return "Add at least two options";
    const correct = filled.filter((o) => o.isCorrect).length;
    if (d.type === "single_choice" && correct !== 1) return "Mark exactly one correct option";
    if (d.type === "multiple_choice" && correct < 1) return "Mark at least one correct option";
  }
  if (d.type === "true_false" && d.options.filter((o) => o.isCorrect).length !== 1) return "Choose True or False as the correct answer";
  if (d.type === "short_answer" && !d.acceptedAnswers.length) return "Add at least one accepted answer";
  return undefined;
}

function toPayload(d: Draft): Omit<Question, "id" | "bankId"> {
  return {
    type: d.type,
    promptHtml: d.promptHtml,
    options: d.type === "short_answer" || d.type === "essay" ? [] : d.options.filter((o) => o.text.trim()).map((o) => ({ id: o.id, text: o.text.trim(), isCorrect: o.isCorrect })),
    acceptedAnswers: d.type === "short_answer" ? d.acceptedAnswers : undefined,
    points: Number(d.points),
    explanation: d.explanation.trim() || undefined,
    tags: d.tags.split(",").map((t) => t.trim()).filter(Boolean),
  };
}

function BankQuestions({ bankId, bankName, courseId }: { bankId: ID; bankName: string; courseId: ID }) {
  const q = useQuery({ queryKey: ["quizzes", "questions", bankId], queryFn: () => api.quizzes.questions(bankId) });
  const [importing, setImporting] = useState(false);
  const [newKeys, setNewKeys] = useState<string[]>([]);
  const [tagFilter, setTagFilter] = useState("");
  const add = () => setNewKeys((k) => [...k, `new-${Date.now()}`]);
  const allTags = [...new Set(q.data?.flatMap((x) => x.tags) ?? [])].sort();
  const list = (q.data ?? []).filter((x) => !tagFilter || x.tags.includes(tagFilter));

  return (
    <SectionCard
      title={bankName}
      subtitle={q.data ? `${q.data.length} question(s)` : undefined}
      action={
        <>
          {allTags.length > 0 && (
            <Select aria-label="Filter by tag" className="w-40 py-1.5 text-xs" value={tagFilter} onChange={(e) => setTagFilter(e.target.value)}>
              <option value="">All tags</option>
              {allTags.map((t) => <option key={t}>{t}</option>)}
            </Select>
          )}
          <Button size="sm" variant="outline" onClick={()=>setImporting(true)}>Bulk upload</Button>
          <Button size="sm" icon={<Plus className="size-4" />} onClick={add} className="rounded-full">Add question</Button>
        </>
      }
      bodyClassName="space-y-4 p-4 sm:p-5"
    >
      {importing && <BulkQuestionImport key={bankId} bankId={bankId} courseId={courseId} onClose={()=>setImporting(false)} />}
      <QueryView query={q} loading={<ListSkeleton rows={3} />}>
        {() => (
          <>
            {list.length === 0 && newKeys.length === 0 && <EmptyState title="No questions yet" description="Questions you add here can be drawn into any quiz in this course." action={<Button size="sm" onClick={add}>Add the first question</Button>} />}
            {list.map((question, i) => (
              <QuestionCard key={question.id} index={i + 1} bankId={bankId} courseId={courseId} question={question} />
            ))}
            {newKeys.map((k, i) => (
              <QuestionCard key={k} index={list.length + i + 1} bankId={bankId} courseId={courseId} onDone={() => setNewKeys((ks) => ks.filter((x) => x !== k))} />
            ))}
          </>
        )}
      </QueryView>
    </SectionCard>
  );
}

function QuestionCard({ index, bankId, courseId, question, onDone }: { index: number; bankId: ID; courseId: ID; question?: Question; onDone?: () => void }) {
  const [d, setD] = useState<Draft>(question ? fromQuestion(question) : blank());
  const [saved, setSaved] = useState(JSON.stringify(question ? fromQuestion(question) : null));
  const [error, setError] = useState<string>();
  const [answer, setAnswer] = useState("");
  const [del, setDel] = useState(false);
  const dirty = JSON.stringify(d) !== saved;
  const inv = [["quizzes", "questions", bankId], ["quizzes", "banks", courseId]];
  const save = useApiMutation({
    mutationFn: () => (question ? api.quizzes.updateQuestion(question.id, toPayload(d)) : api.quizzes.createQuestion(bankId, toPayload(d))),
    success: question ? "Question updated" : "Question added",
    invalidate: inv,
    onSuccess: () => {
      setSaved(JSON.stringify(d));
      onDone?.();
    },
  });
  const remove = useApiMutation({ mutationFn: () => api.quizzes.deleteQuestion(question!.id), success: "Question deleted", invalidate: inv, onSuccess: () => setDel(false) });

  const setType = (type: QuestionType) => {
    let options = d.options;
    if (type === "true_false") options = [{ ...newOpt("True"), isCorrect: true }, newOpt("False")];
    else if ((type === "single_choice" || type === "multiple_choice") && (d.type === "true_false" || options.length < 2)) options = [newOpt(), newOpt(), newOpt(), newOpt()];
    else if (type === "single_choice") {
      const first = options.findIndex((o) => o.isCorrect);
      options = options.map((o, i) => ({ ...o, isCorrect: i === first }));
    }
    setD({ ...d, type, options });
  };
  const setOpt = (i: number, patch: Partial<Draft["options"][number]>) => setD({ ...d, options: d.options.map((o, j) => (j === i ? { ...o, ...patch } : o)) });
  const markCorrect = (i: number, on: boolean) =>
    setD({ ...d, options: d.options.map((o, j) => (d.type === "multiple_choice" ? (j === i ? { ...o, isCorrect: on } : o) : { ...o, isCorrect: j === i })) });

  const submit = () => {
    const e = validate(d);
    setError(e);
    if (!e) save.mutate(undefined);
  };
  const group = `q-${question?.id ?? index}`;

  return (
    <div className="relative rounded-2xl border border-neutral-200 bg-neutral-50/40 p-3 shadow-sm sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-2 pr-1">
        <p className="text-xs font-bold tracking-wide text-primary-500 uppercase">
          Question {index} {!question && <Badge tone="gold" className="ml-1">New</Badge>} {question && dirty && <Badge tone="amber" className="ml-1">Unsaved</Badge>}
        </p>
        <div className="flex items-center gap-1">
          {(dirty || !question) && <Button size="xs" icon={<Save className="size-3.5" />} loading={save.isPending} onClick={submit}>Save</Button>}
          <button type="button" onClick={() => (question ? setDel(true) : onDone?.())} className="flex size-7 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-400 transition-colors hover:border-red-200 hover:bg-danger-50 hover:text-danger" aria-label={question ? `Delete question ${index}` : `Discard question ${index}`}>
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>
      <div className="space-y-4">
        <Field label="Question text" required><RichTextEditor value={d.promptHtml} onChange={(h) => setD((c) => ({ ...c, promptHtml: h }))} variant="simple" minHeight={80} /></Field>
        <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
          <Field label="Question type" htmlFor={`${group}-type`}>
            <Select id={`${group}-type`} value={d.type} onChange={(e) => setType(e.target.value as QuestionType)}>
              {(Object.keys(TYPE_LABELS) as QuestionType[]).map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
            </Select>
          </Field>
          <Field label="Points" htmlFor={`${group}-pts`}><Input id={`${group}-pts`} type="number" min={0.5} step="0.5" value={d.points} onChange={(e) => setD({ ...d, points: e.target.value })} /></Field>
        </div>

        {(d.type === "single_choice" || d.type === "multiple_choice") && (
          <fieldset>
            <legend className="mb-2 text-xs font-semibold text-tertiary-500">Options — mark the correct {d.type === "multiple_choice" ? "ones" : "one"}</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {d.options.map((o, i) => (
                <div key={o.id} className={cn("flex items-end gap-2 rounded-xl border p-2.5 transition-colors", o.isCorrect ? "border-primary-200 bg-primary-50" : "border-neutral-100 bg-white")}>
                  <div className="min-w-0 flex-1">
                    <label htmlFor={`${group}-o${i}`} className="text-[11px] font-bold tracking-wide text-neutral-400 uppercase">Option {String.fromCharCode(65 + i)}</label>
                    <Input id={`${group}-o${i}`} className="mt-1 py-2" value={o.text} onChange={(e) => setOpt(i, { text: e.target.value })} />
                  </div>
                  <label className={cn("flex cursor-pointer items-center gap-1 pb-2 text-xs whitespace-nowrap select-none", o.isCorrect ? "font-semibold text-primary-500" : "text-neutral-400")}>
                    <input type={d.type === "multiple_choice" ? "checkbox" : "radio"} name={group} checked={o.isCorrect} onChange={(e) => markCorrect(i, e.target.checked)} className="size-4 accent-primary-500" />
                    Correct
                  </label>
                  {d.options.length > 2 && <IconButton className="mb-0.5 size-7" label={`Remove option ${String.fromCharCode(65 + i)}`} onClick={() => setD({ ...d, options: d.options.filter((_, j) => j !== i) })}><X className="size-3.5" /></IconButton>}
                </div>
              ))}
            </div>
            {d.options.length < 8 && <Button size="xs" variant="ghost" className="mt-2" icon={<Plus className="size-3.5" />} onClick={() => setD({ ...d, options: [...d.options, newOpt()] })}>Add option</Button>}
          </fieldset>
        )}

        {d.type === "true_false" && (
          <fieldset>
            <legend className="mb-1.5 text-xs font-semibold text-tertiary-500">Correct answer</legend>
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              {d.options.map((o, i) => (
                <button key={o.id} type="button" aria-pressed={o.isCorrect} onClick={() => markCorrect(i, true)} className={cn("rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors", o.isCorrect ? "border-primary-500 bg-gradient-to-r from-primary-600 to-primary-500 text-white shadow-md" : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50")}>
                  {o.text}
                </button>
              ))}
            </div>
          </fieldset>
        )}

        {d.type === "short_answer" && (
          <Field label="Accepted answers" hint="Auto-marked, case-insensitive. Add each acceptable spelling or phrasing.">
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input aria-label="Accepted answer" value={answer} onChange={(e) => setAnswer(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && answer.trim()) { e.preventDefault(); setD({ ...d, acceptedAnswers: [...d.acceptedAnswers, answer.trim()] }); setAnswer(""); } }} />
                <Button variant="outline" onClick={() => { if (answer.trim()) { setD({ ...d, acceptedAnswers: [...d.acceptedAnswers, answer.trim()] }); setAnswer(""); } }}>Add</Button>
              </div>
              <ul className="flex flex-wrap gap-1.5">
                {d.acceptedAnswers.map((a, i) => (
                  <li key={i} className="inline-flex items-center gap-1 rounded-full border border-primary-100 bg-primary-50 py-0.5 pr-1 pl-2.5 text-xs font-semibold text-primary-700">
                    {a}
                    <button type="button" aria-label={`Remove ${a}`} className="rounded-full p-0.5 hover:bg-primary-100" onClick={() => setD({ ...d, acceptedAnswers: d.acceptedAnswers.filter((_, j) => j !== i) })}><X className="size-3" /></button>
                  </li>
                ))}
              </ul>
            </div>
          </Field>
        )}
        {d.type === "essay" && <p className="rounded-lg bg-info-50 px-3 py-2 text-xs text-info">Essay answers go to the manual marking queue on the quiz's Attempts page.</p>}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Explanation" hint="Shown with results." htmlFor={`${group}-exp`}><Textarea id={`${group}-exp`} rows={2} value={d.explanation} onChange={(e) => setD({ ...d, explanation: e.target.value })} /></Field>
          <Field label="Tags" hint="Comma-separated, e.g. week-2, prompts" htmlFor={`${group}-tags`}><Input id={`${group}-tags`} value={d.tags} onChange={(e) => setD({ ...d, tags: e.target.value })} /></Field>
        </div>
        {error && <p role="alert" className="text-sm font-medium text-danger">{error}</p>}
      </div>
      <ConfirmDialog open={del} onClose={() => setDel(false)} onConfirm={() => remove.mutate(undefined)} loading={remove.isPending} tone="danger" title={`Delete question ${index}?`} description="Attempts already taken keep their copy of this question." confirmLabel="Delete question" />
    </div>
  );
}
