import { AssignmentList } from "../../assignments/AssignmentList";
import { useCourseContext } from "../CourseLayout";

export default function AssignmentsTab() {
  const { course } = useCourseContext();
  return <AssignmentList courseId={course.id} />;
}
