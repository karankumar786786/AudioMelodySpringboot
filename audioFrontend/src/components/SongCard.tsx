"use client";

import { motion } from "framer-motion";
import {
  Play,
  Pause,
  MoreVertical,
  ListPlus,
  CornerDownRight,
  Plus,
  X,
  Heart,
  Share2,
} from "lucide-react";
import { type Song } from "../lib/api";
import { playerActions, playerStore } from "../store/player.store";
import { mapToPlayerSong } from "../lib/player-utils";
import { previewPlayer, previewStore } from "../lib/preview-player";
import { useStore } from "@tanstack/react-store";
import { toast } from "sonner";
import { useState } from "react";
import { PlaylistPickerModal } from "./PlaylistPickerModal";
import { ShareSongModal } from "./ShareSongModal";
import { getImageUrl } from "../lib/image-utils";

const formatTime = (seconds: number) => {
  if (isNaN(seconds) || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

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
  const currentSong = useStore(playerStore, (s) => s.currentSong);
  const isPlaying = useStore(playerStore, (s) => s.isPlaying);
  const favourites = useStore(playerStore, (s) => s.favourites);
  const previewState = useStore(previewStore, (s) => s);

  const [isPlaylistModalOpen, setIsPlaylistModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const isActiveSong = currentSong?.id === song.id;
  const isPreviewTarget = previewState.songId === song.id;
  const isCountingDown = isPreviewTarget && previewState.status === "countdown";
  const isPreviewLoading = isPreviewTarget && previewState.status === "loading";
  const isPreviewPlaying = isPreviewTarget && previewState.status === "playing";

  const isFavourite = song?.id
    ? Array.from(favourites).some((id) => String(id) === String(song.id))
    : false;

  const handleToggleFavourite = async () => {
    if (!systemUser?.id) {
      toast.error("Sign in required", {
        description: "Please sign in to add songs to favourites.",
      });
      return;
    }
    try {
      await playerActions.toggleFavourite(String(song.id));
      toast.success(isFavourite ? "Removed from favourites" : "Added to favourites", {
        description: isFavourite
          ? `"${song.title}" removed from your favourites.`
          : `"${song.title}" saved to your favourites.`,
      });
    } catch {
      toast.error("Failed to update favourites");
    }
  };

  const handlePlayToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    previewPlayer.stopPreview(true);
    if (isActiveSong) {
      playerActions.setIsPlaying(!isPlaying);
    } else {
      playerActions.play(mapToPlayerSong(song));
    }
  };

  const handlePlayMouseEnter = () => {
    if (!isActiveSong || !isPlaying) {
      previewPlayer.startHoverCountdown(song);
    }
  };

  const handlePlayMouseLeave = () => {
    previewPlayer.stopPreview();
  };

  const handlePlayNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    playerActions.playNext(mapToPlayerSong(song));
    toast.success("Playing next", {
      description: `"${song.title}" will play next.`,
    });
  };

  const handleAddToQueue = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    playerActions.enqueue([mapToPlayerSong(song)]);
    toast.success("Added to queue", {
      description: `"${song.title}" added to queue.`,
    });
  };

  const handleOpenPlaylistPicker = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setShowMenu(false);
    if (!systemUser?.id) {
      toast.error("Sign in required", {
        description: "Please sign in to add songs to playlists.",
      });
      return;
    }
    setIsPlaylistModalOpen(true);
  };

  const handleOpenShareModal = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setShowMenu(false);
    setIsShareModalOpen(true);
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        onClick={handlePlayToggle}
        className={`bg-black p-4 rounded-md group cursor-pointer relative transition-all duration-300 hover:bg-[#282828] ${
          isActiveSong ? "bg-[#282828] border border-primary/30" : ""
        } ${className || ""}`}
      >
        <div className="aspect-square bg-zinc-900 rounded-md mb-3 relative shadow-md overflow-hidden">
          <img
            src={getImageUrl(song.imageKey, {
              width: 400,
              height: 400,
              focus: "auto",
              aspectRatio: "1-1",
            })}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ease-out"
            alt={song.title}
            loading={priority ? "eager" : "lazy"}
          />

          {/* Best Part Badge if preview is active */}
          {isPreviewPlaying && (
            <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5 bg-black/90 backdrop-blur-md border border-primary/40 px-2 py-0.5 rounded-full text-[10px] text-primary font-bold shadow-lg max-w-[88%]">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping shrink-0" />
              <span className="truncate font-mono">{formatTime(previewState.startTime)} - {formatTime(previewState.endTime)}</span>
            </div>
          )}

          {/* Spotify Green Play/Pause Button Overlay on Cover Art */}
          <div
            className={`absolute bottom-2 right-2 translate-y-2 group-hover:translate-y-0 transition-all duration-300 z-10 ${
              (isActiveSong && isPlaying) || isPreviewPlaying || isCountingDown || isPreviewLoading
                ? "opacity-100 translate-y-0"
                : "opacity-0 group-hover:opacity-100"
            }`}
            onMouseEnter={handlePlayMouseEnter}
            onMouseLeave={handlePlayMouseLeave}
          >
            <div className="relative flex items-center justify-center">
              {/* Circular SVG countdown progress ring when counting down */}
              {isCountingDown && (
                <svg className="absolute -inset-1 w-14 h-14 -rotate-90 pointer-events-none" viewBox="0 0 56 56">
                  <circle
                    cx="28"
                    cy="28"
                    r="25"
                    fill="none"
                    stroke="rgba(255, 255, 255, 0.15)"
                    strokeWidth="3"
                  />
                  <motion.circle
                    cx="28"
                    cy="28"
                    r="25"
                    fill="none"
                    stroke="#ffffffff"
                    strokeWidth="3"
                    strokeDasharray={157}
                    initial={{ strokeDashoffset: 157 }}
                    animate={{ strokeDashoffset: 0 }}
                    transition={{ duration: 1, ease: "linear" }}
                    strokeLinecap="round"
                  />
                </svg>
              )}

              {/* Pulsing ring when preview is playing */}
              {isPreviewPlaying && (
                <span className="absolute -inset-1 rounded-full border-2 border-primary animate-ping opacity-60 pointer-events-none" />
              )}

              <button
                onClick={handlePlayToggle}
                className={`w-12 h-12 rounded-full bg-primary hover:scale-105 flex items-center justify-center text-black shadow-xl cursor-pointer transition-transform relative ${
                  isPreviewPlaying ? "ring-2 ring-primary ring-offset-2 ring-offset-black" : ""
                }`}
                title={
                  isActiveSong && isPlaying
                    ? "Pause"
                    : isPreviewPlaying
                    ? "Playing Preview (Click for Full Track)"
                    : "Play Track (Hover 3s for preview)"
                }
                aria-label={isActiveSong && isPlaying ? "Pause" : "Play"}
              >
                {isActiveSong && isPlaying ? (
                  <Pause fill="black" size={20} />
                ) : isPreviewLoading ? (
                  <svg className="animate-spin h-5 w-5 text-black" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : isPreviewPlaying ? (
                  <div className="flex items-end justify-center gap-0.5 h-4 w-4">
                    <motion.span
                      animate={{ height: ["30%", "100%", "40%"] }}
                      transition={{ duration: 0.5, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }}
                      className="w-1 bg-black rounded-full"
                    />
                    <motion.span
                      animate={{ height: ["80%", "30%", "90%"] }}
                      transition={{ duration: 0.4, repeat: Infinity, repeatType: "reverse", ease: "easeInOut", delay: 0.1 }}
                      className="w-1 bg-black rounded-full"
                    />
                    <motion.span
                      animate={{ height: ["40%", "90%", "30%"] }}
                      transition={{ duration: 0.45, repeat: Infinity, repeatType: "reverse", ease: "easeInOut", delay: 0.2 }}
                      className="w-1 bg-black rounded-full"
                    />
                  </div>
                ) : (
                  <Play fill="black" size={20} className="translate-x-0.5" />
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-1">
          <h3
            className={`font-bold truncate text-[14.5px] tracking-tight transition-colors ${
              isActiveSong ? "text-primary" : "text-white"
            }`}
          >
            {song.title}
          </h3>
          <p className="text-xs font-medium text-zinc-300 truncate hover:text-white">
            {song.artistName}
          </p>
        </div>

        {/* Quick Actions Bar */}
        <div className="absolute top-3 right-3 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-20">
          {onRemove && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              className="w-8 h-8 rounded-full bg-black/60 hover:bg-black text-white flex items-center justify-center transition-all shadow-md cursor-pointer"
              title="Remove"
            >
              <X size={14} />
            </button>
          )}

          {/* More Options Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu((v) => !v);
              }}
              className="w-8 h-8 rounded-full bg-black/60 hover:bg-black flex items-center justify-center text-zinc-300 hover:text-white transition-all shadow-md cursor-pointer"
              title="More options"
            >
              <MoreVertical size={14} />
            </button>

            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(false);
                  }}
                />
                <div
                  className="absolute right-0 top-full mt-1.5 w-48 rounded-xl bg-[#1e1e1e] border border-white/10 shadow-2xl z-50 p-1 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Favourite / Unfavourite Option */}
                  <button
                    type="button"
                    onClick={async (e) => {
                      e.stopPropagation();
                      setShowMenu(false);
                      await handleToggleFavourite();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-zinc-200 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
                  >
                    <Heart
                      size={14}
                      className={
                        isFavourite
                          ? "text-primary fill-primary"
                          : "text-zinc-400"
                      }
                    />
                    <span>
                      {isFavourite ? "Remove from favourites" : "Save to favourites"}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={handlePlayNext}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-zinc-200 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
                  >
                    <CornerDownRight size={14} className="text-primary" />
                    <span>Play next</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleAddToQueue}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-zinc-200 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
                  >
                    <ListPlus size={14} className="text-zinc-400" />
                    <span>Add to queue</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleOpenPlaylistPicker}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-zinc-200 hover:bg-white/10 hover:text-white transition-colors cursor-pointer border-t border-white/5 mt-1 pt-1.5"
                  >
                    <Plus size={14} className="text-zinc-400" />
                    <span>Add to playlist</span>
                  </button>

                  {/* Share Track Story Card */}
                  <button
                    type="button"
                    onClick={handleOpenShareModal}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-zinc-200 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
                  >
                    <Share2 size={14} className="text-primary" />
                    <span>Share track</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </motion.div>

      {/* Portals: Modals are OUTSIDE the transformed card so fixed positioning works */}
      <PlaylistPickerModal
        isOpen={isPlaylistModalOpen}
        onClose={() => setIsPlaylistModalOpen(false)}
        songId={song.id}
        songTitle={song.title}
      />
      <ShareSongModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        song={song}
      />
    </>
  );
}
