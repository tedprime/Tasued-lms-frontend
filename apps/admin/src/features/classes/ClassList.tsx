import { useState } from "react";
import { Link } from "react-router-dom";
import { CalendarClock, ExternalLink, MoreHorizontal, Pencil, XCircle } from "lucide-react";
import { api, fmtDate, fmtTime, type ClassSession } from "@tasued/api-client";
import { Button, ConfirmDialog, Field, IconButton, Input, Menu, Modal, Textarea, buttonClasses } from "../../components/ui";
import { AttendanceStatusBadge, ClassStatusBadge, CopyButton, RecordingStatusBadge } from "../../components/common";
import { hasErrors, useApiMutation } from "../../components/mutation";
import { fromLagosInput, toLagosInput } from "../../components/time";
import { UnitCoveragePicker } from "../../components/pickers";
import { useCan } from "../../app/session";

/** Class rows grouped by Lagos date. Used by the course Classes tab and the global /classes page. */
export function ClassList({ classes, showCourse }: { classes: ClassSession[]; showCourse?: boolean }) {
  const can = useCan();
  const [resched, setResched] = useState<ClassSession | null>(null);
  const [cancel, setCancel] = useState<ClassSession | null>(null);
  const groups = new Map<string, ClassSession[]>();
  [...classes].sort((a, b) => a.startsAt.localeCompare(b.startsAt)).forEach((c) => {
    const k = fmtDate(c.startsAt, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    groups.set(k, [...(groups.get(k) ?? []), c]);
  });

  return (
    <>
      {[...groups.entries()].map(([day, list]) => (
        <section key={day} aria-label={day}>
          <h3 className="border-b border-neutral-100 bg-neutral-50 px-5 py-2 text-xs font-bold tracking-wide text-neutral-500 uppercase">{day}</h3>
          <ul className="divide-y divide-neutral-100">
            {list.map((c) => (
              <li key={c.id} className="grid gap-3 px-5 py-4 md:grid-cols-[110px_minmax(0,1fr)_auto] md:items-center">
                <div className="text-sm">
                  <p className="font-headline font-extrabold text-tertiary-500">{fmtTime(c.startsAt)}</p>
                  <p className="text-xs text-neutral-500">to {fmtTime(c.endsAt)}</p>
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded bg-primary-50 px-1.5 py-0.5 font-mono text-xs font-bold text-primary-600">{c.classCode}</span>
                    <CopyButton value={c.classCode} label="Copy code" />
                    <ClassStatusBadge status={c.status} />
                    <RecordingStatusBadge status={c.recordingStatus} />
                    <Link to={`/courses/${c.courseId}/classes/${c.id}/attendance`} className="rounded-full focus-visible:ring-2 focus-visible:ring-primary-500" aria-label={`Attendance: ${c.attendanceStatus.replace(/_/g, " ")}`}>
                      <AttendanceStatusBadge status={c.attendanceStatus} />
                    </Link>
                  </div>
                  <p className="mt-1 truncate text-sm font-semibold text-tertiary-500">{showCourse && <Link to={`/courses/${c.courseId}/classes`} className="text-primary-500 hover:underline">{c.courseCode}</Link>}{showCourse && " · "}{c.title}</p>
                  <p className="truncate text-xs text-neutral-500">
                    {c.lecturerName}{c.autoRecord ? " · auto-record on" : " · not recorded"}
                    {c.unitTitles.length > 0 && <> · Covers: {c.unitTitles.join(", ")}</>}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 md:justify-end">
                  {c.status !== "cancelled" && (
                    <>
                      <CopyButton value={c.teamsJoinUrl} label="Copy Teams link" />
                      {c.status !== "ended" && <a href={c.teamsJoinUrl} target="_blank" rel="noreferrer" className={buttonClasses(c.status === "live" ? "primary" : "outline", "xs")}>Join <ExternalLink className="size-3.5" /></a>}
                    </>
                  )}
                  {can("classes.schedule") && c.status === "scheduled" && (
                    <Menu
                      trigger={<IconButton label={`Actions for ${c.classCode}`}><MoreHorizontal className="size-4" /></IconButton>}
                      items={[
                        { label: "Reschedule / edit units", icon: <Pencil className="size-4" />, onClick: () => setResched(c) },
                        { label: "Cancel class", icon: <XCircle className="size-4" />, danger: true, onClick: () => setCancel(c) },
                      ]}
                    />
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {resched && <RescheduleModal session={resched} onClose={() => setResched(null)} />}
      {cancel && <CancelDialog session={cancel} onClose={() => setCancel(null)} />}
    </>
  );
}

function RescheduleModal({ session, onClose }: { session: ClassSession; onClose: () => void }) {
  const [start, setStart] = useState(toLagosInput(session.startsAt));
  const initialMinutes = Math.round((new Date(session.endsAt).getTime() - new Date(session.startsAt).getTime()) / 60000);
  const [minutes, setMinutes] = useState(initialMinutes);
  const [unitIds, setUnitIds] = useState(session.unitIds);
  const [errors, setErrors] = useState<{ start?: string; minutes?: string; units?: string }>({});
  const save = useApiMutation({
    mutationFn: () => {
      const s = fromLagosInput(start);
      return api.classes.update(session.id, { startsAt: s, endsAt: new Date(new Date(s).getTime() + minutes * 60000).toISOString(), unitIds });
    },
    success: "Class rescheduled — the Teams meeting and students' calendars are updated",
    invalidate: [["classes"], ["dashboards"]],
    onSuccess: onClose,
  });
  const submit = () => {
    const e = { start: start ? (new Date(fromLagosInput(start)) < new Date() ? "Choose a time in the future" : undefined) : "Required", minutes: minutes >= 15 && minutes <= 480 ? undefined : "15–480 minutes", units: unitIds.length ? undefined : "Pick at least one unit" };
    setErrors(e);
    if (!hasErrors(e)) save.mutate(undefined);
  };
  return (
    <Modal open size="lg" onClose={onClose} title={`Edit ${session.classCode}`} description={session.title} footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={submit} loading={save.isPending} icon={<CalendarClock className="size-4" />}>Reschedule</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="New start (Lagos time)" required error={errors.start} htmlFor="rs-start"><Input id="rs-start" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} invalid={!!errors.start} /></Field>
        <Field label="Duration (minutes)" required error={errors.minutes} htmlFor="rs-min"><Input id="rs-min" type="number" min={15} max={480} step={5} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} invalid={!!errors.minutes} /></Field>
        <Field className="sm:col-span-2" label="Units this class covers" required error={errors.units} hint="The recording publishes under these units.">
          <UnitCoveragePicker courseId={session.courseId} value={unitIds} onChange={setUnitIds} invalid={!!errors.units} />
        </Field>
      </div>
    </Modal>
  );
}

function CancelDialog({ session, onClose }: { session: ClassSession; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string>();
  const cancel = useApiMutation({
    mutationFn: () => api.classes.cancel(session.id, reason.trim()),
    success: "Class cancelled — students have been notified",
    invalidate: [["classes"], ["dashboards"]],
    onSuccess: onClose,
  });
  return (
    <ConfirmDialog
      open
      onClose={onClose}
      tone="danger"
      title={`Cancel ${session.classCode}?`}
      description={`${session.title} on ${fmtDate(session.startsAt)} at ${fmtTime(session.startsAt)}. The Teams meeting is cancelled and enrolled students are notified.`}
      confirmLabel="Cancel class"
      loading={cancel.isPending}
      onConfirm={() => {
        if (!reason.trim()) return setError("Give a reason — students will see it");
        cancel.mutate(undefined);
      }}
    >
      <Field className="mt-4" label="Reason" required error={error} htmlFor="cancel-reason">
        <Textarea id="cancel-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} invalid={!!error} placeholder="e.g. Lecturer attending senate meeting; class moves to Friday." />
      </Field>
    </ConfirmDialog>
  );
}
