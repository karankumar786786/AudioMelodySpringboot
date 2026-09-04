"use client";

import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  type FC,
} from "react";
import { X, Play, Pause, Volume2, VolumeX, Maximize2, Minimize2, ChevronDown } from "lucide-react";

import { playerStore, playerActions } from "@/store/player.store";
import { PlayerTooltip } from "./player/PlayerTooltip";

interface FullVideoModalProps {
  /** Shaka-packaged HLS URL e.g. https://…/videos/<songId>/master.m3u8 */
  hlsUrl: string;
  dashUrl?: string;
  title: string;
  artistName: string;
  posterUrl?: string;
  songId?: string;
  /** Audio player's current time to sync on open */
  initialTime?: number;
  onClose: (finalTime?: number) => void;
}

interface QualityLevel {
  label: string;
  bandwidth: number;
  height: number;
}

// Use any to avoid shaka-player compiled type namespace mismatches
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let shakaCache: any = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadShaka(): Promise<any> {
  if (shakaCache) return shakaCache;
  // shaka-player uses a UMD/namespace build; import as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mod = await import("shaka-player" as any);
  shakaCache = mod.default ?? mod;
  return shakaCache;
}

export const FullVideoModal: FC<FullVideoModalProps> = ({
  hlsUrl,
  dashUrl,
  title,
  artistName,
  posterUrl,
  songId,
  initialTime,
  onClose,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Determine if this full video is for the currently active song in the audio player
  const isCurrentSong = songId
    ? playerStore.state.currentSong?.id === songId
    : true;

  // Capture the starting time at mount time so Shaka gets a stable value.
  // Priority: explicit initialTime prop > audio player's store currentTime.
  // We read once into a ref so the Shaka useEffect dep doesn't change on every time update.
  const startTimeRef = useRef<number>(
    typeof initialTime === "number" && initialTime >= 0
      ? initialTime
      : isCurrentSong
        ? playerStore.state.currentTime || 0
        : 0,
  );

  // Track whether audio was playing when modal opened so we can resume on close
  const wasAudioPlayingRef = useRef<boolean>(false);

  // Pause audio immediately on mount to prevent double audio
  useEffect(() => {
    if (playerStore.state.isPlaying) {
      wasAudioPlayingRef.current = true;
      playerActions.setIsPlaying(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(startTimeRef.current);
  const [duration, setDuration] = useState(0);
  const [bufferedTime, setBufferedTime] = useState(0);
  const [qualityLevels, setQualityLevels] = useState<QualityLevel[]>([]);
  const [selectedQuality, setSelectedQuality] = useState<number>(-1);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  // Controls overlay visibility — separate from the always-visible close button
  const [showControls, setShowControls] = useState(true);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync fullscreen state
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement || (document as any).webkitFullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
    };
  }, []);

  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = setTimeout(() => setShowControls(false), 3000);
  }, []);

  /* ─── Shaka Player init ─── */
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let destroyed = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let player: any;

    (async () => {
      try {
        const shaka = await loadShaka();
        if (shaka.polyfill?.installAll) shaka.polyfill.installAll();

        if (shaka.Player?.isBrowserSupported && !shaka.Player.isBrowserSupported()) {
          setError("Your browser does not support adaptive streaming.");
          setIsLoading(false);
          return;
        }

        player = new shaka.Player();
        await player.attach(video);
        playerRef.current = player;

        player.configure({ streaming: { bufferingGoal: 30, rebufferingGoal: 2 } });

        player.addEventListener("error", (e: Event) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const detail = (e as any).detail;
          if (!destroyed) setError(`Playback error: ${detail?.message ?? "Unknown"}`);
        });

        player.addEventListener("buffering", (e: Event) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if (!destroyed) setIsLoading((e as any).buffering);
        });

        const manifestUrl = dashUrl || hlsUrl;
        // Pass the captured start time to Shaka so it can start buffering at the right position immediately
        const startTime = startTimeRef.current;
        await player.load(manifestUrl, startTime > 0 ? startTime : 0);

        if (destroyed) return;

        // Belt-and-suspenders: also set it on the video element after load
        if (startTime > 0) {
          video.currentTime = startTime;
          setCurrentTime(startTime);
        }

        // Extract quality levels from variant tracks
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tracks: any[] = player.getVariantTracks?.() ?? [];
        const seen = new Set<number>();
        const levels: QualityLevel[] = [];
        tracks.forEach((t) => {
          const h: number = t.height ?? 0;
          if (h > 0 && !seen.has(h)) {
            seen.add(h);
            levels.push({ label: `${h}p`, bandwidth: t.bandwidth, height: h });
          }
        });
        levels.sort((a, b) => b.height - a.height);
        setQualityLevels(levels);
        setIsLoading(false);

        try {
          await video.play();
          setIsPlaying(true);
        } catch { /* autoplay blocked */ }
      } catch (err: unknown) {
        if (!destroyed) {
          setError((err as Error)?.message ?? "Failed to load video");
          setIsLoading(false);
        }
      }
    })();

    return () => {
      destroyed = true;
      if (player) player.destroy?.();
      playerRef.current = null;
    };
    // Only re-init when the URL changes, not on time changes
  }, [hlsUrl, dashUrl]);

  /* ─── Video events ─── */
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const updateBuffer = () => {
      if (!video) return;
      if (video.buffered && video.buffered.length > 0) {
        for (let i = 0; i < video.buffered.length; i++) {
          if (video.buffered.start(i) <= video.currentTime && video.currentTime <= video.buffered.end(i)) {
            setBufferedTime(video.buffered.end(i));
            return;
          }
        }
        setBufferedTime(video.buffered.end(video.buffered.length - 1));
      }
    };

    const onTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      updateBuffer();
    };
    const onDurationChange = () => {
      setDuration(video.duration || 0);
      updateBuffer();
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("progress", updateBuffer);
    video.addEventListener("seeking", updateBuffer);
    video.addEventListener("seeked", updateBuffer);
    video.addEventListener("durationchange", onDurationChange);
    video.addEventListener("loadedmetadata", updateBuffer);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);

    return () => {
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("progress", updateBuffer);
      video.removeEventListener("seeking", updateBuffer);
      video.removeEventListener("seeked", updateBuffer);
      video.removeEventListener("durationchange", onDurationChange);
      video.removeEventListener("loadedmetadata", updateBuffer);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
    };
  }, []);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  }, []);

  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setIsMuted(v.muted);
  }, []);

  // Seamless Close: sync the video's stop time back to the audio player and resume playback
  const handleClose = useCallback(() => {
    const finalTime = videoRef.current?.currentTime ?? currentTime;
    if (isCurrentSong && typeof finalTime === "number" && isFinite(finalTime)) {
      playerActions.seek(finalTime);
      if (wasAudioPlayingRef.current || isPlaying) {
        playerActions.setIsPlaying(true);
      }
    }
    onClose(finalTime);
  }, [currentTime, isCurrentSong, isPlaying, onClose]);

  /* ─── Quality switching ─── */
  const applyQuality = (height: number) => {
    const player = playerRef.current;
    if (!player) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tracks: any[] = player.getVariantTracks?.() ?? [];
    if (height === -1) {
      player.configure?.({ abr: { enabled: true } });
    } else {
      player.configure?.({ abr: { enabled: false } });
      const best = tracks
        .filter((t) => (t.height ?? 0) === height)
        .sort((a, b) => b.bandwidth - a.bandwidth)[0];
      if (best) player.selectVariantTrack?.(best, true);
    }
    setSelectedQuality(height);
    setShowQualityMenu(false);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Number(e.target.value);
    setCurrentTime(v.currentTime);
  };

  const toggleFullscreen = useCallback(() => {
    const isCurrentlyFullscreen = Boolean(
      document.fullscreenElement || (document as any).webkitFullscreenElement,
    );
    if (!isCurrentlyFullscreen) {
      const el = containerRef.current as HTMLElement | null;
      if (!el) return;
      if (el.requestFullscreen) {
        el.requestFullscreen().catch(() => {});
      } else if ((el as any).webkitRequestFullscreen) {
        (el as any).webkitRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      }
    }
  }, []);

  /* ─── Keyboard shortcuts ─── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      if (e.key === "Escape") {
        const inFullscreen = Boolean(
          document.fullscreenElement || (document as any).webkitFullscreenElement,
        );
        if (!inFullscreen) {
          handleClose();
        }
      }
      if (e.key === "v" || e.key === "V") {
        e.preventDefault();
        handleClose();
      }
      if (e.key === " " || e.key === "k" || e.key === "K") {
        e.preventDefault();
        togglePlay();
      }
      if (e.key === "m" || e.key === "M") {
        e.preventDefault();
        toggleMute();
      }
      if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        toggleFullscreen();
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        const v = videoRef.current;
        if (v) {
          v.currentTime = Math.max(0, v.currentTime - 5);
          setCurrentTime(v.currentTime);
        }
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        const v = videoRef.current;
        if (v) {
          const maxDur = v.duration || duration || 0;
          v.currentTime = maxDur > 0 ? Math.min(maxDur, v.currentTime + 5) : v.currentTime + 5;
          setCurrentTime(v.currentTime);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleClose, togglePlay, toggleMute, toggleFullscreen, duration]);

  const fmt = (s: number) => {
    if (!s || isNaN(s) || !isFinite(s) || s < 0) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const safeCurrentTime = Math.max(0, isFinite(currentTime) ? currentTime : 0);
  const safeDuration = Math.max(0, isFinite(duration) ? duration : 0);
  const progressPct =
    safeDuration > 0
      ? Math.min(100, Math.max(0, (safeCurrentTime / safeDuration) * 100))
      : 0;
  const bufferedPct =
    safeDuration > 0
      ? Math.min(100, Math.max(0, (bufferedTime / safeDuration) * 100))
      : 0;

  const qualityLabel = selectedQuality === -1 ? "Auto" : `${selectedQuality}p`;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-md"
      style={{ animation: "fullVideoFadeIn 0.2s ease" }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <style>{`@keyframes fullVideoFadeIn { from { opacity: 0 } to { opacity: 1 } }`}</style>

      <div
        ref={containerRef}
        className="relative w-full max-w-5xl mx-4"
        style={{ aspectRatio: "16/9" }}
        onMouseMove={resetControlsTimer}
        onMouseEnter={resetControlsTimer}
        onClick={togglePlay}
      >
        {/* Close button — hidden when in fullscreen */}
        {!isFullscreen && (
          <div className="absolute top-3 right-3 z-[220]">
            <PlayerTooltip content="Close" shortcut={["Esc", "V"]} side="bottom" align="end">
              <button
                onClick={(e) => { e.stopPropagation(); handleClose(); }}
                className="p-2 rounded-full bg-black/70 hover:bg-black/90 text-white transition-all cursor-pointer border border-white/20 backdrop-blur-sm"
                aria-label="Close full video"
              >
                <X size={18} />
              </button>
            </PlayerTooltip>
          </div>
        )}
        <div className="absolute inset-0 bg-black rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10" />

        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-contain rounded-2xl"
          poster={posterUrl}
          playsInline
        />

        {isLoading && !error && (
          <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/50 pointer-events-none">
            <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/80">
            <div className="text-center px-8">
              <p className="text-red-400 font-bold text-lg mb-2">Playback Error</p>
              <p className="text-zinc-400 text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Controls overlay */}
        <div
          className="absolute inset-0 flex flex-col justify-between rounded-2xl overflow-hidden"
          style={{
            opacity: showControls ? 1 : 0,
            transition: "opacity 0.3s ease",
            pointerEvents: showControls ? "auto" : "none",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Top: title */}
          <div
            className="flex items-center justify-between p-4 rounded-t-2xl"
            style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.85), transparent)" }}
          >
            <div className="min-w-0">
              <h2 className="text-white font-bold text-lg leading-tight truncate">{title}</h2>
              <p className="text-zinc-300 text-sm truncate">{artistName}</p>
            </div>
          </div>

          {/* Bottom: progress + controls */}
          <div
            className="p-4 rounded-b-2xl"
            style={{ background: "linear-gradient(to top, rgba(0,0,0,0.95), rgba(0,0,0,0.55), transparent)" }}
          >
            <div className="flex items-center gap-3 mb-3">
              <span className="text-xs text-zinc-300 font-mono w-10 text-right shrink-0 select-none">
                {fmt(safeCurrentTime)}
              </span>

              <div className="relative flex-1 h-5 flex items-center group cursor-pointer select-none">
                {/* Background Track */}
                <div className="absolute inset-x-0 h-1 group-hover:h-1.5 bg-white/20 rounded-full transition-all duration-150" />

                {/* Buffered Loaded Bar */}
                <div
                  className="absolute left-0 h-1 group-hover:h-1.5 bg-white/40 rounded-full pointer-events-none transition-all duration-150"
                  style={{ width: `${bufferedPct}%` }}
                />

                {/* Played Progress Bar */}
                <div
                  className="absolute left-0 h-1 group-hover:h-1.5 bg-white rounded-full pointer-events-none transition-all duration-150"
                  style={{ width: `${progressPct}%` }}
                />

                {/* Scrubber thumb circle */}
                <div
                  className="absolute w-3.5 h-3.5 bg-white rounded-full shadow-md -translate-x-1/2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                  style={{ left: `${progressPct}%` }}
                />

                {/* Native Slider Input */}
                <input
                  type="range"
                  min="0"
                  max={Math.max(1, safeDuration)}
                  step="0.1"
                  value={Math.min(safeCurrentTime, Math.max(1, safeDuration))}
                  onChange={handleSeek}
                  aria-label="Seek video"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 m-0 p-0 border-0 bg-transparent"
                />
              </div>

              <span className="text-xs text-zinc-300 font-mono w-10 shrink-0 select-none">
                {fmt(safeDuration)}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <PlayerTooltip content={isPlaying ? "Pause" : "Play"} shortcut={["Space", "K"]}>
                  <button
                    onClick={togglePlay}
                    className="w-9 h-9 rounded-full bg-white flex items-center justify-center text-black hover:scale-105 transition-transform cursor-pointer"
                    aria-label={isPlaying ? "Pause" : "Play"}
                  >
                    {isPlaying
                      ? <Pause size={18} fill="black" />
                      : <Play size={18} fill="black" style={{ marginLeft: 2 }} />}
                  </button>
                </PlayerTooltip>

                <PlayerTooltip content={isMuted ? "Unmute" : "Mute"} shortcut="M">
                  <button
                    onClick={toggleMute}
                    className="text-zinc-300 hover:text-white transition-colors p-1 cursor-pointer"
                    aria-label={isMuted ? "Unmute" : "Mute"}
                  >
                    {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                  </button>
                </PlayerTooltip>
              </div>

              <div className="flex items-center gap-2">
                {qualityLevels.length > 0 && (
                  <div className="relative">
                    <PlayerTooltip content="Video Quality">
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowQualityMenu((v) => !v); }}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all cursor-pointer"
                      >
                        {qualityLabel}
                        <ChevronDown size={12} />
                      </button>
                    </PlayerTooltip>
                    {showQualityMenu && (
                      <div
                        className="absolute bottom-full mb-2 right-0 bg-zinc-900 border border-zinc-700 rounded-xl overflow-hidden shadow-2xl min-w-[80px] z-20"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {[{ height: -1, label: "Auto" }, ...qualityLevels].map((q) => (
                          <button
                            key={q.height}
                            onClick={() => applyQuality(q.height)}
                            className={`w-full text-left px-3 py-2 text-xs font-bold transition-colors ${
                              selectedQuality === q.height
                                ? "text-white bg-white/15"
                                : "text-zinc-400 hover:text-white hover:bg-white/5"
                            }`}
                          >
                            {q.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <PlayerTooltip content={isFullscreen ? "Exit Fullscreen" : "Fullscreen"} shortcut="F" align="end">
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
                    className="text-zinc-300 hover:text-white transition-colors p-1 cursor-pointer"
                    aria-label={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                  >
                    {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                  </button>
                </PlayerTooltip>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
