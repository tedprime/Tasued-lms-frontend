import { SaveCourse } from '../../pwa/DeviceSettings';
import { NavLink, Outlet, useOutletContext, useParams } from "react-router-dom";
import type { Course } from "@tasued/api-client";
import { Avatar, Card, Skeleton, cn } from "@tasued/ui";
import { useCourse } from "../../app/queries";
import { Async } from "../../components/Async";
import { Breadcrumbs, Page } from "../../components/bits";
import { courseFacts } from "./CourseCard";

const TABS = [
  { to: "", label: "Overview", end: true },
  { to: "classes", label: "Classes" },
  { to: "recordings", label: "Recordings" },
  { to: "assignments", label: "Assignments" },
  { to: "quizzes", label: "Quizzes" },
  { to: "forum", label: "Forum" },
  { to: "grades", label: "Grades" },
  { to: "attendance", label: "Attendance" },
  { to: "announcements", label: "Announcements" },
];

export function useCourseContext() {
  return useOutletContext<{ course: Course; enrolled: boolean }>();
}

export default function CourseLayout() {
  const { courseId } = useParams();
  const q = useCourse(courseId);
  // A successful student course response already requires active enrolment.
  const enrolled = true;

  return (
    <Page>
      <Async
        query={q}
        skeleton={
          <div className="space-y-4" aria-busy="true">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-10" />
          </div>
        }
      >
        {(o) => (
          <>
            <Breadcrumbs items={[{ label: "My courses", to: "/courses" }, { label: o.code }]} />
            <Card className="mt-3 overflow-hidden">
              <div className="relative bg-[linear-gradient(135deg,#091222_0%,#142647_55%,#192f59_100%)] px-5 py-6 text-white sm:px-7">
                <div aria-hidden className="absolute -top-10 -right-10 size-40 rounded-full border border-white/10" />
                <div className="relative flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-white/10 px-2 py-0.5 font-headline text-sm font-extrabold text-secondary-300">{o.code}</span>
                </div>
                <h1 className="relative mt-2 font-headline text-2xl font-extrabold tracking-tight sm:text-[28px]">{o.title}</h1>
                {courseFacts(o) && <p className="relative mt-1 text-sm text-white/75">{courseFacts(o)}</p>}
              </div>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4 sm:px-7">
                {o.lecturers.length > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="flex -space-x-2">
                      {o.lecturers.slice(0, 3).map((l) => <Avatar key={l.id} name={l.fullName} src={l.avatarUrl} size={28} className="ring-2 ring-white" />)}
                    </div>
                    <div className="text-xs">
                      <p className="font-semibold text-tertiary-500">{o.lecturers.map((l) => l.fullName).join(", ")}</p>
                      <p className="text-neutral-500">Lecturer{o.lecturers.length > 1 ? "s" : ""}</p>
                    </div>
                  </div>
                )}
                {o.assistants.length > 0 && (
                  <div className="text-xs">
                    <p className="font-semibold text-tertiary-500">{o.assistants.map((l) => l.fullName).join(", ")}</p>
                    <p className="text-neutral-500">Teaching assistant{o.assistants.length > 1 ? "s" : ""}</p>
                  </div>
                )}
                <p className="text-xs text-neutral-500">{o.moduleCount} modules · {o.unitCount} units · {o.enrolledCount} students</p>
              </div>
            </Card>
            <SaveCourse courseId={o.id} />

            <nav aria-label="Course sections" className="sticky top-16 z-20 -mx-4 mt-5 overflow-x-auto overflow-y-hidden bg-neutral/95 px-4 shadow-[inset_0_-1px_0_var(--color-neutral-200)] backdrop-blur sm:mx-0 sm:px-0">
              <ul className="flex gap-1">
                {TABS.map((t) => (
                  <li key={t.label}>
                    <NavLink
                      to={t.to}
                      end={t.end}
                      className={({ isActive }) =>
                        cn(
                          "inline-flex border-b-2 px-3.5 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors",
                          isActive ? "border-primary-500 text-primary-500" : "border-transparent text-neutral-500 hover:text-tertiary-500",
                        )
                      }
                    >
                      {t.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="pt-6">
              <Outlet context={{ course: o, enrolled }} />
            </div>
          </>
        )}
      </Async>
    </Page>
  );
}
