"use client";

import { motion } from "framer-motion";
import { Play, Pause, MoreVertical, ListPlus, CornerDownRight, Plus, X } from "lucide-react";
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
  const currentSong = useStore(playerStore, (s) => s.currentSong);
  const isPlaying = useStore(playerStore, (s) => s.isPlaying);
  const [isPlaylistModalOpen, setIsPlaylistModalOpen] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const isActiveSong = currentSong?.id === song.id;

  const handlePlayToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isActiveSong) {
      playerActions.setIsPlaying(!isPlaying);
    } else {
      playerActions.play(mapToPlayerSong(song));
    }
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

          {/* Spotify Green Play/Pause Button Overlay on Cover Art */}
          <div
            className={`absolute bottom-2 right-2 translate-y-2 group-hover:translate-y-0 transition-all duration-300 z-10 ${
              isActiveSong && isPlaying
                ? "opacity-100 translate-y-0"
                : "opacity-0 group-hover:opacity-100"
            }`}
          >
            <button
              onClick={handlePlayToggle}
              className="w-12 h-12 rounded-full bg-primary hover:scale-105 flex items-center justify-center text-black shadow-xl cursor-pointer transition-transform"
              title={isActiveSong && isPlaying ? "Pause" : "Play"}
              aria-label={isActiveSong && isPlaying ? "Pause" : "Play"}
            >
              {isActiveSong && isPlaying ? (
                <Pause fill="black" size={20} />
              ) : (
                <Play fill="black" size={20} className="translate-x-0.5" />
              )}
            </button>
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
                  className="absolute right-0 top-full mt-1.5 w-44 rounded-xl bg-[#1e1e1e] border border-white/10 shadow-2xl z-50 p-1 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150"
                  onClick={(e) => e.stopPropagation()}
                >
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
                </div>
              </>
            )}
          </div>
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
