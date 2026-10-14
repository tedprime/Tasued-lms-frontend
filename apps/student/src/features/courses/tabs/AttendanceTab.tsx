import { UserCheck } from "lucide-react";
import { Card, EmptyState } from "@tasued/ui";
import { useMyAttendance } from "../../../app/queries";
import { Async, ListSkeleton } from "../../../components/Async";
import { AttendanceCard } from "../../attendance/AttendanceCard";
import { useCourseContext } from "../CourseLayout";

export default function AttendanceTab() {
  const { course } = useCourseContext();
  const q = useMyAttendance();
  return (
    <Async
      query={q}
      skeleton={<ListSkeleton rows={2} />}
      isEmpty={(d) => !d.some((s) => s.courseId === course.id)}
      empty={<Card><EmptyState icon={<UserCheck className="size-6" />} title="No attendance for this course" description="Attendance is recorded for registered students after each Teams class." /></Card>}
    >
      {(list) => <AttendanceCard s={list.find((s) => s.courseId === course.id)!} defaultOpen linkToCourse={false} />}
    </Async>
  );
}
