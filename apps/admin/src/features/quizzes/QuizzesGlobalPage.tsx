import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@tasued/api-client";
import { PageHeader } from "../../components/ui";
import { ListSkeleton, QueryView, SectionCard } from "../../components/common";
import { CourseSelect } from "../../components/pickers";
import { QuizzesTable } from "./QuizzesTable";

export function QuizzesGlobalPage() {
  const [courseId, setCourseId] = useState("");
  const q = useQuery({ queryKey: ["quizzes", "list", { courseId: courseId || undefined }], queryFn: () => api.quizzes.list({ courseId: courseId || undefined }) });
  return (
    <div>
      <PageHeader title="Quizzes" description="Quizzes across your courses. Create quizzes and question banks from a course's Quizzes tab." />
      <SectionCard action={<div className="w-full sm:w-72"><CourseSelect allowAll value={courseId} onChange={setCourseId} /></div>}>
        <QueryView query={q} loading={<ListSkeleton />}>{(rows) => <QuizzesTable rows={rows} showCourse />}</QueryView>
      </SectionCard>
    </div>
  );
}
