import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock } from "lucide-react";
import { api } from "@tasued/api-client";
import { EmptyState, PageHeader, SegmentedControl } from "../../components/ui";
import { ListSkeleton, QueryView, SectionCard } from "../../components/common";
import { CourseSelect } from "../../components/pickers";
import { lagosDayRange } from "../../components/time";
import { ClassList } from "./ClassList";

type Range = "today" | "week" | "upcoming";

export function ClassesGlobalPage() {
  const [range, setRange] = useState<Range>("today");
  const [courseId, setCourseId] = useState("");
  const r = range === "today" ? lagosDayRange(0, 1) : range === "week" ? lagosDayRange(0, 7) : { from: new Date().toISOString(), to: lagosDayRange(0, 60).to };
  const q = useQuery({
    queryKey: ["classes", "list", { courseId, range, from: r.from.slice(0, 13) }],
    queryFn: () => api.classes.list({ courseId: courseId || undefined, from: r.from, to: r.to }),
  });

  return (
    <div>
      <PageHeader title="Classes" description="Teams classes across all courses you can manage. Schedule new classes from a course's Classes tab." />
      <SectionCard
        action={
          <div className="flex w-full flex-wrap items-center gap-2">
            <SegmentedControl<Range> value={range} onChange={setRange} options={[{ key: "today", label: "Today" }, { key: "week", label: "Next 7 days" }, { key: "upcoming", label: "Upcoming" }]} />
            <div className="w-full sm:w-72"><CourseSelect allowAll value={courseId} onChange={setCourseId} /></div>
          </div>
        }
      >
        <QueryView query={q} loading={<ListSkeleton />}>
          {(rows) => (rows.length ? <ClassList classes={rows} showCourse /> : <EmptyState icon={<CalendarClock className="size-6" />} title="No classes in this range" />)}
        </QueryView>
      </SectionCard>
    </div>
  );
}
