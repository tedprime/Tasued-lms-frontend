import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { fmtDate, fmtTime, type AttendanceMark, type StudentAttendanceSummary } from "@tasued/api-client";
import { Badge, Card, ProgressRing, cn, type Tone } from "@tasued/ui";

export const markTone: Record<AttendanceMark, Tone> = { present: "green", late: "amber", absent: "red", excused: "blue" };
export const markLabel: Record<AttendanceMark, string> = { present: "Present", late: "Late", absent: "Absent", excused: "Excused" };

export function AttendanceCard({ s, defaultOpen, linkToCourse = true }: { s: StudentAttendanceSummary; defaultOpen?: boolean; linkToCourse?: boolean }) {
  const [open, setOpen] = useState(!!defaultOpen);
  const low = s.totalClasses > 0 && s.percent < 75;
  const records = [...s.records].sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-4 px-5 py-4">
        <ProgressRing value={s.percent} size={64} stroke={7} />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-primary-500">{s.courseCode}</p>
          <h3 className="font-headline text-base font-bold text-tertiary-500">
            {linkToCourse ? <Link to={`/courses/${s.courseId}/attendance`} className="hover:text-primary-500 hover:underline">{s.courseTitle}</Link> : s.courseTitle}
          </h3>
          <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-neutral-500">
            <span>{s.totalClasses} classes</span>
            <span className="text-success">{s.present} present</span>
            <span className="text-warning">{s.late} late</span>
            <span className="text-danger">{s.absent} absent</span>
            {s.excused > 0 && <span className="text-info">{s.excused} excused</span>}
          </p>
          {low && <p className="mt-1 text-xs font-semibold text-danger">Below 75% — talk to your lecturer if you've been unable to attend.</p>}
        </div>
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-primary-500 hover:bg-primary-50">
          {open ? "Hide" : "Show"} classes <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
        </button>
      </div>
      {open && (
        <ul className="divide-y divide-neutral-100 border-t border-neutral-100">
          {records.length === 0 && <li className="px-5 py-4 text-sm text-neutral-500">No attendance recorded yet.</li>}
          {records.map((r) => (
            <li key={r.classSessionId} className="flex items-center gap-3 px-5 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-tertiary-500">{r.title}</p>
                <p className="text-xs text-neutral-500">
                  {fmtDate(r.startsAt, { weekday: "short", day: "numeric", month: "short" })} · {fmtTime(r.startsAt)} · {r.minutesAttended} min attended
                </p>
              </div>
              <Badge tone={markTone[r.mark]}>{markLabel[r.mark]}</Badge>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
