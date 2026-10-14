import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Download, Hand, Link2, Lock, RefreshCw, UserX } from "lucide-react";
import { api, errorMessage, fmtDate, fmtDateTime, fmtTime, type AttendanceMark, type AttendanceRecord, type AttendanceSheet, type ID } from "@tasued/api-client";
import { Alert, Badge, Button, ConfirmDialog, ErrorState, Input, KeyValue, PageLoader, Select, Table, TBody, TD, TH, THead, TR, buttonClasses, cn, useToast } from "../../components/ui";
import { AttendanceStatusBadge, ClassStatusBadge, SectionCard } from "../../components/common";
import { useApiMutation } from "../../components/mutation";
import { apiBase } from "../../app/env";
import { useCan } from "../../app/session";

const MARKS: { key: AttendanceMark; label: string; tone: string }[] = [
  { key: "present", label: "Present", tone: "bg-primary-50 text-primary-700 border-primary-200" },
  { key: "late", label: "Late", tone: "bg-warning-50 text-warning border-amber-200" },
  { key: "absent", label: "Absent", tone: "bg-danger-50 text-danger border-red-200" },
  { key: "excused", label: "Excused", tone: "bg-info-50 text-info border-blue-200" },
];

export function AttendanceSheetPage() {
  const { classId } = useParams();
  const q = useQuery({ queryKey: ["attendance", "sheet", classId], queryFn: () => api.attendance.sheet(classId!), enabled: !!classId });
  if (q.isPending) return <PageLoader label="Loading attendance…" />;
  if (q.isError) return <ErrorState title="Couldn't load the attendance sheet" description={errorMessage(q.error)} onRetry={() => q.refetch()} />;
  return <Sheet sheet={q.data} />;
}

function Sheet({ sheet }: { sheet: AttendanceSheet }) {
  const can = useCan();
  const toast = useToast();
  const qc = useQueryClient();
  const c = sheet.classSession;
  const key = ["attendance", "sheet", c.id];
  const locked = sheet.status === "finalised";
  const canEdit = !locked && can("attendance.manage");
  const [selected, setSelected] = useState<Set<ID>>(new Set());
  const [bulkMark, setBulkMark] = useState<AttendanceMark | "">("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [confirm, setConfirm] = useState<"finalise" | "manual" | null>(null);
  const [filter, setFilter] = useState<AttendanceMark | "all">("all");

  const inv = [key, ["classes"], ["dashboards"]];
  const importTeams = useApiMutation({ mutationFn: () => api.attendance.importFromTeams(c.id), success: "Attendance imported from Teams and rules applied", errorTitle: "Import failed", invalidate: inv });
  const manual = useApiMutation({ mutationFn: () => api.attendance.switchToManual(c.id), success: "Switched to manual attendance", invalidate: inv, onSuccess: () => setConfirm(null) });
  const finalise = useApiMutation({ mutationFn: () => api.attendance.finalise(c.id), success: "Attendance finalised and locked", invalidate: inv, onSuccess: () => setConfirm(null) });
  const mark = useApiMutation({ mutationFn: (v: { userId: ID; mark: AttendanceMark; note?: string }) => api.attendance.mark(c.id, v.userId, { mark: v.mark, note: v.note }), errorTitle: "Couldn't update", invalidate: [key] });
  const match = useApiMutation({ mutationFn: (v: { displayName: string; userId: ID }) => api.attendance.matchUnmatched(c.id, v), success: "Participant matched", invalidate: [key] });

  const applyBulk = async () => {
    if (!bulkMark || !selected.size) return;
    setBulkBusy(true);
    try {
      // No bulk endpoint in the contract — mark each selected student.
      await Promise.all([...selected].map((userId) => api.attendance.mark(c.id, userId, { mark: bulkMark })));
      toast.success(`${selected.size} students marked ${bulkMark}`);
      setSelected(new Set());
    } catch (e) {
      toast.error("Some marks didn't save", errorMessage(e));
    } finally {
      setBulkBusy(false);
      void qc.invalidateQueries({ queryKey: key });
    }
  };

  const counts = MARKS.map((m) => ({ ...m, n: sheet.records.filter((r) => r.mark === m.key).length }));
  const rows = [...sheet.records].filter((r) => filter === "all" || r.mark === filter).sort((a, b) => a.studentName.localeCompare(b.studentName));
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.userId));

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <Link to={`/courses/${c.courseId}/attendance`} className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100" aria-label="Back"><ArrowLeft className="size-5" /></Link>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-bold text-primary-600">{c.classCode}</span>
              <ClassStatusBadge status={c.status} />
              <AttendanceStatusBadge status={sheet.status} />
              <Badge tone="navy">{sheet.mode === "teams" ? "From Teams report" : "Manual register"}</Badge>
            </div>
            <h2 className="mt-1 font-headline text-xl font-extrabold text-tertiary-500">{c.title}</h2>
            <p className="text-sm text-neutral-500">{fmtDate(c.startsAt, { weekday: "long", day: "numeric", month: "long" })}, {fmtTime(c.startsAt)}–{fmtTime(c.endsAt)} · {c.lecturerName}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={api.attendance.exportCsvUrl(apiBase(), c.id)} className={buttonClasses("outline", "sm")} download><Download className="size-4" /> Export CSV</a>
          {canEdit && sheet.mode === "teams" && (
            <Button size="sm" variant="outline" icon={<RefreshCw className="size-4" />} loading={importTeams.isPending} onClick={() => importTeams.mutate(undefined)}>
              {sheet.importedAt ? "Re-import from Teams" : "Import from Teams"}
            </Button>
          )}
          {canEdit && sheet.mode === "teams" && <Button size="sm" variant="ghost" icon={<Hand className="size-4" />} onClick={() => setConfirm("manual")}>Switch to manual</Button>}
          {canEdit && can("attendance.finalise") && <Button size="sm" icon={<Lock className="size-4" />} onClick={() => setConfirm("finalise")} disabled={!sheet.records.length}>Finalise</Button>}
        </div>
      </div>

      {locked && <Alert tone="green" icon={<Lock className="size-4" />} title="Finalised">Finalised {fmtDateTime(sheet.finalisedAt)}{sheet.finalisedBy ? ` by ${sheet.finalisedBy}` : ""}. The register is locked and counts towards students' attendance.</Alert>}
      {!locked && sheet.status === "pending_import" && sheet.mode === "teams" && <Alert tone="gold" title="Waiting for the Teams attendance report">Teams publishes the report shortly after the meeting ends. Import it, or switch to manual if the class wasn't held in Teams.</Alert>}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <SectionCard
          title={`Register (${sheet.records.length})`}
          action={
            <Select aria-label="Filter by mark" className="w-36 py-1.5 text-xs" value={filter} onChange={(e) => setFilter(e.target.value as AttendanceMark | "all")}>
              <option value="all">All marks</option>
              {MARKS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
            </Select>
          }
        >
          <div className="flex flex-wrap gap-2 border-b border-neutral-100 px-5 py-3">
            {counts.map((m) => <span key={m.key} className={cn("rounded-full border px-2.5 py-0.5 text-xs font-semibold", m.tone)}>{m.label}: {m.n}</span>)}
          </div>
          {canEdit && selected.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-b border-neutral-100 bg-primary-50/50 px-5 py-2.5 text-sm">
              <span className="font-semibold">{selected.size} selected</span>
              <Select aria-label="Bulk mark" className="w-36 py-1.5 text-xs" value={bulkMark} onChange={(e) => setBulkMark(e.target.value as AttendanceMark)}>
                <option value="">Mark as…</option>
                {MARKS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
              </Select>
              <Button size="xs" disabled={!bulkMark} loading={bulkBusy} onClick={applyBulk}>Apply</Button>
              <Button size="xs" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
            </div>
          )}
          {sheet.records.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-neutral-500">No records yet. {sheet.mode === "teams" ? "Import the Teams report to fill the register." : ""}</p>
          ) : (
            <Table>
              <THead>
                <tr>
                  {canEdit && <TH className="w-10"><input type="checkbox" className="size-4 accent-primary-500" aria-label="Select all" checked={allSelected} onChange={(e) => setSelected(e.target.checked ? new Set(rows.map((r) => r.userId)) : new Set())} /></TH>}
                  <TH>Student</TH><TH>In class</TH><TH>Mark</TH><TH>Note</TH>
                </tr>
              </THead>
              <TBody>
                {rows.map((r) => (
                  <RecordRow key={r.id} r={r} canEdit={canEdit} selected={selected.has(r.userId)} onSelect={(v) => setSelected((s) => { const n = new Set(s); if (v) n.add(r.userId); else n.delete(r.userId); return n; })} onMark={(m, note) => mark.mutate({ userId: r.userId, mark: m, note })} />
                ))}
              </TBody>
            </Table>
          )}
        </SectionCard>

        <aside className="space-y-5">
          <SectionCard title="Rule" bodyClassName="p-5">
            <KeyValue items={[
              { label: "Present if attended at least", value: `${sheet.rule.presentThresholdPercent}% of class time` },
              { label: "Late if joined after", value: `${sheet.rule.lateAfterMinutes} minutes` },
              { label: "Last import", value: sheet.importedAt ? fmtDateTime(sheet.importedAt) : "Not imported" },
            ]} />
          </SectionCard>
          <SectionCard title={`Unmatched participants (${sheet.unmatched.length})`} subtitle="Teams attendees we couldn't match to an enrolled student.">
            {sheet.unmatched.length === 0 ? (
              <p className="px-5 py-4 text-sm text-neutral-500">Everyone was matched.</p>
            ) : (
              <ul className="divide-y divide-neutral-100">
                {sheet.unmatched.map((u) => (
                  <UnmatchedRow key={u.displayName} u={u} records={sheet.records} disabled={!canEdit} busy={match.isPending && match.variables?.displayName === u.displayName} onMatch={(userId) => match.mutate({ displayName: u.displayName, userId })} />
                ))}
              </ul>
            )}
          </SectionCard>
        </aside>
      </div>

      <ConfirmDialog
        open={confirm === "finalise"}
        onClose={() => setConfirm(null)}
        onConfirm={() => finalise.mutate(undefined)}
        loading={finalise.isPending}
        title="Finalise attendance?"
        description="The register will be locked and count towards each student's attendance percentage. You won't be able to change marks afterwards."
        confirmLabel="Finalise and lock"
      >
        {sheet.unmatched.length > 0 && <Alert tone="amber" className="mt-3">{sheet.unmatched.length} Teams participant(s) are still unmatched.</Alert>}
      </ConfirmDialog>
      <ConfirmDialog open={confirm === "manual"} onClose={() => setConfirm(null)} onConfirm={() => manual.mutate(undefined)} loading={manual.isPending} title="Switch to manual register?" description="Use this when the class didn't happen in Teams or the report is unusable. Teams data will no longer be imported for this class." confirmLabel="Switch to manual" />
    </div>
  );
}

function RecordRow({ r, canEdit, selected, onSelect, onMark }: { r: AttendanceRecord; canEdit: boolean; selected: boolean; onSelect: (v: boolean) => void; onMark: (m: AttendanceMark, note?: string) => void }) {
  const [note, setNote] = useState(r.note ?? "");
  return (
    <TR className={selected ? "bg-primary-50/40" : undefined}>
      {canEdit && <TD><input type="checkbox" className="size-4 accent-primary-500" aria-label={`Select ${r.studentName}`} checked={selected} onChange={(e) => onSelect(e.target.checked)} /></TD>}
      <TD>
        <p className="font-semibold">{r.studentName}</p>
        <p className="text-xs text-neutral-500">{r.matricNumber ?? "—"} · {r.source === "teams" ? "Teams" : "Manual"}</p>
      </TD>
      <TD className="text-xs whitespace-nowrap">{r.minutesAttended} min{r.joinedAt && <span className="block text-neutral-500">{fmtTime(r.joinedAt)}–{fmtTime(r.leftAt)}</span>}</TD>
      <TD>
        {canEdit ? (
          <div role="radiogroup" aria-label={`Mark for ${r.studentName}`} className="inline-flex rounded-lg border border-neutral-200 p-0.5">
            {MARKS.map((m) => (
              <button key={m.key} type="button" role="radio" aria-checked={r.mark === m.key} onClick={() => r.mark !== m.key && onMark(m.key, note || undefined)} className={cn("rounded-md px-2 py-1 text-[11px] font-semibold", r.mark === m.key ? cn("border", m.tone) : "text-neutral-500 hover:bg-neutral-100")}>
                {m.label}
              </button>
            ))}
          </div>
        ) : (
          <span className={cn("rounded-full border px-2.5 py-0.5 text-xs font-semibold", MARKS.find((m) => m.key === r.mark)?.tone)}>{r.mark}</span>
        )}
      </TD>
      <TD className="min-w-[160px]">
        {canEdit ? (
          <Input aria-label={`Note for ${r.studentName}`} className="py-1.5 text-xs" placeholder="Add note" value={note} onChange={(e) => setNote(e.target.value)} onBlur={() => note !== (r.note ?? "") && onMark(r.mark, note)} />
        ) : (
          <span className="text-xs text-neutral-600">{r.note || "—"}</span>
        )}
      </TD>
    </TR>
  );
}

function UnmatchedRow({ u, records, disabled, busy, onMatch }: { u: AttendanceSheet["unmatched"][number]; records: AttendanceRecord[]; disabled: boolean; busy: boolean; onMatch: (userId: ID) => void }) {
  const [userId, setUserId] = useState("");
  return (
    <li className="space-y-2 px-5 py-3">
      <div className="flex items-start gap-2">
        <UserX className="mt-0.5 size-4 shrink-0 text-warning" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{u.displayName}</p>
          <p className="truncate text-xs text-neutral-500">{u.email ?? "No email"} · {u.minutesAttended} min</p>
        </div>
      </div>
      {!disabled && (
        <div className="flex gap-2">
          <Select aria-label={`Match ${u.displayName} to student`} className="py-1.5 text-xs" value={userId} onChange={(e) => setUserId(e.target.value)}>
            <option value="">Match to student…</option>
            {[...records].sort((a, b) => a.studentName.localeCompare(b.studentName)).map((r) => <option key={r.userId} value={r.userId}>{r.studentName}{r.matricNumber ? ` (${r.matricNumber})` : ""}</option>)}
          </Select>
          <Button size="xs" variant="outline" icon={<Link2 className="size-3.5" />} disabled={!userId} loading={busy} onClick={() => onMatch(userId)}>Match</Button>
        </div>
      )}
    </li>
  );
}
