import { motion } from "framer-motion";
import { Play, Heart, Plus, X } from "lucide-react";
import { type Song } from "../lib/api";
import { playerActions, playerStore } from "../store/player.store";
import { mapToPlayerSong } from "../lib/player-utils";
import { useStore } from "@tanstack/react-store";
import { toast } from "sonner";
import { useState } from "react";
import { PlaylistPickerModal } from "./PlaylistPickerModal";
import { getImageUrl } from "../lib/image-utils";

interface SongCardProps {
  song: Song;
  priority?: boolean;
  onRemove?: () => void;
  className?: string;
}

export function SongCard({
  song,
  priority,
  onRemove,
  className,
}: SongCardProps) {
  const systemUser = useStore(playerStore, (s) => s.systemUser);
  const favourites = useStore(playerStore, (s) => s.favourites);
  const currentSong = useStore(playerStore, (s) => s.currentSong);
  const isPlaying = useStore(playerStore, (s) => s.isPlaying);
  const [isPlaylistModalOpen, setIsPlaylistModalOpen] = useState(false);

  // Normalize IDs to strings when checking favourites to avoid type mismatches
  const isFavourite = Array.from(favourites).some((id) => String(id) === String(song.id));
  const isActiveSong = currentSong?.id === song.id;

  const handlePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    playerActions.play(mapToPlayerSong(song));
  };

  const handleToggleFavourite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!systemUser?.id) {
      toast.error("Sign in required", {
        description: "Please sign in to save songs to your library.",
      });
      return;
    }

    toast.promise(playerActions.toggleFavourite(song.id), {
      loading: isFavourite
        ? "Removing from Favourites..."
        : "Adding to Favourites...",
      success: () => {
        return isFavourite ? "Removed from Favourites" : "Added to Favourites";
      },
      error: "Failed to update favourites",
      description: () => {
        return isFavourite
          ? `"${song.title}" removed from your collection.`
          : `"${song.title}" added to your collection.`;
      },
    });
  };

  const handleOpenPlaylistPicker = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!systemUser?.id) {
      toast.error("Sign in required", {
        description: "Please sign in to add songs to playlists.",
      });
      return;
    }
    setIsPlaylistModalOpen(true);
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        whileHover={{ y: -6 }}
        onClick={handlePlay}
        className={`glass-effect p-3.5 rounded-[1.8rem] group cursor-pointer relative overflow-hidden transition-all duration-300 ${
          isActiveSong
            ? "ring-2 ring-primary/60 bg-linear-to-b from-primary/5 to-transparent shadow-[0_12px_30px_rgba(120,240,142,0.15)]"
            : "hover:border-white/15 hover:shadow-[0_20px_40px_rgba(0,0,0,0.6),0_0_30px_rgba(120,240,142,0.06)] hover:bg-white/5"
        } ${className || ""}`}
      >
        <div className="aspect-square bg-zinc-950 rounded-[1.4rem] mb-4 relative shadow-2xl overflow-hidden ring-1 ring-white/6">
          <img
            src={getImageUrl(song.imageKey, {
              width: 400,
              height: 400,
              focus: "auto",
              aspectRatio: "1-1",
            })}
            className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-700 ease-out"
            alt={song.title}
            loading={priority ? "eager" : "lazy"}
          />

          <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center backdrop-blur-[3px] z-10">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-black shadow-xl shadow-primary/20 transition-all duration-300"
            >
              <Play fill="black" size={20} className="translate-x-0.5" />
            </motion.div>
          </div>
        </div>

        <div className="space-y-1.5 px-1.5 pb-1">
          <h3
            className={`font-black truncate text-[0.9rem] uppercase italic tracking-tighter transition-colors duration-300 ${
              isActiveSong ? "text-primary" : "text-white"
            }`}
          >
            {song.title}
          </h3>
          <p
            className={`text-[10px] font-black uppercase tracking-[0.15em] truncate transition-colors italic ${
              isActiveSong
                ? "text-primary/70"
                : "text-zinc-500 group-hover:text-primary"
            }`}
          >
            {song.artistName}
          </p>
        </div>

        {/* Quick Actions */}
        <div className="absolute top-5 right-5 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-all translate-x-3 group-hover:translate-x-0 duration-300">
          {onRemove && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              className="w-9 h-9 rounded-xl bg-red-500 text-white flex items-center justify-center hover:brightness-110 transition-all shadow-2xl"
              title="Remove"
            >
              <X size={15} />
            </button>
          )}
          <button
            onClick={handleToggleFavourite}
            className={`w-9 h-9 rounded-xl bg-black/60 backdrop-blur-xl border border-white/10 flex items-center justify-center transition-all shadow-2xl ${
              isFavourite
                ? "text-primary border-primary/20"
                : "text-zinc-400 hover:text-primary"
            }`}
          >
            <Heart size={15} fill={isFavourite ? "currentColor" : "none"} />
          </button>
          <button
            onClick={handleOpenPlaylistPicker}
            className="w-9 h-9 rounded-xl bg-black/60 backdrop-blur-xl border border-white/10 flex items-center justify-center text-zinc-400 hover:text-primary transition-all shadow-2xl"
          >
            <Plus size={15} />
          </button>
        </div>
      </motion.div>

      {/* Portal: Modal is OUTSIDE the transformed card so fixed positioning works */}
      <PlaylistPickerModal
        isOpen={isPlaylistModalOpen}
        onClose={() => setIsPlaylistModalOpen(false)}
        songId={song.id}
        songTitle={song.title}
      />
    </>
  );
}
