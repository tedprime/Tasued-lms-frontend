import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@tasued/api-client";
import { PageHeader } from "../../components/ui";
import { ListSkeleton, QueryView, SectionCard } from "../../components/common";
import { CourseSelect } from "../../components/pickers";
import { AssignmentsTable } from "./AssignmentsTable";

export function AssignmentsGlobalPage() {
  const [courseId, setCourseId] = useState("");
  const q = useQuery({ queryKey: ["assignments", "list", { courseId: courseId || undefined }], queryFn: () => api.assignments.list({ courseId: courseId || undefined }) });
  return (
    <div>
      <PageHeader title="Assignments" description="Assignments across your courses. Create new ones from a course's Assignments tab." />
      <SectionCard action={<div className="w-full sm:w-72"><CourseSelect allowAll value={courseId} onChange={setCourseId} /></div>}>
        <QueryView query={q} loading={<ListSkeleton />}>{(rows) => <AssignmentsTable rows={rows} showCourse />}</QueryView>
      </SectionCard>
    </div>
  );
}
