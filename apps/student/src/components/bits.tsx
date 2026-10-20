import { portalUrl } from "@tasued/api-client";
import { Link } from "react-router-dom";
import { CheckCircle2, ChevronRight, Download, FileText, Paperclip, ShieldAlert, Video, ExternalLink } from "lucide-react";
import { Badge, Button, buttonClasses, cn, type Tone } from "@tasued/ui";
import {
  fmtBytes,
  fmtDate,
  fmtTime,
  type Attachment,
  type InviteStatus,
  type ClassSession,
  type Quiz,
  type SubmissionState,
} from "@tasued/api-client";
import type { ReactNode } from "react";

/* ───────── Page container ───────── */

export function Page({ children, className, narrow }: { children: ReactNode; className?: string; narrow?: boolean }) {
  return <div className={cn("mx-auto w-full px-4 py-6 sm:px-6 lg:px-8 lg:py-8", narrow ? "max-w-4xl" : "max-w-6xl", className)}>{children}</div>;
}

export function SectionTitle({ children, action, id }: { children: ReactNode; action?: ReactNode; id?: string }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 id={id} className="font-headline text-lg font-extrabold text-tertiary-500">{children}</h2>
      {action}
    </div>
  );
}

/* ───────── Breadcrumbs ───────── */

export function Breadcrumbs({ items }: { items: { label: ReactNode; to?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-1 text-xs text-neutral-500">
        {items.map((it, i) => (
          <li key={i} className="flex min-w-0 items-center gap-1">
            {i > 0 && <ChevronRight className="size-3 shrink-0 text-neutral-400" aria-hidden />}
            {it.to ? (
              <Link to={it.to} className="truncate hover:text-primary-500 hover:underline">{it.label}</Link>
            ) : (
              <span aria-current="page" className="truncate font-semibold text-tertiary-500">{it.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/* ───────── Classes ───────── */

export function LiveBadge() {
  return (
    <Badge tone="red" className="animate-pulse">
      <span className="size-1.5 rounded-full bg-danger" aria-hidden /> LIVE
    </Badge>
  );
}

export function classStatusBadge(c: ClassSession) {
  if (c.status === "live") return <LiveBadge />;
  if (c.status === "cancelled") return <Badge tone="neutral">Cancelled</Badge>;
  if (c.status === "ended") return <Badge tone="navy">Ended</Badge>;
  return <Badge tone="green">Scheduled</Badge>;
}

export const TEAMS_SIGN_IN_HINT = "Sign in to Teams with your invited email so your attendance counts.";

export function JoinTeamsButton({ c, size = "sm", className }: { c: ClassSession; size?: "xs" | "sm" | "md"; className?: string }) {
  if (c.status === "cancelled" || c.status === "ended" || !c.teamsJoinUrl) return null;
  return (
    <a
      href={c.teamsJoinUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={buttonClasses(c.status === "live" ? "primary" : "outline", size, className)}
      aria-label={`Join ${c.courseCode} ${c.title} on Microsoft Teams (opens in a new tab)`}
      title={TEAMS_SIGN_IN_HINT}
    >
      <ExternalLink className="size-3.5" aria-hidden /> Join on Teams
    </a>
  );
}

/** Students' Microsoft Teams guest invitation status. */
export function TeamsInviteBadge({ status }: { status?: InviteStatus }) {
  if (!status) return null;
  const [tone, label, hint]: [Tone, string, string | null] =
    status === "accepted"
      ? ["green", "Accepted", null]
      : status === "sent"
        ? ["amber", "Pending", "Check your email for the invitation."]
        : status === "expired"
          ? ["red", "Expired", "Contact the course team for a new invitation."]
          : ["neutral", "Not sent yet", "It will arrive by email — check back soon."];
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
      <Badge tone={tone}>{status === "accepted" && <CheckCircle2 className="size-3" aria-hidden />}{label}</Badge>
      {hint && <span className="text-xs font-normal text-neutral-500">{hint}</span>}
    </span>
  );
}

/** Link to where a class's recording is published (first covered unit). */
export function RecordingLink({ c }: { c: ClassSession }) {
  if (c.recordingStatus === "ready" && c.unitIds[0]) {
    return (
      <Link to={`/courses/${c.courseId}/units/${c.unitIds[0]}`} className={buttonClasses("ghost", "sm")}>
        <Video className="size-3.5" aria-hidden /> Watch recording
      </Link>
    );
  }
  if (c.status === "ended" && c.recordingStatus === "pending") {
    return <Badge tone="amber">Recording coming soon</Badge>;
  }
  return null;
}

export function ClassRow({ c, showCourse = true }: { c: ClassSession; showCourse?: boolean }) {
  const start = new Date(c.startsAt);
  return (
    <div className={cn("flex flex-col gap-3 rounded-xl border bg-white p-4 sm:flex-row sm:items-center", c.status === "live" ? "border-danger/40 ring-1 ring-danger/20" : "border-neutral-200")}>
      <div className="flex w-full min-w-0 items-start gap-3 sm:flex-1">
        <div className="flex w-14 shrink-0 flex-col items-center rounded-lg bg-primary-50 py-1.5 text-primary-600">
          <span className="text-[10px] font-bold uppercase">{fmtDate(c.startsAt, { weekday: "short" })}</span>
          <span className="font-headline text-lg leading-tight font-extrabold">{fmtDate(c.startsAt, { day: "numeric" })}</span>
          <span className="text-[10px] font-semibold">{fmtDate(c.startsAt, { month: "short" })}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {showCourse && <span className="text-xs font-bold text-primary-500">{c.courseCode}</span>}
            {classStatusBadge(c)}
          </div>
          <p className="mt-0.5 truncate font-semibold text-tertiary-500">{c.title}</p>
          <p className="text-xs text-neutral-500">
            <time dateTime={c.startsAt}>{fmtTime(c.startsAt)}</time> – <time dateTime={c.endsAt}>{fmtTime(c.endsAt)}</time> · {c.lecturerName}
            {c.unitTitles.length > 0 && <> · {c.unitTitles.join(", ")}</>}
          </p>
          <span className="sr-only">{start.toDateString()}</span>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
        <JoinTeamsButton c={c} />
        <RecordingLink c={c} />
      </div>
    </div>
  );
}

/* ───────── Attachments ───────── */

export function AttachmentList({ items, onRemove, removing }: { items: Attachment[]; onRemove?: (a: Attachment) => void; removing?: string | null }) {
  if (!items.length) return null;
  return (
    <ul className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-white">
      {items.map((a) => (
        <li key={a.id} className="flex items-center gap-3 px-4 py-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-tertiary-50 text-tertiary-500">
            {a.mimeType.includes("pdf") || a.mimeType.includes("word") ? <FileText className="size-4" /> : <Paperclip className="size-4" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-tertiary-500">{a.name}</p>
            <p className="text-xs text-neutral-500">
              {fmtBytes(a.sizeBytes)}
              {a.scanStatus === "pending" && " · virus scan pending"}
            </p>
          </div>
          {a.scanStatus === "infected" ? (
            <Badge tone="red"><ShieldAlert className="size-3" /> Blocked</Badge>
          ) : (
            <a href={portalUrl(a.url)} download={a.name} target="_blank" rel="noopener noreferrer" className={buttonClasses("ghost", "xs")} aria-label={`Download ${a.name}`}>
              <Download className="size-3.5" /> <span className="hidden sm:inline">Download</span>
            </a>
          )}
          {onRemove && (
            <Button variant="ghost" size="xs" className="text-danger hover:bg-danger-50" onClick={() => onRemove(a)} loading={removing === a.id} aria-label={`Remove ${a.name}`}>
              Remove
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}

/* ───────── Assignment / quiz status ───────── */

export function submissionBadge(state: SubmissionState | undefined, graded?: boolean) {
  if (graded) return <Badge tone="gold">Graded</Badge>;
  if (state === "submitted") return <Badge tone="green">Submitted</Badge>;
  if (state === "draft") return <Badge tone="amber">Draft saved</Badge>;
  return <Badge tone="neutral">Not started</Badge>;
}

export type QuizWindow = "upcoming" | "open" | "closed";
export function quizWindow(q: Pick<Quiz, "opensAt" | "closesAt">, now = Date.now()): QuizWindow {
  if (now < new Date(q.opensAt).getTime()) return "upcoming";
  if (now > new Date(q.closesAt).getTime()) return "closed";
  return "open";
}
export function quizWindowBadge(w: QuizWindow) {
  const map: Record<QuizWindow, [Tone, string]> = { upcoming: ["blue", "Opens soon"], open: ["green", "Open"], closed: ["neutral", "Closed"] };
  const [tone, label] = map[w];
  return <Badge tone={tone} dot>{label}</Badge>;
}

export function DueText({ iso, className }: { iso: string; className?: string }) {
  const ms = new Date(iso).getTime() - Date.now();
  const urgent = ms > 0 && ms < 48 * 3600_000;
  const overdue = ms < 0;
  return (
    <span className={cn("text-xs", overdue ? "text-danger" : urgent ? "font-semibold text-warning" : "text-neutral-500", className)}>
      {overdue ? "Was due " : "Due "}
      {fmtDate(iso, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
    </span>
  );
}
