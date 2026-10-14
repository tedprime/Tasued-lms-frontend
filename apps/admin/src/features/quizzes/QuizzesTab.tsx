import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Library, Plus } from "lucide-react";
import { api } from "@tasued/api-client";
import { buttonClasses } from "../../components/ui";
import { ListSkeleton, QueryView, SectionCard } from "../../components/common";
import { useCourseId } from "../../components/queries";
import { useCan } from "../../app/session";
import { QuizzesTable } from "./QuizzesTable";

export function QuizzesTab() {
  const courseId = useCourseId();
  const can = useCan();
  const q = useQuery({ queryKey: ["quizzes", "list", { courseId }], queryFn: () => api.quizzes.list({ courseId }) });
  return (
    <SectionCard
      title="Quizzes"
      subtitle="Timed quizzes drawn at random from question banks. Separate from assignments."
      action={
        can("quizzes.manage") && (
          <>
            <Link to="../question-banks" className={buttonClasses("outline", "sm")}><Library className="size-4" /> Question banks</Link>
            <Link to="new" className={buttonClasses("primary", "sm")}><Plus className="size-4" /> New quiz</Link>
          </>
        )
      }
    >
      <QueryView query={q} loading={<ListSkeleton />}>{(rows) => <QuizzesTable rows={rows} />}</QueryView>
    </SectionCard>
  );
}
