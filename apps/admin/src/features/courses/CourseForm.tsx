import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Archive, Trash2 } from "lucide-react";
import { api, errorMessage, isApiError, type Course, type CourseInput, type CourseStatus } from "@tasued/api-client";
import { Alert, Button, ConfirmDialog, Field, Input, Modal, Select, Textarea, useToast } from "../../components/ui";
import { hasErrors, useApiMutation, type Errors } from "../../components/mutation";
import { PeopleMultiPicker, type PersonLite } from "../../components/pickers";

export const COURSE_STATUS_TONE = { draft: "neutral", published: "green", archived: "amber" } as const;
export const COURSE_STATUS_LABEL: Record<CourseStatus, string> = { draft: "Draft", published: "Published", archived: "Archived" };

type F = { code: string; title: string; description: string; creditUnits: string; level: string; prefix: string; status: CourseStatus };
type ErrKey = "code" | "title" | "creditUnits" | "prefix" | "lecturers";

const toPrefix = (code: string) => code.replace(/\s+/g, "").toUpperCase().slice(0, 12);

/** New course (course = null) or Course settings (edit, archive, delete). */
export function CourseFormModal({ course, onClose }: { course: Course | null; onClose: () => void }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const [f, setF] = useState<F>({
    code: course?.code ?? "",
    title: course?.title ?? "",
    description: course?.description ?? "",
    creditUnits: course?.creditUnits != null ? String(course.creditUnits) : "",
    level: course?.level != null ? String(course.level) : "",
    prefix: course?.classCodePrefix ?? "",
    status: course?.status ?? "draft",
  });
  const [prefixTouched, setPrefixTouched] = useState(!!course);
  const [lecturers, setLecturers] = useState<PersonLite[]>(course?.lecturers ?? []);
  const [tas, setTas] = useState<PersonLite[]>(course?.assistants ?? []);
  const [errors, setErrors] = useState<Errors<ErrKey>>({});
  const [confirm, setConfirm] = useState<"archive" | "delete" | null>(null);
  const [inUse, setInUse] = useState<string | null>(null);

  const body = (): CourseInput => ({
    code: f.code.trim().replace(/\s+/g, " "),
    title: f.title.trim(),
    description: f.description.trim(),
    creditUnits: f.creditUnits === "" ? undefined : Number(f.creditUnits),
    level: f.level === "" ? undefined : Number(f.level),
    classCodePrefix: f.prefix.trim(),
    lecturerIds: lecturers.map((l) => l.id),
    assistantIds: tas.map((t) => t.id),
    status: f.status,
  });

  const save = useApiMutation({
    mutationFn: () => (course ? api.courses.update(course.id, body()) : api.courses.create(body())),
    success: course ? "Course updated" : "Course created",
    errorTitle: course ? "Couldn't save the course" : "Couldn't create the course",
    invalidate: [["courses"], ["auth", "session"], ["dashboards"]],
    onSuccess: (c) => {
      onClose();
      if (!course) navigate(`/courses/${c.id}/content`);
    },
  });

  const archive = useApiMutation({
    mutationFn: () => api.courses.update(course!.id, { status: "archived" }),
    success: "Course archived — students no longer see it",
    invalidate: [["courses"]],
    onSuccess: () => {
      setConfirm(null);
      onClose();
    },
  });

  const remove = useMutation({
    mutationFn: () => api.courses.delete(course!.id),
    onSuccess: async () => {
      setConfirm(null);
      onClose();
      qc.removeQueries({ queryKey: ["courses", "get", course!.id] });
      await Promise.all([qc.invalidateQueries({ queryKey: ["courses"] }), qc.invalidateQueries({ queryKey: ["auth", "session"] })]);
      toast.success("Course deleted");
      navigate("/courses");
    },
    onError: (e) => {
      setConfirm(null);
      if (isApiError(e) && (e.code === "COURSE_IN_USE" || e.status === 409)) {
        setInUse(`${course!.code} already has students, classes or graded work, so it can't be deleted. Archive it instead — it disappears for students and its records are kept.`);
      } else toast.error("Couldn't delete the course", errorMessage(e));
    },
  });

  const submit = () => {
    const units = f.creditUnits === "" ? 0 : Number(f.creditUnits);
    const e: Errors<ErrKey> = {
      code: /^[A-Z]{2,5}\s?\d{3}[A-Z]?$/i.test(f.code.trim()) ? undefined : "Use a course code like AIIE 111",
      title: f.title.trim() ? undefined : "Title is required",
      creditUnits: Number.isInteger(units) && units >= 0 && units <= 12 ? undefined : "0–12",
      prefix: /^[A-Z0-9]{3,12}$/.test(f.prefix.trim()) ? undefined : "3–12 letters/digits, no spaces (e.g. AIIE111)",
      lecturers: lecturers.length ? undefined : "Add at least one lecturer",
    };
    setErrors(e);
    if (!hasErrors(e)) save.mutate(undefined);
  };

  const set = (k: keyof F) => (e: { target: { value: string } }) => setF((cur) => ({ ...cur, [k]: e.target.value }));

  return (
    <>
      <Modal
        open
        size="lg"
        onClose={onClose}
        title={course ? "Course settings" : "New course"}
        description={course ? `${course.code} — ${course.title}` : "A course holds its modules and units, lecturers, teaching assistants and enrolled students."}
        footer={
          <>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={submit} loading={save.isPending}>{course ? "Save changes" : "Create course"}</Button>
          </>
        }
      >
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Course code" required error={errors.code} htmlFor="c-code">
              <Input
                id="c-code"
                value={f.code}
                placeholder="AIIE 111"
                invalid={!!errors.code}
                onChange={(e) => {
                  const code = e.target.value.toUpperCase();
                  setF((cur) => ({ ...cur, code, prefix: prefixTouched ? cur.prefix : toPrefix(code) }));
                }}
              />
            </Field>
            <Field label="Status" htmlFor="c-status" hint="Students only see published courses.">
              <Select id="c-status" value={f.status} onChange={(e) => setF((cur) => ({ ...cur, status: e.target.value as CourseStatus }))}>
                {(Object.keys(COURSE_STATUS_LABEL) as CourseStatus[]).map((s) => <option key={s} value={s}>{COURSE_STATUS_LABEL[s]}</option>)}
              </Select>
            </Field>
            <Field className="sm:col-span-2" label="Title" required error={errors.title} htmlFor="c-title">
              <Input id="c-title" value={f.title} onChange={set("title")} invalid={!!errors.title} placeholder="Foundation of Artificial Intelligence and Digital Productivity" />
            </Field>
            <Field className="sm:col-span-2" label="Description" htmlFor="c-desc">
              <Textarea id="c-desc" value={f.description} onChange={set("description")} rows={3} />
            </Field>
            <Field label="Credit units" error={errors.creditUnits} htmlFor="c-units">
              <Input id="c-units" type="number" min={0} max={12} value={f.creditUnits} onChange={set("creditUnits")} invalid={!!errors.creditUnits} />
            </Field>
            <Field label="Level" htmlFor="c-level">
              <Select id="c-level" value={f.level} onChange={set("level")}>
                <option value="">Not set</option>
                {[100, 200, 300, 400, 500].map((l) => <option key={l} value={l}>{l} level</option>)}
              </Select>
            </Field>
            <Field
              className="sm:col-span-2"
              label="Teams class code prefix"
              required
              error={errors.prefix}
              htmlFor="c-prefix"
              hint={course ? "Changing this only affects classes scheduled from now on." : `Teams meetings are titled with a unique class code, e.g. ${f.prefix || "AIIE111"}-S01.`}
            >
              <Input
                id="c-prefix"
                value={f.prefix}
                invalid={!!errors.prefix}
                onChange={(e) => {
                  setPrefixTouched(true);
                  setF((cur) => ({ ...cur, prefix: e.target.value.toUpperCase().replace(/\s+/g, "") }));
                }}
              />
            </Field>
          </div>
          <Field label="Lecturers" required error={errors.lecturers}>
            <PeopleMultiPicker label="Lecturers" role="lecturer" value={lecturers} onChange={setLecturers} />
          </Field>
          <Field label="Teaching assistants">
            <PeopleMultiPicker label="Teaching assistants" role="teaching_assistant" value={tas} onChange={setTas} />
          </Field>

          {course && (
            <div className="space-y-3 rounded-xl border border-danger/30 p-4">
              <p className="text-sm font-semibold text-tertiary-500">Archive or delete</p>
              {inUse && <Alert tone="amber" title="This course is in use">{inUse}</Alert>}
              <div className="flex flex-wrap gap-2">
                {course.status !== "archived" && (
                  <Button size="sm" variant="outline" icon={<Archive className="size-4" />} onClick={() => setConfirm("archive")}>Archive course</Button>
                )}
                <Button size="sm" variant="danger" icon={<Trash2 className="size-4" />} onClick={() => setConfirm("delete")}>Delete course</Button>
              </div>
              <p className="text-xs text-neutral-500">Only courses with no students, classes or graded work can be deleted. Archiving hides a course from students and keeps its records.</p>
            </div>
          )}
        </div>
      </Modal>
      {course && (
        <ConfirmDialog
          open={!!confirm}
          onClose={() => setConfirm(null)}
          onConfirm={() => (confirm === "archive" ? archive.mutate(undefined) : remove.mutate())}
          loading={archive.isPending || remove.isPending}
          tone={confirm === "delete" ? "danger" : "primary"}
          title={confirm === "delete" ? `Delete ${course.code}?` : `Archive ${course.code}?`}
          description={
            confirm === "delete"
              ? "This permanently removes the course and its modules and units. It can't be undone."
              : "Students will no longer see this course. Staff keep access to its content and records, and you can publish it again later."
          }
          confirmLabel={confirm === "delete" ? "Delete course" : "Archive course"}
        />
      )}
    </>
  );
}
