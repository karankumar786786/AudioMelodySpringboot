"use client";

import type Hls from "hls.js";
import { Pause, Play } from "lucide-react";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { fmtTime } from "@/components/charts/Charts";

export interface PreviewPlayerHandle {
  seek: (sec: number) => void;
}

/**
 * Plays the song's HLS master with hls.js (Safari plays it natively), with a quality
 * picker: Auto lets hls.js choose, the rest pin one rendition.
 */
export const PreviewPlayer = forwardRef<
  PreviewPlayerHandle,
  { src: string; duration: number; onTime?: (sec: number) => void }
>(function PreviewPlayer({ src, duration, onTime }, ref) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [levels, setLevels] = useState<{ index: number; label: string }[]>([]);
  const [level, setLevel] = useState(-1);
  const [playingLevel, setPlayingLevel] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const loadStarted = useRef(false);
  const ensureLoad = (at = -1) => {
    if (loadStarted.current || !hlsRef.current) return;
    loadStarted.current = true;
    hlsRef.current.startLoad(at);
  };

  useImperativeHandle(ref, () => ({
    seek: (sec: number) => {
      const a = audioRef.current;
      if (!a) return;
      ensureLoad(sec);
      a.currentTime = sec;
      a.play().catch(() => {});
    },
  }));

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !src) return;
    let cancelled = false;
    setError(null);
    (async () => {
      const { default: HlsLib } = await import("hls.js");
      if (cancelled) return;
      if (HlsLib.isSupported()) {
        // Nothing downloads until the admin presses play (or seeks from a chart).
        const hls = new HlsLib({ enableWorker: true, autoStartLoad: false });
        hlsRef.current = hls;
        hls.on(HlsLib.Events.MANIFEST_PARSED, (_e, data) => {
          setLevels(
            data.levels.map((l, index) => ({
              index,
              label:
                l.url?.[0]?.match(/(\d+)kbps/)?.[0] ??
                `${Math.round((l.bitrate || 0) / 1000)}kbps`,
            })),
          );
        });
        hls.on(HlsLib.Events.LEVEL_SWITCHED, (_e, data) => {
          const l = hls.levels[data.level];
          setPlayingLevel(
            l?.url?.[0]?.match(/(\d+)kbps/)?.[0] ??
              `${Math.round((l?.bitrate || 0) / 1000)}kbps`,
          );
        });
        hls.on(HlsLib.Events.ERROR, (_e, data) => {
          if (data.fatal) setError(`${data.type}: ${data.details}`);
        });
        hls.loadSource(src);
        hls.attachMedia(audio);
      } else if (audio.canPlayType("application/vnd.apple.mpegurl")) {
        audio.src = src;
      } else {
        setError("This browser can't play HLS");
      }
    })();
    return () => {
      cancelled = true;
      hlsRef.current?.destroy();
      hlsRef.current = null;
      loadStarted.current = false;
    };
  }, [src]);

  const pickLevel = (idx: number) => {
    setLevel(idx);
    if (hlsRef.current) hlsRef.current.currentLevel = idx;
  };

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/8 bg-zinc-900/60 px-3 py-2">
      {/* biome-ignore lint/a11y/useMediaCaption: music preview, no speech */}
      <audio
        ref={audioRef}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => {
          const t = e.currentTarget.currentTime;
          setTime(t);
          onTime?.(t);
        }}
      />
      <button
        type="button"
        aria-label={playing ? "Pause preview" : "Play preview"}
        onClick={() => {
          const a = audioRef.current;
          if (!a) return;
          ensureLoad();
          if (a.paused) a.play().catch((e) => setError(String(e)));
          else a.pause();
        }}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-black hover:bg-zinc-200"
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </button>
      <span className="tabular-nums text-xs text-zinc-300">
        {fmtTime(time)} / {fmtTime(duration)}
      </span>
      <label className="flex items-center gap-2 text-xs text-zinc-400">
        Quality
        <select
          value={level}
          onChange={(e) => pickLevel(Number(e.target.value))}
          className="rounded-md border border-white/10 bg-zinc-950 px-2 py-1 text-xs text-white"
        >
          <option value={-1}>Auto</option>
          {levels.map((l) => (
            <option key={l.index} value={l.index}>
              {l.label}
            </option>
          ))}
        </select>
      </label>
      {playingLevel && (
        <span className="text-[11px] text-zinc-500">
          playing {playingLevel}
        </span>
      )}
      {error && <span className="text-[11px] text-red-400">{error}</span>}
    </div>
  );
});
