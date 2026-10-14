import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Eye, EyeOff, History, Plus, Sheet } from "lucide-react";
import { api, fmtDateTime, type GradeCell, type Gradebook as GB, type GradebookItem, type ID } from "@tasued/api-client";
import { Badge, Button, Drawer, EmptyState, Field, Input, Modal, SearchInput, Textarea, buttonClasses, cn } from "../../components/ui";
import { ListSkeleton, QueryView, SectionCard } from "../../components/common";
import { hasErrors, useApiMutation } from "../../components/mutation";
import { apiBase } from "../../app/env";
import { useCan } from "../../app/session";

const KIND_LABEL = { assignment: "Assignment", quiz: "Quiz", manual: "Manual" } as const;

export function Gradebook({ courseId }: { courseId: ID }) {
  const q = useQuery({ queryKey: ["grades", "gradebook", courseId], queryFn: () => api.grades.gradebook(courseId) });
  const [adding, setAdding] = useState(false);
  const [history, setHistory] = useState(false);
  return (
    <SectionCard
      title="Gradebook"
      subtitle="Click a cell to change a score. Every change needs a reason and is kept in the history."
      action={
        <>
          <Button size="sm" variant="ghost" icon={<History className="size-4" />} onClick={() => setHistory(true)}>History</Button>
          <a href={api.grades.exportXlsxUrl(apiBase(), courseId)} className={buttonClasses("outline", "sm")} download><Download className="size-4" /> Export XLSX</a>
          <Button size="sm" icon={<Plus className="size-4" />} onClick={() => setAdding(true)}>Manual item</Button>
        </>
      }
    >
      <QueryView query={q} loading={<ListSkeleton />} isEmpty={(d) => !d.students.length} empty={<EmptyState icon={<Sheet className="size-6" />} title="No students enrolled" />}>
        {(gb) => <Grid gb={gb} courseId={courseId} />}
      </QueryView>
      {adding && <ManualItemModal courseId={courseId} onClose={() => setAdding(false)} />}
      {history && <HistoryDrawer courseId={courseId} gb={q.data} onClose={() => setHistory(false)} />}
    </SectionCard>
  );
}

function Grid({ gb, courseId }: { gb: GB; courseId: ID }) {
  const can = useCan();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<{ item: GradebookItem; studentId: ID; studentName: string; cell?: GradeCell } | null>(null);
  const cells = useMemo(() => {
    const m = new Map<string, GradeCell>();
    gb.cells.forEach((c) => m.set(`${c.userId}:${c.itemId}`, c));
    return m;
  }, [gb.cells]);
  const release = useApiMutation({
    mutationFn: (v: { itemId: ID; released: boolean }) => api.grades.releaseItem(courseId, v.itemId, v.released),
    success: (i) => (i.released ? `${i.title} released to students` : `${i.title} hidden from students`),
    invalidate: [["grades"]],
  });
  const totalWeight = gb.items.reduce((n, i) => n + i.weightPercent, 0);
  const students = gb.students.filter((s) => !search || `${s.fullName} ${s.matricNumber ?? ""}`.toLowerCase().includes(search.toLowerCase()));
  const weighted = (sid: ID) => {
    let total = 0;
    let any = false;
    gb.items.forEach((i) => {
      const c = cells.get(`${sid}:${i.id}`);
      if (c?.score != null) {
        any = true;
        total += (c.score / i.maxScore) * i.weightPercent;
      }
    });
    return any ? total : null;
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 px-5 py-3">
        <SearchInput className="w-full sm:w-64" placeholder="Search students" aria-label="Search students" value={search} onChange={(e) => setSearch(e.target.value)} />
        <p className="text-xs text-neutral-500">{gb.students.length} students · {gb.items.length} items · weights total {totalWeight}%{totalWeight !== 100 && <span className="font-semibold text-warning"> (not 100%)</span>}</p>
      </div>
      <div className="max-h-[70vh] overflow-auto">
        <table className="w-max min-w-full border-separate border-spacing-0 text-sm">
          <thead className="sticky top-0 z-20">
            <tr>
              <th scope="col" className="sticky left-0 z-30 min-w-[200px] border-r border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-left text-xs font-semibold tracking-wide text-neutral-500 uppercase">Student</th>
              {gb.items.map((i) => (
                <th key={i.id} scope="col" className="min-w-[130px] border-b border-neutral-200 bg-neutral-50 px-3 py-2 text-left align-top">
                  <div className="flex items-start justify-between gap-1">
                    <div className="min-w-0">
                      <p className="line-clamp-2 text-xs font-bold text-tertiary-500">{i.title}</p>
                      <p className="text-[10.5px] font-medium text-neutral-500">{KIND_LABEL[i.kind]} · /{i.maxScore} · {i.weightPercent}%</p>
                      <Badge tone={i.released ? "green" : "neutral"} className="mt-1">{i.released ? "Released" : "Hidden"}</Badge>
                    </div>
                    {can("grades.release") && (
                      <button
                        type="button"
                        onClick={() => release.mutate({ itemId: i.id, released: !i.released })}
                        disabled={release.isPending}
                        className="rounded p-1 text-neutral-500 hover:bg-neutral-200 hover:text-primary-500"
                        aria-label={i.released ? `Hide ${i.title} from students` : `Release ${i.title} to students`}
                        title={i.released ? "Hide from students" : "Release to students"}
                      >
                        {i.released ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    )}
                  </div>
                </th>
              ))}
              <th scope="col" className="min-w-[100px] border-b border-neutral-200 bg-neutral-50 px-3 py-3 text-left text-xs font-semibold tracking-wide text-neutral-500 uppercase">Weighted</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => {
              const w = weighted(s.id);
              return (
                <tr key={s.id} className="group">
                  <th scope="row" className="sticky left-0 z-10 border-r border-b border-neutral-100 bg-white px-4 py-2 text-left font-normal group-hover:bg-neutral-50">
                    <p className="font-semibold text-tertiary-500">{s.fullName}</p>
                    <p className="text-xs text-neutral-500">{s.matricNumber ?? ""}</p>
                  </th>
                  {gb.items.map((i) => {
                    const c = cells.get(`${s.id}:${i.id}`);
                    return (
                      <td key={i.id} className="border-b border-neutral-100 p-0 group-hover:bg-neutral-50">
                        <button
                          type="button"
                          onClick={() => setEditing({ item: i, studentId: s.id, studentName: s.fullName, cell: c })}
                          className={cn("h-full w-full px-3 py-3 text-left font-mono text-sm hover:bg-primary-50 focus-visible:bg-primary-50 focus-visible:outline-2 focus-visible:outline-primary-500", c?.score == null && "text-neutral-400")}
                          aria-label={`${s.fullName}, ${i.title}: ${c?.score ?? "no score"}. Edit`}
                        >
                          {c?.score ?? "–"}
                        </button>
                      </td>
                    );
                  })}
                  <td className="border-b border-neutral-100 px-3 py-3 font-semibold group-hover:bg-neutral-50">{w == null ? "–" : `${w.toFixed(1)}%`}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {editing && <CellModal courseId={courseId} {...editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function CellModal({ courseId, item, studentId, studentName, cell, onClose }: { courseId: ID; item: GradebookItem; studentId: ID; studentName: string; cell?: GradeCell; onClose: () => void }) {
  const [score, setScore] = useState(cell?.score != null ? String(cell.score) : "");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<{ score?: string; reason?: string }>({});
  const save = useApiMutation({
    mutationFn: () => api.grades.setCell(courseId, { itemId: item.id, userId: studentId, score: score === "" ? null : Number(score), reason: reason.trim() }),
    success: "Score updated",
    invalidate: [["grades"]],
    onSuccess: onClose,
  });
  const submit = () => {
    const n = Number(score);
    const e = {
      score: score !== "" && (!Number.isFinite(n) || n < 0 || n > item.maxScore) ? `0–${item.maxScore}, or empty to clear` : undefined,
      reason: reason.trim().length >= 5 ? undefined : "A reason is required (at least 5 characters)",
    };
    setErrors(e);
    if (!hasErrors(e)) save.mutate(undefined);
  };
  return (
    <Modal open onClose={onClose} title="Change score" description={`${studentName} · ${item.title}`} footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={submit} loading={save.isPending}>Save change</Button></>}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <p className="text-sm text-neutral-600">Current: <strong>{cell?.score ?? "no score"}</strong> / {item.maxScore}{item.released && <Badge tone="green" className="ml-2">Released — students see changes</Badge>}</p>
        <Field label={`New score (out of ${item.maxScore})`} error={errors.score} htmlFor="cell-score" hint="Leave empty to clear the score.">
          <Input id="cell-score" autoFocus type="number" step="0.5" min={0} max={item.maxScore} value={score} onChange={(e) => setScore(e.target.value)} invalid={!!errors.score} />
        </Field>
        <Field label="Reason for change" required error={errors.reason} htmlFor="cell-reason" hint="Recorded in the grade history and audit log.">
          <Textarea id="cell-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} invalid={!!errors.reason} placeholder="e.g. Re-mark after review of question 3" />
        </Field>
      </form>
    </Modal>
  );
}

function ManualItemModal({ courseId, onClose }: { courseId: ID; onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [maxScore, setMaxScore] = useState("10");
  const [weight, setWeight] = useState("10");
  const [errors, setErrors] = useState<{ title?: string; maxScore?: string; weight?: string }>({});
  const save = useApiMutation({
    mutationFn: () => api.grades.addManualItem(courseId, { title: title.trim(), maxScore: Number(maxScore), weightPercent: Number(weight) }),
    success: "Gradebook item added",
    invalidate: [["grades"]],
    onSuccess: onClose,
  });
  const submit = () => {
    const e = { title: title.trim() ? undefined : "Title is required", maxScore: Number(maxScore) > 0 ? undefined : "More than 0", weight: Number(weight) >= 0 && Number(weight) <= 100 ? undefined : "0–100" };
    setErrors(e);
    if (!hasErrors(e)) save.mutate(undefined);
  };
  return (
    <Modal open onClose={onClose} title="Add manual item" description="For marks recorded outside the LMS, e.g. a practical or a mid-term test." footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={submit} loading={save.isPending}>Add item</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field className="sm:col-span-2" label="Title" required error={errors.title} htmlFor="mi-title"><Input id="mi-title" value={title} onChange={(e) => setTitle(e.target.value)} invalid={!!errors.title} placeholder="Practical 1" /></Field>
        <Field label="Max score" required error={errors.maxScore} htmlFor="mi-max"><Input id="mi-max" type="number" min={1} value={maxScore} onChange={(e) => setMaxScore(e.target.value)} invalid={!!errors.maxScore} /></Field>
        <Field label="Weight (%)" required error={errors.weight} htmlFor="mi-w"><Input id="mi-w" type="number" min={0} max={100} value={weight} onChange={(e) => setWeight(e.target.value)} invalid={!!errors.weight} /></Field>
      </div>
    </Modal>
  );
}

function HistoryDrawer({ courseId, gb, onClose }: { courseId: ID; gb?: GB; onClose: () => void }) {
  const q = useQuery({ queryKey: ["grades", "history", courseId], queryFn: () => api.grades.history(courseId) });
  const item = (id: ID) => gb?.items.find((i) => i.id === id)?.title ?? id;
  const student = (id: ID) => gb?.students.find((s) => s.id === id)?.fullName ?? id;
  return (
    <Drawer open onClose={onClose} title="Change history" width={520}>
      <QueryView query={q} loading={<ListSkeleton />} isEmpty={(d) => !d.length} empty={<EmptyState icon={<History className="size-6" />} title="No changes yet" />}>
        {(rows) => (
          <ol className="space-y-3">
            {[...rows].sort((a, b) => b.changedAt.localeCompare(a.changedAt)).map((c) => (
              <li key={c.id} className="rounded-lg border border-neutral-200 p-3 text-sm">
                <p className="font-semibold text-tertiary-500">{student(c.userId)} · {item(c.itemId)}</p>
                <p className="mt-0.5"><span className="font-mono">{c.from ?? "–"}</span> → <span className="font-mono font-bold">{c.to ?? "–"}</span></p>
                <p className="mt-1 text-neutral-600">“{c.reason}”</p>
                <p className="mt-1 text-xs text-neutral-500">{c.changedBy} · {fmtDateTime(c.changedAt)}</p>
              </li>
            ))}
          </ol>
        )}
      </QueryView>
    </Drawer>
  );
}
