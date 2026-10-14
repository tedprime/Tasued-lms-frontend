import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, ChevronLeft, ChevronRight } from "lucide-react";
import { api, fmtDate, type ClassSession, type ID } from "@tasued/api-client";
import { Card, EmptyState, IconButton, SegmentedControl, Select } from "@tasued/ui";
import { Async, ListSkeleton } from "../../components/Async";
import { ClassRow } from "../../components/bits";
import { useMyCourses } from "../../app/queries";

type Mode = "upcoming" | "week" | "past";

const DAY = 86_400_000;
const lagosDayKey = (iso: string | Date) => fmtDate(typeof iso === "string" ? iso : iso.toISOString(), { year: "numeric", month: "2-digit", day: "2-digit" });

function startOfWeek(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const dow = (x.getDay() + 6) % 7; // Monday = 0
  return new Date(x.getTime() - dow * DAY);
}

export function useClasses(courseId?: ID) {
  return useQuery({
    queryKey: ["classes", { courseId }],
    queryFn: () => api.classes.list({ courseId }),
    refetchInterval: 60_000,
  });
}

/** Agenda / week view of classes: upcoming (incl. live), a navigable week, or past with recording links. */
export function ClassAgenda({ courseId, showCourseFilter }: { courseId?: ID; showCourseFilter?: boolean }) {
  const [mode, setMode] = useState<Mode>("upcoming");
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [course, setCourse] = useState<string>("");
  const courses = useMyCourses();
  const q = useClasses(courseId);

  const filtered = useMemo(() => {
    const now = Date.now();
    let list = (q.data ?? []).filter((c) => !course || c.courseId === course);
    if (mode === "upcoming") list = list.filter((c) => c.status === "live" || (c.status !== "ended" && new Date(c.endsAt).getTime() >= now));
    else if (mode === "past") list = list.filter((c) => c.status === "ended" || (c.status !== "live" && new Date(c.endsAt).getTime() < now));
    else {
      const s = weekStart.getTime();
      list = list.filter((c) => {
        const t = new Date(c.startsAt).getTime();
        return t >= s && t < s + 7 * DAY;
      });
    }
    list.sort((a, b) => (mode === "past" ? b.startsAt.localeCompare(a.startsAt) : a.startsAt.localeCompare(b.startsAt)));
    return list;
  }, [q.data, course, mode, weekStart]);

  const groups = useMemo(() => {
    const m = new Map<string, ClassSession[]>();
    filtered.forEach((c) => {
      const k = lagosDayKey(c.startsAt);
      m.set(k, [...(m.get(k) ?? []), c]);
    });
    return [...m.entries()];
  }, [filtered]);

  const todayKey = lagosDayKey(new Date());

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SegmentedControl<Mode>
          value={mode}
          onChange={setMode}
          options={[
            { key: "upcoming", label: "Upcoming" },
            { key: "week", label: "Week" },
            { key: "past", label: "Past" },
          ]}
        />
        {mode === "week" && (
          <div className="flex items-center gap-1">
            <IconButton label="Previous week" onClick={() => setWeekStart((w) => new Date(w.getTime() - 7 * DAY))}><ChevronLeft className="size-4" /></IconButton>
            <span className="min-w-36 text-center text-sm font-semibold text-tertiary-500" aria-live="polite">
              {fmtDate(weekStart.toISOString(), { day: "numeric", month: "short" })} – {fmtDate(new Date(weekStart.getTime() + 6 * DAY).toISOString(), { day: "numeric", month: "short" })}
            </span>
            <IconButton label="Next week" onClick={() => setWeekStart((w) => new Date(w.getTime() + 7 * DAY))}><ChevronRight className="size-4" /></IconButton>
            <button type="button" className="ml-1 text-xs font-semibold text-primary-500 hover:underline" onClick={() => setWeekStart(startOfWeek(new Date()))}>This week</button>
          </div>
        )}
        {showCourseFilter && (
          <div className="w-full sm:ml-auto sm:w-56">
            <label htmlFor="class-course" className="sr-only">Filter by course</label>
            <Select id="class-course" value={course} onChange={(e) => setCourse(e.target.value)}>
              <option value="">All my courses</option>
              {courses.data?.map((o) => (
                <option key={o.id} value={o.id}>{o.code} — {o.title}</option>
              ))}
            </Select>
          </div>
        )}
      </div>

      <Async
        query={q}
        skeleton={<ListSkeleton rows={4} />}
        isEmpty={() => groups.length === 0}
        empty={
          <Card>
            <EmptyState
              icon={<CalendarClock className="size-6" />}
              title={mode === "past" ? "No past classes yet" : mode === "week" ? "No classes this week" : "No upcoming classes"}
              description="Classes are scheduled by your lecturers on Microsoft Teams and appear here automatically."
            />
          </Card>
        }
      >
        {() => (
          <div className="space-y-6">
            {groups.map(([key, items]) => (
              <section key={key} aria-label={fmtDate(items[0]!.startsAt, { weekday: "long", day: "numeric", month: "long" })}>
                <h3 className="mb-2 flex items-center gap-2 text-xs font-bold tracking-wide text-neutral-500 uppercase">
                  {fmtDate(items[0]!.startsAt, { weekday: "long", day: "numeric", month: "long" })}
                  {key === todayKey && <span className="rounded-full bg-secondary-100 px-2 py-0.5 text-[10px] text-secondary-800">Today</span>}
                </h3>
                <div className="space-y-2.5">
                  {items.map((c) => <ClassRow key={c.id} c={c} showCourse={!courseId} />)}
                </div>
              </section>
            ))}
          </div>
        )}
      </Async>
    </div>
  );
}
