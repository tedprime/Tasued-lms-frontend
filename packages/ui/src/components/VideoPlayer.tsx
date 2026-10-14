import { useEffect, useRef, useState, useCallback } from "react";
import Hls from "hls.js";
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, RotateCcw, RotateCw, Settings, ListVideo } from "lucide-react";
import { cn } from "../lib/cn";

export interface PlayerChapter {
  id: string;
  title: string;
  startSeconds: number;
}

export interface PlayerSource {
  url: string;
  /** When the link stops working (OneDrive pre-authenticated links last minutes). */
  expiresAt?: string;
}

export interface VideoPlayerProps {
  /** A fixed URL (MP4 or HLS). Use `resolveSource` instead for expiring OneDrive links. */
  src?: string;
  /** Fetches a fresh playback link. Called on load and again whenever the current link fails or expires. */
  resolveSource?: () => Promise<PlayerSource>;
  poster?: string;
  title?: string;
  chapters?: PlayerChapter[];
  /** Resume from here (seconds). */
  startAt?: number;
  initialSpeed?: number;
  /** "none" downloads nothing until the student presses play (low-data mode). */
  preload?: "none" | "metadata";
  /** Called about every 10 s and on pause/end with the current position. */
  onProgress?: (positionSeconds: number, durationSeconds: number) => void;
  onEnded?: () => void;
  className?: string;
}

const SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2];

function fmt(t: number) {
  if (!Number.isFinite(t)) return "0:00";
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = Math.floor(t % 60);
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Player for Teams recordings streamed from OneDrive (progressive MP4 with range requests),
 * with resume, speed and chapters. When the short-lived link expires mid-playback the player
 * fetches a new one and continues from the same position. HLS sources also work (hls.js).
 */
export function VideoPlayer({ src: fixedSrc, resolveSource, poster, title, chapters = [], startAt = 0, initialSpeed = 1, preload = "metadata", onProgress, onEnded, className }: VideoPlayerProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const lastReport = useRef(0);

  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [speed, setSpeed] = useState(initialSpeed);
  const [levels, setLevels] = useState<{ index: number; height: number }[]>([]);
  const [level, setLevel] = useState<number>(-1); // -1 auto
  const [menu, setMenu] = useState<null | "settings" | "chapters">(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [src, setSrc] = useState<string | null>(fixedSrc ?? null);
  const [resumeAt, setResumeAt] = useState(startAt);
  const resumePlaying = useRef(false);
  const refreshes = useRef(0);

  // Resolve the first playback link
  useEffect(() => {
    if (fixedSrc) { setSrc(fixedSrc); return; }
    if (!resolveSource) return;
    let cancelled = false;
    resolveSource()
      .then((s) => { if (!cancelled) setSrc(s.url); })
      .catch(() => { if (!cancelled) setError("This recording couldn't be loaded. Check your connection and try again."); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fixedSrc]);

  /** Link expired or failed: get a new one and continue from the same second. */
  const refreshLink = useCallback(async () => {
    const v = videoRef.current;
    if (!resolveSource || refreshes.current >= 3) {
      setError("This recording couldn't be played. Check your connection and try again.");
      return;
    }
    refreshes.current += 1;
    resumePlaying.current = !!v && !v.paused;
    setResumeAt(v?.currentTime ?? 0);
    try {
      const next = await resolveSource();
      setError(null);
      setSrc(next.url);
    } catch {
      setError("This recording couldn't be played. Check your connection and try again.");
    }
  }, [resolveSource]);
  const [showControls, setShowControls] = useState(true);
  const hideTimer = useRef<number | undefined>(undefined);

  // Attach source
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;
    setError(null);

    if (Hls.isSupported() && src.includes(".m3u8")) {
      const hls = new Hls({ startPosition: resumeAt > 0 ? resumeAt : -1, capLevelToPlayerSize: true });
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, (_e, data) => {
        setLevels(data.levels.map((l, index) => ({ index, height: l.height })));
        setLevel(-1);
      });
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (data.fatal) setError("This recording couldn't be played. Check your connection and try again.");
      });
      return () => {
        hls.destroy();
        hlsRef.current = null;
      };
    }
    // Progressive MP4 from OneDrive (or native HLS on Safari)
    video.src = src;
    const onMeta = () => {
      if (resumeAt > 0) video.currentTime = resumeAt;
      if (resumePlaying.current) { resumePlaying.current = false; void video.play(); }
    };
    video.addEventListener("loadedmetadata", onMeta, { once: true });
    return () => video.removeEventListener("loadedmetadata", onMeta);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  // Browsers reset playbackRate to defaultPlaybackRate whenever a source loads (first link, renewed link),
  // so set both and re-apply on every load — otherwise the saved speed falls back to 1×.
  const applySpeed = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.defaultPlaybackRate = speed;
    v.playbackRate = speed;
  }, [speed]);
  useEffect(() => { applySpeed(); }, [applySpeed]);
  useEffect(() => { setSpeed(initialSpeed); }, [initialSpeed]);

  useEffect(() => {
    const onFs = () => setFullscreen(document.fullscreenElement === wrapRef.current);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const report = useCallback(
    (force = false) => {
      const v = videoRef.current;
      if (!v || !onProgress) return;
      const now = Date.now();
      if (force || now - lastReport.current > 10_000) {
        lastReport.current = now;
        onProgress(Math.floor(v.currentTime), Math.floor(v.duration || 0));
      }
    },
    [onProgress],
  );

  const toggle = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) void v.play();
    else v.pause();
  };
  const seek = (t: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(t, v.duration || t));
  };
  const nudge = () => {
    setShowControls(true);
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => playing && setShowControls(false), 2800);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === " " || e.key === "k") { e.preventDefault(); toggle(); }
    if (e.key === "ArrowRight") seek(time + 10);
    if (e.key === "ArrowLeft") seek(time - 10);
    if (e.key === "m") setMuted((m) => !m);
    if (e.key === "f") void toggleFs();
  };

  const toggleFs = async () => {
    if (!wrapRef.current) return;
    if (document.fullscreenElement) await document.exitFullscreen();
    else await wrapRef.current.requestFullscreen().catch(() => undefined);
  };

  const currentChapter = [...chapters].reverse().find((c) => c.startSeconds <= time);
  const pct = duration ? (time / duration) * 100 : 0;

  return (
    <div
      ref={wrapRef}
      tabIndex={0}
      onKeyDown={onKey}
      onMouseMove={nudge}
      onMouseLeave={() => playing && setShowControls(false)}
      className={cn("group relative aspect-video w-full overflow-hidden rounded-xl bg-black outline-none focus-visible:ring-2 focus-visible:ring-primary-500", fullscreen && "rounded-none", className)}
      aria-label={title ? `Video player: ${title}` : "Video player"}
    >
      <video
        ref={videoRef}
        poster={poster}
        muted={muted}
        playsInline
        preload={preload}
        onLoadedMetadata={applySpeed}
        className="size-full object-contain"
        onClick={toggle}
        onPlay={() => { setPlaying(true); nudge(); }}
        onPlaying={() => { refreshes.current = 0; }}
        onPause={() => { setPlaying(false); setShowControls(true); report(true); }}
        onEnded={() => { report(true); onEnded?.(); }}
        onTimeUpdate={(e) => {
          const v = e.currentTarget;
          setTime(v.currentTime);
          if (v.buffered.length) setBuffered(v.buffered.end(v.buffered.length - 1));
          report();
        }}
        onDurationChange={(e) => setDuration(e.currentTarget.duration)}
        onError={() => void refreshLink()}
      />

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-6 text-center text-sm text-white">{error}</div>
      )}

      {!playing && !error && (
        <button type="button" onClick={toggle} aria-label="Play" className="absolute inset-0 m-auto flex size-16 items-center justify-center rounded-full bg-primary-500/90 text-white shadow-cta transition-transform hover:scale-105">
          <Play className="ml-1 size-7" fill="currentColor" />
        </button>
      )}

      {/* Controls */}
      <div className={cn("absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-3 pt-10 pb-2 text-white transition-opacity", showControls || !playing ? "opacity-100" : "opacity-0")}>
        {/* Scrubber */}
        <div className="group/bar relative mb-2 h-1.5 cursor-pointer rounded-full bg-white/25"
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            seek(((e.clientX - r.left) / r.width) * duration);
          }}
        >
          <div className="absolute inset-y-0 left-0 rounded-full bg-white/35" style={{ width: `${duration ? (buffered / duration) * 100 : 0}%` }} />
          <div className="absolute inset-y-0 left-0 rounded-full bg-secondary-400" style={{ width: `${pct}%` }} />
          {chapters.map((c) => (
            <span key={c.id} title={c.title} className="absolute top-0 h-full w-0.5 bg-black/60" style={{ left: `${duration ? (c.startSeconds / duration) * 100 : 0}%` }} />
          ))}
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={1}
            value={time}
            onChange={(e) => seek(Number(e.target.value))}
            aria-label="Seek"
            className="absolute inset-0 w-full cursor-pointer opacity-0"
          />
        </div>

        <div className="flex items-center gap-1 text-sm">
          <button type="button" onClick={toggle} aria-label={playing ? "Pause" : "Play"} className="rounded p-1.5 hover:bg-white/15">
            {playing ? <Pause className="size-5" fill="currentColor" /> : <Play className="size-5" fill="currentColor" />}
          </button>
          <button type="button" onClick={() => seek(time - 10)} aria-label="Back 10 seconds" className="rounded p-1.5 hover:bg-white/15"><RotateCcw className="size-4.5" /></button>
          <button type="button" onClick={() => seek(time + 10)} aria-label="Forward 10 seconds" className="rounded p-1.5 hover:bg-white/15"><RotateCw className="size-4.5" /></button>
          <button type="button" onClick={() => setMuted((m) => !m)} aria-label={muted ? "Unmute" : "Mute"} className="rounded p-1.5 hover:bg-white/15">
            {muted ? <VolumeX className="size-4.5" /> : <Volume2 className="size-4.5" />}
          </button>
          <span className="ml-1 tabular-nums text-xs text-white/90">{fmt(time)} / {fmt(duration)}</span>
          {currentChapter && <span className="ml-2 hidden truncate text-xs text-white/70 sm:inline">· {currentChapter.title}</span>}

          <div className="ml-auto flex items-center gap-1">
            {chapters.length > 0 && (
              <button type="button" onClick={() => setMenu(menu === "chapters" ? null : "chapters")} aria-label="Chapters" className="rounded p-1.5 hover:bg-white/15"><ListVideo className="size-4.5" /></button>
            )}
            <button type="button" onClick={() => setMenu(menu === "settings" ? null : "settings")} aria-label="Settings" className="flex items-center gap-1 rounded p-1.5 hover:bg-white/15">
              <Settings className="size-4.5" />
              <span className="text-[11px] font-semibold">{speed !== 1 ? `${speed}×` : ""}</span>
            </button>
            <button type="button" onClick={() => void toggleFs()} aria-label="Full screen" className="rounded p-1.5 hover:bg-white/15">
              {fullscreen ? <Minimize className="size-4.5" /> : <Maximize className="size-4.5" />}
            </button>
          </div>
        </div>
      </div>

      {menu === "settings" && (
        <div className="absolute right-3 bottom-14 w-56 rounded-xl bg-black/90 p-3 text-xs text-white shadow-pop">
          <p className="mb-1.5 font-semibold text-white/60 uppercase">Speed</p>
          <div className="mb-3 grid grid-cols-3 gap-1">
            {SPEEDS.map((s) => (
              <button key={s} type="button" onClick={() => setSpeed(s)} className={cn("rounded px-2 py-1", s === speed ? "bg-primary-500" : "bg-white/10 hover:bg-white/20")}>{s}×</button>
            ))}
          </div>
          {levels.length > 0 && (
            <>
              <p className="mb-1.5 font-semibold text-white/60 uppercase">Quality</p>
              <div className="grid grid-cols-3 gap-1">
                <button type="button" onClick={() => { if (hlsRef.current) hlsRef.current.currentLevel = -1; setLevel(-1); }} className={cn("rounded px-2 py-1", level === -1 ? "bg-primary-500" : "bg-white/10 hover:bg-white/20")}>Auto</button>
                {levels.map((l) => (
                  <button key={l.index} type="button" onClick={() => { if (hlsRef.current) hlsRef.current.currentLevel = l.index; setLevel(l.index); }} className={cn("rounded px-2 py-1", level === l.index ? "bg-primary-500" : "bg-white/10 hover:bg-white/20")}>{l.height}p</button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {menu === "chapters" && (
        <div className="absolute right-3 bottom-14 max-h-64 w-64 overflow-y-auto rounded-xl bg-black/90 py-2 text-sm text-white shadow-pop">
          {chapters.map((c) => (
            <button key={c.id} type="button" onClick={() => { seek(c.startSeconds); setMenu(null); }} className={cn("flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-white/10", currentChapter?.id === c.id && "text-secondary-300")}>
              <span className="w-12 shrink-0 tabular-nums text-xs text-white/60">{fmt(c.startSeconds)}</span>
              <span className="truncate">{c.title}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
