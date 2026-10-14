import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Activity, CalendarClock, ClipboardCheck, ExternalLink, FileText, Flag, BookOpen, GraduationCap, MailCheck, ScrollText, UserCog, Video } from "lucide-react";
import { api, fmtDate, fmtDateTime, fmtTime, type AdminDashboard } from "@tasued/api-client";
import { Badge, buttonClasses, EmptyState, ErrorState, Skeleton, StatCard } from "@tasued/ui";
import { errorMessage } from "@tasued/api-client";
import { useCan, useIsSuperAdmin, useSession, useTeaches } from "../../app/session";
import { COURSE_STATUS_LABEL, COURSE_STATUS_TONE } from "../courses/CourseForm";
import { useCoursesInScope } from "../../components/queries";
import { AttendanceStatusBadge, ClassStatusBadge, CopyButton, RecordingStatusBadge, SectionCard } from "../../components/common";

function greeting() {
  const h = Number(new Intl.DateTimeFormat("en-NG", { timeZone: "Africa/Lagos", hour: "numeric", hour12: false }).format(new Date()));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

/** Ported from SLAN admin's pages/Dashboard.tsx: green hero banner + stat cards + panels. */
export function DashboardPage() {
  const session = useSession();
  const can = useCan();
  const courses = useCoursesInScope();
  const teaches = useTeaches();
  const isAdmin = useIsSuperAdmin();
  const taught = courses.data?.filter((c) => teaches(c.id));
  const only = taught?.length === 1 ? taught[0] : undefined;
  const q = useQuery({ queryKey: ["dashboards", "admin"], queryFn: () => api.dashboards.admin(), refetchInterval: 60_000 });

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[20px] bg-gradient-to-br from-primary-700 via-primary-600 to-primary-400 p-5 text-white shadow-cta sm:rounded-[28px] sm:p-8">
        <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "22px 22px" }} aria-hidden />
        <div className="absolute -top-16 -right-16 size-72 rounded-full bg-white/10 blur-3xl" aria-hidden />
        <div className="relative z-10 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 text-xs font-medium">
              {teaches() ? "Teaching overview" : "Admin overview"} <span className="size-1 rounded-full bg-white/40" /> {fmtDate(new Date().toISOString(), { weekday: "long", day: "numeric", month: "long" })}
            </span>
            <h1 className="mt-4 font-headline text-[26px] leading-tight font-extrabold sm:text-[32px]">
              {greeting()}, <span className="text-secondary-300">{session.user.fullName.split(/\s+/).find((w) => !/^(dr|prof|mr|mrs|ms|engr|rev)\.?$/i.test(w)) ?? session.user.fullName}</span>
            </h1>
            <p className="mt-2 max-w-xl text-sm text-white/75">
              {teaches()
                ? "Today's Teams classes, class recordings and work waiting for you."
                : "Courses, people, invitations and platform health at a glance."}
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 md:items-end">
          {only && (
            <Link to={`/courses/${only.id}/content`} className="inline-flex items-center gap-2 rounded-full bg-secondary-400 px-4 py-2 text-sm font-semibold text-tertiary-500 shadow-sm hover:bg-secondary-300">
              <BookOpen className="size-4" aria-hidden /> Open {only.code}
            </Link>
          )}
          {q.data && can("integrations.view") && (
            <Link to="/integrations" className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-xs font-semibold text-primary-600 shadow-sm md:self-center">
              <span className={q.data.integrationOk ? "size-2 rounded-full bg-primary-500" : "size-2 rounded-full bg-danger"} aria-hidden />
              {q.data.integrationOk ? "Microsoft Teams integration healthy" : "Integration needs attention"}
            </Link>
          )}
          </div>
        </div>
      </section>

      {q.isPending ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
      ) : q.isError ? (
        <ErrorState description={errorMessage(q.error)} onRetry={() => q.refetch()} />
      ) : (
        <>
          <StatRow d={q.data} />
          {teaches() && <TeachingPanels d={q.data} />}
          {isAdmin && <AdminPanels d={q.data} />}
        </>
      )}
    </div>
  );
}

function StatRow({ d }: { d: AdminDashboard }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      <StatCard label="Students" value={d.counts.students.toLocaleString()} icon={<GraduationCap className="size-5" />} />
      <StatCard label="Staff" value={d.counts.staff.toLocaleString()} icon={<UserCog className="size-5" />} tone="navy" />
      <StatCard label="Courses" value={d.counts.courses.toLocaleString()} icon={<BookOpen className="size-5" />} tone="gold" />
      <StatCard label="Classes this week" value={d.counts.classesThisWeek.toLocaleString()} icon={<CalendarClock className="size-5" />} />
    </div>
  );
}

/** Lecturers and teaching assistants: classes, recordings and marking for the courses they teach. */
function TeachingPanels({ d }: { d: AdminDashboard }) {
  const can = useCan();
  return (
    <>

      <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
        <SectionCard className="lg:col-span-2" title="Today's classes" subtitle="Teams meetings with automatic recording" action={<Link to="/classes" className="text-sm font-semibold text-primary-500 hover:underline">All classes</Link>}>
          {d.todayClasses.length === 0 ? (
            <EmptyState icon={<CalendarClock className="size-6" />} title="No classes today" description="Scheduled classes in your courses will appear here." />
          ) : (
            <ul className="divide-y divide-neutral-100">
              {d.todayClasses.map((c) => (
                <li key={c.id} className="flex flex-col gap-2 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-primary-600">{c.classCode}</span>
                      <ClassStatusBadge status={c.status} />
                    </div>
                    <p className="mt-0.5 truncate text-sm font-semibold text-tertiary-500">{c.courseCode} · {c.title}</p>
                    <p className="text-xs text-neutral-500">{fmtTime(c.startsAt)}–{fmtTime(c.endsAt)} · {c.lecturerName}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <CopyButton value={c.classCode} label="Copy code" />
                    {c.status !== "cancelled" && c.status !== "ended" && (
                      <a href={c.teamsJoinUrl} target="_blank" rel="noreferrer" className={buttonClasses(c.status === "live" ? "primary" : "outline", "xs")}>
                        Join in Teams <ExternalLink className="size-3.5" />
                      </a>
                    )}
                    <Link to={`/courses/${c.courseId}/classes`} className={buttonClasses("ghost", "xs")}>Details</Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <div className="space-y-4 lg:space-y-6">
        <SectionCard title="Recording queue" subtitle="Linked from the organiser's OneDrive" action={can("recordings.manage") ? <Link to="/recordings" className="text-sm font-semibold text-primary-500 hover:underline">Open</Link> : undefined}>
          <ul className="divide-y divide-neutral-100">
            {([
              ["pending", d.recordingQueue.pending],
              ["failed", d.recordingQueue.failed],
            ] as const).map(([s, n]) => (
              <li key={s}>
                <Link to={`/recordings?status=${s}`} className="flex items-center justify-between px-5 py-3 hover:bg-neutral-50">
                  <RecordingStatusBadge status={s} />
                  <span className={s === "failed" && n > 0 ? "font-headline text-lg font-extrabold text-danger" : "font-headline text-lg font-extrabold text-tertiary-500"}>{n}</span>
                </Link>
              </li>
            ))}
            <li className="flex items-center justify-between px-5 py-3">
              <span className="text-sm text-neutral-500">Ready this week</span>
              <span className="font-headline text-lg font-extrabold text-primary-500">{d.recordingQueue.readyThisWeek}</span>
            </li>
          </ul>
        </SectionCard>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
        <SectionCard title="Attendance to review" action={can("attendance.manage") ? <Link to="/attendance" className="text-sm font-semibold text-primary-500 hover:underline">All</Link> : undefined}>
          {d.attendanceToReview.length === 0 ? (
            <EmptyState icon={<ClipboardCheck className="size-6" />} title="Nothing to review" />
          ) : (
            <ul className="divide-y divide-neutral-100">
              {d.attendanceToReview.map((c) => (
                <li key={c.id}>
                  <Link to={`/courses/${c.courseId}/classes/${c.id}/attendance`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-neutral-50">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-tertiary-500">{c.courseCode} · {c.title}</span>
                      <span className="text-xs text-neutral-500">{fmtDate(c.startsAt)}</span>
                    </span>
                    <AttendanceStatusBadge status={c.attendanceStatus} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Submissions to grade">
          {d.submissionsToGrade.length === 0 ? (
            <EmptyState icon={<FileText className="size-6" />} title="All graded" />
          ) : (
            <ul className="divide-y divide-neutral-100">
              {d.submissionsToGrade.map((s) => (
                <li key={s.assignmentId}>
                  <SubmissionLink assignmentId={s.assignmentId}>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-tertiary-500">{s.title}</span>
                      <span className="text-xs text-neutral-500">{s.courseCode}</span>
                    </span>
                    <Badge tone="amber">{s.ungraded} ungraded</Badge>
                  </SubmissionLink>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Forum reports">
          <div className="flex items-center justify-between px-5 py-5">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-lg bg-danger-50 text-danger"><Flag className="size-5" /></span>
              <div>
                <p className="font-headline text-2xl font-extrabold text-tertiary-500">{d.openReports}</p>
                <p className="text-xs text-neutral-500">open reports</p>
              </div>
            </div>
            {can("forum.moderate") && <Link to="/forum" className={buttonClasses("outline", "sm")}>Review</Link>}
          </div>
          {can("recordings.manage") && (
            <div className="border-t border-neutral-100 px-5 py-4">
              <Link to="/recordings?status=failed" className="flex items-center gap-2 text-sm font-semibold text-primary-500 hover:underline"><Video className="size-4" /> Fix failed recordings</Link>
            </div>
          )}
        </SectionCard>
      </div>
    </>
  );
}

/** Super admins: courses, onboarding, platform health and recent activity — no teaching work. */
function AdminPanels({ d }: { d: AdminDashboard }) {
  const can = useCan();
  return (
    <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
      <div className="space-y-4 lg:col-span-2 lg:space-y-6">
        <CoursesCard />
        {can("audit.view") && <RecentActivityCard />}
      </div>
      <div className="space-y-4 lg:space-y-6">
        {can("people.manage") && <InvitationsCard />}
        {can("integrations.view") && (
          <SectionCard title="Platform health" subtitle="Teams, OneDrive and email" action={<Link to="/integrations" className="text-sm font-semibold text-primary-500 hover:underline">Details</Link>}>
            <div className="flex items-center gap-3 px-5 py-5">
              <span className={d.integrationOk ? "flex size-10 items-center justify-center rounded-lg bg-success-50 text-success" : "flex size-10 items-center justify-center rounded-lg bg-danger-50 text-danger"}>
                <Activity className="size-5" />
              </span>
              <div>
                <p className="font-semibold text-tertiary-500">{d.integrationOk ? "All services healthy" : "Needs attention"}</p>
                <p className="text-xs text-neutral-500">{d.integrationOk ? "Classes, recordings and invitations are syncing." : "Open the details to see which service is failing."}</p>
              </div>
            </div>
          </SectionCard>
        )}
      </div>
    </div>
  );
}

function CoursesCard() {
  const q = useCoursesInScope();
  const can = useCan();
  return (
    <SectionCard title="Courses" subtitle="Status, students and teaching staff" action={can("courses.manage") ? <Link to="/courses" className="text-sm font-semibold text-primary-500 hover:underline">Manage</Link> : undefined}>
      {q.isPending ? (
        <div className="space-y-2 p-5">{[0, 1].map((i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : q.isError ? (
        <p className="px-5 py-4 text-sm text-neutral-500">Couldn't load courses.</p>
      ) : !q.data.length ? (
        <EmptyState icon={<BookOpen className="size-6" />} title="No courses yet" action={can("courses.manage") ? <Link to="/courses" className={buttonClasses("outline", "sm")}>Add a course</Link> : undefined} />
      ) : (
        <ul className="divide-y divide-neutral-100">
          {q.data.map((c) => (
            <li key={c.id}>
              <Link to={`/courses/${c.id}/content`} className="flex flex-col gap-1 px-5 py-3.5 hover:bg-neutral-50 sm:flex-row sm:items-center sm:justify-between">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-tertiary-500"><span className="text-primary-500">{c.code}</span> {c.title}</span>
                  <span className="text-xs text-neutral-500">
                    Lecturer: {c.lecturers.map((l) => l.fullName).join(", ") || "not assigned"}
                    {c.assistants.length > 0 && <> · TAs: {c.assistants.map((l) => l.fullName).join(", ")}</>}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2 text-xs text-neutral-500">
                  {c.enrolledCount} students · {c.unitCount} units
                  <Badge tone={COURSE_STATUS_TONE[c.status]}>{COURSE_STATUS_LABEL[c.status]}</Badge>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

function RecentActivityCard() {
  const q = useQuery({ queryKey: ["audit", "recent"], queryFn: () => api.audit.list({ pageSize: 6 }) });
  return (
    <SectionCard title="Recent activity" action={<Link to="/audit" className="text-sm font-semibold text-primary-500 hover:underline">Audit log</Link>}>
      {q.isPending ? (
        <div className="space-y-2 p-5">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-10" />)}</div>
      ) : q.isError || !q.data.items.length ? (
        <EmptyState icon={<ScrollText className="size-6" />} title={q.isError ? "Couldn't load activity" : "No activity yet"} />
      ) : (
        <ul className="divide-y divide-neutral-100">
          {q.data.items.map((e) => (
            <li key={e.id} className="px-5 py-3">
              <p className="text-sm text-tertiary-500">{e.summary}</p>
              <p className="text-xs text-neutral-500">{e.actor} · {fmtDateTime(e.at)}</p>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

/** The dashboard only gives assignmentId; resolve its course to deep-link into the submissions page. */
function SubmissionLink({ assignmentId, children }: { assignmentId: string; children: React.ReactNode }) {
  const q = useQuery({ queryKey: ["assignments", "get", assignmentId], queryFn: () => api.assignments.get(assignmentId), staleTime: 5 * 60_000 });
  const to = q.data ? `/courses/${q.data.courseId}/assignments/${assignmentId}/submissions` : "/assignments";
  return <Link to={to} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-neutral-50">{children}</Link>;
}

/** Students who haven't finished onboarding: LMS password invite and Teams guest invite. */
function InvitationsCard() {
  const q = useQuery({ queryKey: ["dashboards", "admin"], queryFn: () => api.dashboards.admin(), refetchInterval: 60_000 });
  const inv = q.data?.invitations;
  const rows: [string, string, number | undefined][] = [
    ["Pending LMS invite", "/people?role=student&lms=invited", inv?.lmsPending],
    ["Pending Teams guest invite", "/people?role=student&teams=invited", inv?.teamsPending],
    ["Expired invitations", "/people?role=student&lms=expired", inv?.expired],
  ];
  return (
    <SectionCard title="Invitations" subtitle="Students who haven't accepted yet" action={<Link to="/people?role=student" className="text-sm font-semibold text-primary-500 hover:underline">People</Link>}>
      {q.isError ? (
        <p className="px-5 py-4 text-sm text-neutral-500">Couldn't load invitation counts.</p>
      ) : (
        <ul className="divide-y divide-neutral-100">
          {rows.map(([label, to, n]) => (
            <li key={label}>
              <Link to={to} className="flex items-center justify-between px-5 py-3 hover:bg-neutral-50">
                <span className="flex items-center gap-2 text-sm text-tertiary-500"><MailCheck className="size-4 text-primary-500" /> {label}</span>
                {n === undefined ? <Skeleton className="h-6 w-8" /> : <span className={n > 0 ? "font-headline text-lg font-extrabold text-warning" : "font-headline text-lg font-extrabold text-tertiary-500"}>{n}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
