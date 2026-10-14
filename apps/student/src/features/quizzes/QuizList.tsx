import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Timer } from "lucide-react";
import { api, fmtDate, type ID, type Quiz } from "@tasued/api-client";
import { Card, EmptyState, Tabs } from "@tasued/ui";
import { Async, ListSkeleton } from "../../components/Async";
import { quizWindow, quizWindowBadge, type QuizWindow } from "../../components/bits";

export function useQuizzes(courseId?: ID) {
  return useQuery({
    queryKey: ["quizzes", { courseId }],
    queryFn: () => api.quizzes.list({ courseId, state: "published" }),
    select: (d: Quiz[]) => d.filter((q) => q.state === "published"),
  });
}

export function QuizList({ courseId }: { courseId?: ID }) {
  const q = useQuizzes(courseId);
  const [tab, setTab] = useState<QuizWindow>("open");
  const groups = useMemo(() => {
    const g: Record<QuizWindow, Quiz[]> = { open: [], upcoming: [], closed: [] };
    q.data?.forEach((x) => g[quizWindow(x)].push(x));
    g.open.sort((a, b) => a.closesAt.localeCompare(b.closesAt));
    g.upcoming.sort((a, b) => a.opensAt.localeCompare(b.opensAt));
    g.closed.sort((a, b) => b.closesAt.localeCompare(a.closesAt));
    return g;
  }, [q.data]);

  return (
    <div>
      <Tabs<QuizWindow>
        className="mb-4"
        value={tab}
        onChange={setTab}
        tabs={[
          { key: "open", label: "Open", count: q.data ? groups.open.length : undefined },
          { key: "upcoming", label: "Upcoming", count: q.data ? groups.upcoming.length : undefined },
          { key: "closed", label: "Closed", count: q.data ? groups.closed.length : undefined },
        ]}
      />
      <Async
        query={q}
        skeleton={<ListSkeleton rows={3} />}
        isEmpty={() => groups[tab].length === 0}
        empty={<Card><EmptyState icon={<Timer className="size-6" />} title={tab === "open" ? "No quizzes open right now" : tab === "upcoming" ? "No upcoming quizzes" : "No closed quizzes"} /></Card>}
      >
        {() => (
          <ul className="space-y-2.5" role="tabpanel">
            {groups[tab].map((x) => (
              <li key={x.id}>
                <Link to={`/quizzes/${x.id}`} className="flex items-center gap-4 rounded-xl border border-neutral-200 bg-white p-4 transition-colors hover:border-primary-300">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary-50 text-secondary-700"><Timer className="size-5" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      {!courseId && <span className="text-xs font-bold text-primary-500">{x.courseCode}</span>}
                      {quizWindowBadge(quizWindow(x))}
                    </span>
                    <span className="mt-0.5 block truncate font-semibold text-tertiary-500">{x.title}</span>
                    <span className="text-xs text-neutral-500">
                      {x.timeLimitMinutes} min · {x.drawCount} questions · {x.attemptsAllowed} attempt{x.attemptsAllowed === 1 ? "" : "s"} ·{" "}
                      {tab === "upcoming" ? `opens ${fmtDate(x.opensAt, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}` : `${tab === "closed" ? "closed" : "closes"} ${fmtDate(x.closesAt, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}`}
                    </span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-neutral-400" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Async>
    </div>
  );
}
