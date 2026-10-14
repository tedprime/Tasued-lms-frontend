import { useState } from "react";
import { PageHeader, Select } from "@tasued/ui";
import { useMyCourses } from "../../app/queries";
import { Page } from "../../components/bits";
import { AnnouncementList } from "./AnnouncementList";

export default function AnnouncementsPage() {
  const courses = useMyCourses();
  const [course, setCourse] = useState("");
  return (
    <Page narrow>
      <PageHeader
        title="Announcements"
        description="News from your lecturers and the university."
        actions={
          <div className="w-full sm:w-56">
            <label htmlFor="ann-course" className="sr-only">Filter by course</label>
            <Select id="ann-course" value={course} onChange={(e) => setCourse(e.target.value)}>
              <option value="">All announcements</option>
              {courses.data?.map((o) => <option key={o.id} value={o.id}>{o.code} — {o.title}</option>)}
            </Select>
          </div>
        }
      />
      <AnnouncementList key={course} courseId={course || undefined} />
    </Page>
  );
}
