import { Info } from "lucide-react";
import { ClassAgenda } from "../../classes/ClassAgenda";
import { TEAMS_SIGN_IN_HINT } from "../../../components/bits";
import { useCourseContext } from "../CourseLayout";

export default function ClassesTab() {
  const { course } = useCourseContext();
  return (
    <div className="space-y-3">
      <p className="flex items-start gap-1.5 text-xs text-neutral-500">
        <Info className="mt-0.5 size-3.5 shrink-0 text-primary-500" aria-hidden />
        {TEAMS_SIGN_IN_HINT}
      </p>
      <ClassAgenda courseId={course.id} />
    </div>
  );
}
