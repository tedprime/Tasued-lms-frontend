import { useEffect, useRef, useState } from "react";
import { Link, useBlocker, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Eye, FileUp, Paperclip, Plus, Save, Send, Trash2, Video, X } from "lucide-react";
import { Editor as RichTextEditor } from "../../components/Editor";
import { api, errorMessage, fmtBytes, fmtDateTime, fmtDuration, type Attachment, type Unit } from "@tasued/api-client";
import { Alert, Badge, Button, ConfirmDialog, ErrorState, Field, IconButton, Input, Modal, PageLoader, RichContent, useToast } from "../../components/ui";
import { PublishBadge, RecordingStatusBadge, SectionCard } from "../../components/common";
import { OneDriveFileInfo, RecordingPreview } from "../recordings/RecordingsTable";
import { useApiMutation } from "../../components/mutation";
import { useCourseId } from "../../components/queries";
import { useCan, useTeaches } from "../../app/session";

export function UnitEditorPage() {
  const { unitId } = useParams();
  const q = useQuery({ queryKey: ["content", "unit", unitId], queryFn: () => api.content.unit(unitId!), enabled: !!unitId });
  if (q.isPending) return <PageLoader label="Loading unit…" />;
  if (q.isError) return <ErrorState title="Couldn't load this unit" description={errorMessage(q.error)} onRetry={() => q.refetch()} />;
  return <UnitEditor key={q.data.id} unit={q.data} />;
}

type Draft = { title: string; objectives: string[]; estimatedReadMinutes: number; courseTextHtml: string };

function UnitEditor({ unit }: { unit: Unit }) {
  const courseId = useCourseId();
  const can = useCan();
  const toast = useToast();
  const qc = useQueryClient();
  // Only the course's own lecturer and TAs edit its content; administrators see it read-only.
  const teaches = useTeaches()(courseId);
  const canEdit = teaches && can("content.edit");
  const canPublish = teaches && can("content.publish");
  const initial = useRef<Draft>({ title: unit.title, objectives: unit.objectives, estimatedReadMinutes: unit.estimatedReadMinutes, courseTextHtml: unit.courseTextHtml });
  const [d, setD] = useState<Draft>(initial.current);
  const [newObjective, setNewObjective] = useState("");
  const [titleError, setTitleError] = useState<string>();
  const [preview, setPreview] = useState(false);
  const [delAttachment, setDelAttachment] = useState<Attachment | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const dirty = JSON.stringify(d) !== JSON.stringify(initial.current);

  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname);
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const invalidate = [["content"], ["courses", "get", courseId]];
  const save = useApiMutation({
    mutationFn: (state?: Unit["state"]) =>
      api.content.updateUnit(unit.id, {
        title: d.title.trim(),
        objectives: d.objectives,
        estimatedReadMinutes: d.estimatedReadMinutes,
        courseTextHtml: d.courseTextHtml,
        ...(state ? { state } : {}),
      }),
    success: (_u, state) => (state === "published" ? "Unit published" : state === "draft" ? "Unit moved to draft" : "Draft saved"),
    invalidate,
    onSuccess: (u) => {
      initial.current = { title: u.title, objectives: u.objectives, estimatedReadMinutes: u.estimatedReadMinutes, courseTextHtml: u.courseTextHtml };
      setD(initial.current);
    },
  });
  const submit = (state?: Unit["state"]) => {
    if (!d.title.trim()) {
      setTitleError("Title is required");
      return;
    }
    setTitleError(undefined);
    save.mutate(state);
  };

  const upload = useApiMutation({
    mutationFn: (file: File) => api.content.uploadAttachment(unit.id, file),
    success: (a) => `${a.name} attached`,
    errorTitle: "Upload failed",
    invalidate: [["content", "unit", unit.id]],
  });
  const removeAttachment = useApiMutation({
    mutationFn: (id: string) => api.content.deleteAttachment(unit.id, id),
    success: "Attachment removed",
    invalidate: [["content", "unit", unit.id]],
    onSuccess: () => setDelAttachment(null),
  });

  const uploadImage = async (file: File) => {
    try {
      const a = await api.content.uploadAttachment(unit.id, file);
      void qc.invalidateQueries({ queryKey: ["content", "unit", unit.id] });
      return a.url;
    } catch (e) {
      toast.error("Image upload failed", errorMessage(e));
      throw e;
    }
  };

  const addObjective = () => {
    const v = newObjective.trim();
    if (!v) return;
    setD({ ...d, objectives: [...d.objectives, v] });
    setNewObjective("");
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Link to="../content" className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100" aria-label="Back to content"><ArrowLeft className="size-5" /></Link>
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 text-xs text-neutral-500"><PublishBadge state={unit.state} /> Last saved {fmtDateTime(unit.updatedAt)} {dirty && <Badge tone="amber">Unsaved changes</Badge>}</p>
            <h2 className="truncate font-headline text-xl font-extrabold text-tertiary-500">{d.title || "Untitled unit"}</h2>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" icon={<Eye className="size-4" />} onClick={() => setPreview(true)}>Preview</Button>
          {canEdit && <Button variant="outline" icon={<Save className="size-4" />} loading={save.isPending && save.variables === undefined} onClick={() => submit()} disabled={!dirty}>Save draft</Button>}
          {canPublish && (unit.state === "published" ? (
            <>
              <Button variant="subtle" onClick={() => submit("draft")} loading={save.isPending && save.variables === "draft"}>Unpublish</Button>
              {dirty && <Button icon={<Send className="size-4" />} onClick={() => submit("published")} loading={save.isPending && save.variables === "published"}>Publish changes</Button>}
            </>
          ) : (
            <Button icon={<Send className="size-4" />} onClick={() => submit("published")} loading={save.isPending && save.variables === "published"}>Publish</Button>
          ))}
        </div>
      </div>

      {!canEdit && <Alert tone="blue">You can view this unit but your role can't edit course content.</Alert>}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          <SectionCard title="Unit details" bodyClassName="space-y-4 p-5">
            <Field label="Title" required error={titleError} htmlFor="u-title"><Input id="u-title" value={d.title} disabled={!canEdit} onChange={(e) => setD({ ...d, title: e.target.value })} invalid={!!titleError} /></Field>
            <div>
              <p className="mb-1.5 text-[13px] font-semibold text-tertiary-500">Learning objectives</p>
              {d.objectives.length > 0 && (
                <ol className="mb-2 space-y-1.5">
                  {d.objectives.map((o, i) => (
                    <li key={i} className="flex items-start gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm">
                      <span className="font-semibold text-primary-500">{i + 1}.</span>
                      <span className="flex-1">{o}</span>
                      {canEdit && <IconButton className="size-6" label={`Remove objective ${i + 1}`} onClick={() => setD({ ...d, objectives: d.objectives.filter((_, j) => j !== i) })}><X className="size-3.5" /></IconButton>}
                    </li>
                  ))}
                </ol>
              )}
              {canEdit && (
                <div className="flex gap-2">
                  <Input aria-label="New objective" placeholder="Students will be able to…" value={newObjective} onChange={(e) => setNewObjective(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addObjective(); } }} />
                  <Button variant="outline" icon={<Plus className="size-4" />} onClick={addObjective}>Add</Button>
                </div>
              )}
            </div>
            <Field label="Estimated reading time (minutes)" htmlFor="u-read" className="max-w-xs">
              <Input id="u-read" type="number" min={0} max={600} value={d.estimatedReadMinutes} disabled={!canEdit} onChange={(e) => setD({ ...d, estimatedReadMinutes: Math.max(0, Number(e.target.value) || 0) })} />
            </Field>
          </SectionCard>

          <SectionCard title="Course text" subtitle="The manual reading. Students see it under the recording(s); if there's no recording, it comes first." bodyClassName="p-3 sm:p-5">
            {canEdit ? (
              <RichTextEditor value={d.courseTextHtml} onChange={(html) => setD((cur) => ({ ...cur, courseTextHtml: html }))} uploadImage={uploadImage} variant="full" minHeight={420} placeholder="Write the course text for this unit…" />
            ) : d.courseTextHtml ? (
              <RichContent html={d.courseTextHtml} />
            ) : (
              <p className="text-sm text-neutral-500">No course text yet.</p>
            )}
          </SectionCard>
        </div>

        <aside className="space-y-5">
          <SectionCard
            title="Attachments"
            action={canEdit && (
              <>
                <input ref={fileRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload.mutate(f); e.target.value = ""; }} />
                <Button size="xs" variant="outline" icon={<FileUp className="size-3.5" />} loading={upload.isPending} onClick={() => fileRef.current?.click()}>Upload</Button>
              </>
            )}
          >
            {unit.attachments.length === 0 ? (
              <p className="px-5 py-4 text-sm text-neutral-500">No attachments. Slides, worksheets and readings go here.</p>
            ) : (
              <ul className="divide-y divide-neutral-100">
                {unit.attachments.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 px-5 py-3">
                    <Paperclip className="size-4 shrink-0 text-neutral-400" />
                    <div className="min-w-0 flex-1">
                      <a href={a.url} target="_blank" rel="noreferrer" className="block truncate text-sm font-semibold text-tertiary-500 hover:text-primary-500">{a.name}</a>
                      <p className="text-xs text-neutral-500">{fmtBytes(a.sizeBytes)} · {a.scanStatus === "clean" ? "Scanned" : a.scanStatus === "pending" ? "Virus scan pending" : <span className="font-semibold text-danger">Infected — blocked</span>}</p>
                    </div>
                    {canEdit && <IconButton label={`Delete ${a.name}`} className="hover:text-danger" onClick={() => setDelAttachment(a)}><Trash2 className="size-4" /></IconButton>}
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="Recordings" subtitle="Classes that cover this unit publish their recording here. Recordings stream from the organiser's OneDrive — don't delete the files there." action={can("recordings.manage") && <Link to="../recordings" className="text-xs font-semibold text-primary-500 hover:underline">Manage</Link>}>
            {unit.recordings.length === 0 ? (
              <p className="px-5 py-4 text-sm text-neutral-500">No recordings yet. Pick this unit in a class's unit coverage when scheduling.</p>
            ) : (
              <ul className="divide-y divide-neutral-100">
                {unit.recordings.map((r) => (
                  <li key={r.id} className="flex items-start gap-3 px-5 py-3">
                    <Video className="mt-0.5 size-4 shrink-0 text-neutral-400" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-tertiary-500">{r.title}</p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-neutral-500">
                        <RecordingStatusBadge status={r.status} /> {r.durationSeconds > 0 && fmtDuration(r.durationSeconds)} {!r.published && r.status === "ready" && <Badge>Hidden</Badge>}
                      </p>
                      {r.oneDrive ? <OneDriveFileInfo file={r.oneDrive} /> : <p className="mt-1 text-xs text-neutral-500">{r.status === "pending" ? "Waiting for Teams to save the recording to OneDrive." : "Not found in OneDrive — use Manage to search again or upload the MP4."}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </aside>
      </div>

      <Modal open={preview} onClose={() => setPreview(false)} size="xl" title="Student preview" description="How this unit reads for students (unsaved changes included).">
        <article className="space-y-5">
          <h1 className="font-headline text-2xl font-extrabold text-tertiary-500">{d.title}</h1>
          {unit.recordings.filter((r) => r.status === "ready" && r.published).map((r) => (
            <RecordingPreview key={r.id} recording={r} />
          ))}
          {d.objectives.length > 0 && (
            <div className="rounded-xl border border-secondary-200 bg-secondary-50 p-4">
              <p className="mb-1 text-sm font-bold">In this unit you will</p>
              <ul className="list-disc space-y-1 pl-5 text-sm">{d.objectives.map((o, i) => <li key={i}>{o}</li>)}</ul>
            </div>
          )}
          {d.courseTextHtml ? <RichContent html={d.courseTextHtml} /> : <p className="text-sm text-neutral-500">No course text yet.</p>}
        </article>
      </Modal>

      <ConfirmDialog open={!!delAttachment} onClose={() => setDelAttachment(null)} onConfirm={() => delAttachment && removeAttachment.mutate(delAttachment.id)} loading={removeAttachment.isPending} tone="danger" title="Remove attachment?" description={`${delAttachment?.name} will no longer be available to students.`} confirmLabel="Remove" />
      <ConfirmDialog
        open={blocker.state === "blocked"}
        onClose={() => blocker.reset?.()}
        onConfirm={() => blocker.proceed?.()}
        tone="danger"
        title="Leave without saving?"
        description="You have unsaved changes to this unit. They'll be lost if you leave."
        confirmLabel="Discard changes"
      />
    </div>
  );
}
