import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { MessagesSquare, Plus } from "lucide-react";
import { api, type ID } from "@tasued/api-client";
import { Card, EmptyState, Pagination, SearchInput, SegmentedControl, buttonClasses } from "@tasued/ui";
import { Async, ListSkeleton } from "../../components/Async";
import { useDebounced } from "../../layout/GlobalSearch";
import { ThreadItem } from "./ThreadItem";

type Sort = "recent" | "top" | "unanswered";
const PAGE_SIZE = 15;

/** Thread list with sort / search / pagination kept in the URL. */
export function ThreadList({ courseId, categoryId, newHref, courseCodeOf }: { courseId?: ID; categoryId?: ID; newHref: string; courseCodeOf?: (courseId: ID | null) => string | undefined }) {
  const [params, setParams] = useSearchParams();
  const sort = (params.get("sort") as Sort) || "recent";
  const page = Number(params.get("page") ?? "1") || 1;
  const [term, setTerm] = useState(params.get("q") ?? "");
  const search = useDebounced(term.trim(), 300);

  const set = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    if (!("page" in patch)) next.delete("page");
    setParams(next, { replace: true });
  };
  useEffect(() => {
    if ((params.get("q") ?? "") !== search) set({ q: search || undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const q = useQuery({
    queryKey: ["forum", "threads", { courseId, categoryId, sort, search, page }],
    queryFn: () => api.forum.threads({ courseId, categoryId, sort, search: search || undefined, page, pageSize: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput className="flex-1" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search threads" aria-label="Search threads" />
        <div className="flex items-center gap-2">
          <SegmentedControl<Sort>
            value={sort}
            onChange={(s) => set({ sort: s === "recent" ? undefined : s })}
            options={[
              { key: "recent", label: "Recent" },
              { key: "top", label: "Top" },
              { key: "unanswered", label: "Unanswered" },
            ]}
          />
          <Link to={newHref} className={buttonClasses("primary", "sm", "ml-auto")}>
            <Plus className="size-4" /> New thread
          </Link>
        </div>
      </div>
      <Async
        query={q}
        skeleton={<ListSkeleton rows={4} />}
        isEmpty={(d) => d.items.length === 0}
        empty={
          <Card>
            <EmptyState
              icon={<MessagesSquare className="size-6" />}
              title={search ? "No threads match your search" : sort === "unanswered" ? "No unanswered threads" : "No discussions yet"}
              description={search ? undefined : "Be the first to start a conversation."}
              action={<Link to={newHref} className={buttonClasses("primary", "sm")}>Start a thread</Link>}
            />
          </Card>
        }
      >
        {(d) => (
          <>
            <div className={`space-y-3 ${q.isPlaceholderData ? "opacity-60" : ""}`}>
              {d.items.map((t) => <ThreadItem key={t.id} t={t} showCourse={courseCodeOf?.(t.courseId)} />)}
            </div>
            <Pagination page={d.page} pageSize={d.pageSize} total={d.total} onPage={(p) => set({ page: String(p) })} />
          </>
        )}
      </Async>
    </div>
  );
}
