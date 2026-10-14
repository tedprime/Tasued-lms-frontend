import { useMemo, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Bell, BellOff, CheckCircle2, Flag, Lock, MessageSquareReply, Pin, ThumbsUp, EyeOff } from "lucide-react";
import { api, errorMessage, fromNow, fmtDateTime, type ForumPost, type ForumThread } from "@tasued/api-client";
import { Editor } from "../../components/Editor";
import { Alert, Avatar, Badge, Button, Card, Field, Modal, RichContent, Textarea, cn, useToast } from "@tasued/ui";
import { useSession } from "../../app/session";
import { Async, PageSkeleton } from "../../components/Async";
import { Breadcrumbs, Page } from "../../components/bits";
import { RoleBadge, authorName } from "./ThreadItem";
import { threadKey } from "./queries";

type ThreadData = { thread: ForumThread; posts: ForumPost[] };

const plain = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").trim();

export default function ThreadPage() {
  const { threadId } = useParams();
  const q = useQuery({ queryKey: threadKey(threadId!), queryFn: () => api.forum.thread(threadId!), enabled: !!threadId });
  return (
    <Page narrow>
      <Async query={q} skeleton={<PageSkeleton />}>
        {(d) => <ThreadView data={d} />}
      </Async>
    </Page>
  );
}

function ThreadView({ data }: { data: ThreadData }) {
  const { thread: t, posts } = data;
  const session = useSession();
  const qc = useQueryClient();
  const toast = useToast();
  const key = threadKey(t.id);
  const isAuthor = t.author.id === session.user.id;
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [report, setReport] = useState<null | { type: "thread" | "post"; id: string }>(null);

  const patchThread = (th: ForumThread) => qc.setQueryData<ThreadData>(key, (d) => (d ? { ...d, thread: { ...d.thread, ...th } } : d));
  const patchPost = (p: ForumPost) => qc.setQueryData<ThreadData>(key, (d) => (d ? { ...d, posts: d.posts.map((x) => (x.id === p.id ? { ...x, ...p } : x)) } : d));

  const upvoteThread = useMutation({ mutationFn: () => api.forum.upvoteThread(t.id), onSuccess: patchThread, onError: (e) => toast.error("Couldn't vote", errorMessage(e)) });
  const subscribe = useMutation({
    mutationFn: (on: boolean) => api.forum.subscribe(t.id, on),
    onSuccess: (th, on) => {
      patchThread({ ...th, viewerIsSubscribed: th.viewerIsSubscribed ?? on });
      toast.success(on ? "Subscribed" : "Unsubscribed", on ? "You'll be notified about new replies." : undefined);
    },
    onError: (e) => toast.error("Couldn't update subscription", errorMessage(e)),
  });
  const upvotePost = useMutation({ mutationFn: (id: string) => api.forum.upvotePost(id), onSuccess: patchPost, onError: (e) => toast.error("Couldn't vote", errorMessage(e)) });
  const accept = useMutation({
    mutationFn: (postId: string) => api.forum.acceptAnswer(t.id, postId),
    onSuccess: (th, postId) => {
      qc.setQueryData<ThreadData>(key, (d) => (d ? { thread: { ...d.thread, ...th }, posts: d.posts.map((p) => ({ ...p, isAcceptedAnswer: p.id === postId })) } : d));
      toast.success("Marked as the accepted answer");
    },
    onError: (e) => toast.error("Couldn't accept answer", errorMessage(e)),
  });

  // Group into top-level posts with one level of replies (deeper replies attach to their top-level ancestor).
  const tree = useMemo(() => {
    const byId = new Map(posts.map((p) => [p.id, p]));
    const root = (p: ForumPost): string => {
      let cur = p;
      const seen = new Set<string>();
      while (cur.parentId && byId.has(cur.parentId) && !seen.has(cur.id)) {
        seen.add(cur.id);
        cur = byId.get(cur.parentId)!;
      }
      return cur.id;
    };
    const tops = posts.filter((p) => !p.parentId || !byId.has(p.parentId)).sort((a, b) => Number(b.isAcceptedAnswer) - Number(a.isAcceptedAnswer) || a.createdAt.localeCompare(b.createdAt));
    const children = new Map<string, ForumPost[]>();
    posts.filter((p) => p.parentId && byId.has(p.parentId)).forEach((p) => {
      const r = root(p);
      children.set(r, [...(children.get(r) ?? []), p].sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
    });
    return tops.map((p) => ({ post: p, replies: children.get(p.id) ?? [] }));
  }, [posts]);

  return (
    <>
      <Link to={t.courseId ? `/courses/${t.courseId}/forum` : "/forum"} className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-neutral-600 hover:text-primary-500">
        <ArrowLeft className="size-4" /> Back to discussions
      </Link>
      <Breadcrumbs items={[{ label: "Forum", to: "/forum" }, ...(t.unitTitle && t.courseId && t.unitId ? [{ label: t.unitTitle, to: `/courses/${t.courseId}/units/${t.unitId}` }] : []), { label: t.title }]} />

      <Card className="mt-3 p-5 sm:p-6">
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          {t.isPinned && <Badge tone="navy"><Pin className="size-3" /> Pinned</Badge>}
          {t.isLocked && <Badge tone="neutral"><Lock className="size-3" /> Locked</Badge>}
          {t.isResolved && <Badge tone="green"><CheckCircle2 className="size-3" /> Answered</Badge>}
          {t.tags.map((tag) => <Badge key={tag}>#{tag}</Badge>)}
        </div>
        <h1 className="font-headline text-xl font-extrabold tracking-tight text-tertiary-500 sm:text-2xl">{t.title}</h1>
        <AuthorLine author={authorName(t)} avatar={t.isAnonymous ? undefined : t.author.avatarUrl} role={t.isAnonymous ? null : <RoleBadge author={t.author} />} at={t.createdAt} />
        <RichContent html={t.bodyHtml} className="mt-4 text-[15px]" />
        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-neutral-100 pt-4">
          <VoteButton count={t.upvotes} active={!!t.viewerHasUpvoted} onClick={() => upvoteThread.mutate()} loading={upvoteThread.isPending} />
          <Button variant="ghost" size="sm" onClick={() => subscribe.mutate(!t.viewerIsSubscribed)} loading={subscribe.isPending} icon={t.viewerIsSubscribed ? <BellOff className="size-4" /> : <Bell className="size-4" />} aria-pressed={!!t.viewerIsSubscribed}>
            {t.viewerIsSubscribed ? "Unsubscribe" : "Subscribe"}
          </Button>
          {!isAuthor && (
            <Button variant="ghost" size="sm" className="ml-auto text-neutral-500" onClick={() => setReport({ type: "thread", id: t.id })} icon={<Flag className="size-4" />}>
              Report
            </Button>
          )}
        </div>
      </Card>

      <h2 className="mt-8 mb-3 text-sm font-bold text-neutral-700">
        {t.replyCount || posts.length} {(t.replyCount || posts.length) === 1 ? "reply" : "replies"}
      </h2>

      {tree.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-300 bg-white py-8 text-center text-sm text-neutral-500">No replies yet.</p>
      ) : (
        <ul className="space-y-3">
          {tree.map(({ post, replies }) => (
            <li key={post.id}>
              <PostCard
                post={post}
                canAccept={isAuthor && !t.isLocked && !post.isHidden}
                isMine={post.author.id === session.user.id}
                onUpvote={() => upvotePost.mutate(post.id)}
                onAccept={() => accept.mutate(post.id)}
                accepting={accept.isPending && accept.variables === post.id}
                onReply={t.isLocked ? undefined : () => setReplyTo(replyTo === post.id ? null : post.id)}
                onReport={() => setReport({ type: "post", id: post.id })}
              />
              {(replies.length > 0 || replyTo === post.id) && (
                <ul className="mt-2 ml-4 space-y-2 border-l-2 border-neutral-200 pl-3 sm:ml-8 sm:pl-4">
                  {replies.map((r) => (
                    <li key={r.id}>
                      <PostCard
                        post={r}
                        compact
                        isMine={r.author.id === session.user.id}
                        onUpvote={() => upvotePost.mutate(r.id)}
                        onReply={t.isLocked ? undefined : () => setReplyTo(post.id)}
                        onReport={() => setReport({ type: "post", id: r.id })}
                      />
                    </li>
                  ))}
                  {replyTo === post.id && (
                    <li>
                      <ReplyForm threadId={t.id} parentId={post.id} onDone={() => setReplyTo(null)} compact />
                    </li>
                  )}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-8">
        {t.isLocked ? (
          <Alert tone="neutral" icon={<Lock className="size-4" />}>This thread is locked. New replies are disabled.</Alert>
        ) : (
          <Card className="p-4 sm:p-5">
            <h2 className="mb-3 text-sm font-bold text-tertiary-500">Add a reply</h2>
            <ReplyForm threadId={t.id} parentId={null} />
          </Card>
        )}
      </div>

      <ReportModal target={report} onClose={() => setReport(null)} />
    </>
  );
}

function AuthorLine({ author, avatar, role, at, edited }: { author: string; avatar?: string; role: ReactNode; at: string; edited?: string }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
      <Avatar name={author} src={avatar} size={24} />
      <span className="font-semibold text-neutral-700">{author}</span>
      {role}
      <time dateTime={at} title={fmtDateTime(at)}>· {fromNow(at)}</time>
      {edited && <span>· edited</span>}
    </div>
  );
}

function VoteButton({ count, active, onClick, loading }: { count: number; active: boolean; onClick: () => void; loading?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      aria-pressed={active}
      aria-label={`${active ? "Remove upvote" : "Upvote"} (${count})`}
      className={cn("inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors", active ? "border-primary-500 bg-primary-50 text-primary-600" : "border-neutral-200 text-neutral-600 hover:border-primary-300")}
    >
      <ThumbsUp className={cn("size-3.5", active && "fill-current")} /> {count}
    </button>
  );
}

function PostCard({
  post,
  compact,
  canAccept,
  isMine,
  onUpvote,
  onAccept,
  accepting,
  onReply,
  onReport,
}: {
  post: ForumPost;
  compact?: boolean;
  canAccept?: boolean;
  isMine?: boolean;
  onUpvote: () => void;
  onAccept?: () => void;
  accepting?: boolean;
  onReply?: () => void;
  onReport: () => void;
}) {
  const staff = post.author.roleLabel === "Lecturer" || post.author.roleLabel === "TA" || post.author.roleLabel === "Admin";
  return (
    <article className={cn("rounded-xl border bg-white", compact ? "p-3.5" : "p-4", post.isAcceptedAnswer ? "border-success/50 ring-1 ring-success/20" : staff ? "border-primary-100" : "border-neutral-200")}>
      {post.isAcceptedAnswer && <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-success"><CheckCircle2 className="size-4" /> Accepted answer</p>}
      <AuthorLine author={post.author.fullName} avatar={post.author.avatarUrl} role={<RoleBadge author={post.author} />} at={post.createdAt} edited={post.editedAt} />
      {post.isHidden ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-neutral-400 italic"><EyeOff className="size-4" /> This reply was hidden by a moderator.</p>
      ) : (
        <RichContent html={post.bodyHtml} className="mt-3 text-sm" />
      )}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <VoteButton count={post.upvotes} active={!!post.viewerHasUpvoted} onClick={onUpvote} />
        {onReply && <Button variant="ghost" size="xs" onClick={onReply} icon={<MessageSquareReply className="size-3.5" />}>Reply</Button>}
        {canAccept && !post.isAcceptedAnswer && !compact && (
          <Button variant="ghost" size="xs" onClick={onAccept} loading={accepting} icon={<CheckCircle2 className="size-3.5" />}>Accept answer</Button>
        )}
        {!isMine && <Button variant="ghost" size="xs" className="ml-auto text-neutral-400" onClick={onReport} icon={<Flag className="size-3.5" />} aria-label="Report reply">
          <span className="hidden sm:inline">Report</span>
        </Button>}
      </div>
    </article>
  );
}

function ReplyForm({ threadId, parentId, onDone, compact }: { threadId: string; parentId: string | null; onDone?: () => void; compact?: boolean }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [body, setBody] = useState("");
  const [editorKey, setEditorKey] = useState(0);
  const reply = useMutation({
    mutationFn: () => api.forum.reply(threadId, { bodyHtml: body, parentId }),
    onSuccess: (p) => {
      qc.setQueryData<ThreadData>(threadKey(threadId), (d) => (d ? { thread: { ...d.thread, replyCount: d.thread.replyCount + 1 }, posts: [...d.posts, p] } : d));
      void qc.invalidateQueries({ queryKey: ["forum", "threads"] });
      setBody("");
      setEditorKey((k) => k + 1);
      toast.success("Reply posted");
      onDone?.();
    },
    onError: (e) => toast.error("Couldn't post reply", errorMessage(e)),
  });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (plain(body)) reply.mutate();
      }}
      className="space-y-3"
      aria-label={parentId ? "Reply to post" : "Reply to thread"}
    >
      <Editor key={editorKey} variant="simple" value="" onChange={setBody} placeholder={parentId ? "Write a reply…" : "Share your answer or thoughts…"} minHeight={compact ? 90 : 130} />
      <div className="flex justify-end gap-2">
        {onDone && <Button variant="outline" size="sm" onClick={onDone}>Cancel</Button>}
        <Button type="submit" size="sm" loading={reply.isPending} disabled={!plain(body)}>Post reply</Button>
      </div>
    </form>
  );
}

function ReportModal({ target, onClose }: { target: null | { type: "thread" | "post"; id: string }; onClose: () => void }) {
  const toast = useToast();
  const [reason, setReason] = useState("");
  const report = useMutation({
    mutationFn: () => api.forum.report({ targetType: target!.type, targetId: target!.id, reason: reason.trim() }),
    onSuccess: () => {
      toast.success("Report sent", "A moderator will review it. Thank you.");
      setReason("");
      onClose();
    },
    onError: (e) => toast.error("Couldn't send report", errorMessage(e)),
  });
  return (
    <Modal
      open={!!target}
      onClose={onClose}
      title={`Report this ${target?.type === "thread" ? "thread" : "reply"}`}
      description="Tell moderators what's wrong. Reports are confidential."
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="danger" onClick={() => report.mutate()} loading={report.isPending} disabled={reason.trim().length < 5}>Send report</Button>
        </>
      }
    >
      <Field label="Reason" htmlFor="report-reason" hint="At least 5 characters." required>
        <Textarea id="report-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={4} placeholder="e.g. Harassment, spam, sharing quiz answers…" />
      </Field>
    </Modal>
  );
}
