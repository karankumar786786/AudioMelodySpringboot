"use client";

import { useStore } from "@tanstack/react-store";
import { motion } from "framer-motion";
import {
  CornerDownRight,
  Heart,
  ListMinus,
  ListPlus,
  Loader2,
  MoreVertical,
  Pause,
  Play,
  Plus,
  Radio,
  Share2,
  X,
} from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { toast } from "sonner";
import type { Song } from "../lib/api";
import { getImageUrl } from "../lib/image-utils";
import { mapToPlayerSong } from "../lib/player-utils";
import { previewPlayer, previewStore } from "../lib/preview-player";
import { playerActions, playerStore } from "../store/player.store";
import { PlaylistPickerModal } from "./PlaylistPickerModal";
import { ShareSongModal } from "./ShareSongModal";

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
  const isAudioLoading = useStore(playerStore, (s) => s.isLoading);
  const favourites = useStore(playerStore, (s) => s.favourites);
  const isInQueue = useStore(playerStore, (s) =>
    s.queue.some((item, idx) => idx > s.lastQueueIndex && item.id === song.id),
  );
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

  const rawImageKey = song.imageKey || (song as any).coverImageKey;
  const imageUrl = rawImageKey
    ? getImageUrl(rawImageKey, {
        width: 400,
        height: 400,
        focus: "auto",
        aspectRatio: "1-1",
      })
    : (song as any).posterUrl || "";

  const handleToggleFavourite = async () => {
    if (!systemUser?.id) {
      toast.error("Sign in required", {
        description: "Please sign in to add songs to favourites.",
      });
      return;
    }
    try {
      await playerActions.toggleFavourite(String(song.id));
      toast.success(
        isFavourite ? "Removed from favourites" : "Added to favourites",
        {
          description: isFavourite
            ? `"${song.title}" removed from your favourites.`
            : `"${song.title}" saved to your favourites.`,
        },
      );
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
      playerActions.playWithRadio(mapToPlayerSong(song));
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

  const handleStartRadio = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    previewPlayer.stopPreview(true);
    playerActions.playWithRadio(mapToPlayerSong(song));
    toast.success("Playing Song Radio", {
      description: `Starting infinite radio for "${song.title}"...`,
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

  const handleRemoveFromQueue = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    playerActions.removeSongFromQueue(song.id);
    toast.success("Removed from queue", {
      description: `"${song.title}" removed from queue.`,
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
        className={`bg-black p-2 rounded-lg group cursor-pointer relative transition-all duration-300 hover:bg-[#282828] ${
          isActiveSong ? "bg-[#282828] border border-primary/30" : ""
        } ${className || ""}`}
      >
        <div className="aspect-square bg-zinc-900 rounded-md mb-1.5 relative shadow-md overflow-hidden">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={song.title || "Song cover"}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 250px"
              priority={priority}
              className="object-cover group-hover:scale-105 transition-transform duration-300 ease-out"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-zinc-800 text-zinc-600">
              <span className="text-xs">No Image</span>
            </div>
          )}

          {/* Best Part Badge if preview is active */}
          {isPreviewPlaying && (
            <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5 bg-black/90 backdrop-blur-md border border-primary/40 px-2 py-0.5 rounded-full text-[10px] text-primary font-bold shadow-lg max-w-[88%]">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping shrink-0" />
              <span className="truncate font-mono">
                {formatTime(previewState.startTime)} -{" "}
                {formatTime(previewState.endTime)}
              </span>
            </div>
          )}

          {/* Spotify Green Play/Pause Button Overlay on Cover Art */}
          <div
            className={`absolute bottom-2 right-2 translate-y-2 group-hover:translate-y-0 transition-all duration-300 z-10 ${
              (isActiveSong && isPlaying) ||
              isPreviewPlaying ||
              isCountingDown ||
              isPreviewLoading
                ? "opacity-100 translate-y-0"
                : "opacity-0 group-hover:opacity-100"
            }`}
            onMouseEnter={handlePlayMouseEnter}
            onMouseLeave={handlePlayMouseLeave}
          >
            <div className="relative flex items-center justify-center">
              {/* Circular SVG countdown progress ring when counting down */}
              {isCountingDown && (
                <svg
                  className="absolute -inset-1 w-[52px] h-[52px] -rotate-90 pointer-events-none"
                  viewBox="0 0 52 52"
                  aria-hidden="true"
                >
                  <circle
                    cx="26"
                    cy="26"
                    r="23"
                    fill="none"
                    stroke="rgba(255, 255, 255, 0.15)"
                    strokeWidth="2.5"
                  />
                  <motion.circle
                    cx="26"
                    cy="26"
                    r="23"
                    fill="none"
                    stroke="#ffffffff"
                    strokeWidth="2.5"
                    strokeDasharray={145}
                    initial={{ strokeDashoffset: 145 }}
                    animate={{ strokeDashoffset: 0 }}
                    transition={{ duration: 1, ease: "linear" }}
                    strokeLinecap="round"
                  />
                </svg>
              )}

              {/* Real-time Progress Ring & Pulsing Beat Expansion when preview is playing */}
              {isPreviewPlaying && (
                <>
                  <span className="absolute -inset-1 rounded-full border-2 border-primary animate-ping opacity-60 pointer-events-none" />
                  <motion.span
                    className="absolute -inset-2 rounded-full border border-primary/40 pointer-events-none"
                    animate={{ scale: [1, 1.2, 1], opacity: [0.6, 0, 0.6] }}
                    transition={{
                      duration: 1.2,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  />
                  <svg
                    className="absolute -inset-1 w-[52px] h-[52px] -rotate-90 pointer-events-none drop-shadow-[0_0_8px_rgba(30,215,96,0.6)]"
                    viewBox="0 0 52 52"
                    aria-hidden="true"
                  >
                    <circle
                      cx="26"
                      cy="26"
                      r="23"
                      fill="none"
                      stroke="rgba(255, 255, 255, 0.2)"
                      strokeWidth="2.5"
                    />
                    <circle
                      cx="26"
                      cy="26"
                      r="23"
                      fill="none"
                      stroke="#ffffffff"
                      strokeWidth="2.5"
                      strokeDasharray={145}
                      strokeDashoffset={
                        145 *
                        (1 -
                          Math.min(1, Math.max(0, previewState.progress || 0)))
                      }
                      strokeLinecap="round"
                      className="transition-[stroke-dashoffset] duration-150 ease-linear"
                    />
                  </svg>
                </>
              )}

              <button
                type="button"
                onClick={handlePlayToggle}
                className={`w-11 h-11 rounded-full bg-primary hover:scale-105 flex items-center justify-center text-black shadow-xl cursor-pointer transition-transform relative ${
                  isPreviewPlaying
                    ? "ring-2 ring-primary ring-offset-2 ring-offset-black"
                    : ""
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
                  isAudioLoading ? (
                    <Loader2 size={18} className="animate-spin text-black" />
                  ) : (
                    <Pause fill="black" size={18} />
                  )
                ) : isPreviewLoading ? (
                  <Loader2 size={18} className="animate-spin text-black" />
                ) : isPreviewPlaying ? (
                  <div className="flex items-end justify-center gap-0.5 h-3.5 w-3.5">
                    <motion.span
                      animate={{ height: ["30%", "100%", "40%"] }}
                      transition={{
                        duration: 0.5,
                        repeat: Infinity,
                        repeatType: "reverse",
                        ease: "easeInOut",
                      }}
                      className="w-0.5 bg-black rounded-full"
                    />
                    <motion.span
                      animate={{ height: ["80%", "30%", "90%"] }}
                      transition={{
                        duration: 0.4,
                        repeat: Infinity,
                        repeatType: "reverse",
                        ease: "easeInOut",
                        delay: 0.1,
                      }}
                      className="w-0.5 bg-black rounded-full"
                    />
                    <motion.span
                      animate={{ height: ["40%", "90%", "30%"] }}
                      transition={{
                        duration: 0.45,
                        repeat: Infinity,
                        repeatType: "reverse",
                        ease: "easeInOut",
                        delay: 0.2,
                      }}
                      className="w-0.5 bg-black rounded-full"
                    />
                  </div>
                ) : (
                  <Play fill="black" size={18} className="translate-x-0.5" />
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-0.5 px-0.5">
          <h3
            className={`font-bold truncate text-[12.5px] sm:text-[13px] tracking-tight transition-colors ${
              isActiveSong ? "text-primary" : "text-white"
            }`}
          >
            {song.title}
          </h3>
          <p className="text-[11px] sm:text-[11.5px] font-medium text-zinc-400 truncate hover:text-white">
            {song.artistName}
          </p>
        </div>

        {/* Quick Actions Bar */}
        <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-20">
          {onRemove && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              className="w-7 h-7 rounded-full bg-black/60 hover:bg-black text-white flex items-center justify-center transition-all shadow-md cursor-pointer"
              title="Remove"
            >
              <X size={13} />
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
              className="w-7 h-7 rounded-full bg-black/60 hover:bg-black flex items-center justify-center text-zinc-300 hover:text-white transition-all shadow-md cursor-pointer"
              title="More options"
            >
              <MoreVertical size={13} />
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
                      {isFavourite
                        ? "Remove from favourites"
                        : "Save to favourites"}
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
                    onClick={handleStartRadio}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-zinc-200 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
                  >
                    <Radio size={14} className="text-cyan-400" />
                    <span>Start song radio</span>
                  </button>

                  {isInQueue ? (
                    <button
                      type="button"
                      onClick={handleRemoveFromQueue}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                    >
                      <ListMinus size={14} className="text-red-400" />
                      <span>Remove from queue</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleAddToQueue}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-zinc-200 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
                    >
                      <ListPlus size={14} className="text-zinc-400" />
                      <span>Add to queue</span>
                    </button>
                  )}

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
