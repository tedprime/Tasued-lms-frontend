import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, CheckCircle2, Clock, Info, MessagesSquare, PlayCircle, Plus } from "lucide-react";
import { api, errorMessage, type UnitProgress } from "@tasued/api-client";
import { Alert, Badge, Button, Card, CardHeader, buttonClasses, useToast } from "@tasued/ui";
import { flattenUnits, progressMap, useModules, useCourse, useCourseProgress } from "../../app/queries";
import { Async, ListSkeleton, PageSkeleton } from "../../components/Async";
import { Breadcrumbs, Page } from "../../components/bits";
import { ThreadItem } from "../forum/ThreadItem";
import { CourseText } from "./CourseText";
import { RecordingStatusCard, RecordingSection } from "./RecordingSection";

export default function UnitPage() {
  const { courseId, unitId } = useParams();
  const unit = useQuery({ queryKey: ["content", "unit", unitId], queryFn: () => api.content.unit(unitId!), enabled: !!unitId });
  const course = useCourse(courseId);
  const modules = useModules(courseId);
  const progress = useCourseProgress(courseId);
  const qc = useQueryClient();
  const toast = useToast();

  const units = flattenUnits(modules.data);
  const idx = units.findIndex((u) => u.id === unitId);
  const prev = idx > 0 ? units[idx - 1] : undefined;
  const next = idx >= 0 && idx < units.length - 1 ? units[idx + 1] : undefined;
  const mod = modules.data?.find((m) => m.units.some((u) => u.id === unitId));
  const my = progressMap(progress.data).get(unitId!);

  const complete = useMutation({
    mutationFn: () => api.content.saveProgress(unitId!, { completed: true }),
    onSuccess: (p) => {
      qc.setQueryData<UnitProgress[]>(["courses", courseId, "progress"], (list) => [...(list ?? []).filter((x) => x.unitId !== p.unitId), p]);
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Unit marked as complete");
    },
    onError: (e) => toast.error("Couldn't update progress", errorMessage(e)),
  });

  return (
    <Page>
      <Async query={unit} skeleton={<PageSkeleton />}>
        {(u) => {
          const ready = u.recordings.filter((r) => r.status === "ready");
          const pending = u.recordings.filter((r) => r.status === "pending").length;
          const failed = u.recordings.filter((r) => r.status === "failed").length;
          const hasVideo = ready.length > 0;
          return (
            <div className="space-y-6">
              <div>
                <Breadcrumbs
                  items={[
                    { label: course.data?.code ?? "Course", to: `/courses/${courseId}` },
                    ...(mod ? [{ label: mod.title, to: `/courses/${courseId}` }] : []),
                    { label: u.title },
                  ]}
                />
                <div className="mt-3 flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1">
                    {mod && idx >= 0 && <p className="text-xs font-bold tracking-wide text-primary-500 uppercase">{mod.title} · Unit {mod.units.findIndex((x) => x.id === u.id) + 1}</p>}
                    <h1 className="mt-1 font-headline text-2xl font-extrabold tracking-tight text-tertiary-500 sm:text-[28px]">{u.title}</h1>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500">
                      <span className="inline-flex items-center gap-1"><Clock className="size-3.5" /> {u.estimatedReadMinutes} min read</span>
                      {hasVideo && <span className="inline-flex items-center gap-1"><PlayCircle className="size-3.5" /> {ready.length} recording{ready.length === 1 ? "" : "s"}</span>}
                    </p>
                  </div>
                  {my?.completed && <Badge tone="green"><CheckCircle2 className="size-3" /> Completed</Badge>}
                </div>
              </div>

              {/* Recordings first, course text underneath. No recording → course text first. */}
              {hasVideo ? (
                <RecordingSection unitId={u.id} recordings={u.recordings} />
              ) : pending + failed > 0 ? (
                <RecordingStatusCard pending={pending} failed={failed} />
              ) : (
                <Alert tone="blue" icon={<Info className="size-4" />}>No class recording is attached to this unit yet. Start with the course text below.</Alert>
              )}

              <CourseText key={u.id} unit={u} courseId={courseId!} initialPercent={my?.readPercent ?? 0} />

              {/* Completion + prev/next (SLAN UnitDetailView footer) */}
              <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <div className="order-2 flex gap-2 sm:order-1 sm:flex-1">
                  {prev ? (
                    <Link to={`/courses/${courseId}/units/${prev.id}`} className={buttonClasses("outline", "md", "min-w-0 flex-1 sm:flex-none")} title={prev.title}>
                      <ArrowLeft className="size-4 shrink-0" /> <span className="truncate">Previous<span className="hidden md:inline">: {prev.title}</span></span>
                    </Link>
                  ) : <span className="hidden sm:block" />}
                </div>
                <div className="order-1 sm:order-2">
                  {my?.completed ? (
                    <span className="flex items-center justify-center gap-2 py-2 text-sm font-semibold text-success"><CheckCircle2 className="size-5" /> You've completed this unit</span>
                  ) : (
                    <Button className="w-full" onClick={() => complete.mutate()} loading={complete.isPending} icon={<CheckCircle2 className="size-4" />}>
                      Mark as complete
                    </Button>
                  )}
                </div>
                <div className="order-3 flex justify-end gap-2 sm:flex-1">
                  {next ? (
                    <Link to={`/courses/${courseId}/units/${next.id}`} className={buttonClasses(my?.completed ? "primary" : "outline", "md", "min-w-0 flex-1 sm:flex-none")} title={next.title}>
                      <span className="truncate">Next<span className="hidden md:inline">: {next.title}</span></span> <ArrowRight className="size-4 shrink-0" />
                    </Link>
                  ) : (
                    <Link to={`/courses/${courseId}`} className={buttonClasses("ghost", "md")}>Back to course</Link>
                  )}
                </div>
              </Card>

              <UnitDiscussion courseId={courseId!} unitId={u.id} />
            </div>
          );
        }}
      </Async>
    </Page>
  );
}

function UnitDiscussion({ courseId, unitId }: { courseId: string; unitId: string }) {
  const threads = useQuery({
    queryKey: ["forum", "threads", { unitId, courseId, sort: "recent" }],
    queryFn: () => api.forum.threads({ unitId, courseId, sort: "recent", pageSize: 5 }),
  });
  return (
    <section aria-labelledby="discuss-h">
      <Card>
        <CardHeader
          title={<span id="discuss-h" className="flex items-center gap-2"><MessagesSquare className="size-4 text-primary-500" /> Discuss this unit</span>}
          subtitle="Ask a question or help a classmate. Lecturers and TAs answer here too."
          action={
            <Link to={`/forum/new?courseId=${courseId}&unitId=${unitId}`} className={buttonClasses("primary", "sm")}>
              <Plus className="size-4" /> <span className="hidden sm:inline">Start a thread</span><span className="sm:hidden">New</span>
            </Link>
          }
        />
        <div className="p-4">
          <Async
            query={threads}
            skeleton={<ListSkeleton rows={2} />}
            isEmpty={(d) => d.items.length === 0}
            empty={<p className="py-4 text-center text-sm text-neutral-500">No discussions about this unit yet. Be the first to ask.</p>}
          >
            {(d) => (
              <div className="space-y-3">
                {d.items.map((t) => <ThreadItem key={t.id} t={t} />)}
                {d.total > d.items.length && (
                  <Link to={`/courses/${courseId}/forum`} className="block text-center text-sm font-semibold text-primary-500 hover:underline">
                    See all {d.total} threads
                  </Link>
                )}
              </div>
            )}
          </Async>
        </div>
      </Card>
    </section>
  );
}

