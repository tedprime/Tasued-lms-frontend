import { useSearchParams } from "react-router-dom";
import { ChartColumn } from "lucide-react";
import { EmptyState, Field, PageHeader } from "../../components/ui";
import { SectionCard } from "../../components/common";
import { CourseSelect } from "../../components/pickers";
import { CourseReportPanel } from "./CourseReportPanel";

export function ReportsPage() {
  const [params, setParams] = useSearchParams();
  const courseId = params.get("course") ?? "";
  return (
    <div className="space-y-5">
      <PageHeader title="Reports" description="Attendance, recording engagement, submissions and students at risk, per course." />
      <Field label="Course" htmlFor="rep-course" className="max-w-xl">
        <CourseSelect id="rep-course" value={courseId} onChange={(v) => setParams(v ? { course: v } : {}, { replace: true })} />
      </Field>
      {courseId ? <CourseReportPanel key={courseId} courseId={courseId} /> : <SectionCard><EmptyState icon={<ChartColumn className="size-6" />} title="Choose a course to see its report" /></SectionCard>}
    </div>
  );
}
