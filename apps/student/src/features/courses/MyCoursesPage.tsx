import { Link } from "react-router-dom";
import { useQueries } from "@tanstack/react-query";
import { BookOpen, Compass } from "lucide-react";
import { api } from "@tasued/api-client";
import { EmptyState, PageHeader, buttonClasses, Card } from "@tasued/ui";
import { completionPercent, useMyCourses } from "../../app/queries";
import { Async, CardGridSkeleton } from "../../components/Async";
import { Page } from "../../components/bits";
import { CourseCard } from "./CourseCard";

export default function MyCoursesPage() {
  const courses = useMyCourses();
  const progress = useQueries({
    queries: (courses.data ?? []).map((o) => ({
      queryKey: ["courses", o.id, "progress"],
      queryFn: () => api.courses.progress(o.id),
    })),
  });

  return (
    <Page>
      <PageHeader
        title="My courses"
        description="Courses you're registered for."
        actions={<Link to="/courses/browse" className={buttonClasses("outline", "sm")}><Compass className="size-4" /> Search my courses</Link>}
      />
      <Async
        query={courses}
        skeleton={<CardGridSkeleton />}
        isEmpty={(d) => d.length === 0}
        empty={
          <Card>
            <EmptyState
              icon={<BookOpen className="size-6" />}
              title="No registered courses yet"
              description="Your enrolled courses will appear here once published. Contact your course administrator if a course is missing."
              action={<Link to="/courses/browse" className={buttonClasses("primary", "sm")}>Browse courses</Link>}
            />
          </Card>
        }
      >
        {(list) => (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {list.map((o, i) => (
              <CourseCard key={o.id} course={o} index={i} progress={progress[i]?.data ? completionPercent(progress[i]!.data, o.unitCount) : progress[i]?.isPending ? undefined : 0} enrolled />
            ))}
          </div>
        )}
      </Async>
    </Page>
  );
}
