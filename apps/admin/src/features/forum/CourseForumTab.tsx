import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "@tasued/api-client";
import { Pagination, SearchInput, SegmentedControl } from "../../components/ui";
import { ListSkeleton, QueryView, SectionCard } from "../../components/common";
import { useCourseId } from "../../components/queries";
import { ThreadList } from "./ThreadList";

type Sort = "recent" | "unanswered" | "top";

export function CourseForumTab() {
  const courseId = useCourseId();
  const [sort, setSort] = useState<Sort>("recent");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const q = useQuery({
    queryKey: ["forum", "threads", { courseId, sort, search, page }],
    queryFn: () => api.forum.threads({ courseId, sort, search, page, pageSize: 20 }),
    placeholderData: keepPreviousData,
  });
  return (
    <SectionCard
      title="Course forum"
      subtitle="Open a thread to pin, lock, resolve, hide posts or reply as staff."
      action={
        <>
          <SearchInput className="w-full sm:w-56" placeholder="Search threads" aria-label="Search threads" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          <SegmentedControl<Sort> value={sort} onChange={(s) => { setSort(s); setPage(1); }} options={[{ key: "recent", label: "Recent" }, { key: "unanswered", label: "Unanswered" }, { key: "top", label: "Top" }]} />
        </>
      }
    >
      <QueryView query={q} loading={<ListSkeleton />}>
        {(d) => (
          <>
            <ThreadList threads={d.items} />
            <Pagination page={d.page} pageSize={d.pageSize} total={d.total} onPage={setPage} />
          </>
        )}
      </QueryView>
    </SectionCard>
  );
}
