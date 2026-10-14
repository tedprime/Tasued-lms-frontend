import { useCourseId } from "../../components/queries";
import { Gradebook } from "./Gradebook";

export function GradebookTab() {
  return <Gradebook courseId={useCourseId()} />;
}
