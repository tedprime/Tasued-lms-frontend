import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { BookOpenText, Target, Paperclip, Play } from "lucide-react";
import { api, portalUrl, fmtBytes, type Attachment, type ID, type Unit, type UnitProgress } from "@tasued/api-client";
import { VideoPlayer } from "../../lib/video-player";
import { Button, Card, Modal, Progress, RichContent } from "@tasued/ui";
import { usePreferences } from "../../app/session";
import { AttachmentList } from "../../components/bits";

const isVideoAttachment = (a: Attachment) =>
  ['video/mp4', 'video/webm'].includes(a.mimeType.toLowerCase().split(';')[0].trim()) || /\.(mp4|webm)$/i.test(a.name);

/**
 * Course text (manual reading) with scroll-based reading progress.
 * Progress only ever increases and is saved at most every few seconds, plus on leave.
 */
export function CourseText({ unit, courseId, initialPercent }: { unit: Unit; courseId: ID; initialPercent: number }) {
  const prefs = usePreferences();
  const [playingId, setPlayingId] = useState<string | null>(null);
  const closeVideo = useCallback(() => setPlayingId(null), []);
  const playingVideo = unit.attachments.find(a => a.id === playingId && isVideoAttachment(a) && ['clean', 'skipped'].includes(a.scanStatus));
  useEffect(() => { setPlayingId(null); }, [unit.id]);
  const ref = useRef<HTMLElement>(null);
  const [pct, setPct] = useState(initialPercent);
  const maxRef = useRef(initialPercent);
  const savedRef = useRef(initialPercent);
  const lastSaveAt = useRef(0);
  const qc = useQueryClient();

  useEffect(() => {
    const save = (force = false) => {
      const v = Math.round(maxRef.current);
      if (v <= savedRef.current) return;
      const now = Date.now();
      if (!force && now - lastSaveAt.current < 4000 && v < 100) return;
      lastSaveAt.current = now;
      savedRef.current = v;
      void api.content
        .saveProgress(unit.id, { readPercent: v })
        .then((p) => {
          qc.setQueryData<UnitProgress[]>(["courses", courseId, "progress"], (list) => {
            if (!list) return list;
            const rest = list.filter((x) => x.unitId !== unit.id);
            return [...rest, p];
          });
        })
        .catch(() => {
          savedRef.current = Math.min(savedRef.current, v - 1);
        });
    };

    let raf = 0;
    const measure = () => {
      raf = 0;
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      // Fraction of the text whose bottom edge has scrolled into view.
      const seen = r.height <= 0 ? 1 : (vh - r.top) / r.height;
      const v = Math.max(0, Math.min(100, seen * 100));
      if (v > maxRef.current) {
        maxRef.current = v;
        setPct(v);
        save();
      }
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    const interval = setInterval(() => save(true), 15_000);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      clearInterval(interval);
      if (raf) cancelAnimationFrame(raf);
      save(true);
    };
  }, [unit.id, courseId, qc]);

  return (
    <section aria-labelledby="course-text-h">
      <Card className="overflow-clip">
        <div className="sticky top-16 z-10 border-b border-neutral-100 bg-white/95 px-5 py-3 backdrop-blur sm:px-7">
          <div className="flex items-center gap-3">
            <BookOpenText className="size-4.5 shrink-0 text-primary-500" aria-hidden />
            <h2 id="course-text-h" className="flex-1 font-headline text-base font-extrabold text-tertiary-500">Course text</h2>
            <span className="text-xs text-neutral-500">{unit.estimatedReadMinutes} min read · {Math.round(pct)}% read</span>
          </div>
          <Progress value={pct} className="mt-2 h-1" label="Reading progress" />
        </div>
        <div className="px-5 py-6 sm:px-7">
          {unit.objectives.length > 0 && (
            <div className="mb-6 rounded-xl border border-secondary-200 bg-secondary-50/60 p-4">
              <p className="mb-2 flex items-center gap-2 text-sm font-bold text-tertiary-500"><Target className="size-4 text-secondary-700" /> Learning objectives</p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-neutral-700">
                {unit.objectives.map((o, i) => <li key={i}>{o}</li>)}
              </ul>
            </div>
          )}
          <article ref={ref}>
            {unit.courseTextHtml ? (
              <RichContent html={unit.courseTextHtml} deferImages={prefs.lowDataMode} />
            ) : (
              <p className="text-sm text-neutral-500">Course text for this unit hasn't been added yet.</p>
            )}
          </article>
          {unit.attachments.length > 0 && (
            <div className="mt-8">
              <p className="mb-2 flex items-center gap-2 text-sm font-bold text-tertiary-500"><Paperclip className="size-4" /> Unit resources</p>
              <div className="space-y-4">
                {unit.attachments.filter(isVideoAttachment).map(a => (
                  <div key={a.id} className="flex min-w-0 flex-wrap items-center gap-3 rounded-xl border border-neutral-200 p-4">
                    <Play className="size-5 shrink-0 text-primary-500" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-sm font-semibold">{a.name}</p>
                      <p className="text-xs text-neutral-500">Video - {fmtBytes(a.sizeBytes)}</p>
                    </div>
                    {['clean', 'skipped'].includes(a.scanStatus)
                      ? <Button size="sm" variant="outline" onClick={() => setPlayingId(a.id)} aria-label={`Watch ${a.name}`}><Play className="size-4" aria-hidden /> Watch video</Button>
                      : <p className="text-sm text-neutral-500">This video is not available for playback yet.</p>}
                  </div>
                ))}
                <AttachmentList items={unit.attachments.filter(a => !isVideoAttachment(a))} />
              </div>
            </div>
          )}
        </div>
      </Card>
      <Modal open={!!playingVideo} onClose={closeVideo} title={<span className="break-all">{playingVideo?.name || 'Watch video'}</span>} size="xl">
        {playingVideo && <VideoPlayer key={playingVideo.id} src={portalUrl(playingVideo.url)} title={playingVideo.name} preload="metadata" restrictDownload />}
      </Modal>
    </section>
  );
}
