import { useEffect, useState } from "react";
import { Link, matchPath, useLocation } from "react-router-dom";
import { BookOpen, CheckCircle2, ChevronDown, ChevronRight, Circle, PlayCircle } from "lucide-react";
import { cn, Skeleton } from "@tasued/ui";
import type { Course } from "@tasued/api-client";
import { useModules, useMyCourses, useCourseProgress, progressMap } from "../app/queries";

/** SLAN's collapsible sidebar course tree: course → modules → units, with completion ticks. */
export function CourseTree({ onNavigate }: { onNavigate?: () => void }) {
  const courses = useMyCourses();
  const { pathname } = useLocation();
  const m = matchPath("/courses/:courseId/*", pathname);
  const activeCourse = m?.params.courseId && m.params.courseId !== "browse" ? m.params.courseId : undefined;

  if (courses.isPending)
    return (
      <div className="space-y-2 px-5 py-2" aria-busy="true" aria-label="Loading courses">
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-4 w-3/5" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    );
  if (courses.isError)
    return (
      <p className="px-5 py-2 text-xs text-danger">
        Couldn't load courses.{" "}
        <button type="button" className="font-semibold text-primary-500 underline" onClick={() => void courses.refetch()}>
          Retry
        </button>
      </p>
    );
  if (!courses.data.length) return <p className="px-5 py-2 text-xs text-neutral-400">No registered courses yet.</p>;

  return (
    <ul className="space-y-0.5">
      {courses.data.map((o) => (
        <CourseNode key={o.id} course={o} active={o.id === activeCourse} onNavigate={onNavigate} />
      ))}
    </ul>
  );
}

function CourseNode({ course, active, onNavigate }: { course: Course; active: boolean; onNavigate?: () => void }) {
  const [open, setOpen] = useState(active);
  useEffect(() => {
    if (active) setOpen(true);
  }, [active]);
  const modules = useModules(course.id, open);
  const progress = useCourseProgress(course.id, open);
  const pm = progressMap(progress.data);
  const { pathname } = useLocation();
  const unitMatch = matchPath("/courses/:courseId/units/:unitId", pathname);
  const activeUnit = unitMatch?.params.unitId;

  return (
    <li>
      <div className={cn("mx-2 flex items-center rounded-lg", active ? "bg-primary-500/8" : "hover:bg-neutral-100")}>
        <Link
          to={`/courses/${course.id}`}
          onClick={onNavigate}
          className={cn("flex min-w-0 flex-1 items-center gap-2.5 py-2 pl-3 text-[13px]", active ? "font-semibold text-primary-500" : "font-medium text-neutral-600")}
          title={`${course.code} — ${course.title}`}
        >
          <BookOpen className={cn("size-4 shrink-0", active ? "text-primary-500" : "text-neutral-400")} aria-hidden />
          <span className="truncate">
            <span className="font-bold">{course.code}</span> <span className="text-neutral-500">{course.title}</span>
          </span>
        </Link>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={`${open ? "Collapse" : "Expand"} ${course.code} modules`}
          className="flex size-8 shrink-0 items-center justify-center rounded-md text-neutral-400 hover:text-primary-500"
        >
          {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        </button>
      </div>
      {open && (
        <div className="pb-1">
          {modules.isPending ? (
            <div className="space-y-1.5 py-1 pr-4 pl-10"><Skeleton className="h-3 w-4/5" /><Skeleton className="h-3 w-3/5" /></div>
          ) : modules.isError ? (
            <p className="py-1 pl-10 text-[11px] text-danger">Couldn't load modules.</p>
          ) : modules.data.length === 0 ? (
            <p className="py-1 pl-10 text-[11px] text-neutral-400">No modules yet.</p>
          ) : (
            <ul>
              {modules.data.map((mod) => (
                <ModuleNode key={mod.id} mod={mod} courseId={course.id} activeUnit={activeUnit} done={(id) => !!pm.get(id)?.completed} onNavigate={onNavigate} />
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}

function ModuleNode({
  mod,
  courseId,
  activeUnit,
  done,
  onNavigate,
}: {
  mod: { id: string; title: string; units: { id: string; title: string; hasRecording: boolean }[] };
  courseId: string;
  activeUnit?: string;
  done: (unitId: string) => boolean;
  onNavigate?: () => void;
}) {
  const containsActive = mod.units.some((u) => u.id === activeUnit);
  const [open, setOpen] = useState(containsActive);
  useEffect(() => {
    if (containsActive) setOpen(true);
  }, [containsActive]);
  const complete = mod.units.length > 0 && mod.units.every((u) => done(u.id));

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn("mx-2 flex w-[calc(100%-16px)] items-center gap-2 rounded-md py-1.5 pr-2 pl-9 text-left text-xs", containsActive ? "font-semibold text-primary-500" : "text-neutral-500 hover:bg-neutral-100")}
      >
        <span className="min-w-0 flex-1 truncate">{mod.title}</span>
        {complete && <CheckCircle2 className="size-3 shrink-0 text-success" aria-label="Module complete" />}
        {open ? <ChevronDown className="size-3 shrink-0 text-neutral-400" /> : <ChevronRight className="size-3 shrink-0 text-neutral-400" />}
      </button>
      {open && (
        <ul>
          {mod.units.length === 0 && <li className="py-1 pl-14 text-[11px] text-neutral-400">No units yet.</li>}
          {mod.units.map((u) => {
            const isActive = u.id === activeUnit;
            const isDone = done(u.id);
            return (
              <li key={u.id}>
                <Link
                  to={`/courses/${courseId}/units/${u.id}`}
                  onClick={onNavigate}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "mx-2 flex items-center gap-2 rounded-md py-1.5 pr-2 pl-12 text-xs",
                    isActive ? "bg-primary-500/8 font-semibold text-primary-500" : "text-neutral-500 hover:bg-neutral-100 hover:text-tertiary-500",
                  )}
                >
                  {isDone ? (
                    <CheckCircle2 className="size-3.5 shrink-0 text-success" aria-label="Completed" />
                  ) : (
                    <Circle className="size-3.5 shrink-0 text-neutral-300" aria-label="Not completed" />
                  )}
                  <span className="min-w-0 flex-1 truncate">{u.title}</span>
                  {u.hasRecording && <PlayCircle className="size-3 shrink-0 text-neutral-400" aria-label="Has recording" />}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}
