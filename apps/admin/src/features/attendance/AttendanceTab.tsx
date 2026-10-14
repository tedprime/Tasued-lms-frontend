import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@tasued/api-client";
import { SegmentedControl } from "../../components/ui";
import { ListSkeleton, QueryView, SectionCard } from "../../components/common";
import { useCourseId } from "../../components/queries";
import { AttendanceList } from "./AttendanceList";

type F = "review" | "finalised" | "all";

export function AttendanceTab() {
  const courseId = useCourseId();
  const [f, setF] = useState<F>("review");
  const q = useQuery({ queryKey: ["classes", "list", { courseId }], queryFn: () => api.classes.list({ courseId }) });
  return (
    <SectionCard
      title="Attendance sheets"
      subtitle="Imported from each Teams meeting's attendance report, reviewed, then finalised."
      action={<SegmentedControl<F> value={f} onChange={setF} options={[{ key: "review", label: "Needs review" }, { key: "finalised", label: "Finalised" }, { key: "all", label: "All" }]} />}
    >
      <QueryView query={q} loading={<ListSkeleton />}>
        {(all) => {
          const held = all.filter((c) => c.status === "ended" || c.status === "live").sort((a, b) => b.startsAt.localeCompare(a.startsAt));
          const list = f === "all" ? held : f === "finalised" ? held.filter((c) => c.attendanceStatus === "finalised") : held.filter((c) => c.attendanceStatus !== "finalised");
          return <AttendanceList classes={list} emptyTitle={f === "review" ? "Nothing to review" : "No sheets"} />;
        }}
      </QueryView>
    </SectionCard>
  );
}
