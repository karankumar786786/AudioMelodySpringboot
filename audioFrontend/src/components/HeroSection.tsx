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
    <section className="relative w-full h-80 rounded-xl overflow-hidden group border border-[#282828] bg-[#181818]">
      {/* Soft dark ambient backdrop */}
      <div className="absolute inset-0 z-0 bg-[#181818]">
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
            animate={{ opacity: 0.15 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0 w-full h-full object-cover filter blur-xl"
            alt=""
          />
        </AnimatePresence>
        <div className="absolute inset-0 bg-linear-to-r from-[#181818] via-[#181818]/90 to-transparent z-0" />
      </div>

      {/* Content Grid */}
      <div className="relative z-10 h-full w-full grid grid-cols-1 md:grid-cols-12 gap-8 items-center px-12 py-6">
        {/* Left Side: Information & Actions */}
        <div className="md:col-span-8 flex flex-col justify-center h-full text-left">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            key={`meta-${currentSong.id}`}
            transition={{ duration: 0.4 }}
            className="space-y-3"
          >
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">
              Featured Track
            </span>
            <h1 className="text-3xl lg:text-4xl font-bold text-white tracking-tight leading-tight line-clamp-2">
              {currentSong.title}
            </h1>

            <p className="text-sm text-zinc-400 font-normal">
              by{" "}
              <span className="text-white font-medium hover:underline cursor-pointer">
                {currentSong.artistName}
              </span>
            </p>

            <div className="flex items-center gap-3 text-xs text-zinc-400 font-medium pt-1">
              <span>{formatDuration(currentSong.duration)}</span>
              <span className="w-1 h-1 rounded-full bg-zinc-600" />
              <span>{currentSong.language || "Stereo"}</span>
              <span className="w-1 h-1 rounded-full bg-zinc-600" />
              <span className="text-primary font-medium">High Quality Audio</span>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            key={`actions-${currentSong.id}`}
            transition={{ delay: 0.1, duration: 0.4 }}
            className="flex items-center gap-4 mt-6"
          >
            <button
              onClick={() => playerActions.play(mapToPlayerSong(currentSong))}
              className="h-11 px-6 bg-primary hover:scale-105 text-black rounded-full font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-md transition-all cursor-pointer"
            >
              <Play fill="black" size={16} />
              Play
            </button>

            <button
              onClick={handleToggleFavourite}
              className={`h-11 w-11 rounded-full border border-white/10 flex items-center justify-center transition-all cursor-pointer ${
                isFavourite
                  ? "text-primary border-primary/40 bg-primary/10"
                  : "text-white hover:text-primary hover:bg-white/5"
              }`}
              title={
                isFavourite ? "Remove from Favourites" : "Add to Favourites"
              }
            >
              <Heart fill={isFavourite ? "currentColor" : "none"} size={18} />
            </button>
          </motion.div>
        </div>

        {/* Right Side: Album Cover */}
        <div className="hidden md:col-span-4 md:flex items-center justify-center h-full relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSong.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.4 }}
              className="relative w-48 h-48 cursor-pointer"
            >
              <div className="absolute inset-0 rounded-lg overflow-hidden border border-[#282828] z-10 bg-zinc-900 shadow-xl">
                <img
                  src={getImageUrl(currentSong.imageKey, {
                    width: 500,
                    height: 500,
                    focus: "auto",
                  })}
                  className="w-full h-full object-cover select-none pointer-events-none"
                  alt={currentSong.title}
                />
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Carousel Dots */}
      {songs.length > 1 && (
        <div className="absolute bottom-6 right-12 z-20 flex items-center gap-4">
          <div className="flex items-center gap-2">
            {songs.map((_, i) => (
              <button
                key={i}
                onClick={() => setIndex(i)}
                className="h-1.5 rounded-full cursor-pointer relative overflow-hidden transition-all duration-300 bg-white/20"
                style={{
                  width: i === index ? "24px" : "6px",
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
