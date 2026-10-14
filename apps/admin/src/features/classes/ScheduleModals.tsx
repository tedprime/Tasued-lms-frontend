import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Info } from "lucide-react";
import { api, type Course } from "@tasued/api-client";
import { Alert, Button, Field, Input, Modal, Select, Switch, cn } from "../../components/ui";
import { hasErrors, useApiMutation, type Errors } from "../../components/mutation";
import { UnitCoveragePicker } from "../../components/pickers";
import { fromLagosInput, lagosWeekday } from "../../components/time";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function TeamsNote({ prefix }: { prefix: string }) {
  // Settings may be admin-only; the organiser email is a nice-to-have here.
  const settings = useQuery({ queryKey: ["settings"], queryFn: () => api.settings.get(), retry: false, staleTime: 10 * 60_000 });
  const organiser = settings.data?.organiserAccountEmail;
  return (
    <Alert tone="blue" icon={<Info className="size-4" />}>
      The Teams meeting is created under the meeting organiser account{organiser ? <> (<span className="font-semibold">{organiser}</span>)</> : null}, with the class code (e.g. <span className="font-mono font-bold">{prefix}-S07</span>) in its title and <strong>automatic recording on</strong>, so every recording lands in one OneDrive. After class the recording is linked from there and published under the units you pick below — nothing is copied. Students join as guests of our organisation, signed in with the email they were invited with.
    </Alert>
  );
}

type Common = { title: string; lecturerId: string; autoRecord: boolean; unitIds: string[] };

function CommonFields({ course, f, setF, errors }: { course: Course; f: Common; setF: (f: Common) => void; errors: Errors<"title" | "lecturerId" | "unitIds"> }) {
  return (
    <>
      <Field label="Title" required error={errors.title} htmlFor="cls-title" hint="Shown to students and in the Teams meeting title after the class code.">
        <Input id="cls-title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} invalid={!!errors.title} placeholder={`${course.code} lecture`} />
      </Field>
      <Field label="Lecturer" required error={errors.lecturerId} htmlFor="cls-lect" hint="Invited to the meeting and shown to students as the lecturer.">
        <Select id="cls-lect" value={f.lecturerId} onChange={(e) => setF({ ...f, lecturerId: e.target.value })} invalid={!!errors.lecturerId}>
          <option value="">Choose…</option>
          {course.lecturers.map((l) => <option key={l.id} value={l.id}>{l.fullName}</option>)}
        </Select>
      </Field>
      <Switch checked={f.autoRecord} onChange={(v) => setF({ ...f, autoRecord: v })} label="Record automatically" description="Strongly recommended — students rely on recordings." />
      <Field label="Units this class covers" required error={errors.unitIds} hint="The recording will publish under these units.">
        <UnitCoveragePicker courseId={course.id} value={f.unitIds} onChange={(unitIds) => setF({ ...f, unitIds })} invalid={!!errors.unitIds} />
      </Field>
    </>
  );
}

export function ScheduleClassModal({ course, onClose }: { course: Course; onClose: () => void }) {
  const [f, setF] = useState<Common>({ title: "", lecturerId: course.lecturers[0]?.id ?? "", autoRecord: true, unitIds: [] });
  const [start, setStart] = useState("");
  const [duration, setDuration] = useState(120);
  const [errors, setErrors] = useState<Errors<"title" | "lecturerId" | "unitIds" | "start" | "duration">>({});
  const save = useApiMutation({
    mutationFn: () => {
      const s = fromLagosInput(start);
      return api.classes.create({ courseId: course.id, title: f.title.trim(), startsAt: s, endsAt: new Date(new Date(s).getTime() + duration * 60000).toISOString(), unitIds: f.unitIds, lecturerId: f.lecturerId, autoRecord: f.autoRecord });
    },
    success: (c) => `Class ${c.classCode} scheduled in Teams`,
    errorTitle: "Couldn't schedule the class",
    invalidate: [["classes"], ["dashboards"]],
    onSuccess: onClose,
  });
  const submit = () => {
    const e = {
      title: f.title.trim() ? undefined : "Title is required",
      lecturerId: f.lecturerId ? undefined : "Choose the lecturer",
      unitIds: f.unitIds.length ? undefined : "Pick at least one unit",
      start: !start ? "Choose the start time" : new Date(fromLagosInput(start)) < new Date() ? "Must be in the future" : undefined,
      duration: duration >= 15 && duration <= 480 ? undefined : "15–480 minutes",
    };
    setErrors(e);
    if (!hasErrors(e)) save.mutate(undefined);
  };
  return (
    <Modal open size="lg" onClose={onClose} title="Schedule a class" description={`${course.code} · one Teams meeting`} footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={submit} loading={save.isPending}>Schedule in Teams</Button></>}>
      <div className="space-y-4">
        <TeamsNote prefix={course.classCodePrefix} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Starts (Lagos time)" required error={errors.start} htmlFor="cls-start"><Input id="cls-start" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} invalid={!!errors.start} /></Field>
          <Field label="Duration (minutes)" required error={errors.duration} htmlFor="cls-dur"><Input id="cls-dur" type="number" min={15} max={480} step={5} value={duration} onChange={(e) => setDuration(Number(e.target.value))} invalid={!!errors.duration} /></Field>
        </div>
        <CommonFields course={course} f={f} setF={setF} errors={errors} />
      </div>
    </Modal>
  );
}

export function ScheduleSeriesModal({ course, onClose }: { course: Course; onClose: () => void }) {
  const [f, setF] = useState<Common>({ title: "", lecturerId: course.lecturers[0]?.id ?? "", autoRecord: true, unitIds: [] });
  const [first, setFirst] = useState("");
  const [duration, setDuration] = useState(120);
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [occurrences, setOccurrences] = useState(13);
  const [errors, setErrors] = useState<Errors<"title" | "lecturerId" | "unitIds" | "first" | "duration" | "weekdays" | "occurrences">>({});

  const save = useApiMutation({
    mutationFn: () => api.classes.createSeries({ courseId: course.id, title: f.title.trim(), firstStartsAt: fromLagosInput(first), durationMinutes: duration, weekdays: [...weekdays].sort(), occurrences, unitIds: f.unitIds, lecturerId: f.lecturerId, autoRecord: f.autoRecord }),
    success: (list) => `${list.length} classes scheduled in Teams`,
    errorTitle: "Couldn't schedule the series",
    invalidate: [["classes"], ["dashboards"]],
    onSuccess: onClose,
  });
  const submit = () => {
    const firstDay = first ? lagosWeekday(fromLagosInput(first)) : -1;
    const e = {
      title: f.title.trim() ? undefined : "Title is required",
      lecturerId: f.lecturerId ? undefined : "Choose the lecturer",
      unitIds: f.unitIds.length ? undefined : "Pick at least one unit",
      first: !first ? "Choose the first class" : new Date(fromLagosInput(first)) < new Date() ? "Must be in the future" : !weekdays.includes(firstDay) ? `The first class is on a ${WEEKDAYS[firstDay]}; tick that day too` : undefined,
      duration: duration >= 15 && duration <= 480 ? undefined : "15–480 minutes",
      weekdays: weekdays.length ? undefined : "Pick at least one weekday",
      occurrences: occurrences >= 1 && occurrences <= 60 ? undefined : "1–60",
    };
    setErrors(e);
    if (!hasErrors(e)) save.mutate(undefined);
  };
  return (
    <Modal open size="lg" onClose={onClose} title="Schedule a weekly series" description={`${course.code} · recurring Teams meetings`} footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={submit} loading={save.isPending}>Schedule {occurrences} classes</Button></>}>
      <div className="space-y-4">
        <TeamsNote prefix={course.classCodePrefix} />
        <fieldset>
          <legend className="mb-1.5 text-[13px] font-semibold text-tertiary-500">Repeats on <span className="text-danger">*</span></legend>
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAYS.map((d, i) => {
              const on = weekdays.includes(i);
              return (
                <label key={d} className={cn("cursor-pointer rounded-lg border px-3 py-2 text-sm font-semibold transition-colors", on ? "border-primary-500 bg-primary-500 text-white" : "border-neutral-300 bg-white text-tertiary-500 hover:border-primary-300")}>
                  <input type="checkbox" className="sr-only" checked={on} onChange={() => setWeekdays(on ? weekdays.filter((x) => x !== i) : [...weekdays, i])} />
                  {d}
                </label>
              );
            })}
          </div>
          {errors.weekdays && <p className="mt-1 text-xs text-danger">{errors.weekdays}</p>}
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field className="sm:col-span-1" label="First class (Lagos time)" required error={errors.first} htmlFor="ser-first"><Input id="ser-first" type="datetime-local" value={first} onChange={(e) => setFirst(e.target.value)} invalid={!!errors.first} /></Field>
          <Field label="Duration (min)" required error={errors.duration} htmlFor="ser-dur"><Input id="ser-dur" type="number" min={15} max={480} step={5} value={duration} onChange={(e) => setDuration(Number(e.target.value))} invalid={!!errors.duration} /></Field>
          <Field label="Occurrences" required error={errors.occurrences} htmlFor="ser-occ" hint="e.g. 13 for a 13-week course."><Input id="ser-occ" type="number" min={1} max={60} value={occurrences} onChange={(e) => setOccurrences(Number(e.target.value))} invalid={!!errors.occurrences} /></Field>
        </div>
        <CommonFields course={course} f={f} setF={setF} errors={errors} />
      </div>
    </Modal>
  );
}
