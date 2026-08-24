import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { type Song } from "../lib/api";
import { playerActions } from "../store/player.store";
import { mapToPlayerSong } from "../lib/player-utils";
import { getImageUrl, getVideoUrl } from "../lib/image-utils";

interface HeroSectionProps {
  songs: Song[];
  index: number;
  setIndex: (idx: number) => void;
  isLoading: boolean;
}

const formatDuration = (val?: number | string) => {
  if (!val) return "0:00";
  const num = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(num) || num <= 0) return "0:00";
  const totalSeconds = num > 10000 ? Math.floor(num / 1000) : Math.floor(num);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

export function HeroSection({
  songs,
  index,
  setIndex,
  isLoading,
}: HeroSectionProps) {
  const currentSong = songs[index] || songs[0];

  if (isLoading) {
    return (
      <div className="w-full h-80 rounded-2xl bg-zinc-900/60 border border-[#282828] overflow-hidden relative flex flex-col justify-between p-8 md:p-12 animate-pulse">
        <div className="space-y-4 max-w-lg">
          <div className="h-5 w-28 bg-zinc-800 rounded-full" />
          <div className="h-10 w-3/4 bg-zinc-800 rounded-lg" />
          <div className="h-4 w-1/3 bg-zinc-800 rounded" />
          <div className="h-4 w-1/2 bg-zinc-800 rounded" />
        </div>
        <div className="h-11 w-32 bg-zinc-800 rounded-full" />
      </div>
    );
  }

  if (!currentSong) return null;

  const isVideoSong =
    currentSong.id === "afcef7ca-367e-4f15-97c8-9564af846a4d" ||
    currentSong.title?.toLowerCase().includes("o soniya");

  const videoUrl = isVideoSong
    ? getVideoUrl("o soniya clip.mp4", { quality: 85 })
    : undefined;

  const bgImageUrl = currentSong.imageKey
    ? getImageUrl(currentSong.imageKey, {
        width: 1920,
        height: 900,
        aspectRatio: "16-9",
        focus: "auto",
        crop: "at_least",
        quality: 100,
        format: "auto",
      })
    : undefined;

  return (
    <section
      onClick={() => playerActions.play(mapToPlayerSong(currentSong))}
      className="relative w-full h-[290px] md:h-[325px] rounded-2xl overflow-hidden group bg-zinc-900 border border-white/10 shadow-2xl cursor-pointer hover:border-white/20 transition-all select-none"
    >
      {/* ─── Video or High-Res Background Image ─── */}
      <div className="absolute inset-0 z-0">
        <AnimatePresence mode="wait">
          {isVideoSong && videoUrl ? (
            <motion.video
              key={`video-${currentSong.id}`}
              src={videoUrl}
              autoPlay
              loop
              muted
              playsInline
              initial={{ opacity: 0, scale: 1.05 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              style={{ filter: "brightness(0.9) saturate(1.0) contrast(1.0)" }}
            />
          ) : bgImageUrl ? (
            <motion.img
              key={currentSong.id}
              src={bgImageUrl}
              initial={{ opacity: 0, scale: 1.05 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="absolute inset-0 w-full h-full object-cover object-[70%_center] group-hover:scale-105 transition-transform duration-500"
              style={{ filter: "brightness(0.9) saturate(1.0) contrast(1.0)" }}
              alt={currentSong.title}
            />
          ) : null}
        </AnimatePresence>

        {/* Bottom scrim */}
        <div className="absolute bottom-0 left-0 right-0 h-[65%] bg-gradient-to-t from-black/95 via-black/55 to-transparent z-[1]" />
      </div>

      {/* ─── Content Layer ─── */}
      <div className="relative z-10 h-full w-full flex flex-col justify-end gap-3 p-7 md:p-9">

        {/* Title, Artist & Meta */}
        <div className="max-w-xl md:max-w-2xl space-y-1.5 mb-2">
          <motion.h1
            key={`title-${currentSong.id}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="text-3xl md:text-5xl font-black text-white tracking-tight leading-tight line-clamp-2"
          >
            {currentSong.title}
          </motion.h1>

          <motion.p
            key={`artist-${currentSong.id}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.05 }}
            className="text-sm md:text-base text-zinc-200 font-semibold"
          >
            by{" "}
            <span className="text-white font-bold hover:underline">
              {currentSong.artistName}
            </span>
          </motion.p>

          <div className="flex items-center gap-3 text-xs text-zinc-300 font-semibold">
            <span>{formatDuration(currentSong.duration)}</span>
            <span className="w-1 h-1 rounded-full bg-zinc-400" />
            <span>{currentSong.language || "Hindi"}</span>
            <span className="w-1 h-1 rounded-full bg-zinc-400" />
            <span className="text-primary font-bold">
              {isVideoSong ? "Music Video" : "High Quality Audio"}
            </span>
          </div>
        </div>

        {/* Bottom: Carousel Progress */}
        {songs.length > 1 && (
          <div className="flex items-center justify-end z-20">
            <div className="flex items-center gap-2">
              {songs.map((_, i) => (
                <button
                  key={i}
                  onClick={(e) => {
                    e.stopPropagation();
                    setIndex(i);
                  }}
                  className="h-1.5 rounded-full cursor-pointer relative overflow-hidden transition-all duration-300 bg-white/30 hover:bg-white/50"
                  style={{
                    width: i === index ? "28px" : "8px",
                  }}
                  title={`Track ${i + 1}`}
                >
                  {i === index && (
                    <motion.div
                      key={`progress-${currentSong.id}`}
                      initial={{ left: "-100%" }}
                      animate={{ left: "0%" }}
                      transition={{ duration: 12, ease: "linear" }}
                      className="absolute top-0 bottom-0 left-0 right-0 bg-primary rounded-full"
                    />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}