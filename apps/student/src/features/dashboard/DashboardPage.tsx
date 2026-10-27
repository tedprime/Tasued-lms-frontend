import { TeamsSetupCard } from '../../components/TeamsSetupCard';
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CalendarClock, ClipboardList, Megaphone, PlayCircle, Timer, UserCheck, Video } from "lucide-react";
import { api, fmtDuration, fromNow, fmtDate, type StudentDashboard } from "@tasued/api-client";
import { Card, CardHeader, EmptyState, ErrorState, Progress, ProgressRing, Skeleton, buttonClasses, Badge } from "@tasued/ui";
import { useSession } from "../../app/session";
import { ClassRow, DueText, TEAMS_SIGN_IN_HINT, submissionBadge } from "../../components/bits";
import { ListSkeleton } from "../../components/Async";

function greeting() {
  const h = Number(new Intl.DateTimeFormat("en-NG", { timeZone: "Africa/Lagos", hour: "numeric", hourCycle: "h23" }).format(new Date()));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

/** Dashboard — SLAN's Overview hero + resume banner, extended with TASFUED's Teams-first widgets. */
export default function DashboardPage() {
  const { user } = useSession();
  const q = useQuery({ queryKey: ["dashboard", "student"], queryFn: () => api.dashboards.student(), refetchInterval: 60_000 });
  const firstName = user.fullName.split(/\s+/)[0];
  const hello = useMemo(greeting, []);

  return (
    <div className="animate-fade-in-up">
      {/* Hero (SLAN Overview) */}
      <section className="relative overflow-hidden bg-[linear-gradient(135deg,#091222_0%,#142647_55%,#192f59_100%)] px-4 pt-10 pb-12 sm:px-8 sm:pt-14 sm:pb-16">
        <div aria-hidden className="absolute -top-16 -right-12 size-64 rounded-full border border-white/10" />
        <div aria-hidden className="absolute right-16 -bottom-24 size-44 rounded-full border border-white/5" />
        <div className="relative mx-auto flex max-w-6xl flex-wrap items-start justify-between gap-5">
          <div>
            <h1 className="font-headline text-[26px] font-extrabold tracking-tight text-white sm:text-3xl">
              {hello}, {firstName}
            </h1>
            <p className="mt-1 text-sm text-white/75">
              {user.department ? `${user.department}${user.level ? ` · ${user.level} level` : ""}` : "Here's what's happening in your courses."}
            </p>
          </div>
          {q.data && q.data.attendancePercent !== null && (
            <Link to="/attendance" className="flex items-center gap-3 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-white hover:bg-white/10">
              <span className="flex size-16 items-center justify-center rounded-full border-[3px] border-secondary-500 font-headline text-base font-extrabold">
                {Math.round(q.data.attendancePercent)}%
              </span>
              <span className="text-xs leading-tight text-white/80">
                Overall
                <br />
                attendance
              </span>
            </Link>
          )}
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <TeamsSetupCard />
        {q.isPending ? (
          <DashboardSkeleton />
        ) : q.isError ? (
          <Card><ErrorState title="Couldn't load your dashboard" onRetry={() => void q.refetch()} /></Card>
        ) : (
          <DashboardBody d={q.data} />
        )}
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3" aria-busy="true" aria-label="Loading dashboard">
      <div className="min-w-0 space-y-6 lg:col-span-2">
        <Skeleton className="h-24 rounded-xl" />
        <ListSkeleton rows={3} />
      </div>
      <div className="space-y-6"><ListSkeleton rows={3} /></div>
    </div>
  );
}

function DashboardBody({ d }: { d: StudentDashboard }) {
  const live = d.upcomingClasses.filter((c) => c.status === "live");
  const resume = d.continueLearning[0];
  const classes = [...d.upcomingClasses].sort((a, b) => (a.status === "live" ? -1 : b.status === "live" ? 1 : a.startsAt.localeCompare(b.startsAt))).slice(0, 4);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="min-w-0 space-y-6 lg:col-span-2">
        {live.length > 0 && (
          <div role="status" className="flex flex-col gap-3 rounded-xl border border-danger/30 bg-danger-50 p-4 sm:flex-row sm:flex-wrap sm:items-center">
            <span className="flex items-center gap-2 text-sm font-bold text-danger">
              <span className="relative flex size-2.5"><span className="absolute inline-flex size-full animate-ping rounded-full bg-danger opacity-60" /><span className="relative inline-flex size-2.5 rounded-full bg-danger" /></span>
              Live now
            </span>
            <p className="min-w-0 flex-1 truncate text-sm text-tertiary-500">
              <span className="font-semibold">{live[0]!.courseCode}</span> · {live[0]!.title}
            </p>
            <a
              href={live[0]!.teamsJoinUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClasses("danger", "sm")}
              aria-label={`Join ${live[0]!.courseCode} ${live[0]!.title} on Microsoft Teams (opens in a new tab)`}
              aria-describedby="live-teams-hint"
            >
              Join on Teams
            </a>
            <p id="live-teams-hint" className="text-xs text-neutral-600 sm:basis-full">{TEAMS_SIGN_IN_HINT}</p>
          </div>
        )}

        {/* Resume banner (SLAN) */}
        {resume && (
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-l-4 border-neutral-200 border-l-secondary-500 bg-white p-5 shadow-card">
            <div className="min-w-0">
              <p className="text-xs font-bold tracking-wide text-primary-500 uppercase">Continue learning · {resume.courseCode}</p>
              <h2 className="mt-1 truncate font-headline text-base font-bold text-tertiary-500">{resume.unitTitle}</h2>
              <div className="mt-2 flex items-center gap-2">
                <Progress value={resume.readPercent} className="w-40" label="Reading progress" />
                <span className="text-xs text-neutral-500">{Math.round(resume.readPercent)}% read</span>
              </div>
            </div>
            <Link to={`/courses/${resume.courseId}/units/${resume.unitId}`} className={buttonClasses("primary", "md")}>
              Continue <ArrowRight className="size-4" />
            </Link>
          </div>
        )}

        <Card>
          <CardHeader
            title={<span className="flex items-center gap-2"><CalendarClock className="size-4 text-primary-500" /> Today & upcoming classes</span>}
            action={<Link to="/classes" className="text-xs font-semibold text-primary-500 hover:underline">All classes</Link>}
          />
          <div className="space-y-3 p-4">
            {classes.length === 0 ? (
              <EmptyState className="py-6" icon={<CalendarClock className="size-6" />} title="No upcoming classes" description="When your lecturers schedule Teams classes they'll appear here." />
            ) : (
              classes.map((c) => <ClassRow key={c.id} c={c} />)
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title={<span className="flex items-center gap-2"><Video className="size-4 text-primary-500" /> Latest recordings</span>}
          />
          {d.latestRecordings.length === 0 ? (
            <EmptyState className="py-8" icon={<Video className="size-6" />} title="No recordings yet" description="Class recordings appear here shortly after Teams saves them." />
          ) : (
            <ul className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
              {d.latestRecordings.slice(0, 4).map((r) => (
                <li key={r.id}>
                  <Link
                    to={r.unitId ? `/courses/${r.courseId}/units/${r.unitId}` : `/courses/${r.courseId}/recordings`}
                    className="group flex gap-3 rounded-xl border border-neutral-200 p-3 transition-colors hover:border-primary-300 hover:bg-primary-50/30"
                  >
                    <span className="relative flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-tertiary-500 text-white">
                      {r.posterUrl && <img src={r.posterUrl} alt="" className="decorative-img absolute inset-0 size-full object-cover opacity-70" loading="lazy" />}
                      <PlayCircle className="relative size-7" aria-hidden />
                      <span className="absolute right-1 bottom-1 rounded bg-black/70 px-1 text-[10px] font-semibold">{fmtDuration(r.durationSeconds)}</span>
                    </span>
                    <span className="min-w-0">
                      <span className="block text-xs font-bold text-primary-500">{r.courseCode}</span>
                      <span className="line-clamp-2 block text-sm font-semibold text-tertiary-500 group-hover:text-primary-500">{r.title}</span>
                      <span className="block text-xs text-neutral-500">{r.unitTitle ? `${r.unitTitle} · ` : ""}{fromNow(r.recordedAt)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="min-w-0 space-y-6">
        <Card>
          <CardHeader title={<span className="flex items-center gap-2"><ClipboardList className="size-4 text-primary-500" /> Due soon</span>} action={<Link to="/assignments" className="text-xs font-semibold text-primary-500 hover:underline">All</Link>} />
          {d.dueSoon.length === 0 ? (
            <p className="px-5 py-6 text-sm text-neutral-500">Nothing due in the next few days.</p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {d.dueSoon.map((a) => (
                <li key={a.id}>
                  <Link to={`/assignments/${a.id}`} className="block px-5 py-3 hover:bg-neutral-50">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-primary-500">{a.courseCode}</span>
                      {submissionBadge(a.submissionState)}
                    </div>
                    <p className="truncate text-sm font-semibold text-tertiary-500">{a.title}</p>
                    <DueText iso={a.dueAt} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title={<span className="flex items-center gap-2"><Timer className="size-4 text-primary-500" /> Open quizzes</span>} action={<Link to="/quizzes" className="text-xs font-semibold text-primary-500 hover:underline">All</Link>} />
          {d.openQuizzes.length === 0 ? (
            <p className="px-5 py-6 text-sm text-neutral-500">No quizzes open right now.</p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {d.openQuizzes.map((qz) => (
                <li key={qz.id}>
                  <Link to={`/quizzes/${qz.id}`} className="block px-5 py-3 hover:bg-neutral-50">
                    <span className="text-xs font-bold text-primary-500">{qz.courseCode}</span>
                    <p className="truncate text-sm font-semibold text-tertiary-500">{qz.title}</p>
                    <p className="text-xs text-neutral-500">Closes {fmtDate(qz.closesAt, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title={<span className="flex items-center gap-2"><Megaphone className="size-4 text-primary-500" /> Announcements</span>} action={<Link to={announcementsHref(d.announcements)} className="text-xs font-semibold text-primary-500 hover:underline">All</Link>} />
          {d.announcements.length === 0 ? (
            <p className="px-5 py-6 text-sm text-neutral-500">No announcements.</p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {d.announcements.slice(0, 4).map((a) => (
                <li key={a.id}>
                  <Link to={a.courseId ? `/courses/${a.courseId}/announcements` : "/announcements"} className="block px-5 py-3 hover:bg-neutral-50">
                    <div className="flex items-center gap-2">
                      {a.courseCode ? <span className="text-xs font-bold text-primary-500">{a.courseCode}</span> : <Badge tone="gold">University</Badge>}
                      {!a.readByViewer && <span className="size-1.5 rounded-full bg-secondary-500" aria-label="Unread" />}
                    </div>
                    <p className="truncate text-sm font-semibold text-tertiary-500">{a.title}</p>
                    <p className="text-xs text-neutral-500">{a.author.fullName} · {fromNow(a.publishedAt)}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {d.attendancePercent !== null && (
          <Card className="flex items-center gap-4 p-5">
            <ProgressRing value={d.attendancePercent} size={64} />
            <div>
              <p className="flex items-center gap-1.5 text-sm font-bold text-tertiary-500"><UserCheck className="size-4 text-primary-500" /> Attendance</p>
              <p className="text-xs text-neutral-500">Across all your classes.</p>
              <Link to="/attendance" className="text-xs font-semibold text-primary-500 hover:underline">See details</Link>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

/** "All" goes to the course's Announcements tab when every listed announcement belongs to one course. */
function announcementsHref(list: { courseId: string | null }[]) {
  const ids = new Set(list.map((a) => a.courseId));
  const [only] = [...ids];
  return ids.size === 1 && only ? `/courses/${only}/announcements` : "/announcements";
}
