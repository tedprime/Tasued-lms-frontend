import { BarChart3 } from "lucide-react";
import { Card, EmptyState } from "@tasued/ui";
import { useMyGrades } from "../../../app/queries";
import { Async, ListSkeleton } from "../../../components/Async";
import { GradeCard } from "../../grades/GradeCard";
import { useCourseContext } from "../CourseLayout";

export default function GradesTab() {
  const { course } = useCourseContext();
  const q = useMyGrades();
  return (
    <Async
      query={q}
      skeleton={<ListSkeleton rows={2} />}
      isEmpty={(d) => !d.some((r) => r.courseId === course.id)}
      empty={<Card><EmptyState icon={<BarChart3 className="size-6" />} title="No grades for this course" description="Grades appear here once they're released. You need to be registered for the course to receive grades." /></Card>}
    >
      {(rows) => <GradeCard row={rows.find((r) => r.courseId === course.id)!} linkToCourse={false} />}
    </Async>
  );
}
