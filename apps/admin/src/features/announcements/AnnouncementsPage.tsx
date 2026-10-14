import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Megaphone, Pin, PinOff, Plus, Trash2 } from "lucide-react";
import { Editor as RichTextEditor } from "../../components/Editor";
import { api, fmtDateTime, type Announcement, type ID } from "@tasued/api-client";
import { Badge, Button, ConfirmDialog, EmptyState, Field, IconButton, Input, Modal, PageHeader, RichContent, Select, Switch } from "../../components/ui";
import { ListSkeleton, QueryView, SectionCard } from "../../components/common";
import { hasErrors, useApiMutation } from "../../components/mutation";
import { CourseSelect } from "../../components/pickers";
import { useCourseId } from "../../components/queries";
import { useIsSuperAdmin, useTeaches } from "../../app/session";

export function CourseAnnouncementsTab() {
  const courseId = useCourseId();
  return <Announcements courseId={courseId} />;
}

export function AnnouncementsGlobalPage() {
  const [filter, setFilter] = useState("");
  const isAdmin = useIsSuperAdmin();
  const teachesAny = useTeaches()();
  const description = isAdmin && teachesAny
    ? "Send to all students, or to the students of a course you teach. Optionally also by email."
    : isAdmin
      ? "Platform-wide notices to all students, optionally also by email. Course announcements are sent by each course's lecturer."
      : "Send to the students of a course you teach. Optionally also by email.";
  return (
    <div>
      <PageHeader title="Announcements" description={description} />
      <Announcements courseId={filter || undefined} global onFilter={setFilter} filter={filter} />
    </div>
  );
}

function Announcements({ courseId, global, filter, onFilter }: { courseId?: ID; global?: boolean; filter?: string; onFilter?: (v: string) => void }) {
  const q = useQuery({ queryKey: ["announcements", { courseId }], queryFn: () => api.announcements.list({ courseId }) });
  const [creating, setCreating] = useState(false);
  const [del, setDel] = useState<Announcement | null>(null);
  const pin = useApiMutation({ mutationFn: (a: Announcement) => api.announcements.update(a.id, { isPinned: !a.isPinned }), success: (a) => (a.isPinned ? "Pinned" : "Unpinned"), invalidate: [["announcements"]] });
  const remove = useApiMutation({ mutationFn: (id: ID) => api.announcements.delete(id), success: "Announcement deleted", invalidate: [["announcements"]], onSuccess: () => setDel(null) });
  const isAdmin = useIsSuperAdmin();
  const teaches = useTeaches();
  // All-student notices belong to administrators; course announcements to that course's teaching staff.
  const canManage = (a: Announcement) => (a.courseId ? teaches(a.courseId) : isAdmin);
  const canCreate = global ? isAdmin || teaches() : !!courseId && teaches(courseId);
  return (
    <SectionCard
      title={global ? undefined : "Announcements"}
      action={
        <>
          {global && onFilter && <div className="w-full sm:w-72"><CourseSelect allowAll allLabel="All announcements" value={filter ?? ""} onChange={onFilter} /></div>}
          {canCreate && <Button size="sm" icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>New announcement</Button>}
        </>
      }
    >
      <QueryView query={q} loading={<ListSkeleton />} isEmpty={(d) => !d.length} empty={<EmptyState icon={<Megaphone className="size-6" />} title="No announcements yet" />}>
        {(rows) => (
          <ul className="divide-y divide-neutral-100">
            {[...rows].sort((a, b) => Number(b.isPinned) - Number(a.isPinned) || b.publishedAt.localeCompare(a.publishedAt)).map((a) => (
              <li key={a.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {a.isPinned && <Badge tone="gold"><Pin className="size-3" /> Pinned</Badge>}
                      <Badge tone="navy">{a.courseId ? a.courseCode ?? "Course" : "All students"}</Badge>
                      {a.sendEmail && <Badge tone="blue">Emailed</Badge>}
                    </div>
                    <p className="mt-1 font-semibold text-tertiary-500">{a.title}</p>
                    <p className="text-xs text-neutral-500">{a.author.fullName} · {fmtDateTime(a.publishedAt)}</p>
                  </div>
                  {canManage(a) && <div className="flex shrink-0">
                    <IconButton label={a.isPinned ? `Unpin ${a.title}` : `Pin ${a.title}`} onClick={() => pin.mutate(a)}>{a.isPinned ? <PinOff className="size-4" /> : <Pin className="size-4" />}</IconButton>
                    <IconButton label={`Delete ${a.title}`} className="hover:text-danger" onClick={() => setDel(a)}><Trash2 className="size-4" /></IconButton>
                  </div>}
                </div>
                <RichContent html={a.bodyHtml} className="mt-2 line-clamp-4 text-sm" />
              </li>
            ))}
          </ul>
        )}
      </QueryView>
      {creating && <NewAnnouncementModal fixedCourseId={global ? undefined : courseId} onClose={() => setCreating(false)} />}
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} onConfirm={() => del && remove.mutate(del.id)} loading={remove.isPending} tone="danger" title="Delete announcement?" description="Students will no longer see it. Emails already sent can't be recalled." confirmLabel="Delete" />
    </SectionCard>
  );
}

function NewAnnouncementModal({ fixedCourseId, onClose }: { fixedCourseId?: ID; onClose: () => void }) {
  const isAdmin = useIsSuperAdmin();
  const teachesAny = useTeaches()();
  const [audience, setAudience] = useState<"all" | "course">(fixedCourseId || !isAdmin ? "course" : "all");
  const [courseId, setCourseId] = useState(fixedCourseId ?? "");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sendEmail, setSendEmail] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [errors, setErrors] = useState<{ title?: string; body?: string; course?: string }>({});
  const save = useApiMutation({
    mutationFn: () => api.announcements.create({ courseId: audience === "all" ? null : courseId, title: title.trim(), bodyHtml: body, sendEmail, isPinned }),
    success: sendEmail ? "Announcement published and emailed" : "Announcement published",
    invalidate: [["announcements"]],
    onSuccess: onClose,
  });
  const submit = () => {
    const e = {
      title: title.trim() ? undefined : "Title is required",
      body: body.replace(/<[^>]*>/g, "").trim() ? undefined : "Write the announcement",
      course: audience === "course" && !courseId ? "Choose a course" : undefined,
    };
    setErrors(e);
    if (!hasErrors(e)) save.mutate(undefined);
  };
  return (
    <Modal open size="lg" onClose={onClose} title="New announcement" footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={submit} loading={save.isPending}>Publish</Button></>}>
      <div className="space-y-4">
        {!fixedCourseId && (isAdmin || teachesAny) && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Audience" htmlFor="an-aud">
              <Select id="an-aud" value={audience} onChange={(e) => setAudience(e.target.value as "all" | "course")} disabled={!(isAdmin && teachesAny)}>
                {isAdmin && <option value="all">All students</option>}
                {teachesAny && <option value="course">Students of a course you teach</option>}
              </Select>
            </Field>
            {audience === "course" && <Field label="Course" required error={errors.course} htmlFor="an-off"><CourseSelect id="an-off" value={courseId} onChange={setCourseId} invalid={!!errors.course} teachingOnly /></Field>}
          </div>
        )}
        <Field label="Title" required error={errors.title} htmlFor="an-title"><Input id="an-title" value={title} onChange={(e) => setTitle(e.target.value)} invalid={!!errors.title} /></Field>
        <Field label="Message" required error={errors.body}><RichTextEditor value={body} onChange={setBody} variant="simple" minHeight={160} /></Field>
        <Switch checked={sendEmail} onChange={setSendEmail} label="Also send by email" description="Emails go to the address each student was invited with." />
        <Switch checked={isPinned} onChange={setIsPinned} label="Pin to the top" />
      </div>
    </Modal>
  );
}
