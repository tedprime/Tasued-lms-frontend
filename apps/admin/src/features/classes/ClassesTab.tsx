import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, CalendarPlus, ChevronLeft, ChevronRight, Repeat } from "lucide-react";
import { api, fmtDate, fmtTime, type ClassSession } from "@tasued/api-client";
import { Button, EmptyState, IconButton, SegmentedControl, cn } from "../../components/ui";
import { ListSkeleton, QueryView, SectionCard } from "../../components/common";
import { useCourseId } from "../../components/queries";
import { lagosDayRange, lagosWeekday } from "../../components/time";
import { useCan } from "../../app/session";
import { useCourseContext } from "../courses/CourseLayout";
import { ClassList } from "./ClassList";
import { ScheduleClassModal, ScheduleSeriesModal } from "./ScheduleModals";

type View = "upcoming" | "past" | "week";

export function ClassesTab() {
  const courseId = useCourseId();
  const { course } = useCourseContext();
  const can = useCan();
  const [view, setView] = useState<View>("upcoming");
  const [modal, setModal] = useState<"single" | "series" | null>(null);
  const q = useQuery({ queryKey: ["classes", "list", { courseId }], queryFn: () => api.classes.list({ courseId }) });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl<View> value={view} onChange={setView} options={[{ key: "upcoming", label: "Upcoming" }, { key: "past", label: "Past" }, { key: "week", label: "Week view" }]} />
        {can("classes.schedule") && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" icon={<CalendarPlus className="size-4" />} onClick={() => setModal("single")}>Schedule class</Button>
            <Button icon={<Repeat className="size-4" />} onClick={() => setModal("series")}>Schedule series</Button>
          </div>
        )}
      </div>
      <QueryView query={q} loading={<SectionCard><ListSkeleton /></SectionCard>}>
        {(all) => (view === "week" ? <WeekView classes={all} /> : <ListView classes={all} past={view === "past"} canSchedule={can("classes.schedule")} onSchedule={() => setModal("series")} />)}
      </QueryView>
      {modal === "single" && <ScheduleClassModal course={course} onClose={() => setModal(null)} />}
      {modal === "series" && <ScheduleSeriesModal course={course} onClose={() => setModal(null)} />}
    </div>
  );
}

function ListView({ classes, past, canSchedule, onSchedule }: { classes: ClassSession[]; past: boolean; canSchedule: boolean; onSchedule: () => void }) {
  const now = Date.now();
  const list = classes.filter((c) => (past ? new Date(c.endsAt).getTime() < now : new Date(c.endsAt).getTime() >= now));
  if (past) list.reverse();
  if (!list.length)
    return (
      <SectionCard>
        <EmptyState icon={<CalendarClock className="size-6" />} title={past ? "No past classes" : "No upcoming classes"} description={past ? undefined : "Schedule a weekly series for the course — each class gets a Teams meeting with recording on."} action={!past && canSchedule && <Button size="sm" onClick={onSchedule}>Schedule series</Button>} />
      </SectionCard>
    );
  return <SectionCard><ClassList classes={list} /></SectionCard>;
}

function WeekView({ classes }: { classes: ClassSession[] }) {
  const [offset, setOffset] = useState(0);
  const todayDow = lagosWeekday(new Date().toISOString());
  const mondayOffset = (todayDow + 6) % 7;
  const { from, to } = lagosDayRange(offset * 7 - mondayOffset, 7);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => new Date(new Date(from).getTime() + i * 864e5).toISOString()), [from]);
  const inWeek = classes.filter((c) => c.startsAt >= from && c.startsAt < to);
  return (
    <SectionCard
      title={`${fmtDate(from, { day: "numeric", month: "short" })} – ${fmtDate(new Date(new Date(to).getTime() - 1).toISOString(), { day: "numeric", month: "short", year: "numeric" })}`}
      action={
        <div className="flex items-center gap-1">
          <IconButton label="Previous week" onClick={() => setOffset((o) => o - 1)}><ChevronLeft className="size-4" /></IconButton>
          <Button size="xs" variant="outline" onClick={() => setOffset(0)}>This week</Button>
          <IconButton label="Next week" onClick={() => setOffset((o) => o + 1)}><ChevronRight className="size-4" /></IconButton>
        </div>
      }
    >
      <div className="overflow-x-auto">
        <div className="grid min-w-[760px] grid-cols-7 divide-x divide-neutral-100">
          {days.map((d, i) => {
            const dayClasses = inWeek.filter((c) => c.startsAt >= d && c.startsAt < (days[i + 1] ?? to)).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
            const isToday = offset === 0 && i === mondayOffset;
            return (
              <div key={d} className="min-h-[220px]">
                <p className={cn("border-b border-neutral-100 px-2 py-2 text-center text-xs font-bold", isToday ? "bg-primary-50 text-primary-600" : "text-neutral-500")}>
                  {fmtDate(d, { weekday: "short", day: "numeric" })}
                </p>
                <ul className="space-y-1.5 p-1.5">
                  {dayClasses.map((c) => (
                    <li key={c.id}>
                      <Link to={`../classes/${c.id}/attendance`} className={cn("block rounded-lg border px-2 py-1.5 text-[11px] hover:shadow-card", c.status === "cancelled" ? "border-neutral-200 bg-neutral-50 text-neutral-400 line-through" : c.status === "live" ? "border-danger bg-danger-50" : "border-primary-100 bg-primary-50/60")}>
                        <span className="block font-bold text-tertiary-500">{fmtTime(c.startsAt)}</span>
                        <span className="block font-mono text-primary-600">{c.classCode}</span>
                        <span className="line-clamp-2 block text-neutral-600">{c.title}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </SectionCard>
  );
}
