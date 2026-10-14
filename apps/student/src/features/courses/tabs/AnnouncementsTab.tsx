import { AnnouncementList } from "../../announcements/AnnouncementList";
import { useCourseContext } from "../CourseLayout";

export default function AnnouncementsTab() {
  const { course } = useCourseContext();
  return <AnnouncementList courseId={course.id} />;
}
