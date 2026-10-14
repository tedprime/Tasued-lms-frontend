import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ClipboardList, ChevronRight } from "lucide-react";
import type { ID } from "@tasued/api-client";
import { Badge, Card, EmptyState, Tabs } from "@tasued/ui";
import { Async, ListSkeleton } from "../../components/Async";
import { DueText, submissionBadge } from "../../components/bits";
import { bucketOf, submissionWindow, useAssignments, useMySubmissions, type AssignmentBucket } from "./queries";

/** All assignments (optionally for one course) split into To do / Submitted / Graded. */
export function AssignmentList({ courseId }: { courseId?: ID }) {
  const [tab, setTab] = useState<AssignmentBucket>("todo");
  const q = useAssignments(courseId);
  const subs = useMySubmissions(q.data);

  const buckets = useMemo(() => {
    const b: Record<AssignmentBucket, NonNullable<typeof q.data>> = { todo: [], submitted: [], graded: [], missed: [] };
    q.data?.forEach((a) => b[bucketOf(subs.map.get(a.id), a)].push(a));
    b.submitted.reverse();
    b.graded.reverse();
    return b;
  }, [q.data, subs.map]);

  return (
    <div>
      <Tabs<AssignmentBucket>
        className="mb-4"
        value={tab}
        onChange={setTab}
        tabs={[
          { key: "todo", label: "To do", count: q.data ? buckets.todo.length : undefined },
          { key: "submitted", label: "Submitted", count: q.data ? buckets.submitted.length : undefined },
          { key: "graded", label: "Graded", count: q.data ? buckets.graded.length : undefined },
          { key: "missed", label: "Missed", count: q.data ? buckets.missed.length : undefined },
        ]}
      />
      <Async
        query={q}
        skeleton={<ListSkeleton rows={4} />}
        isEmpty={() => buckets[tab].length === 0}
        empty={
          <Card>
            <EmptyState
              icon={<ClipboardList className="size-6" />}
              title={tab === "todo" ? "Nothing to do" : tab === "submitted" ? "No submitted assignments awaiting grades" : tab === "missed" ? "No missed assignments" : "No graded assignments yet"}
              description={tab === "todo" ? "New assignments from your lecturers will appear here." : undefined}
            />
          </Card>
        }
      >
        {() => (
          <ul className="space-y-2.5" role="tabpanel">
            {buckets[tab].map((a) => {
              const sub = subs.map.get(a.id);
              const win = submissionWindow(a, sub);
              const g = sub?.grade?.released ? sub.grade : undefined;
              return (
                <li key={a.id}>
                  <Link to={`/assignments/${a.id}`} className="flex items-center gap-4 rounded-xl border border-neutral-200 bg-white p-4 transition-colors hover:border-primary-300">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-500"><ClipboardList className="size-5" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        {!courseId && <span className="text-xs font-bold text-primary-500">{a.courseCode}</span>}
                        {sub === undefined && subs.pending ? null : submissionBadge(sub?.state, !!g)}
                        {tab === "todo" && win.state === "late" && <Badge tone="amber">Late window</Badge>}
                        {win.state === "closed" && tab === "missed" && <Badge tone="red">Closed — not submitted</Badge>}
                        {tab === "todo" && win.state === "not_open" && <Badge tone="blue">Opens later</Badge>}
                        {win.extended && <Badge tone="purple">Extension</Badge>}
                      </span>
                      <span className="mt-0.5 block truncate font-semibold text-tertiary-500">{a.title}</span>
                      {g ? (
                        <span className="text-xs font-semibold text-tertiary-500">Score: {g.score}/{g.maxScore}</span>
                      ) : sub?.state === "submitted" ? (
                        <span className="text-xs text-neutral-500">Submitted · receipt {sub.receiptCode}</span>
                      ) : (
                        <DueText iso={sub?.extensionDueAt ?? a.dueAt} />
                      )}
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-neutral-400" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Async>
    </div>
  );
}
