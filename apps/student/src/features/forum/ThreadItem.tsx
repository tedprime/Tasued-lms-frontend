import { Link } from "react-router-dom";
import { CheckCircle2, Lock, MessageSquare, Pin, ThumbsUp } from "lucide-react";
import { fromNow, type ForumAuthor, type ForumThread } from "@tasued/api-client";
import { Avatar, Badge } from "@tasued/ui";

export function RoleBadge({ author }: { author: ForumAuthor }) {
  if (author.roleLabel === "Lecturer") return <Badge tone="green">Lecturer</Badge>;
  if (author.roleLabel === "TA") return <Badge tone="blue">TA</Badge>;
  if (author.roleLabel === "Admin") return <Badge tone="navy">Admin</Badge>;
  return null;
}

export function authorName(t: { author: ForumAuthor; isAnonymous?: boolean }) {
  return t.isAnonymous ? "Anonymous student" : t.author.fullName;
}

const excerpt = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

/** Thread card, from SLAN's CommunityPage discussion list. */
export function ThreadItem({ t, showCourse }: { t: ForumThread; showCourse?: string }) {
  return (
    <Link to={`/forum/${t.id}`} className="block rounded-xl border border-neutral-200 bg-white p-4 transition-all hover:border-primary-300 hover:shadow-sm sm:p-5">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
            {t.isPinned && <Badge tone="navy"><Pin className="size-3" /> Pinned</Badge>}
            {t.isLocked && <Badge tone="neutral"><Lock className="size-3" /> Locked</Badge>}
            {t.isResolved && <Badge tone="green"><CheckCircle2 className="size-3" /> Answered</Badge>}
            {showCourse && <span className="text-xs font-bold text-primary-500">{showCourse}</span>}
            {t.unitTitle && <Badge tone="gold">{t.unitTitle}</Badge>}
          </div>
          <h3 className="font-headline text-[15px] font-bold text-tertiary-500">{t.title}</h3>
          <p className="mt-1 line-clamp-2 text-[13px] text-neutral-500">{excerpt(t.bodyHtml)}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5 text-xs font-semibold text-neutral-400">
          <span className="inline-flex items-center gap-1" aria-label={`${t.upvotes} upvotes`}><ThumbsUp className="size-3.5" /> {t.upvotes}</span>
          <span className="inline-flex items-center gap-1" aria-label={`${t.replyCount} replies`}><MessageSquare className="size-3.5" /> {t.replyCount}</span>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-neutral-400">
        {!t.isAnonymous && <Avatar name={t.author.fullName} src={t.author.avatarUrl} size={20} />}
        <span className="font-semibold text-neutral-600">{authorName(t)}</span>
        {!t.isAnonymous && <RoleBadge author={t.author} />}
        <span>· {fromNow(t.createdAt)}</span>
        {t.lastActivityAt !== t.createdAt && <span>· active {fromNow(t.lastActivityAt)}</span>}
      </div>
    </Link>
  );
}
