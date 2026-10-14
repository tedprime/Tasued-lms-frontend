import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { api } from "@tasued/api-client";
import { buttonClasses } from "../../components/ui";
import { ListSkeleton, QueryView, SectionCard } from "../../components/common";
import { useCourseId } from "../../components/queries";
import { useCan } from "../../app/session";
import { AssignmentsTable } from "./AssignmentsTable";

export function AssignmentsTab() {
  const courseId = useCourseId();
  const can = useCan();
  const q = useQuery({ queryKey: ["assignments", "list", { courseId }], queryFn: () => api.assignments.list({ courseId }) });
  return (
    <SectionCard
      title="Assignments"
      subtitle="Single, strictly final submissions. Once a student submits, the submission can't be changed or reopened."
      action={can("assignments.manage") && <Link to="new" className={buttonClasses("primary", "sm")}><Plus className="size-4" /> New assignment</Link>}
    >
      <QueryView query={q} loading={<ListSkeleton />}>{(rows) => <AssignmentsTable rows={rows} />}</QueryView>
    </SectionCard>
  );
}
