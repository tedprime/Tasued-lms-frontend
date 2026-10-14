import { BarChart3 } from "lucide-react";
import { Card, EmptyState, PageHeader } from "@tasued/ui";
import { useMyGrades } from "../../app/queries";
import { Async, ListSkeleton } from "../../components/Async";
import { Page } from "../../components/bits";
import { GradeCard } from "./GradeCard";

export default function GradesPage() {
  const q = useMyGrades();
  return (
    <Page narrow>
      <PageHeader title="Grades" description="Released grades for each course, with a weighted running total." />
      <Async
        query={q}
        skeleton={<ListSkeleton rows={3} />}
        isEmpty={(d) => d.length === 0}
        empty={<Card><EmptyState icon={<BarChart3 className="size-6" />} title="No grades yet" description="Grades appear here once your lecturers release them." /></Card>}
      >
        {(rows) => <div className="space-y-5">{rows.map((r) => <GradeCard key={r.courseId} row={r} />)}</div>}
      </Async>
    </Page>
  );
}
