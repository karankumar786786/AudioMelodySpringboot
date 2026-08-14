import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useStore } from "@tanstack/react-store";
import { playerStore } from "../../store/player.store";
import { TranscriptionEntry } from "./hooks/useLyrics";

interface PlayerLyricsOverlayProps {
  currentCaption: TranscriptionEntry | null;
  transcriptions?: TranscriptionEntry[];
  localTime: number;
  onSeek?: (time: number) => void;
}

export const PlayerLyricsOverlay: React.FC<PlayerLyricsOverlayProps> = ({
  currentCaption,
  localTime,
}) => {
  const isPlaying = useStore(playerStore, (s) => s.isPlaying);

  // Fallback Equalizer component when no caption is active
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
              className="w-1 bg-primary rounded-full"
              style={{ height: 8 }}
            />
          );
        })}
      </div>

      <div className="text-center space-y-1">
        <p className="text-xs font-medium text-zinc-400">
          {isPlaying ? "Streaming High Quality Audio" : "Playback paused"}
        </p>
      </div>
    </motion.div>
  );

  return (
    <div className="flex-1 overflow-hidden relative z-10 px-6 flex flex-col justify-center lyrics-mask min-h-0">
      <div className="flex-1 flex flex-col items-center justify-center py-1">
        <AnimatePresence mode="wait">
          {currentCaption ? (
            <motion.div
              key={currentCaption.start_time_seconds}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
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
                              : "rgba(255,255,255,0.15)",
                          scale: isActive ? 1.05 : 1,
                        }}
                        transition={{ duration: 0.12 }}
                        className="text-sm font-semibold tracking-normal leading-relaxed text-white"
                      >
                        {word.text}
                      </motion.span>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm font-semibold tracking-normal text-white leading-relaxed">
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
