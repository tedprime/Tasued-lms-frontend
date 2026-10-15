import { useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, Download, FileSpreadsheet, Mail, RotateCcw, Upload, Users } from "lucide-react";
import { api, fmtBytes, type ImportPreview, type ImportResult, type ImportRowResult } from "@tasued/api-client";
import { Alert, Badge, Button, ConfirmDialog, Field, PageHeader, SegmentedControl, StatCard, Table, TBody, TD, TH, THead, TR, buttonClasses, cn, type Tone } from "../../components/ui";
import { SectionCard, downloadCsv } from "../../components/common";
import { useApiMutation } from "../../components/mutation";
import { CourseSelect } from "../../components/pickers";

type Kind = "students" | "staff";
const TEMPLATES: Record<Kind, string[][]> = {
  students: [
    ["fullName", "email", "matricNumber", "level", "department"],
    ["Adaeze Okafor", "adaeze.okafor@example.com", "20260101001", "100", "CSC"],
  ],
  staff: [
    ["fullName", "email", "staffId", "department"],
    ["Dr. Tunde Bakare", "tunde.bakare@tasued.edu.ng", "TAS/1234", "CSC"],
  ],
};
const ACTION_TONE: Record<ImportRowResult["action"], Tone> = { create: "green", update: "blue", skip: "neutral", error: "red" };
const STEPS = ["Choose", "Upload", "Preview", "Done"];

export function ImportPage() {
  const [params] = useSearchParams();
  const [kind, setKind] = useState<Kind>(params.get("kind") === "staff" ? "staff" : "students");
  const [courseId, setCourseId] = useState(params.get("course") ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string>();
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [rowFilter, setRowFilter] = useState<"all" | ImportRowResult["action"]>("all");
  const [confirm, setConfirm] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const step = result ? 3 : preview ? 2 : file ? 1 : 0;

  const previewM = useApiMutation({
    mutationFn: () => api.people.importPreview(kind, file!, kind === "students" ? courseId || undefined : undefined),
    errorTitle: "Couldn't read the CSV",
    onSuccess: (p) => { setPreview(p); setRowFilter(p.summary.error ? "error" : "all"); },
  });
  const commit = useApiMutation({
    mutationFn: () => api.people.importCommit(preview!.importId),
    success: (r) => (kind === "students" ? `Done — ${r.lmsInvitesSent} LMS invitation(s) and ${r.teamsGuestInvitesSent} Teams invitation(s) sent` : "Import complete"),
    errorTitle: "Import failed",
    invalidate: [["people"], ["courses"]],
    onSuccess: (r) => { setResult(r); setConfirm(false); },
  });
  const reset = () => { setFile(null); setPreview(null); setResult(null); setFileError(undefined); };

  const pick = (f: File | undefined) => {
    if (!f) return;
    if (!/\.csv$/i.test(f.name)) return setFileError("Choose a .csv file");
    if (f.size > 5 * 1024 * 1024) return setFileError("CSV files must be 5 MB or smaller");
    setFileError(undefined);
    setFile(f);
    setPreview(null);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title={kind === "students" ? "Invite students" : "Import staff"}
        description={
          kind === "students"
            ? "TASFUED sends the student list. Importing it creates LMS accounts, emails each student a link to set their LMS password, and sends a Microsoft Teams guest invitation to our organisation so they can join classes."
            : "Staff are members of our Microsoft 365 organisation and sign in with Microsoft. Importing adds them to the LMS — no invitations or passwords are needed."
        }
        breadcrumb={<Link to="/people" className="hover:text-primary-500">People</Link>}
      />

      <ol className="flex flex-wrap gap-2" aria-label="Import steps">
        {STEPS.map((s, i) => (
          <li key={s} aria-current={i === step ? "step" : undefined} className={cn("flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold", i < step ? "border-primary-200 bg-primary-50 text-primary-600" : i === step ? "border-primary-500 bg-primary-500 text-white" : "border-neutral-200 bg-white text-neutral-500")}>
            <span className="flex size-5 items-center justify-center rounded-full bg-white/20">{i < step ? "✓" : i + 1}</span> {s}
          </li>
        ))}
      </ol>

      {result ? (
        <SectionCard title={<span className="flex items-center gap-2"><CheckCircle2 className="size-5 text-primary-500" /> Import complete</span>} bodyClassName="space-y-5 p-5">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="Created" value={result.created} />
            <StatCard label="Updated" value={result.updated} tone="navy" />
            <StatCard label="Skipped" value={result.skipped} tone="gold" />
            <StatCard label="Errors" value={result.errors} tone="red" />
          </div>
          {kind === "students" && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <StatCard label="LMS invitations sent" value={result.lmsInvitesSent} icon={<Mail className="size-5" />} />
              <StatCard label="Teams guest invitations sent" value={result.teamsGuestInvitesSent} icon={<Users className="size-5" />} tone="navy" />
            </div>
          )}
          <p className="text-sm text-neutral-600">
            {kind === "students"
              ? "Each student gets two emails: one to set their LMS password and one from Microsoft to accept the Teams guest invitation. Track who has accepted in People, and resend from a student's page."
              : "Staff can sign in straight away with their Microsoft work account."}
          </p>
          <div className="flex flex-wrap gap-2">
            <Link to={kind === "students" ? "/people?role=student" : "/people"} className={buttonClasses("primary")}>Go to People</Link>
            <Button variant="outline" icon={<RotateCcw className="size-4" />} onClick={reset}>{kind === "students" ? "Invite another list" : "Import another file"}</Button>
          </div>
        </SectionCard>
      ) : (
        <>
          <SectionCard title="1. What are you importing?" bodyClassName="space-y-4 p-5">
            <SegmentedControl<Kind> value={kind} onChange={(k) => { setKind(k); setPreview(null); }} options={[{ key: "students", label: "Students (invite)" }, { key: "staff", label: "Staff" }]} />
            {kind === "students" && (
              <Field label="Also enrol them into a course (optional)" htmlFor="imp-off" className="max-w-xl">
                <CourseSelect id="imp-off" allowAll allLabel="Don't enrol — accounts only" value={courseId} onChange={(v) => { setCourseId(v); setPreview(null); }} />
              </Field>
            )}
            <div className="flex flex-wrap items-center gap-3 rounded-xl bg-neutral-50 p-3 text-sm">
              <FileSpreadsheet className="size-5 text-primary-500" />
              <span className="flex-1">Columns: <code className="text-xs">{TEMPLATES[kind][0]!.join(", ")}</code></span>
              <Button size="xs" variant="outline" icon={<Download className="size-3.5" />} onClick={() => downloadCsv(`tasued-${kind}-import-template.csv`, TEMPLATES[kind])}>Download template</Button>
            </div>
          </SectionCard>

          <SectionCard title="2. Upload the CSV" bodyClassName="space-y-3 p-5">
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files[0]); }}
              className={cn("flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition-colors hover:border-primary-300 hover:bg-primary-50", fileError ? "border-danger" : "border-neutral-300")}
            >
              <Upload className="size-6 text-primary-500" />
              <span className="text-sm font-semibold text-tertiary-500">{file ? file.name : "Choose or drop a CSV file"}</span>
              <span className="text-xs text-neutral-500">{file ? fmtBytes(file.size) : "UTF-8, up to 5 MB"}</span>
            </button>
            {fileError && <p className="text-xs text-danger">{fileError}</p>}
            <div className="flex justify-end"><Button disabled={!file} loading={previewM.isPending} onClick={() => previewM.mutate(undefined)}>Check file</Button></div>
          </SectionCard>

          {preview && (
            <SectionCard
              title="3. Preview"
              subtitle="Nothing has been written yet. Rows with errors are skipped on import."
              action={<SegmentedControl value={rowFilter} onChange={setRowFilter} options={[{ key: "all", label: `All ${preview.rows.length}` }, { key: "create", label: `Create ${preview.summary.create}` }, { key: "update", label: `Update ${preview.summary.update}` }, { key: "skip", label: `Skip ${preview.summary.skip}` }, { key: "error", label: `Errors ${preview.summary.error}` }]} />}
            >
              {preview.summary.error > 0 && <Alert tone="red" className="m-5 mb-0">{preview.summary.error} row(s) have errors and will be skipped. Fix them in the CSV and check again, or import the valid rows now.</Alert>}
              <div className="max-h-[480px] overflow-auto">
                <Table>
                  <THead><tr><TH>Row</TH><TH>Name</TH><TH>Email</TH>{kind === "students" && <TH>Matric no.</TH>}<TH>Action</TH><TH>Message</TH></tr></THead>
                  <TBody>
                    {preview.rows.filter((r) => rowFilter === "all" || r.action === rowFilter).map((r) => (
                      <TR key={r.row} className={r.action === "error" ? "bg-danger-50/40" : undefined}>
                        <TD className="font-mono text-xs">{r.row}</TD>
                        <TD className="font-semibold">{r.fullName || "—"}</TD>
                        <TD className="text-xs">{r.email || "—"}</TD>
                        {kind === "students" && <TD className="font-mono text-xs">{r.matricNumber ?? "—"}</TD>}
                        <TD><Badge tone={ACTION_TONE[r.action]}>{r.action}</Badge></TD>
                        <TD className={cn("text-xs", r.action === "error" ? "text-danger" : "text-neutral-500")}>{r.message ?? ""}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </div>
              <div className="flex flex-wrap justify-end gap-2 border-t border-neutral-100 px-5 py-4">
                <Button variant="outline" onClick={reset}>Start over</Button>
                <Button disabled={preview.summary.create + preview.summary.update === 0} onClick={() => setConfirm(true)}>{kind === "students" ? `Import and invite ${preview.summary.create + preview.summary.update} students` : `Import ${preview.summary.create + preview.summary.update} staff`}</Button>
              </div>
            </SectionCard>
          )}
        </>
      )}
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={() => commit.mutate(undefined)}
        loading={commit.isPending}
        title={kind === "students" ? "Import and send invitations?" : "Run the import?"}
        description={
          preview
            ? kind === "students"
              ? `${preview.summary.create} LMS account(s) will be created and ${preview.summary.update} updated. New students are emailed a link to set their LMS password and a Microsoft Teams guest invitation${courseId ? ", and are enrolled in the chosen course" : ""}.`
              : `${preview.summary.create} staff account(s) will be created and ${preview.summary.update} updated. They sign in with Microsoft.`
            : undefined
        }
        confirmLabel={kind === "students" ? "Import and invite" : "Import now"}
      />
    </div>
  );
}
