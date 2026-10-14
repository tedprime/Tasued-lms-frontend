import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { PlayCircle, Video } from "lucide-react";
import { api, fmtDate, fmtDuration, type Recording } from "@tasued/api-client";
import { Card, EmptyState } from "@tasued/ui";
import { flattenUnits, useModules } from "../../../app/queries";
import { Async, ListSkeleton } from "../../../components/Async";
import { useCourseContext } from "../CourseLayout";

export default function RecordingsTab() {
  const { course } = useCourseContext();
  const modules = useModules(course.id);
  const recs = useQuery({
    queryKey: ["recordings", { courseId: course.id, status: "ready" }],
    queryFn: () => api.recordings.list({ courseId: course.id, status: "ready" }),
  });

  return (
    <Async
      query={recs}
      skeleton={<ListSkeleton rows={4} />}
      isEmpty={(d) => d.filter((r) => r.published !== false).length === 0}
      empty={<Card><EmptyState icon={<Video className="size-6" />} title="No recordings yet" description="Class recordings appear here shortly after Teams saves them." /></Card>}
    >
      {(all) => {
        const list = all.filter((r) => r.status === "ready" && r.published !== false);
        const units = flattenUnits(modules.data);
        const groups = units
          .map((u) => ({ unit: u, items: list.filter((r) => r.unitIds.includes(u.id)).sort((a, b) => a.recordedAt.localeCompare(b.recordedAt)) }))
          .filter((g) => g.items.length > 0);
        const orphan = list.filter((r) => !r.unitIds.some((id) => units.some((u) => u.id === id)));
        return (
          <div className="space-y-6">
            {groups.map((g) => (
              <section key={g.unit.id} aria-label={g.unit.title}>
                <p className="text-[11px] font-bold tracking-wide text-neutral-400 uppercase">{g.unit.moduleTitle}</p>
                <h3 className="mb-2 font-headline text-base font-bold text-tertiary-500">
                  <Link to={`/courses/${course.id}/units/${g.unit.id}`} className="hover:text-primary-500 hover:underline">{g.unit.title}</Link>
                </h3>
                <ul className="grid gap-3 sm:grid-cols-2">
                  {g.items.map((r) => <RecordingItem key={r.id} r={r} to={`/courses/${course.id}/units/${g.unit.id}?recording=${r.id}`} />)}
                </ul>
              </section>
            ))}
            {orphan.length > 0 && (
              <section aria-label="Other recordings">
                <h3 className="mb-2 font-headline text-base font-bold text-tertiary-500">Other recordings</h3>
                <ul className="grid gap-3 sm:grid-cols-2">
                  {orphan.map((r) => <RecordingItem key={r.id} r={r} to={r.unitIds[0] ? `/courses/${course.id}/units/${r.unitIds[0]}?recording=${r.id}` : undefined} />)}
                </ul>
              </section>
            )}
          </div>
        );
      }}
    </Async>
  );
}

function RecordingItem({ r, to }: { r: Recording; to?: string }) {
  const body = (
    <>
      <span className="relative flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-tertiary-500 text-white">
        {r.posterUrl && <img src={r.posterUrl} alt="" loading="lazy" className="decorative-img absolute inset-0 size-full object-cover opacity-70" />}
        <PlayCircle className="relative size-7" aria-hidden />
        <span className="absolute right-1 bottom-1 rounded bg-black/70 px-1 text-[10px] font-semibold">{fmtDuration(r.durationSeconds)}</span>
      </span>
      <span className="min-w-0">
        <span className="line-clamp-2 block text-sm font-semibold text-tertiary-500">{r.title}</span>
        <span className="block text-xs text-neutral-500">{fmtDate(r.recordedAt, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</span>
        {r.chapters.length > 0 && <span className="block text-xs text-neutral-400">{r.chapters.length} chapters</span>}
      </span>
    </>
  );
  return (
    <li>
      {to ? (
        <Link to={to} className="flex gap-3 rounded-xl border border-neutral-200 bg-white p-3 transition-colors hover:border-primary-300">{body}</Link>
      ) : (
        <div className="flex gap-3 rounded-xl border border-neutral-200 bg-white p-3">{body}</div>
      )}
    </li>
  );
}
