import React, { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useStore } from "@tanstack/react-store";
import { playerStore } from "../../store/player.store";
import { TranscriptionEntry } from "./hooks/useLyrics";

interface PlayerLyricsOverlayProps {
  currentCaption: TranscriptionEntry | null;
  transcriptions?: TranscriptionEntry[];
  localTime: number;
  isLyricsOpen?: boolean;
  onSeek?: (time: number) => void;
}

export const PlayerLyricsOverlay: React.FC<PlayerLyricsOverlayProps> = ({
  currentCaption,
  transcriptions = [],
  localTime,
  isLyricsOpen = false,
  onSeek,
}) => {
  const isPlaying = useStore(playerStore, (s) => s.isPlaying);
  const activeRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Find active line index
  let activeIndex = transcriptions.findIndex(
    (t) => t.start_time_seconds === currentCaption?.start_time_seconds,
  );

  const hasExactActive = activeIndex !== -1;

  if (activeIndex === -1 && transcriptions.length > 0) {
    // Find the last line that has start_time_seconds <= localTime
    activeIndex = transcriptions.reduce((acc, line, idx) => {
      if (line.start_time_seconds <= localTime) {
        return idx;
      }
      return acc;
    }, 0);
  }

  const prevOpenRef = useRef(false);
  const prevActiveIndexRef = useRef(-1);

  // Auto-scroll: keep active lyric line centered in the container
  useEffect(() => {
    if (!isLyricsOpen) {
      prevOpenRef.current = false;
      prevActiveIndexRef.current = -1;
      return;
    }

    const justOpened = !prevOpenRef.current;
    const lineChanged = activeIndex !== prevActiveIndexRef.current;
    prevOpenRef.current = true;
    prevActiveIndexRef.current = activeIndex;

    if (!justOpened && !lineChanged) return;

    /**
     * Delta-based scroll: measures where the active line currently is
     * relative to the container viewport, compares to desired center,
     * and adjusts scrollTop by the difference.
     *
     * This avoids offsetTop/offsetParent issues caused by Framer Motion
     * transforms and nested positioned elements.
     */
    const scrollToCenter = (smooth: boolean) => {
      const container = containerRef.current;
      const activeLine = activeRef.current;
      if (!container || !activeLine) return false;

      const containerRect = container.getBoundingClientRect();
      const lineRect = activeLine.getBoundingClientRect();

      // Current position of line's center relative to container's top
      const lineCenterInContainer =
        lineRect.top - containerRect.top + lineRect.height / 2;

      // Desired position: center of the container's visible area
      const containerCenter = container.clientHeight / 2;

      // Adjust scroll by the difference
      const scrollDelta = lineCenterInContainer - containerCenter;

      if (smooth) {
        container.scrollTo({
          top: container.scrollTop + scrollDelta,
          behavior: "smooth",
        });
      } else {
        container.scrollTop += scrollDelta;
      }
      return true;
    };

    if (justOpened) {
      // On first open, retry to beat CSS layout transitions
      let cancelled = false;
      const snap = () => {
        if (!cancelled) scrollToCenter(false);
      };
      snap();
      const raf1 = requestAnimationFrame(snap);
      const raf2 = requestAnimationFrame(() => requestAnimationFrame(snap));
      const t1 = setTimeout(snap, 50);
      const t2 = setTimeout(snap, 150);
      const t3 = setTimeout(snap, 300);
      const t4 = setTimeout(snap, 500);
      return () => {
        cancelled = true;
        cancelAnimationFrame(raf1);
        cancelAnimationFrame(raf2);
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
        clearTimeout(t4);
      };
    }

    // Normal line change: smooth scroll
    const timeoutId = setTimeout(() => {
      scrollToCenter(true);
    }, 50);

    return () => clearTimeout(timeoutId);
  }, [activeIndex, isLyricsOpen, transcriptions.length]);

  // Fallback Equalizer component
  const EqualizerFallback = () => (
    <motion.div
      key="idle"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="flex flex-col items-center justify-center gap-5 py-4 w-full h-full"
    >
      {/* Bouncing neon equalizer waveform */}
      <div className="flex items-end gap-1.5 h-16 px-4">
        {[...Array(9)].map((_, i) => {
          const animDurations = [1.2, 0.8, 1.4, 0.9, 1.1, 1.3, 0.7, 1.0, 1.2];
          const heightSequence = [
            [16, 40, 16],
            [12, 56, 12],
            [20, 32, 20],
            [8, 48, 8],
            [16, 64, 16],
            [12, 40, 12],
            [20, 56, 20],
            [8, 32, 8],
            [16, 48, 16],
          ];
          return (
            <motion.div
              key={i}
              animate={
                isPlaying ? { height: heightSequence[i] } : { height: 8 }
              }
              transition={{
                duration: animDurations[i],
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="w-1 bg-gradient-to-t from-primary/30 to-primary rounded-full shadow-[0_0_10px_rgba(120,240,142,0.3)]"
              style={{ height: 8 }}
            />
          );
        })}
      </div>

      <div className="text-center space-y-1">
        <p className="text-[10px] font-black text-zinc-500 uppercase text-[10px] font-black text-zinc-500  ">
          {isPlaying ? "Lossless audio streaming" : "Playback paused"}
        </p>
      </div>
    </motion.div>
  );

  // If lyrics mode is open
  if (isLyricsOpen) {
    return (
      <div className="flex-1 overflow-hidden relative z-10 flex flex-col min-h-0 w-full lyrics-mask select-none">
        {transcriptions.length > 0 ? (
          <div
            ref={containerRef}
            className="flex-1 overflow-y-auto no-scrollbar py-4 px-6 space-y-8 min-h-0 relative"
          >
            {/* Top Spacer to allow centering of first lines */}
            <div className="h-[40vh] shrink-0" />

            {transcriptions.map((line, idx) => {
              const isActive = idx === activeIndex;
              const isExactActive = isActive && hasExactActive;
              const isPast = idx < activeIndex;

              return (
                <motion.div
                  ref={isActive ? activeRef : undefined}
                  key={line.start_time_seconds}
                  onClick={() => onSeek?.(line.start_time_seconds)}
                  animate={{
                    opacity: isExactActive
                      ? 1
                      : isActive
                        ? 0.6
                        : isPast
                          ? 0.35
                          : 0.15,
                    scale: isExactActive ? 1.05 : isActive ? 1.01 : 0.96,
                    filter: isActive ? "blur(0px)" : "blur(0.5px)",
                  }}
                  transition={{ duration: 0.35, ease: "easeOut" }}
                  className={`text-center px-4 py-1.5 cursor-pointer transition-all duration-300 hover:opacity-100 hover:scale-[1.01] font-black tracking-tight leading-relaxed italic ${
                    isExactActive
                      ? "text-white text-[22px]"
                      : isActive
                        ? "text-white/80 text-[18px]"
                        : "text-zinc-600 text-[15px]"
                  }`}
                >
                  {isExactActive && line.words.length > 0 ? (
                    <div className="flex flex-wrap justify-center gap-x-[5px] gap-y-1">
                      {line.words.map((word, wIdx) => {
                        const isWordActive =
                          localTime >= word.start && localTime <= word.end;
                        const isWordPast = localTime > word.end;
                        return (
                          <motion.span
                            key={wIdx}
                            animate={{
                              color: isWordActive
                                ? "#ffffff"
                                : isWordPast
                                  ? "rgba(255, 255, 255, 0.5)"
                                  : "rgba(255, 255, 255, 0.2)",
                              scale: isWordActive ? 1.06 : 1,
                            }}
                            transition={{ duration: 0.1 }}
                            className="text-[22px] font-black italic tracking-tight"
                          >
                            {word.text}
                          </motion.span>
                        );
                      })}
                    </div>
                  ) : (
                    <span>{line.transcript}</span>
                  )}
                </motion.div>
              );
            })}

            {/* Bottom Spacer to allow centering of last lines */}
            <div className="h-[40vh] shrink-0" />
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-4">
              <EqualizerFallback />
              <p className="text-sm text-zinc-500 font-medium -mt-2">
                No synced lyrics available
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Artwork focus mode (original overlay style)
  return (
    <div className="flex-1 overflow-hidden relative z-10 px-6 flex flex-col justify-center lyrics-mask min-h-0">
      <div className="flex-1 flex flex-col items-center justify-center py-1">
        <AnimatePresence mode="wait">
          {currentCaption ? (
            <motion.div
              key={currentCaption.start_time_seconds}
              initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -12, filter: "blur(4px)" }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="text-center px-2 w-full select-none"
            >
              {currentCaption.words.length > 0 ? (
                <div className="flex flex-wrap justify-center gap-x-[5px] gap-y-1.5">
                  {currentCaption.words.map((word, idx) => {
                    const isActive =
                      localTime >= word.start && localTime <= word.end;
                    const isPast = localTime > word.end;
                    return (
                      <motion.span
                        key={idx}
                        animate={{
                          color: isActive
                            ? "#ffffff"
                            : isPast
                              ? "rgba(255,255,255,0.4)"
                              : "rgba(255,255,255,0.12)",
                          scale: isActive ? 1.06 : 1,
                        }}
                        transition={{ duration: 0.12 }}
                        className="text-base font-black italic tracking-tight leading-relaxed text-white"
                      >
                        {word.text}
                      </motion.span>
                    );
                  })}
                </div>
              ) : (
                <p className="text-base font-black italic tracking-tight text-white/85 leading-relaxed">
                  {currentCaption.transcript}
                </p>
              )}
            </motion.div>
          ) : (
            <EqualizerFallback />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
