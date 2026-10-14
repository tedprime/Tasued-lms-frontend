import { useState } from "react";
import { Link } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Ban, Check, Flag } from "lucide-react";
import { api, fmtDateTime, fromNow, type ForumReport } from "@tasued/api-client";
import { Badge, Button, ConfirmDialog, EmptyState, PageHeader, Pagination, SegmentedControl, Tabs } from "../../components/ui";
import { ListSkeleton, QueryView, SectionCard } from "../../components/common";
import { useApiMutation } from "../../components/mutation";
import { CourseSelect } from "../../components/pickers";
import { useCoursesInScope } from "../../components/queries";
import { ThreadList } from "./ThreadList";

/** Moderation queue — replaces SLAN admin's pages/Discussions.tsx overview. */
export function ForumModerationPage() {
  const [tab, setTab] = useState<"reports" | "threads">("reports");
  const reports = useQuery({ queryKey: ["forum", "reports", "open"], queryFn: () => api.forum.reports("open") });
  return (
    <div>
      <PageHeader title="Forum moderation" description="Review reported posts and keep an eye on recent conversations across courses." />
      <Tabs className="mb-5" value={tab} onChange={setTab} tabs={[{ key: "reports", label: "Reports queue", count: reports.data?.length }, { key: "threads", label: "Recent threads" }]} />
      {tab === "reports" ? <ReportsQueue /> : <RecentThreads />}
    </div>
  );
}

function ReportsQueue() {
  const [status, setStatus] = useState<ForumReport["status"]>("open");
  const q = useQuery({ queryKey: ["forum", "reports", status], queryFn: () => api.forum.reports(status) });
  const [acting, setActing] = useState<ForumReport | null>(null);
  const inv = [["forum"]];
  const dismiss = useApiMutation({ mutationFn: (id: string) => api.forum.resolveReport(id, "dismissed"), success: "Report dismissed", invalidate: inv });
  const action = useApiMutation({
    mutationFn: async (r: ForumReport) => {
      if (r.targetType === "post") await api.forum.hidePost(r.targetId, true);
      else await api.forum.moderateThread(r.targetId, { isLocked: true });
      return api.forum.resolveReport(r.id, "actioned");
    },
    success: (r) => (r.targetType === "post" ? "Post hidden and report closed" : "Thread locked and report closed"),
    invalidate: inv,
    onSuccess: () => setActing(null),
  });
  return (
    <SectionCard action={<SegmentedControl<ForumReport["status"]> value={status} onChange={setStatus} options={[{ key: "open", label: "Open" }, { key: "actioned", label: "Actioned" }, { key: "dismissed", label: "Dismissed" }]} />}>
      <QueryView query={q} loading={<ListSkeleton />} isEmpty={(d) => !d.length} empty={<EmptyState icon={<Flag className="size-6" />} title={status === "open" ? "No open reports" : "Nothing here"} description={status === "open" ? "Reported posts and threads will appear here." : undefined} />}>
        {(rows) => (
          <ul className="divide-y divide-neutral-100">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                    <Badge tone="red"><Flag className="size-3" /> {r.reason}</Badge>
                    <span>{r.targetType === "post" ? "Reply" : "Thread"} reported by {r.reportedBy} · {fromNow(r.reportedAt)}</span>
                  </div>
                  <Link to={`/forum/threads/${r.threadId}`} className="mt-1 block font-semibold text-tertiary-500 hover:text-primary-500">{r.threadTitle}</Link>
                  <blockquote className="mt-1 border-l-2 border-neutral-200 pl-3 text-sm text-neutral-600">{r.excerpt}</blockquote>
                </div>
                {r.status === "open" ? (
                  <div className="flex shrink-0 gap-2">
                    <Button size="xs" variant="outline" icon={<Check className="size-3.5" />} loading={dismiss.isPending && dismiss.variables === r.id} onClick={() => dismiss.mutate(r.id)}>Dismiss</Button>
                    <Button size="xs" variant="danger" icon={<Ban className="size-3.5" />} onClick={() => setActing(r)}>{r.targetType === "post" ? "Hide post" : "Lock thread"}</Button>
                  </div>
                ) : (
                  <Badge tone={r.status === "actioned" ? "green" : "neutral"}>{r.status} · {fmtDateTime(r.reportedAt)}</Badge>
                )}
              </li>
            ))}
          </ul>
        )}
      </QueryView>
      <ConfirmDialog
        open={!!acting}
        onClose={() => setActing(null)}
        onConfirm={() => acting && action.mutate(acting)}
        loading={action.isPending}
        tone="danger"
        title={acting?.targetType === "post" ? "Hide this reply?" : "Lock this thread?"}
        description={acting?.targetType === "post" ? "The reply is hidden from students (staff can still see and restore it). The report is marked actioned." : "No one can reply to a locked thread. The report is marked actioned."}
        confirmLabel={acting?.targetType === "post" ? "Hide post" : "Lock thread"}
      />
    </SectionCard>
  );
}

function RecentThreads() {
  const [courseId, setCourseId] = useState("");
  const [page, setPage] = useState(1);
  const scope = useCoursesInScope();
  const codes = new Map(scope.data?.map((o) => [o.id, o.code]));
  const q = useQuery({
    queryKey: ["forum", "threads", { courseId, page, sort: "recent" }],
    queryFn: () => api.forum.threads({ courseId: courseId || undefined, page, pageSize: 20, sort: "recent" }),
    placeholderData: keepPreviousData,
  });
  return (
    <SectionCard action={<div className="w-full sm:w-72"><CourseSelect allowAll value={courseId} onChange={(v) => { setCourseId(v); setPage(1); }} /></div>}>
      <QueryView query={q} loading={<ListSkeleton />}>
        {(d) => (
          <>
            <ThreadList threads={d.items} showCourse={codes} />
            <Pagination page={d.page} pageSize={d.pageSize} total={d.total} onPage={setPage} />
          </>
        )}
      </QueryView>
    </SectionCard>
  );
}
