import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Hourglass, ListVideo, PlayCircle, Wifi } from "lucide-react";
import { api, fmtDate, fmtDuration, type ID, type Recording } from "@tasued/api-client";
import { Badge, Card, Skeleton, cn } from "@tasued/ui";
import { VideoPlayer } from "../../lib/video-player";
import { usePreferences } from "../../app/session";

/** Recording(s) for a unit: player first, chapters beside it, and a switcher when there are several. */
export function RecordingSection({ unitId, recordings }: { unitId: ID; recordings: Recording[] }) {
  const [params, setParams] = useSearchParams();
  const ready = recordings.filter((r) => r.status === "ready").sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
  const pending = recordings.filter((r) => r.status === "pending");
  const failed = recordings.filter((r) => r.status === "failed");
  const waiting = [...pending, ...failed];
  const requested = params.get("recording");
  const current = ready.find((r) => r.id === requested) ?? ready[0];

  const select = (id: string) => {
    const next = new URLSearchParams(params);
    next.set("recording", id);
    setParams(next, { replace: true });
  };

  if (!current) return waiting.length ? <RecordingStatusCard pending={pending.length} failed={failed.length} /> : null;

  return (
    <section aria-label="Class recording" className="space-y-4">
      <PlayerWithChapters key={current.id} unitId={unitId} rec={current} />
      {(ready.length > 1 || waiting.length > 0) && (
        <Card>
          <div className="flex items-center gap-2 border-b border-neutral-100 px-4 py-3">
            <ListVideo className="size-4 text-primary-500" aria-hidden />
            <h3 className="text-sm font-bold text-tertiary-500">Recordings for this unit ({ready.length})</h3>
          </div>
          <ul className="divide-y divide-neutral-100">
            {ready.map((r, i) => {
              const on = r.id === current.id;
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => select(r.id)}
                    aria-current={on ? "true" : undefined}
                    className={cn("flex w-full items-center gap-3 px-4 py-3 text-left", on ? "bg-primary-50/60" : "hover:bg-neutral-50")}
                  >
                    <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold", on ? "bg-primary-500 text-white" : "bg-neutral-100 text-neutral-500")}>
                      {on ? <PlayCircle className="size-4" /> : i + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cn("block truncate text-sm", on ? "font-bold text-primary-600" : "font-semibold text-tertiary-500")}>{r.title}</span>
                      <span className="block text-xs text-neutral-500">
                        {fmtDate(r.recordedAt, { weekday: "short", day: "numeric", month: "short" })} · {fmtDuration(r.durationSeconds)}
                        {r.source === "lecturer_upload" ? " · uploaded by lecturer" : ""}
                      </span>
                    </span>
                    {on && <Badge tone="green">Now playing</Badge>}
                  </button>
                </li>
              );
            })}
            {waiting.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-4 py-3 text-sm text-neutral-500">
                {r.status === "failed" ? <AlertCircle className="size-4 shrink-0 text-neutral-400" aria-hidden /> : <Hourglass className="size-4 shrink-0 text-warning" aria-hidden />}
                <span className="min-w-0 flex-1 truncate">{r.title}</span>
                {r.status === "failed" ? <Badge tone="neutral">Not available yet</Badge> : <Badge tone="amber">Coming soon</Badge>}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </section>
  );
}

/** Shown when a unit's recording(s) aren't playable yet. The file streams straight from OneDrive once Teams saves it. */
export function RecordingStatusCard({ pending, failed }: { pending: number; failed: number }) {
  const isPending = pending > 0;
  return (
    <Card role="status" className="flex flex-col items-center gap-3 bg-tertiary-500 px-6 py-10 text-center text-white sm:aspect-[21/9] sm:justify-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-white/10">
        {isPending ? <Hourglass className="size-6 text-secondary-400" aria-hidden /> : <AlertCircle className="size-6 text-secondary-400" aria-hidden />}
      </span>
      <p className="font-headline text-lg font-extrabold">{isPending ? "Recording coming soon" : "Recording not available yet"}</p>
      <p className="max-w-md text-sm text-white/75">
        {isPending
          ? "This class recording will appear here shortly after Teams saves it. You'll get a notification when it's ready — meanwhile, the course text is below."
          : "This recording isn't available yet — your lecturer has been notified. Meanwhile, the course text is below."}
      </p>
      {isPending && failed > 0 && <p className="max-w-md text-xs text-white/60">{failed === 1 ? "Another recording for this unit isn't" : `${failed} other recordings for this unit aren't`} available yet — your lecturer has been notified.</p>}
    </Card>
  );
}

function PlayerWithChapters({ unitId, rec }: { unitId: ID; rec: Recording }) {
  const prefs = usePreferences();
  const qc = useQueryClient();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [time, setTime] = useState(0);
  const lastProgressSave = useRef(0);

  const pos = useQuery({
    queryKey: ["recordings", rec.id, "position"],
    queryFn: () => api.recordings.position(rec.id),
    staleTime: 0,
    retry: false,
  });

  // Track current time for chapter highlighting.
  useEffect(() => {
    const v = wrapRef.current?.querySelector("video");
    if (!v) return;
    const h = () => setTime(v.currentTime);
    v.addEventListener("timeupdate", h);
    return () => v.removeEventListener("timeupdate", h);
  }, [pos.isPending]);

  const onProgress = useCallback(
    (position: number, duration: number) => {
      void api.recordings.savePosition(rec.id, position).catch(() => undefined);
      qc.setQueryData(["recordings", rec.id, "position"], { recordingId: rec.id, positionSeconds: position, updatedAt: new Date().toISOString() });
      const now = Date.now();
      if (now - lastProgressSave.current > 30_000 || (duration && position >= duration - 5)) {
        lastProgressSave.current = now;
        void api.content.saveProgress(unitId, { watchedSeconds: position }).catch(() => undefined);
      }
    },
    [rec.id, unitId, qc],
  );

  /** Short-lived OneDrive link, re-requested by the player whenever it expires. */
  const resolveSource = useCallback(
    () => api.recordings.playback(rec.id).then((l) => ({ url: l.url, expiresAt: l.expiresAt })),
    [rec.id],
  );

  /** VideoPlayer has no imperative seek API; drive the underlying <video> element directly. */
  const seek = (t: number) => {
    const v = wrapRef.current?.querySelector("video");
    if (!v) return;
    v.currentTime = t;
    if (v.paused) void v.play().catch(() => undefined);
    v.closest<HTMLElement>("[tabindex]")?.focus();
  };

  let startAt = pos.data?.positionSeconds ?? 0;
  if (rec.durationSeconds && startAt >= rec.durationSeconds - 10) startAt = 0;
  const currentChapter = [...rec.chapters].sort((a, b) => a.startSeconds - b.startSeconds).reverse().find((c) => c.startSeconds <= time);

  return (
    <div className={cn("grid gap-4", rec.chapters.length > 0 && "lg:grid-cols-[minmax(0,1fr)_280px]")}>
      <div className="min-w-0">
        <div ref={wrapRef}>
          {pos.isPending ? (
            <Skeleton className="aspect-video w-full rounded-xl bg-tertiary-500/80" />
          ) : (
            <VideoPlayer
              resolveSource={resolveSource}
              poster={prefs.lowDataMode ? undefined : rec.posterUrl}
              title={rec.title}
              chapters={rec.chapters}
              startAt={startAt}
              initialSpeed={prefs.playbackSpeed}
              preload={prefs.lowDataMode ? "none" : "metadata"}
              onProgress={onProgress}
            />
          )}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
          <h2 className="min-w-0 flex-1 font-headline text-base font-bold text-tertiary-500">{rec.title}</h2>
          <span className="text-xs text-neutral-500">
            {fmtDate(rec.recordedAt, { weekday: "short", day: "numeric", month: "short", year: "numeric" })} · {fmtDuration(rec.durationSeconds)}
          </span>
          {startAt > 0 && !pos.isPending && <Badge tone="neutral">Resuming at {fmtDuration(startAt)}</Badge>}
        </div>
        {prefs.lowDataMode && (
          <p className="mt-2 flex items-start gap-1.5 text-xs text-neutral-500">
            <Wifi className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            Class videos stream at full quality and use a lot of data — use Wi-Fi where you can.
          </p>
        )}
      </div>

      {rec.chapters.length > 0 && (
        <Card className="h-fit overflow-hidden">
          <p className="border-b border-neutral-100 px-4 py-3 text-sm font-bold text-tertiary-500">Chapters</p>
          <ol className="max-h-[360px] overflow-y-auto py-1">
            {[...rec.chapters]
              .sort((a, b) => a.startSeconds - b.startSeconds)
              .map((c) => {
                const on = currentChapter?.id === c.id;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => seek(c.startSeconds)}
                      aria-current={on ? "true" : undefined}
                      className={cn("flex w-full items-start gap-3 px-4 py-2 text-left text-sm", on ? "bg-primary-50 font-semibold text-primary-600" : "text-neutral-700 hover:bg-neutral-50")}
                    >
                      <span className="w-12 shrink-0 font-mono text-xs text-neutral-500 tabular-nums">{fmtDuration(c.startSeconds)}</span>
                      <span className="min-w-0 flex-1">{c.title}</span>
                    </button>
                  </li>
                );
              })}
          </ol>
        </Card>
      )}
    </div>
  );
}
