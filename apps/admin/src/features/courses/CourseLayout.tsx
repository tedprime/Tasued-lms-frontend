import { useState } from "react";
import { Link, NavLink, Outlet, useOutletContext } from "react-router-dom";
import { ChevronRight, Settings2 } from "lucide-react";
import { errorMessage, type Course, type Permission } from "@tasued/api-client";
import { Badge, Button, ErrorState, PageLoader, Skeleton, cn } from "../../components/ui";
import { useCan, useCanStaffCourse, useTeaches } from "../../app/session";
import { useCourse, useCourseId } from "../../components/queries";
import { COURSE_STATUS_LABEL, COURSE_STATUS_TONE, CourseFormModal } from "./CourseForm";
import { NoAccess } from "../../app/session";

/** `teaching` tabs are only for the course's own lecturer and teaching assistants. */
const TABS: { to: string; label: string; perm?: Permission[]; teaching?: boolean }[] = [
  { to: "content", label: "Content" },
  { to: "classes", label: "Classes", perm: ["classes.schedule", "attendance.manage"], teaching: true },
  { to: "recordings", label: "Recordings", perm: ["recordings.manage"], teaching: true },
  { to: "attendance", label: "Attendance", perm: ["attendance.manage"], teaching: true },
  { to: "assignments", label: "Assignments", perm: ["assignments.manage", "assignments.grade"], teaching: true },
  { to: "quizzes", label: "Quizzes", perm: ["quizzes.manage", "quizzes.grade"], teaching: true },
  { to: "gradebook", label: "Gradebook", perm: ["assignments.grade", "quizzes.grade", "grades.release"], teaching: true },
  { to: "students", label: "Students" },
  { to: "forum", label: "Forum", perm: ["forum.moderate"], teaching: true },
  { to: "announcements", label: "Announcements", perm: ["announcements.send"], teaching: true },
  { to: "report", label: "Report", perm: ["reports.view"] },
];

export function useCourseContext() {
  return useOutletContext<{ course: Course }>();
}

export function CourseLayout() {
  const id = useCourseId();
  const q = useCourse(id);
  const can = useCan();
  const canStaff = useCanStaffCourse();
  const teaches = useTeaches();
  const [editing, setEditing] = useState(false);

  if (q.isPending)
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-10 w-2/3" />
        <PageLoader />
      </div>
    );
  if (q.isError) return <ErrorState title="Couldn't load this course" description={errorMessage(q.error)} onRetry={() => q.refetch()} />;
  const o = q.data;
  if (!canStaff(o.id)) return <NoAccess what="work on this course" />;

  return (
    <div>
      <nav aria-label="Breadcrumb" className="mb-2 flex items-center gap-1 text-xs text-neutral-500">
        <Link to="/courses" className="hover:text-primary-500">Courses</Link>
        <ChevronRight className="size-3" />
        <span className="text-tertiary-500">{o.code}</span>
      </nav>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-headline text-2xl font-extrabold text-tertiary-500 sm:text-[26px]">
            <span className="text-primary-500">{o.code}</span> {o.title}
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-neutral-500">
            <Badge tone={COURSE_STATUS_TONE[o.status]}>{COURSE_STATUS_LABEL[o.status]}</Badge>
            {(o.creditUnits != null || o.level != null) && (
              <>
                <span>{[o.creditUnits != null && `${o.creditUnits} credit units`, o.level != null && `${o.level} level`].filter(Boolean).join(" · ")}</span>
                <span aria-hidden>·</span>
              </>
            )}
            <span>{o.enrolledCount} students</span>
            <span aria-hidden>·</span>
            <span>{o.moduleCount} modules · {o.unitCount} units</span>
            <span aria-hidden>·</span>
            <span>Class code prefix <span className="font-mono font-bold text-tertiary-500">{o.classCodePrefix}</span></span>
          </div>
          <p className="mt-1 text-xs text-neutral-500">
            Lecturers: {o.lecturers.map((l) => l.fullName).join(", ") || "—"}
            {o.assistants.length > 0 && <> · TAs: {o.assistants.map((l) => l.fullName).join(", ")}</>}
          </p>
        </div>
        {can("courses.manage") && <Button variant="outline" size="sm" icon={<Settings2 className="size-4" />} onClick={() => setEditing(true)}>Course settings</Button>}
      </div>

      <nav aria-label="Course sections" className="-mx-3 mb-5 overflow-x-auto overflow-y-hidden px-3 shadow-[inset_0_-1px_0_var(--color-neutral-200)] sm:mx-0 sm:px-0">
        <ul className="flex gap-1">
          {TABS.filter((t) => (!t.perm || can(t.perm)) && (!t.teaching || teaches(o.id))).map((t) => (
            <li key={t.to}>
              <NavLink
                to={t.to}
                className={({ isActive }) =>
                  cn("relative inline-flex border-b-2 px-3 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors", isActive ? "border-primary-500 text-primary-500" : "border-transparent text-neutral-500 hover:text-tertiary-500")
                }
              >
                {t.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <Outlet context={{ course: o }} />
      {editing && <CourseFormModal course={o} onClose={() => setEditing(false)} />}
    </div>
  );
}

