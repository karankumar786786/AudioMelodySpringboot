import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Heart } from "lucide-react";
import { type Song } from "../lib/api";
import { playerActions, playerStore } from "../store/player.store";
import { mapToPlayerSong } from "../lib/player-utils";
import { getImageUrl } from "../lib/image-utils";
import { useStore } from "@tanstack/react-store";
import { toast } from "sonner";

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
  const systemUser = useStore(playerStore, (s) => s.systemUser);
  const favourites = useStore(playerStore, (s) => s.favourites);

  const isFavourite = currentSong
    ? Array.from(favourites).some((id) => String(id) === String(currentSong.id))
    : false;

  const handleToggleFavourite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentSong) return;

    if (!systemUser?.id) {
      toast.error("Sign in required", {
        description: "Please sign in to save songs to your library.",
      });
      return;
    }

    toast.promise(playerActions.toggleFavourite(currentSong.id), {
      loading: isFavourite
        ? "Removing from Favourites..."
        : "Adding to Favourites...",
      success: () => {
        return isFavourite ? "Removed from Favourites" : "Added to Favourites";
      },
      error: "Failed to update favourites",
      description: () => {
        return isFavourite
          ? `"${currentSong.title}" removed from your collection.`
          : `"${currentSong.title}" added to your collection.`;
      },
    });
  };

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

  const bgImageUrl = currentSong.imageKey
    ? getImageUrl(currentSong.imageKey, { width: 1400, height: 700, quality: 95 })
    : undefined;

  return (
    <section className="relative w-full h-[320px] md:h-[360px] rounded-2xl overflow-hidden group bg-zinc-900 border border-white/10 shadow-2xl">
      {/* ─── High-Res Background Image – bright, saturated, vivid ─── */}
      <div className="absolute inset-0 z-0">
        <AnimatePresence mode="wait">
          {bgImageUrl && (
            <motion.img
              key={currentSong.id}
              src={bgImageUrl}
              initial={{ opacity: 0, scale: 1.05 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="absolute inset-0 w-full h-full object-cover object-[70%_center]"
              style={{ filter: "brightness(1.15) saturate(1.3) contrast(1.05)" }}
              alt={currentSong.title}
            />
          )}
        </AnimatePresence>

        {/* Light left-side gradient — only covers ~55% from left so image is visible and bright */}
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/70 to-transparent z-[1]" />
        {/* Very subtle top/bottom vignette */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent z-[1]" />
      </div>

      {/* ─── Content Layer ─── */}
      <div className="relative z-10 h-full w-full flex flex-col justify-between p-8 md:p-10">

        {/* Top badge */}
        <div>
          <span className="inline-flex items-center gap-1.5 bg-white/10 backdrop-blur-sm border border-white/15 text-white/90 text-[10.5px] font-bold uppercase tracking-widest rounded-full px-3 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            Featured
          </span>
        </div>

        {/* Title, Artist & Meta */}
        <div className="max-w-xl md:max-w-2xl space-y-2">
          <motion.h1
            key={`title-${currentSong.id}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="text-3xl md:text-5xl font-black text-white tracking-tight leading-tight line-clamp-2"
            style={{ textShadow: "0 2px 24px rgba(0,0,0,0.7)" }}
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
            <span className="text-white font-bold hover:underline cursor-pointer">
              {currentSong.artistName}
            </span>
          </motion.p>

          <div className="flex items-center gap-3 text-xs text-zinc-300 font-semibold pt-0.5">
            <span>{formatDuration(currentSong.duration)}</span>
            <span className="w-1 h-1 rounded-full bg-zinc-400" />
            <span>{currentSong.language || "Stereo"}</span>
            <span className="w-1 h-1 rounded-full bg-zinc-400" />
            <span className="text-primary font-bold">High Quality Audio</span>
          </div>
        </div>

        {/* Bottom: Play / Favourite Actions & Carousel Progress */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => playerActions.play(mapToPlayerSong(currentSong))}
              className="h-11 px-8 bg-white hover:bg-zinc-100 hover:scale-105 active:scale-95 text-black rounded-full font-extrabold text-xs uppercase tracking-wider flex items-center gap-2 shadow-2xl transition-all cursor-pointer"
            >
              <Play fill="black" size={16} />
              Play
            </button>

            <button
              onClick={handleToggleFavourite}
              className={`h-11 w-11 rounded-full border flex items-center justify-center transition-all cursor-pointer backdrop-blur-md ${
                isFavourite
                  ? "text-primary border-primary/50 bg-primary/15"
                  : "border-white/30 text-white hover:text-primary hover:bg-white/15 hover:border-white/50"
              }`}
              title={isFavourite ? "Remove from Favourites" : "Add to Favourites"}
            >
              <Heart fill={isFavourite ? "currentColor" : "none"} size={18} />
            </button>
          </div>

          {/* Carousel Dots */}
          {songs.length > 1 && (
            <div className="flex items-center gap-2">
              {songs.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setIndex(i)}
                  className="h-1.5 rounded-full cursor-pointer relative overflow-hidden transition-all duration-300 bg-white/30"
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
                      transition={{ duration: 8, ease: "linear" }}
                      className="absolute top-0 bottom-0 left-0 right-0 bg-primary rounded-full"
                    />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
