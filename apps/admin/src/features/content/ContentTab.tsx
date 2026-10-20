import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDown, ArrowUp, BookOpenText, Eye, EyeOff, FolderPlus, MoreHorizontal, Pencil, Plus, Trash2, Video } from "lucide-react";
import { api, type ID, type Module, type UnitSummary } from "@tasued/api-client";
import { Badge, Button, ConfirmDialog, EmptyState, Field, IconButton, Input, Menu, Modal, Textarea } from "../../components/ui";
import { ListSkeleton, PublishBadge, QueryView, SectionCard } from "../../components/common";
import { hasErrors, useApiMutation } from "../../components/mutation";
import { useModules, useCourseId, useCourse } from "../../components/queries";
import { useCan, useTeaches } from "../../app/session";

type Dialog =
  | { kind: "publish-course" }
  | { kind: "module"; module?: Module }
  | { kind: "unit"; moduleId: ID; unit?: UnitSummary }
  | { kind: "delete-module"; module: Module }
  | { kind: "delete-unit"; unit: UnitSummary }
  | null;

/** Modules & units tree — replaces SLAN's Manage-Module / ModuleCreate / Manage-Unit lists. */
export function ContentTab() {
  const courseId = useCourseId();
  const q = useModules(courseId);
  const course = useCourse(courseId);
  const can = useCan();
  const [dialog, setDialog] = useState<Dialog>(null);
  const keys = [["content", "modules", courseId], ["courses", "get", courseId]];

  const publishCourse = useApiMutation({
    mutationFn: () => api.content.publishCourse(courseId),
    success: "Course and all saved modules and units published",
    errorTitle: "Couldn't publish course",
    invalidate: [["content"], ["courses"]],
    onSuccess: () => setDialog(null),
  });
  const reorderModules = useApiMutation({ mutationFn: (ids: ID[]) => api.content.reorderModules(courseId, ids), errorTitle: "Couldn't reorder", invalidate: keys });
  const reorderUnits = useApiMutation({ mutationFn: (v: { moduleId: ID; ids: ID[] }) => api.content.reorderUnits(v.moduleId, v.ids), errorTitle: "Couldn't reorder", invalidate: keys });
  const setModuleState = useApiMutation({ mutationFn: (v: { id: ID; state: Module["state"] }) => api.content.updateModule(v.id, { state: v.state }), success: (m) => (m.state === "published" ? "Module published" : "Module unpublished"), invalidate: keys });
  const setUnitState = useApiMutation({ mutationFn: (v: { id: ID; state: Module["state"] }) => api.content.updateUnit(v.id, { state: v.state }), success: (u) => (u.state === "published" ? "Unit published" : "Unit moved to draft"), invalidate: keys });
  const delModule = useApiMutation({ mutationFn: (id: ID) => api.content.deleteModule(id), success: "Module deleted", invalidate: keys, onSuccess: () => setDialog(null) });
  const delUnit = useApiMutation({ mutationFn: (id: ID) => api.content.deleteUnit(id), success: "Unit deleted", invalidate: keys, onSuccess: () => setDialog(null) });

  const move = <T extends { id: ID }>(list: T[], i: number, dir: -1 | 1) => {
    const ids = list.map((x) => x.id);
    const j = i + dir;
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
    return ids;
  };

  // Only the course's own lecturer and TAs edit its content; administrators see it read-only.
  const teaches = useTeaches()(courseId);
  const canEdit = teaches && can("content.edit");
  const canPublish = teaches && can("content.publish");

  return (
    <div className="space-y-4">
      {(canEdit || canPublish) && (
        <div className="flex flex-wrap justify-end gap-2">
          {canPublish && <Button variant="outline" icon={<Eye className="size-4" />} disabled={!q.data?.length || !course.data || course.data.status === "archived" || publishCourse.isPending} onClick={() => setDialog({kind: "publish-course"})}>Publish entire course</Button>}
          {canEdit && <Button icon={<FolderPlus className="size-4" />} onClick={() => setDialog({ kind: "module" })}>Add module</Button>}
        </div>
      )}

      <QueryView
        query={q}
        loading={<SectionCard><ListSkeleton /></SectionCard>}
        isEmpty={(d) => !d.length}
        empty={<SectionCard><EmptyState icon={<BookOpenText className="size-6" />} title="No modules yet" description="Organise the course into modules, then add units with course text, attachments and recordings." action={canEdit && <Button size="sm" onClick={() => setDialog({ kind: "module" })}>Add the first module</Button>} /></SectionCard>}
      >
        {(modules) => {
          const sorted = [...modules].sort((a, b) => a.order - b.order);
          return (
            <ol className="space-y-4">
              {sorted.map((m, mi) => {
                const units = [...m.units].sort((a, b) => a.order - b.order);
                return (
                  <li key={m.id}>
                    <SectionCard
                      title={<span className="flex flex-wrap items-center gap-2"><span className="text-neutral-400">Module {mi + 1}.</span> {m.title} <PublishBadge state={m.state} /></span>}
                      subtitle={m.summary}
                      action={
                        <div className="flex items-center gap-1">
                          {canEdit && (
                            <>
                              <IconButton label={`Move ${m.title} up`} disabled={mi === 0 || reorderModules.isPending} onClick={() => reorderModules.mutate(move(sorted, mi, -1))}><ArrowUp className="size-4" /></IconButton>
                              <IconButton label={`Move ${m.title} down`} disabled={mi === sorted.length - 1 || reorderModules.isPending} onClick={() => reorderModules.mutate(move(sorted, mi, 1))}><ArrowDown className="size-4" /></IconButton>
                            </>
                          )}
                          {canPublish && (
                            <Button size="xs" variant={m.state === "published" ? "outline" : "primary"} icon={m.state === "published" ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />} onClick={() => setModuleState.mutate({ id: m.id, state: m.state === "published" ? "draft" : "published" })}>
                              {m.state === "published" ? "Unpublish" : "Publish"}
                            </Button>
                          )}
                          {canEdit && (
                            <Menu
                              trigger={<IconButton label={`More actions for ${m.title}`}><MoreHorizontal className="size-4" /></IconButton>}
                              items={[
                                { label: "Add unit", icon: <Plus className="size-4" />, onClick: () => setDialog({ kind: "unit", moduleId: m.id }) },
                                { label: "Rename module", icon: <Pencil className="size-4" />, onClick: () => setDialog({ kind: "module", module: m }) },
                                "divider",
                                { label: "Delete module", icon: <Trash2 className="size-4" />, danger: true, onClick: () => setDialog({ kind: "delete-module", module: m }) },
                              ]}
                            />
                          )}
                        </div>
                      }
                    >
                      {units.length === 0 ? (
                        <div className="flex items-center justify-between px-5 py-4 text-sm text-neutral-500">
                          No units yet.
                          {canEdit && <Button size="xs" variant="ghost" icon={<Plus className="size-3.5" />} onClick={() => setDialog({ kind: "unit", moduleId: m.id })}>Add unit</Button>}
                        </div>
                      ) : (
                        <ol className="divide-y divide-neutral-100">
                          {units.map((u, ui) => (
                            <li key={u.id} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                              <div className="min-w-0">
                                <Link to={`../units/${u.id}`} className="font-semibold text-tertiary-500 hover:text-primary-500">
                                  <span className="mr-1 text-neutral-400">{mi + 1}.{ui + 1}</span> {u.title}
                                </Link>
                                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                                  <PublishBadge state={u.state} />
                                  {u.hasRecording ? <Badge tone="blue"><Video className="size-3" /> {u.recordingCount} recording{u.recordingCount === 1 ? "" : "s"}</Badge> : <span>No recording yet</span>}
                                  <span>{u.estimatedReadMinutes} min read</span>
                                </div>
                              </div>
                              <div className="flex shrink-0 items-center gap-1">
                                {canEdit && (
                                  <>
                                    <IconButton label={`Move ${u.title} up`} disabled={ui === 0 || reorderUnits.isPending} onClick={() => reorderUnits.mutate({ moduleId: m.id, ids: move(units, ui, -1) })}><ArrowUp className="size-4" /></IconButton>
                                    <IconButton label={`Move ${u.title} down`} disabled={ui === units.length - 1 || reorderUnits.isPending} onClick={() => reorderUnits.mutate({ moduleId: m.id, ids: move(units, ui, 1) })}><ArrowDown className="size-4" /></IconButton>
                                  </>
                                )}
                                {canPublish && (
                                  <Button size="xs" variant="ghost" onClick={() => setUnitState.mutate({ id: u.id, state: u.state === "published" ? "draft" : "published" })}>
                                    {u.state === "published" ? "Unpublish" : "Publish"}
                                  </Button>
                                )}
                                <Link to={`../units/${u.id}`} className="rounded-md px-2.5 py-1.5 text-xs font-semibold text-primary-500 hover:bg-primary-50">{canEdit ? "Edit" : "View"}</Link>
                                {canEdit && (
                                  <Menu
                                    trigger={<IconButton label={`More actions for ${u.title}`}><MoreHorizontal className="size-4" /></IconButton>}
                                    items={[
                                      { label: "Rename unit", icon: <Pencil className="size-4" />, onClick: () => setDialog({ kind: "unit", moduleId: m.id, unit: u }) },
                                      { label: "Delete unit", icon: <Trash2 className="size-4" />, danger: true, onClick: () => setDialog({ kind: "delete-unit", unit: u }) },
                                    ]}
                                  />
                                )}
                              </div>
                            </li>
                          ))}
                        </ol>
                      )}
                    </SectionCard>
                  </li>
                );
              })}
            </ol>
          );
        }}
      </QueryView>

      <ConfirmDialog
        open={dialog?.kind === "publish-course"}
        onClose={() => { if (!publishCourse.isPending) setDialog(null); }}
        onConfirm={() => publishCourse.mutate()}
        loading={publishCourse.isPending}
        title="Publish the entire course?"
        description={`Students will be able to access this course and all ${q.data?.length ?? 0} saved modules and ${q.data?.reduce((n, m) => n + m.units.length, 0) ?? 0} units, including their course text and attachments. Save any open edits first. Quizzes, assignments, recordings and grades keep their own release settings.`}
        confirmLabel="Publish entire course"
      />
      {dialog?.kind === "module" && <ModuleModal courseId={courseId} module={dialog.module} onClose={() => setDialog(null)} />}
      {dialog?.kind === "unit" && <UnitModal courseId={courseId} moduleId={dialog.moduleId} unit={dialog.unit} onClose={() => setDialog(null)} />}
      <ConfirmDialog
        open={dialog?.kind === "delete-module"}
        onClose={() => setDialog(null)}
        onConfirm={() => dialog?.kind === "delete-module" && delModule.mutate(dialog.module.id)}
        loading={delModule.isPending}
        tone="danger"
        title="Delete this module?"
        description={dialog?.kind === "delete-module" ? `"${dialog.module.title}" and its ${dialog.module.units.length} unit(s) will be deleted. Recordings stay in the Recordings list but are detached from these units.` : undefined}
        confirmLabel="Delete module"
      />
      <ConfirmDialog
        open={dialog?.kind === "delete-unit"}
        onClose={() => setDialog(null)}
        onConfirm={() => dialog?.kind === "delete-unit" && delUnit.mutate(dialog.unit.id)}
        loading={delUnit.isPending}
        tone="danger"
        title="Delete this unit?"
        description={dialog?.kind === "delete-unit" ? `"${dialog.unit.title}", its course text and attachments will be deleted.` : undefined}
        confirmLabel="Delete unit"
      />
    </div>
  );
}

function ModuleModal({ courseId, module, onClose }: { courseId: ID; module?: Module; onClose: () => void }) {
  const [title, setTitle] = useState(module?.title ?? "");
  const [summary, setSummary] = useState(module?.summary ?? "");
  const [error, setError] = useState<string>();
  const save = useApiMutation({
    mutationFn: () => (module ? api.content.updateModule(module.id, { title: title.trim(), summary }) : api.content.createModule(courseId, { title: title.trim(), summary })),
    success: module ? "Module renamed" : "Module added",
    invalidate: [["content", "modules", courseId], ["courses", "get", courseId]],
    onSuccess: onClose,
  });
  const submit = () => {
    const e = title.trim() ? undefined : "Title is required";
    setError(e);
    if (!hasErrors({ e })) save.mutate(undefined);
  };
  return (
    <Modal open onClose={onClose} title={module ? "Edit module" : "Add module"} footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={submit} loading={save.isPending}>Save</Button></>}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <Field label="Module title" required error={error} htmlFor="mod-title"><Input id="mod-title" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} invalid={!!error} placeholder="Module 1: Introduction to AI" /></Field>
        <Field label="Summary" htmlFor="mod-sum"><Textarea id="mod-sum" rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} /></Field>
      </form>
    </Modal>
  );
}

function UnitModal({ courseId, moduleId, unit, onClose }: { courseId: ID; moduleId: ID; unit?: UnitSummary; onClose: () => void }) {
  const [title, setTitle] = useState(unit?.title ?? "");
  const [error, setError] = useState<string>();
  const save = useApiMutation({
    mutationFn: () => (unit ? api.content.updateUnit(unit.id, { title: title.trim() }) : api.content.createUnit(moduleId, { title: title.trim() })),
    success: unit ? "Unit renamed" : "Unit added as a draft",
    invalidate: [["content"], ["courses", "get", courseId]],
    onSuccess: onClose,
  });
  const submit = () => {
    const e = title.trim() ? undefined : "Title is required";
    setError(e);
    if (!e) save.mutate(undefined);
  };
  return (
    <Modal open onClose={onClose} title={unit ? "Rename unit" : "Add unit"} footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={submit} loading={save.isPending}>Save</Button></>}>
      <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <Field label="Unit title" required error={error} htmlFor="unit-title" hint={unit ? undefined : "You can write course text and attach files after creating it."}>
          <Input id="unit-title" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} invalid={!!error} />
        </Field>
      </form>
    </Modal>
  );
}
