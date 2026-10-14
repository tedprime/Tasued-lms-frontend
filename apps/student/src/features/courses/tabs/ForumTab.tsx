import { ThreadList } from "../../forum/ThreadList";
import { useCourseContext } from "../CourseLayout";

export default function ForumTab() {
  const { course } = useCourseContext();
  return <ThreadList courseId={course.id} newHref={`/forum/new?courseId=${course.id}`} />;
}
