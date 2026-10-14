import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, ChevronDown, Circle, Clock, Layers, PlayCircle } from "lucide-react";
import { Card, CardBody, CardHeader, EmptyState, Progress, ProgressRing, buttonClasses, cn } from "@tasued/ui";
import { completionPercent, flattenUnits, progressMap, useModules, useCourseProgress } from "../../../app/queries";
import { Async, ListSkeleton } from "../../../components/Async";
import { useCourseContext } from "../CourseLayout";

export default function OverviewTab() {
  const { course } = useCourseContext();
  const modules = useModules(course.id);
  const progress = useCourseProgress(course.id);
  const pm = progressMap(progress.data);
  const units = flattenUnits(modules.data);
  const pct = completionPercent(progress.data, units.length || course.unitCount);
  const next = units.find((u) => !pm.get(u.id)?.completed) ?? units[0];
  const started = (progress.data?.length ?? 0) > 0;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="min-w-0 space-y-6 lg:col-span-2">
        <Card>
          <CardHeader title="About this course" />
          <CardBody>
            <p className="text-sm leading-relaxed whitespace-pre-line text-neutral-700">{course.description || "No description yet."}</p>
          </CardBody>
        </Card>

        <section aria-labelledby="outline-h">
          <h2 id="outline-h" className="mb-3 font-headline text-lg font-extrabold text-tertiary-500">Course outline</h2>
          <Async
            query={modules}
            skeleton={<ListSkeleton rows={3} />}
            isEmpty={(d) => d.length === 0}
            empty={<Card><EmptyState icon={<Layers className="size-6" />} title="No modules published yet" description="Your lecturer hasn't published course content yet." /></Card>}
          >
            {(mods) => (
              <div className="space-y-3">
                {mods.map((m, i) => (
                  <ModuleOutline key={m.id} index={i} courseId={course.id} mod={m} pm={pm} defaultOpen={i === 0 || m.units.some((u) => u.id === next?.id)} />
                ))}
              </div>
            )}
          </Async>
        </section>
      </div>

      <aside className="space-y-4">
        <Card className="p-5">
          <div className="flex items-center gap-4">
            <ProgressRing value={pct} size={72} stroke={7} />
            <div>
              <p className="font-headline text-base font-extrabold text-tertiary-500">Your progress</p>
              <p className="text-xs text-neutral-500">
                {progress.data?.filter((p) => p.completed).length ?? 0} of {units.length || course.unitCount} units complete
              </p>
            </div>
          </div>
          {next && (
            <Link to={`/courses/${course.id}/units/${next.id}`} className={buttonClasses("primary", "md", "mt-5 w-full")}>
              {started ? "Continue" : "Start"}: {next.title.length > 28 ? next.title.slice(0, 28) + "…" : next.title} <ArrowRight className="size-4" />
            </Link>
          )}
        </Card>
      </aside>
    </div>
  );
}

function ModuleOutline({
  mod,
  index,
  courseId,
  pm,
  defaultOpen,
}: {
  mod: { id: string; title: string; summary?: string; units: { id: string; title: string; hasRecording: boolean; recordingCount: number; estimatedReadMinutes: number }[] };
  index: number;
  courseId: string;
  pm: ReturnType<typeof progressMap>;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const done = mod.units.filter((u) => pm.get(u.id)?.completed).length;
  const pct = mod.units.length ? Math.round((done / mod.units.length) * 100) : 0;
  return (
    <Card className="overflow-hidden">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-neutral-50">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 font-headline text-sm font-extrabold text-primary-500">{index + 1}</span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-tertiary-500">{mod.title}</span>
          <span className="mt-1 flex items-center gap-2">
            <Progress value={pct} className="h-1.5 max-w-40" label={`${mod.title} progress`} />
            <span className="text-xs text-neutral-500">{done}/{mod.units.length} units</span>
          </span>
        </span>
        <ChevronDown className={cn("size-4 shrink-0 text-neutral-400 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="border-t border-neutral-100">
          {mod.summary && <p className="px-5 pt-3 text-sm text-neutral-500">{mod.summary}</p>}
          <ul className="py-2">
            {mod.units.map((u) => {
              const p = pm.get(u.id);
              return (
                <li key={u.id}>
                  <Link to={`/courses/${courseId}/units/${u.id}`} className="flex items-center gap-3 px-5 py-2.5 hover:bg-primary-50/40">
                    {p?.completed ? <CheckCircle2 className="size-4.5 shrink-0 text-success" aria-label="Completed" /> : <Circle className="size-4.5 shrink-0 text-neutral-300" aria-label="Not completed" />}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-tertiary-500">{u.title}</span>
                      <span className="flex flex-wrap items-center gap-x-3 text-xs text-neutral-500">
                        {u.hasRecording && <span className="inline-flex items-center gap-1"><PlayCircle className="size-3" /> {u.recordingCount} recording{u.recordingCount === 1 ? "" : "s"}</span>}
                        <span className="inline-flex items-center gap-1"><Clock className="size-3" /> {u.estimatedReadMinutes} min read</span>
                        {p && !p.completed && p.readPercent > 0 && <span>{Math.round(p.readPercent)}% read</span>}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
            {mod.units.length === 0 && <li className="px-5 py-2 text-sm text-neutral-400">No units yet.</li>}
          </ul>
        </div>
      )}
    </Card>
  );
}
