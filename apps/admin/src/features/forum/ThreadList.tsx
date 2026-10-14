import { Link } from "react-router-dom";
import { CheckCircle2, Flag, Lock, MessageSquare, Pin } from "lucide-react";
import { fromNow, type ForumThread } from "@tasued/api-client";
import { Avatar, Badge, EmptyState } from "../../components/ui";

/** Thread rows in SLAN's Discussions style (pinned/locked chips, counts). */
export function ThreadList({ threads, showCourse }: { threads: ForumThread[]; showCourse?: Map<string, string> }) {
  if (!threads.length) return <EmptyState icon={<MessageSquare className="size-6" />} title="No threads" />;
  return (
    <ul className="divide-y divide-neutral-100">
      {threads.map((t) => (
        <li key={t.id}>
          <Link to={`/forum/threads/${t.id}`} className="flex gap-3 px-5 py-4 hover:bg-neutral-50">
            <span className={t.isPinned ? "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-secondary-50 text-secondary-700" : "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-500"}>
              {t.isPinned ? <Pin className="size-4" /> : <MessageSquare className="size-4" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-tertiary-500">{t.title}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-neutral-500">
                {showCourse && t.courseId && <Badge tone="navy">{showCourse.get(t.courseId) ?? "Course"}</Badge>}
                {!t.courseId && <Badge tone="navy">Campus</Badge>}
                {t.unitTitle && <span>Unit: {t.unitTitle} ·</span>}
                <Avatar name={t.isAnonymous ? "Anonymous" : t.author.fullName} size={16} />
                <span>{t.isAnonymous ? "Anonymous student" : t.author.fullName}</span>
                <span>· {t.replyCount} repl{t.replyCount === 1 ? "y" : "ies"} · {fromNow(t.lastActivityAt)}</span>
                {t.isPinned && <Badge tone="gold"><Pin className="size-3" /> Pinned</Badge>}
                {t.isLocked && <Badge tone="navy"><Lock className="size-3" /> Locked</Badge>}
                {t.isResolved && <Badge tone="green"><CheckCircle2 className="size-3" /> Resolved</Badge>}
                {t.reportCount > 0 && <Badge tone="red"><Flag className="size-3" /> {t.reportCount} report{t.reportCount === 1 ? "" : "s"}</Badge>}
              </div>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
