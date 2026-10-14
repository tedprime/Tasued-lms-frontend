import { Link } from "react-router-dom";
import { BookOpen, Layers, Users } from "lucide-react";
import type { Course } from "@tasued/api-client";
import { Progress } from "@tasued/ui";

/** Cycled gradients from SLAN's Overview course grid (primary/tertiary palette). */
const GRADIENTS = [
  "linear-gradient(135deg, #0f1d36 0%, #3d5b87 100%)",
  "linear-gradient(135deg, #142647 0%, #2f7d46 100%)",
  "linear-gradient(135deg, #091222 0%, #a56808 100%)",
];

export function CourseCard({ course, index, progress, enrolled }: { course: Course; index: number; progress?: number; enrolled?: boolean }) {
  const c = course;
  return (
    <Link
      to={`/courses/${course.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-card transition-all hover:-translate-y-0.5 hover:shadow-hover focus-visible:ring-2 focus-visible:ring-primary-500"
    >
      <div className="relative flex h-24 items-center justify-between px-5" style={{ background: GRADIENTS[index % GRADIENTS.length] }}>
        {c.coverImageUrl && <img src={c.coverImageUrl} alt="" className="decorative-img absolute inset-0 size-full object-cover opacity-30" loading="lazy" />}
        <span className="relative font-headline text-xl font-extrabold tracking-tight text-white">{c.code}</span>
        <BookOpen className="relative size-7 text-white/80" aria-hidden />
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-headline text-[15px] leading-snug font-extrabold text-tertiary-500 group-hover:text-primary-500">{c.title}</h3>
        {courseFacts(c) && <p className="mt-1 text-xs text-neutral-500">{courseFacts(c)}</p>}
        <p className="mt-2 line-clamp-2 flex-1 text-[13px] text-neutral-500">{c.description}</p>
        <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-400">
          <span className="inline-flex items-center gap-1"><Layers className="size-3.5" /> {course.moduleCount} modules · {course.unitCount} units</span>
          <span className="inline-flex items-center gap-1"><Users className="size-3.5" /> {course.lecturers.map((l) => l.fullName).join(", ") || "TBA"}</span>
        </p>
        {progress !== undefined && (
          <div className="mt-4 flex items-center gap-2.5">
            <Progress value={progress} className="flex-1" label={`${c.code} progress`} />
            <span className={progress > 0 ? "rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-bold text-primary-600" : "rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-bold text-neutral-500"}>
              {progress}%
            </span>
          </div>
        )}
        {enrolled && progress === undefined && <span className="mt-4 text-[11px] font-bold tracking-wide text-primary-500 uppercase">Registered</span>}
      </div>
    </Link>
  );
}

/** "100 level · 2 credit units" — whichever of level / credit units the course has. */
export function courseFacts(c: Pick<Course, "level" | "creditUnits">) {
  return [c.level ? `${c.level} level` : null, c.creditUnits ? `${c.creditUnits} credit unit${c.creditUnits === 1 ? "" : "s"}` : null]
    .filter(Boolean)
    .join(" · ");
}
