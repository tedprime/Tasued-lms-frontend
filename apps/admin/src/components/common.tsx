import { useState, type ReactNode } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import { Check, Copy } from "lucide-react";
import { errorMessage, type AttendanceSheetStatus, type ClassSessionStatus, type HealthState, type PublishState, type RecordingStatus } from "@tasued/api-client";
import { Badge, Card, ErrorState, Skeleton, cn, type Tone } from "@tasued/ui";

/* ───────── Query rendering helper: loading / error / data ───────── */

export function QueryView<T>({
  query,
  children,
  loading,
  isEmpty,
  empty,
}: {
  query: UseQueryResult<T>;
  children: (data: T) => ReactNode;
  loading?: ReactNode;
  isEmpty?: (data: T) => boolean;
  empty?: ReactNode;
}) {
  if (query.isPending) return <>{loading ?? <ListSkeleton />}</>;
  if (query.isError) return <ErrorState description={errorMessage(query.error)} onRetry={() => query.refetch()} />;
  if (isEmpty?.(query.data) && empty) return <>{empty}</>;
  return <>{children(query.data)}</>;
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3 p-5" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

export function SectionCard({ title, subtitle, action, children, className, bodyClassName }: { title?: ReactNode; subtitle?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; bodyClassName?: string }) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      {(title || action) && (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-100 px-5 py-4">
          <div className="min-w-0">
            {title && <h2 className="font-headline text-[15px] font-bold text-tertiary-500">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-sm text-neutral-500">{subtitle}</p>}
          </div>
          {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </Card>
  );
}

/* ───────── Status pills (text + colour; colour is never the only signal) ───────── */

const classTone: Record<ClassSessionStatus, Tone> = { scheduled: "blue", live: "red", ended: "neutral", cancelled: "amber" };
export function ClassStatusBadge({ status }: { status: ClassSessionStatus }) {
  return <Badge tone={classTone[status]} dot>{status === "live" ? "Live now" : cap(status)}</Badge>;
}

const recTone: Record<RecordingStatus | "none", Tone> = { pending: "gold", ready: "green", failed: "red", none: "neutral" };
const recLabel: Record<RecordingStatus | "none", string> = { pending: "Pending", ready: "Ready", failed: "Failed", none: "No recording" };
/** Recording status: pending (waiting for Teams to save to OneDrive), ready (linked), failed (file not found). */
export function RecordingStatusBadge({ status }: { status: RecordingStatus | "none" }) {
  return <Badge tone={recTone[status]} dot>{recLabel[status]}</Badge>;
}

const attTone: Record<AttendanceSheetStatus | "not_started", Tone> = { not_started: "neutral", pending_import: "gold", imported: "blue", in_review: "amber", finalised: "green" };
export function AttendanceStatusBadge({ status }: { status: AttendanceSheetStatus | "not_started" }) {
  return <Badge tone={attTone[status]} dot>{cap(status.replace(/_/g, " "))}</Badge>;
}

export function PublishBadge({ state }: { state: PublishState }) {
  return <Badge tone={state === "published" ? "green" : "neutral"}>{state === "published" ? "Published" : "Draft"}</Badge>;
}

const healthTone: Record<HealthState, Tone> = { ok: "green", degraded: "amber", down: "red", unknown: "neutral", waiting: "blue", disabled: "neutral" };
export function healthLabel(state: HealthState) { return { ok: "Working", degraded: "Needs attention", down: "Failed", unknown: "Not verified", waiting: "Waiting", disabled: "Not used" }[state]; }
export function HealthBadge({ state, label }: { state: HealthState; label?: string }) {
  return <Badge tone={healthTone[state]} dot>{label ?? healthLabel(state)}</Badge>;
}

export function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* ───────── Copy to clipboard ───────── */

export function CopyButton({ value, label = "Copy", className }: { value: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          /* clipboard blocked */
        }
      }}
      className={cn("inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-primary-500 hover:bg-primary-50", className)}
      aria-label={done ? "Copied" : label}
    >
      {done ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      {done ? "Copied" : label}
    </button>
  );
}

/* ───────── Responsive bar chart ───────── */

export function MiniBars({ data, max, format = (v) => String(v), label, color = "var(--color-primary-500)" }: { data: { label: string; value: number }[]; max?: number; format?: (v: number) => string; label: string; color?: string }) {
  const top = max ?? Math.max(1, ...data.map((d) => d.value));
  return (
    <figure className="min-w-0 overflow-x-auto pb-2" aria-label={label}>
      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.max(1, data.length)}, minmax(88px, 1fr))` }}>
        {data.map((d) => (
          <div key={d.label} className="min-w-0 text-center">
            <div className="flex h-40 flex-col items-center justify-end">
              <span className="mb-1 text-xs font-semibold text-tertiary-500">{format(d.value)}</span>
              <div aria-hidden className="w-8 shrink-0 rounded-t" style={{ height: Math.max(2, Math.min(1, d.value / top) * 120), backgroundColor: color }} />
            </div>
            <p className="mt-2 whitespace-normal break-words text-xs leading-5 text-neutral-500">{d.label}</p>
          </div>
        ))}
      </div>
    </figure>
  );
}

/* ───────── Download a CSV built in the browser ───────── */

export function downloadCsv(filename: string, rows: (string | number | null | undefined)[][]) {
  const esc = (v: string | number | null | undefined) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const blob = new Blob([rows.map((r) => r.map(esc).join(",")).join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
