import { blocksCachedData } from "@tasued/api-client";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Eye, EyeOff, Flag, Lock, LockOpen, Pin, PinOff, Trash2 } from "lucide-react";
import { Editor as RichTextEditor } from "../../components/Editor";
import { api, errorMessage, fmtDateTime, type ForumPost, type ForumThread } from "@tasued/api-client";
import { Alert, Avatar, Badge, Button, ConfirmDialog, ErrorState, PageLoader, RichContent, cn } from "../../components/ui";
import { SectionCard } from "../../components/common";
import { useApiMutation } from "../../components/mutation";

export function ThreadPage() {
  const { threadId } = useParams();
  const navigate = useNavigate();
  const q = useQuery({ queryKey: ["forum", "thread", threadId], queryFn: () => api.forum.thread(threadId!), enabled: !!threadId });
  const [reply, setReply] = useState("");
  const [replyError, setReplyError] = useState<string>();
  const [del, setDel] = useState(false);
  const inv = [["forum"]];
  const moderate = useApiMutation({
    mutationFn: (b: Partial<Pick<ForumThread, "isPinned" | "isLocked" | "isResolved">>) => api.forum.moderateThread(threadId!, b),
    success: (t, b) => ("isPinned" in b ? (t.isPinned ? "Thread pinned" : "Thread unpinned") : "isLocked" in b ? (t.isLocked ? "Thread locked" : "Thread unlocked") : t.isResolved ? "Marked resolved" : "Marked unresolved"),
    invalidate: inv,
  });
  const hide = useApiMutation({ mutationFn: (v: { id: string; hidden: boolean }) => api.forum.hidePost(v.id, v.hidden), success: (p) => (p.isHidden ? "Reply hidden from students" : "Reply restored"), invalidate: inv });
  const remove = useApiMutation({ mutationFn: () => api.forum.deleteThread(threadId!), success: "Thread deleted", invalidate: inv, onSuccess: () => navigate(-1) });
  const post = useApiMutation({ mutationFn: () => api.forum.reply(threadId!, { bodyHtml: reply }), success: "Reply posted", invalidate: inv, onSuccess: () => setReply("") });

  if (q.isPending) return <PageLoader />;
  if (q.isError && (q.data === undefined || blocksCachedData(q.error))) return <ErrorState title="Couldn't load this thread" description={errorMessage(q.error)} onRetry={() => q.refetch()} />;
  const { thread: t, posts } = q.data;

  const submitReply = () => {
    if (!reply.replace(/<[^>]*>/g, "").trim()) return setReplyError("Write a reply");
    setReplyError(undefined);
    post.mutate(undefined);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <button type="button" onClick={() => navigate(-1)} className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100" aria-label="Back"><ArrowLeft className="size-5" /></button>
        <div className="min-w-0">
          <div className="flex flex-wrap gap-1.5">
            {t.isPinned && <Badge tone="gold"><Pin className="size-3" /> Pinned</Badge>}
            {t.isLocked && <Badge tone="navy"><Lock className="size-3" /> Locked</Badge>}
            {t.isResolved && <Badge tone="green"><CheckCircle2 className="size-3" /> Resolved</Badge>}
            {t.reportCount > 0 && <Badge tone="red"><Flag className="size-3" /> {t.reportCount} reports</Badge>}
          </div>
          <h2 className="mt-1 font-headline text-xl font-extrabold text-tertiary-500">{t.title}</h2>
          {t.courseId && <Link to={`/courses/${t.courseId}/forum`} className="text-xs font-semibold text-primary-500 hover:underline">Back to course forum</Link>}
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-4">
          <SectionCard bodyClassName="p-5">
            <PostHeader name={t.isAnonymous ? "Anonymous student" : t.author.fullName} role={t.author.roleLabel} at={t.createdAt} anonymousNote={t.isAnonymous ? `Posted anonymously (staff view: ${t.author.fullName})` : undefined} />
            <RichContent html={t.bodyHtml} className="mt-3 text-[15px]" />
          </SectionCard>
          <h3 className="text-sm font-bold text-neutral-500">{posts.length} repl{posts.length === 1 ? "y" : "ies"}</h3>
          <ol className="space-y-3">
            {posts.map((p) => <PostItem key={p.id} p={p} busy={hide.isPending && hide.variables?.id === p.id} onToggleHide={() => hide.mutate({ id: p.id, hidden: !p.isHidden })} />)}
          </ol>
          <SectionCard title="Reply as staff" bodyClassName="space-y-3 p-5">
            {t.isLocked && <Alert tone="navy" icon={<Lock className="size-4" />}>This thread is locked — students can't reply. Staff replies are still allowed.</Alert>}
            <RichTextEditor value={reply} onChange={setReply} variant="simple" minHeight={120} placeholder="Your reply is labelled as Lecturer / TA / Admin" />
            {replyError && <p className="text-xs text-danger">{replyError}</p>}
            <div className="flex justify-end"><Button onClick={submitReply} loading={post.isPending}>Post reply</Button></div>
          </SectionCard>
        </div>
        <aside>
          <SectionCard title="Moderation" bodyClassName="grid gap-2 p-4">
            <Button variant="outline" icon={t.isPinned ? <PinOff className="size-4" /> : <Pin className="size-4" />} onClick={() => moderate.mutate({ isPinned: !t.isPinned })} disabled={moderate.isPending}>{t.isPinned ? "Unpin" : "Pin to top"}</Button>
            <Button variant="outline" icon={t.isLocked ? <LockOpen className="size-4" /> : <Lock className="size-4" />} onClick={() => moderate.mutate({ isLocked: !t.isLocked })} disabled={moderate.isPending}>{t.isLocked ? "Unlock" : "Lock replies"}</Button>
            <Button variant="outline" icon={<CheckCircle2 className="size-4" />} onClick={() => moderate.mutate({ isResolved: !t.isResolved })} disabled={moderate.isPending}>{t.isResolved ? "Mark unresolved" : "Mark resolved"}</Button>
            <Button variant="ghost" className="text-danger hover:bg-danger-50" icon={<Trash2 className="size-4" />} onClick={() => setDel(true)}>Delete thread</Button>
          </SectionCard>
        </aside>
      </div>
      <ConfirmDialog open={del} onClose={() => setDel(false)} onConfirm={() => remove.mutate(undefined)} loading={remove.isPending} tone="danger" title="Delete this thread?" description="The thread and all its replies will be removed for everyone. This can't be undone." confirmLabel="Delete thread" />
    </div>
  );
}

function PostHeader({ name, role, at, anonymousNote }: { name: string; role?: string; at: string; anonymousNote?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <Avatar name={name} size={32} />
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-tertiary-500">{name} {role && role !== "Student" && <Badge tone="green">{role}</Badge>}</p>
        <p className="text-xs text-neutral-500">{fmtDateTime(at)}{anonymousNote && ` · ${anonymousNote}`}</p>
      </div>
    </div>
  );
}

function PostItem({ p, busy, onToggleHide }: { p: ForumPost; busy: boolean; onToggleHide: () => void }) {
  return (
    <li className={cn("rounded-xl border bg-white p-4 shadow-card", p.isHidden ? "border-dashed border-neutral-300 opacity-70" : "border-neutral-200", p.parentId && "ml-6 sm:ml-10")}>
      <div className="flex items-start justify-between gap-2">
        <PostHeader name={p.author.fullName} role={p.author.roleLabel} at={p.createdAt} />
        <div className="flex shrink-0 items-center gap-1.5">
          {p.isAcceptedAnswer && <Badge tone="green">Accepted answer</Badge>}
          {p.isHidden && <Badge tone="neutral">Hidden</Badge>}
          {p.reportCount > 0 && <Badge tone="red"><Flag className="size-3" /> {p.reportCount}</Badge>}
          <Button size="xs" variant="ghost" loading={busy} icon={p.isHidden ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />} onClick={onToggleHide}>{p.isHidden ? "Restore" : "Hide"}</Button>
        </div>
      </div>
      <RichContent html={p.bodyHtml} className="mt-2 text-sm" />
    </li>
  );
}
