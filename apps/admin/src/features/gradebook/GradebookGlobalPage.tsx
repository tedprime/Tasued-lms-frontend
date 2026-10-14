import { useSearchParams } from "react-router-dom";
import { Sheet } from "lucide-react";
import { EmptyState, Field, PageHeader } from "../../components/ui";
import { SectionCard } from "../../components/common";
import { CourseSelect } from "../../components/pickers";
import { Gradebook } from "./Gradebook";

export function GradebookGlobalPage() {
  const [params, setParams] = useSearchParams();
  const courseId = params.get("course") ?? "";
  return (
    <div className="space-y-5">
      <PageHeader title="Gradebook" description="Pick a course to view and edit its gradebook." />
      <Field label="Course" htmlFor="gb-course" className="max-w-xl">
        <CourseSelect id="gb-course" value={courseId} onChange={(v) => setParams(v ? { course: v } : {}, { replace: true })} />
      </Field>
      {courseId ? <Gradebook key={courseId} courseId={courseId} /> : <SectionCard><EmptyState icon={<Sheet className="size-6" />} title="Choose a course" /></SectionCard>}
    </div>
  );
}
