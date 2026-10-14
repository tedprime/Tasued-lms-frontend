import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@tasued/api-client";
import { PageHeader } from "../../components/ui";
import { ListSkeleton, QueryView, SectionCard } from "../../components/common";
import { CourseSelect } from "../../components/pickers";
import { AttendanceList } from "./AttendanceList";

export function AttendanceGlobalPage() {
  const [courseId, setCourseId] = useState("");
  const q = useQuery({
    queryKey: ["classes", "list", { courseId, status: "ended" }],
    queryFn: () => api.classes.list({ courseId: courseId || undefined, status: "ended" }),
  });
  return (
    <div>
      <PageHeader title="Attendance" description="Sheets that still need review or finalising, across your courses." />
      <SectionCard title="Needs review" action={<div className="w-full sm:w-72"><CourseSelect allowAll value={courseId} onChange={setCourseId} /></div>}>
        <QueryView query={q} loading={<ListSkeleton />}>
          {(all) => <AttendanceList showCourse classes={all.filter((c) => c.attendanceStatus !== "finalised").sort((a, b) => b.startsAt.localeCompare(a.startsAt))} emptyTitle="All attendance is finalised" />}
        </QueryView>
      </SectionCard>
    </div>
  );
}
