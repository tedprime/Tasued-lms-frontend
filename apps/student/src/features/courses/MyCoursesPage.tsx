import { useSearchParams } from "react-router-dom";
import { keepPreviousData, useQueries, useQuery } from "@tanstack/react-query";
import { BookOpen } from "lucide-react";
import { api } from "@tasued/api-client";
import { EmptyState, PageHeader, Card, Field, SearchInput, Button, Pagination } from "@tasued/ui";
import { completionPercent } from "../../app/queries";
import { Async, CardGridSkeleton } from "../../components/Async";
import { Page } from "../../components/bits";
import { useDebounced } from "../../layout/GlobalSearch";
import { CourseCard } from "./CourseCard";

export default function MyCoursesPage() {
  const [params, setParams] = useSearchParams();
  const term = params.get("q") ?? "";
  const search = useDebounced(term.trim(), 300);
  const rawPage = Number(params.get("page") ?? 1);
  const page = Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const courses = useQuery({
    queryKey: ["courses", "mine", { search, page }],
    queryFn: () => api.courses.list({ search: search || undefined, page, pageSize: 12 }),
    placeholderData: keepPreviousData,
  });
  const setSearch = (value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set("q", value); else next.delete("q");
    next.delete("page");
    setParams(next, { replace: true });
  };
  const progress = useQueries({
    queries: (courses.data?.items ?? []).map((o) => ({
      queryKey: ["courses", o.id, "progress"],
      queryFn: () => api.courses.progress(o.id),
    })),
  });

  return (
    <Page>
      <PageHeader title="My courses" description="Courses you're registered for." />
      <Card className="mb-6 p-4">
        <Field label="Search my courses" htmlFor="my-course-search">
          <SearchInput id="my-course-search" value={term} onChange={(e) => setSearch(e.target.value)} placeholder="Course code or title" />
        </Field>
      </Card>
      <Async
        query={courses}
        skeleton={<CardGridSkeleton />}
        isEmpty={(d) => d.items.length === 0}
        empty={
          <Card>
            <EmptyState
              icon={<BookOpen className="size-6" />}
              title={search ? "No courses match your search" : "No registered courses yet"}
              description={search ? "Try a different course code or title." : "Your enrolled courses will appear here once published. Contact your course administrator if a course is missing."}
              action={search ? <Button variant="outline" size="sm" onClick={() => setSearch("")}>Clear search</Button> : undefined}
            />
          </Card>
        }
      >
        {(data) => (
          <>
            <p className="mb-3 text-xs text-neutral-500" aria-live="polite">{data.total} course{data.total === 1 ? "" : "s"}</p>
            <div className={`grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 ${courses.isPlaceholderData ? "opacity-60" : ""}`}>
              {data.items.map((o, i) => (
                <CourseCard key={o.id} course={o} index={i} progress={progress[i]?.data ? completionPercent(progress[i]!.data, o.unitCount) : progress[i]?.isPending ? undefined : 0} enrolled />
              ))}
            </div>
            <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={(p) => { const next = new URLSearchParams(params); next.set("page", String(p)); setParams(next); }} />
          </>
        )}
      </Async>
    </Page>
  );
}
