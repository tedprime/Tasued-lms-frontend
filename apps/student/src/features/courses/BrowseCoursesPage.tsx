import { useSearchParams } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Compass } from "lucide-react";
import { api } from "@tasued/api-client";
import { Card, EmptyState, Field, PageHeader, Pagination, SearchInput, Button } from "@tasued/ui";
import { useMyCourses } from "../../app/queries";
import { Async, CardGridSkeleton } from "../../components/Async";
import { Page } from "../../components/bits";
import { useDebounced } from "../../layout/GlobalSearch";
import { CourseCard } from "./CourseCard";
import { useEffect, useState } from "react";

const PAGE_SIZE = 12;

/** Catalogue of every published course — students can open any course, any time. */
export default function BrowseCoursesPage() {
  const [params, setParams] = useSearchParams();
  const page = Number(params.get("page") ?? "1") || 1;
  const [term, setTerm] = useState(params.get("q") ?? "");
  const search = useDebounced(term.trim(), 300);

  const set = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    if (!("page" in patch)) next.delete("page");
    setParams(next, { replace: true });
  };

  useEffect(() => {
    if ((params.get("q") ?? "") !== search) set({ q: search });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const mine = useMyCourses();
  const mineIds = new Set(mine.data?.map((o) => o.id));
  const catalogue = useQuery({
    queryKey: ["courses", "catalogue", { search, page }],
    queryFn: () => api.courses.catalogue({ search: search || undefined, page, pageSize: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  const filtered = !!search;

  return (
    <Page>
      <PageHeader title="Browse courses" description="Every published course. Open any course to read its course text and watch recordings." />

      <Card className="mb-6 p-4">
        <Field label="Search" htmlFor="cat-search">
          <SearchInput id="cat-search" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Course code or title" />
        </Field>
      </Card>

      <Async
        query={catalogue}
        skeleton={<CardGridSkeleton />}
        isEmpty={(d) => d.items.length === 0}
        empty={
          <Card>
            <EmptyState
              icon={<Compass className="size-6" />}
              title={filtered ? "No courses match your search" : "No published courses yet"}
              action={filtered ? <Button variant="outline" size="sm" onClick={() => { setTerm(""); setParams({}, { replace: true }); }}>Clear search</Button> : undefined}
            />
          </Card>
        }
      >
        {(d) => (
          <>
            <p className="mb-3 text-xs text-neutral-500" aria-live="polite">{d.total} course{d.total === 1 ? "" : "s"}</p>
            <div className={`grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 ${catalogue.isPlaceholderData ? "opacity-60" : ""}`}>
              {d.items.map((o, i) => (
                <CourseCard key={o.id} course={o} index={i} enrolled={mineIds.has(o.id)} />
              ))}
            </div>
            <Pagination page={d.page} pageSize={d.pageSize} total={d.total} onPage={(p) => set({ page: String(p) })} />
          </>
        )}
      </Async>
    </Page>
  );
}
