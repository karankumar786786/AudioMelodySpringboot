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

const formatDuration = (ms: number) => {
  if (!ms) return "0:00";
  const totalSeconds = Math.floor(ms / 1000);
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

  // Normalize IDs to strings when checking favourites to avoid type mismatches
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
      <div className="w-full h-112.5 rounded-[3rem] bg-zinc-950/40 backdrop-blur-md border border-white/5 overflow-hidden relative flex items-center justify-between p-16 animate-pulse">
        <div className="space-y-6 w-1/2">
          <div className="h-4 w-24 bg-white/5 rounded-full" />
          <div className="space-y-3">
            <div className="h-12 w-[85%] bg-white/5 rounded-2xl" />
            <div className="h-12 w-[60%] bg-white/5 rounded-2xl" />
          </div>
          <div className="h-6 w-32 bg-white/5 rounded-full" />
          <div className="h-14 w-40 bg-white/5 rounded-full pt-4" />
        </div>
        <div className="w-60 h-60 rounded-4xl bg-white/5 hidden md:block" />
      </div>
    );
  }

  if (!currentSong) return null;

  return (
    <section className="relative w-full h-112.5 rounded-[3rem] overflow-hidden group shadow-2xl border border-white/5 bg-zinc-950/20 backdrop-blur-sm">
      {/* Blurred ambient background image */}
      <div className="absolute inset-0 z-0 bg-black">
        <AnimatePresence mode="wait">
          <motion.img
            key={currentSong.id}
            src={getImageUrl(currentSong.imageKey, {
              width: 1200,
              height: 600,
              blur: 15,
              quality: 85,
            })}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.25, scale: 1.05 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
            className="absolute inset-0 w-full h-full object-cover filter blur-[30px]"
            alt=""
          />
        </AnimatePresence>
        <div className="absolute inset-0 bg-linear-to-r from-black via-black/85 to-transparent z-0" />
        <div className="absolute inset-0 bg-linear-to-t from-black via-transparent to-black/20 z-0" />
      </div>

      {/* Grid Pattern Overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-size-[32px_32px] pointer-events-none opacity-40 z-0" />

      {/* Color accent glow */}
      <div className="absolute top-1/2 right-[15%] -translate-y-1/2 w-87.5 h-87.5 rounded-full bg-primary/10 blur-[120px] pointer-events-none z-0" />

      {/* Content Grid */}
      <div className="relative z-10 h-full w-full grid grid-cols-1 md:grid-cols-12 gap-8 items-center px-16 py-8">
        {/* Left Side: Typography & Actions */}
        <div className="md:col-span-7 flex flex-col justify-center h-full text-left">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            key={`meta-${currentSong.id}`}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="space-y-4"
          >
            <h1 className="text-5xl lg:text-6xl font-black text-white tracking-tight leading-none max-w-2xl drop-shadow-xl line-clamp-2">
              {currentSong.title}
            </h1>

            <p className="text-lg text-zinc-400 font-medium pt-1">
              by{" "}
              <span className="text-white font-bold hover:text-primary transition-colors cursor-pointer relative group">
                {currentSong.artistName}
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-primary group-hover:w-full transition-all duration-300" />
              </span>
            </p>

            <div className="flex items-center gap-4 text-xs text-zinc-500 font-bold uppercase tracking-wider pt-2">
              <span>{formatDuration(currentSong.duration)}</span>
              <span className="w-1 h-1 rounded-full bg-zinc-700" />
              <span>{currentSong.language || "Stereo"}</span>
              <span className="w-1 h-1 rounded-full bg-zinc-700" />
              <span className="text-primary font-black">Ultra HD Audio</span>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            key={`actions-${currentSong.id}`}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="flex items-center gap-4 mt-8"
          >
            <button
              onClick={() => playerActions.play(mapToPlayerSong(currentSong))}
              className="h-14 px-8 bg-primary hover:bg-emerald-400 text-black rounded-full font-black text-xs uppercase tracking-widest flex items-center gap-3 shadow-[0_8px_30px_rgba(120,240,142,0.25)] hover:scale-[1.03] active:scale-95 transition-all duration-300 cursor-pointer"
            >
              <Play fill="black" size={16} />
              Play Now
            </button>

            <button
              onClick={handleToggleFavourite}
              className={`h-14 w-14 rounded-full border border-white/10 flex items-center justify-center transition-all duration-300 hover:bg-white/5 active:scale-95 cursor-pointer ${
                isFavourite
                  ? "text-primary border-primary/30 shadow-[0_0_20px_rgba(120,240,142,0.1)]"
                  : "text-white hover:text-primary"
              }`}
              title={
                isFavourite ? "Remove from Favourites" : "Add to Favourites"
              }
            >
              <Heart fill={isFavourite ? "currentColor" : "none"} size={18} />
            </button>
          </motion.div>
        </div>

        {/* Right Side: Interactive 3D Vinyl & Album Cover */}
        <div className="hidden md:col-span-5 md:flex items-center justify-center h-full relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSong.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="relative w-60 h-60 cursor-pointer"
              whileHover="hover"
            >
              {/* Vinyl Record */}
              

              {/* Album Cover Card */}
              <motion.div
                variants={{
                  hover: { y: -6, rotate: -2, scale: 1.02 },
                  initial: { y: 0, rotate: 0, scale: 1 },
                }}
                initial="initial"
                transition={{ type: "spring", stiffness: 250, damping: 20 }}
                className="absolute inset-0 rounded-4xl overflow-hidden border border-white/10 z-10 bg-zinc-900 shadow-2xl animate-float"
              >
                <img
                  src={getImageUrl(currentSong.imageKey, {
                    width: 500,
                    height: 500,
                    focus: "auto",
                  })}
                  className="w-full h-full object-cover select-none pointer-events-none"
                  alt={currentSong.title}
                />
                <div className="absolute inset-0 bg-linear-to-t from-black/50 via-transparent to-transparent pointer-events-none" />
              </motion.div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Carousel Dots & Sliding Progress Indicators */}
      {songs.length > 1 && (
        <div className="absolute bottom-8 right-16 z-20 flex items-center gap-6">
          <span className="text-[10px] font-black tracking-widest text-zinc-500">
            {(index + 1).toString().padStart(2, "0")}{" "}
            <span className="text-zinc-700 font-normal">/</span>{" "}
            {songs.length.toString().padStart(2, "0")}
          </span>

          <div className="flex items-center gap-2">
            {songs.map((_, i) => (
              <button
                key={i}
                onClick={() => setIndex(i)}
                className="h-1.5 rounded-full cursor-pointer relative overflow-hidden transition-all duration-300 bg-white/10"
                style={{
                  width: i === index ? "40px" : "6px",
                }}
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
        </div>
      )}
    </section>
  );
}
