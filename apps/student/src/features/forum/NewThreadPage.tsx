import { useEffect, useId, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { api, errorMessage } from "@tasued/api-client";
import { Editor } from "../../components/Editor";
import { Alert, Button, Card, Checkbox, Field, Input, PageHeader, Select, Skeleton, useToast } from "@tasued/ui";
import { useModules, useMyCourses } from "../../app/queries";
import { Page } from "../../components/bits";
import { useForumCategories } from "./queries";

const plain = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").trim();

export default function NewThreadPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const cats = useForumCategories();
  const mine = useMyCourses();
  const ids = { title: useId(), cat: useId(), unit: useId() };

  const [categoryId, setCategoryId] = useState(params.get("categoryId") ?? "");
  const [unitId, setUnitId] = useState(params.get("unitId") ?? "");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [touched, setTouched] = useState(false);

  // Default category from ?courseId= (course forum) or the first campus category.
  useEffect(() => {
    if (categoryId || !cats.data?.length) return;
    const off = params.get("courseId");
    const match = (off && cats.data.find((c) => c.courseId === off)) || cats.data.find((c) => c.courseId === null) || cats.data[0];
    if (match) setCategoryId(match.id);
  }, [cats.data, categoryId, params]);

  const category = cats.data?.find((c) => c.id === categoryId);
  const modules = useModules(category?.courseId ?? undefined, !!category?.courseId);
  useEffect(() => {
    // Drop a unit that doesn't belong to the newly chosen course.
    if (!unitId || !modules.data) return;
    if (!modules.data.some((m) => m.units.some((u) => u.id === unitId))) setUnitId("");
  }, [modules.data, unitId]);

  const create = useMutation({
    mutationFn: () => api.forum.createThread({ categoryId, title: title.trim(), bodyHtml: body, unitId: unitId || undefined, isAnonymous: anonymous }),
    onSuccess: (t) => {
      void qc.invalidateQueries({ queryKey: ["forum"] });
      toast.success("Thread posted");
      navigate(`/forum/${t.id}`, { replace: true });
    },
    onError: (e) => toast.error("Couldn't post your thread", errorMessage(e)),
  });

  const titleErr = touched && !title.trim() ? "Add a title." : title.length > 150 ? "Keep the title under 150 characters." : undefined;
  const bodyErr = touched && !plain(body) ? "Write your question or message." : undefined;
  const catErr = touched && !categoryId ? "Choose where to post." : undefined;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!title.trim() || title.length > 150 || !plain(body) || !categoryId) return;
    create.mutate();
  };

  const codeOf = new Map(mine.data?.map((o) => [o.id, o.code]));
  const general = cats.data?.filter((c) => c.courseId === null) ?? [];
  const course = cats.data?.filter((c) => c.courseId !== null) ?? [];

  return (
    <Page narrow>
      <button type="button" onClick={() => navigate(-1)} className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-neutral-600 hover:text-primary-500">
        <ArrowLeft className="size-4" /> Back
      </button>
      <PageHeader title="Start a thread" description="Be specific — include what you've tried and where you're stuck." />
      <Card className="p-5 sm:p-6">
        <form onSubmit={submit} className="space-y-5" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Post in" htmlFor={ids.cat} required error={catErr}>
              {cats.isPending ? (
                <Skeleton className="h-10" />
              ) : (
                <Select id={ids.cat} value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setUnitId(""); }} invalid={!!catErr}>
                  <option value="">Choose a category…</option>
                  {general.length > 0 && <optgroup label="Campus">{general.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>}
                  {course.length > 0 && (
                    <optgroup label="Courses">
                      {course.map((c) => <option key={c.id} value={c.id}>{codeOf.get(c.courseId!) ? `${codeOf.get(c.courseId!)} — ` : ""}{c.name}</option>)}
                    </optgroup>
                  )}
                </Select>
              )}
            </Field>
            <Field label="Unit (optional)" htmlFor={ids.unit} hint={category?.courseId ? "Link your question to a unit." : "Choose a course category to link a unit."}>
              <Select id={ids.unit} value={unitId} onChange={(e) => setUnitId(e.target.value)} disabled={!category?.courseId || modules.isPending}>
                <option value="">No specific unit</option>
                {modules.data?.map((m) => (
                  <optgroup key={m.id} label={m.title}>
                    {m.units.map((u) => <option key={u.id} value={u.id}>{u.title}</option>)}
                  </optgroup>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="Title" htmlFor={ids.title} required error={titleErr} hint={`${title.length}/150`}>
            <Input id={ids.title} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} placeholder="e.g. How does backpropagation update the weights?" invalid={!!titleErr} />
          </Field>

          <div>
            <p className="mb-1.5 text-[13px] font-semibold text-tertiary-500">Message<span className="ml-0.5 text-danger">*</span></p>
            <Editor variant="simple" value="" onChange={setBody} placeholder="Write your question or message…" minHeight={180} />
            {bodyErr && <p className="mt-1.5 text-xs text-danger">{bodyErr}</p>}
          </div>

          <Checkbox checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} label="Post anonymously" description="Your name is hidden from other students. Lecturers and moderators can still see who posted." />

          {create.isError && <Alert tone="red">{errorMessage(create.error)}</Alert>}

          <div className="flex justify-end gap-2 border-t border-neutral-100 pt-5">
            <Button variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
            <Button type="submit" loading={create.isPending}>Post thread</Button>
          </div>
        </form>
      </Card>
    </Page>
  );
}
