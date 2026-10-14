import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CloudUpload, ExternalLink, FileVideo, Pencil, Play, Plus, Search, Trash2, Video } from "lucide-react";
import { api, fmtBytes, fmtDateTime, fmtDuration, type Chapter, type ID, type OneDriveFileRef, type Recording, type RecordingStatus } from "@tasued/api-client";
import { Alert, Badge, Button, ConfirmDialog, Drawer, EmptyState, Field, IconButton, Input, Modal, Select, Switch, Table, TBody, TD, TH, THead, TR, VideoPlayer } from "../../components/ui";
import { ListSkeleton, QueryView, RecordingStatusBadge } from "../../components/common";
import { hasErrors, useApiMutation } from "../../components/mutation";
import { UnitCoveragePicker } from "../../components/pickers";
import { useUnitTitles } from "../../components/queries";
import { parseClock } from "../../components/time";

/** Shown wherever recordings are managed. */
export const ONEDRIVE_NOTE = "Recordings are streamed from the organiser's OneDrive. Nothing is copied — don't delete files from OneDrive.";

export function OneDriveNotice({ className }: { className?: string }) {
  return <Alert tone="blue" icon={<FileVideo className="size-4" />} className={className}>{ONEDRIVE_NOTE}</Alert>;
}

/** File name, owner account and a staff-only "Open in OneDrive" link. */
export function OneDriveFileInfo({ file, compact }: { file: OneDriveFileRef; compact?: boolean }) {
  return (
    <div className={compact ? "text-xs text-neutral-500" : "mt-1 text-xs text-neutral-500"}>
      <p className="flex min-w-0 items-center gap-1"><FileVideo className="size-3.5 shrink-0 text-neutral-400" /><span className="truncate" title={file.fileName}>{file.fileName}</span></p>
      <p className="truncate">OneDrive of {file.ownerEmail}</p>
      {file.webUrl && (
        <a href={file.webUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-primary-500 hover:underline">
          Open in OneDrive <ExternalLink className="size-3" />
        </a>
      )}
    </div>
  );
}

/** Plays a recording through a short-lived OneDrive link from the API (re-requested on expiry). */
export function RecordingPreview({ recording }: { recording: Recording }) {
  return (
    <VideoPlayer
      resolveSource={() => api.recordings.playback(recording.id).then((l) => ({ url: l.url, expiresAt: l.expiresAt }))}
      poster={recording.posterUrl}
      title={recording.title}
      chapters={recording.chapters}
    />
  );
}

function UnitNames({ courseId, ids }: { courseId: ID; ids: ID[] }) {
  const titles = useUnitTitles(courseId);
  if (!ids.length) return <span className="text-xs text-warning">No units — won't be visible</span>;
  return <span className="text-xs text-neutral-600">{ids.map((id) => titles.get(id) ?? "…").join(", ")}</span>;
}

/** Recordings table: used by the course tab and the global /recordings page. */
export function RecordingsTable({ courseId, status, showCourse }: { courseId?: ID; status?: RecordingStatus; showCourse?: boolean }) {
  const q = useQuery({ queryKey: ["recordings", "list", { courseId, status }], queryFn: () => api.recordings.list({ courseId, status }), refetchInterval: 30_000 });
  const [edit, setEdit] = useState<Recording | null>(null);
  const [preview, setPreview] = useState<Recording | null>(null);
  const [upload, setUpload] = useState<Recording | null>(null);
  const [del, setDel] = useState<Recording | null>(null);
  const relink = useApiMutation({
    mutationFn: (id: ID) => api.recordings.relink(id),
    success: (r) => (r.status === "ready" ? "Found in OneDrive — the recording is linked" : r.status === "pending" ? "Not in OneDrive yet — still waiting for Teams to save it" : "Still not found in OneDrive. You can upload the MP4 instead."),
    errorTitle: "Couldn't search OneDrive",
    invalidate: [["recordings"], ["dashboards"], ["classes"], ["content"]],
  });
  const remove = useApiMutation({ mutationFn: (id: ID) => api.recordings.delete(id), success: "Recording removed from the LMS", invalidate: [["recordings"], ["content"]], onSuccess: () => setDel(null) });

  return (
    <>
      <QueryView query={q} loading={<ListSkeleton />} isEmpty={(d) => !d.length} empty={<EmptyState icon={<Video className="size-6" />} title="No recordings" description={status ? `No ${status} recordings.` : "Recordings appear here after each Teams class ends."} />}>
        {(rows) => (
          <Table>
            <THead><tr><TH>Recording</TH><TH>Status</TH><TH>OneDrive file</TH><TH>Length</TH><TH>Units</TH><TH>Visible</TH><TH className="text-right">Actions</TH></tr></THead>
            <TBody>
              {rows.map((r) => (
                <TR key={r.id}>
                  <TD className="max-w-[280px]">
                    <p className="font-semibold">{r.title}</p>
                    <p className="text-xs text-neutral-500">{fmtDateTime(r.recordedAt)}{showCourse && <CourseCode id={r.courseId} />}</p>
                    {r.status === "failed" && r.failureReason && (
                      <p className="mt-1 flex items-start gap-1 text-xs text-danger"><AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> {r.failureReason}</p>
                    )}
                    {r.status === "pending" && <p className="mt-1 text-xs text-neutral-500">Waiting for Teams to save the recording to OneDrive.</p>}
                  </TD>
                  <TD><RecordingStatusBadge status={r.status} /></TD>
                  <TD className="max-w-[240px]">
                    {r.oneDrive ? <OneDriveFileInfo file={r.oneDrive} compact /> : <span className="text-xs text-neutral-400">Not linked yet</span>}
                    <span className="mt-0.5 block text-xs text-neutral-400">{r.source === "teams_onedrive" ? "Teams recording" : "Uploaded by lecturer"}</span>
                  </TD>
                  <TD className="text-xs whitespace-nowrap">{r.durationSeconds ? fmtDuration(r.durationSeconds) : "—"}</TD>
                  <TD className="max-w-[220px]"><UnitNames courseId={r.courseId} ids={r.unitIds} /></TD>
                  <TD>{r.status === "ready" ? (r.published ? <Badge tone="green">Published</Badge> : <Badge>Hidden</Badge>) : "—"}</TD>
                  <TD className="text-right whitespace-nowrap">
                    {r.status !== "ready" && (
                      <>
                        <Button size="xs" variant="outline" icon={<Search className="size-3.5" />} loading={relink.isPending && relink.variables === r.id} onClick={() => relink.mutate(r.id)}>Find in OneDrive</Button>{" "}
                        <Button size="xs" variant="ghost" icon={<CloudUpload className="size-3.5" />} onClick={() => setUpload(r)}>Upload recording</Button>
                      </>
                    )}
                    {r.status === "ready" && <IconButton label={`Preview ${r.title}`} onClick={() => setPreview(r)}><Play className="size-4" /></IconButton>}
                    <IconButton label={`Edit ${r.title}`} onClick={() => setEdit(r)}><Pencil className="size-4" /></IconButton>
                    <IconButton label={`Remove ${r.title}`} className="hover:text-danger" onClick={() => setDel(r)}><Trash2 className="size-4" /></IconButton>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </QueryView>
      {edit && <EditRecordingDrawer recording={edit} onClose={() => setEdit(null)} />}
      {upload && <UploadRecordingModal courseId={upload.courseId} replacing={upload} onClose={() => setUpload(null)} />}
      <Modal open={!!preview} onClose={() => setPreview(null)} size="xl" title={preview?.title ?? ""} description="Streamed from the organiser's OneDrive.">
        {preview && <RecordingPreview recording={preview} />}
      </Modal>
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} onConfirm={() => del && remove.mutate(del.id)} loading={remove.isPending} tone="danger" title="Remove recording from the LMS?" description={`"${del?.title}" will be removed from the LMS and its units. The file itself stays in the organiser's OneDrive.`} confirmLabel="Remove recording" />
    </>
  );
}

function CourseCode({ id }: { id: ID }) {
  const q = useQuery({ queryKey: ["courses", "get", id], queryFn: () => api.courses.get(id), staleTime: 10 * 60_000 });
  return q.data ? <> · <span className="font-semibold text-primary-600">{q.data.code}</span></> : null;
}

/* ───────── Edit: title, units, chapters, publish ───────── */

function toClock(s: number) {
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

function EditRecordingDrawer({ recording, onClose }: { recording: Recording; onClose: () => void }) {
  const [title, setTitle] = useState(recording.title);
  const [unitIds, setUnitIds] = useState(recording.unitIds);
  const [published, setPublished] = useState(recording.published);
  const [chapters, setChapters] = useState<(Omit<Chapter, "startSeconds"> & { time: string })[]>(
    [...recording.chapters].sort((a, b) => a.startSeconds - b.startSeconds).map((c) => ({ id: c.id, title: c.title, time: toClock(c.startSeconds) })),
  );
  const [errors, setErrors] = useState<{ title?: string; units?: string; chapters?: string }>({});
  const save = useApiMutation({
    mutationFn: () =>
      api.recordings.update(recording.id, {
        title: title.trim(),
        unitIds,
        published,
        chapters: chapters.map((c) => ({ id: c.id, title: c.title.trim(), startSeconds: parseClock(c.time) })).sort((a, b) => a.startSeconds - b.startSeconds),
      }),
    success: "Recording updated",
    invalidate: [["recordings"], ["content"]],
    onSuccess: onClose,
  });
  const submit = () => {
    const badChapter = chapters.find((c) => !c.title.trim() || !Number.isFinite(parseClock(c.time)) || (recording.durationSeconds > 0 && parseClock(c.time) > recording.durationSeconds));
    const e = {
      title: title.trim() ? undefined : "Title is required",
      units: unitIds.length ? undefined : published ? "A published recording must be under at least one unit" : undefined,
      chapters: badChapter ? "Every chapter needs a title and a valid time (mm:ss) within the recording" : undefined,
    };
    setErrors(e);
    if (!hasErrors(e)) save.mutate(undefined);
  };
  return (
    <Drawer open onClose={onClose} title="Edit recording" width={560} footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={submit} loading={save.isPending}>Save</Button></>}>
      <div className="space-y-5">
        {recording.oneDrive && (
          <div className="rounded-lg border border-neutral-200 px-3 py-2">
            <p className="text-[13px] font-semibold text-tertiary-500">OneDrive file</p>
            <OneDriveFileInfo file={recording.oneDrive} />
          </div>
        )}
        <Field label="Title" required error={errors.title} htmlFor="rec-title"><Input id="rec-title" value={title} onChange={(e) => setTitle(e.target.value)} invalid={!!errors.title} /></Field>
        <Switch checked={published} onChange={setPublished} disabled={recording.status !== "ready"} label="Published to students" description={recording.status === "ready" ? "Shown first on each selected unit page." : "Available once the file is linked from OneDrive."} />
        <Field label="Units" required={published} error={errors.units} hint="The recording appears on these unit pages.">
          <UnitCoveragePicker courseId={recording.courseId} value={unitIds} onChange={setUnitIds} invalid={!!errors.units} />
        </Field>
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[13px] font-semibold text-tertiary-500">Chapters</p>
            <Button size="xs" variant="ghost" icon={<Plus className="size-3.5" />} onClick={() => setChapters([...chapters, { id: `new-${Date.now()}`, title: "", time: chapters.length ? "" : "0:00" }])}>Add chapter</Button>
          </div>
          {chapters.length === 0 && <p className="text-sm text-neutral-500">No chapters. Chapters help students jump to topics in long classes.</p>}
          <ul className="space-y-2">
            {chapters.map((c, i) => (
              <li key={c.id} className="flex items-center gap-2">
                <Input aria-label={`Chapter ${i + 1} time (mm:ss)`} className="w-24 font-mono" placeholder="mm:ss" value={c.time} onChange={(e) => setChapters(chapters.map((x, j) => (j === i ? { ...x, time: e.target.value } : x)))} />
                <Input aria-label={`Chapter ${i + 1} title`} placeholder="Chapter title" value={c.title} onChange={(e) => setChapters(chapters.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
                <IconButton label={`Remove chapter ${i + 1}`} className="hover:text-danger" onClick={() => setChapters(chapters.filter((_, j) => j !== i))}><Trash2 className="size-4" /></IconButton>
              </li>
            ))}
          </ul>
          {errors.chapters && <p className="mt-1 text-xs text-danger">{errors.chapters}</p>}
          {recording.durationSeconds > 0 && <p className="mt-1 text-xs text-neutral-500">Recording length {fmtDuration(recording.durationSeconds)}.</p>}
        </div>
      </div>
    </Drawer>
  );
}

/* ───────── Upload fallback (lecturer MP4) ───────── */

export function UploadRecordingModal({ courseId, replacing, onClose }: { courseId: ID; replacing?: Recording; onClose: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState(replacing?.title ?? "");
  const [unitIds, setUnitIds] = useState<ID[]>(replacing?.unitIds ?? []);
  const [classSessionId, setClassSessionId] = useState(replacing?.classSessionId ?? "");
  const [errors, setErrors] = useState<{ file?: string; title?: string; units?: string }>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const classes = useQuery({ queryKey: ["classes", "list", { courseId }], queryFn: () => api.classes.list({ courseId }) });
  const save = useApiMutation({
    mutationFn: () => api.recordings.upload({ courseId, classSessionId: classSessionId || undefined, title: title.trim(), unitIds, file: file! }),
    success: "Uploaded to the organiser's OneDrive — the recording is ready to publish",
    errorTitle: "Upload failed",
    invalidate: [["recordings"], ["classes"], ["dashboards"]],
    onSuccess: onClose,
  });
  const submit = () => {
    const e = {
      file: !file ? "Choose an MP4 file" : !/\.mp4$/i.test(file.name) && file.type !== "video/mp4" ? "Only MP4 files are accepted" : undefined,
      title: title.trim() ? undefined : "Title is required",
      units: unitIds.length ? undefined : "Pick at least one unit",
    };
    setErrors(e);
    if (!hasErrors(e)) save.mutate(undefined);
  };
  return (
    <Modal open size="lg" onClose={onClose} title="Upload recording" description="Upload the MP4 — it's saved to the organiser's OneDrive and streamed from there." footer={<><Button variant="outline" onClick={onClose} disabled={save.isPending}>Cancel</Button><Button onClick={submit} loading={save.isPending} icon={<CloudUpload className="size-4" />}>Upload</Button></>}>
      <div className="space-y-4">
        {replacing && <p className="text-sm text-neutral-600">Use this when the Teams recording can't be found in OneDrive for <span className="font-semibold">{replacing.title}</span>.</p>}
        <Field label="Video file (MP4)" required error={errors.file}>
          <input ref={fileRef} type="file" accept="video/mp4,.mp4" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <button type="button" onClick={() => fileRef.current?.click()} className={`flex w-full items-center gap-3 rounded-xl border-2 border-dashed px-4 py-4 text-left text-sm transition-colors hover:border-primary-300 hover:bg-primary-50 ${errors.file ? "border-danger" : "border-neutral-300"}`}>
            <CloudUpload className="size-5 shrink-0 text-primary-500" />
            <span className="min-w-0 flex-1 truncate">{file ? `${file.name} · ${fmtBytes(file.size)}` : "Choose an MP4 file"}</span>
          </button>
        </Field>
        <Field label="Title" required error={errors.title} htmlFor="up-title"><Input id="up-title" value={title} onChange={(e) => setTitle(e.target.value)} invalid={!!errors.title} /></Field>
        <Field label="Class (optional)" htmlFor="up-class" hint="Links the upload to a class so its recording status updates.">
          <Select id="up-class" value={classSessionId} onChange={(e) => setClassSessionId(e.target.value)}>
            <option value="">Not linked to a class</option>
            {classes.data?.filter((c) => c.status === "ended").map((c) => <option key={c.id} value={c.id}>{c.classCode} — {c.title} ({fmtDateTime(c.startsAt)})</option>)}
          </Select>
        </Field>
        <Field label="Units" required error={errors.units}><UnitCoveragePicker courseId={courseId} value={unitIds} onChange={setUnitIds} invalid={!!errors.units} /></Field>
      </div>
    </Modal>
  );
}
