"use client";

import React, { useState } from "react";
import { useStore } from "@tanstack/react-store";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { getImageUrl } from "@/lib/image-utils";
import { mapToPlayerSong } from "@/lib/player-utils";
import { previewPlayer, previewStore } from "@/lib/preview-player";
import { playerActions, playerStore } from "@/store/player.store";
import { PlaylistPickerModal } from "@/components/PlaylistPickerModal";
import { ShareSongModal } from "@/components/ShareSongModal";
import { SongCardCover } from "./SongCardCover";
import { SongCardInfo } from "./SongCardInfo";
import { SongCardMenu } from "./SongCardMenu";
import type { SongCardProps } from "./types";

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
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || "Failed to update favourites");
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
    playerActions.playNext(mapToPlayerSong(song));
    toast.success("Playing next", {
      description: `"${song.title}" will play next.`,
    });
  };

  const handleStartRadio = (e: React.MouseEvent) => {
    e.stopPropagation();
    previewPlayer.stopPreview(true);
    playerActions.playWithRadio(mapToPlayerSong(song));
    toast.success("Playing Song Radio", {
      description: `Starting infinite radio for "${song.title}"...`,
    });
  };

  const handleAddToQueue = (e: React.MouseEvent) => {
    e.stopPropagation();
    playerActions.enqueue([mapToPlayerSong(song)]);
    toast.success("Added to queue", {
      description: `"${song.title}" added to queue.`,
    });
  };

  const handleRemoveFromQueue = (e: React.MouseEvent) => {
    e.stopPropagation();
    playerActions.removeSongFromQueue(song.id);
    toast.success("Removed from queue", {
      description: `"${song.title}" removed from queue.`,
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

  const handleOpenShareModal = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsShareModalOpen(true);
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        onClick={handlePlayToggle}
        className={`bg-black p-2 sm:p-2.5 rounded-xl group cursor-pointer relative transition-all duration-300 hover:bg-[#282828] border ${
          isActiveSong
            ? "bg-[#282828] border-primary/40 shadow-sm"
            : "border-white/10 hover:border-white/20"
        } ${className || ""}`}
      >
        <SongCardCover
          song={song}
          imageUrl={imageUrl}
          priority={priority}
          isActiveSong={isActiveSong}
          isPlaying={isPlaying}
          isAudioLoading={isAudioLoading}
          isPreviewPlaying={isPreviewPlaying}
          isCountingDown={isCountingDown}
          isPreviewLoading={isPreviewLoading}
          previewStartTime={previewState.startTime}
          previewEndTime={previewState.endTime}
          previewProgress={previewState.progress}
          onPlayToggle={handlePlayToggle}
          onPlayMouseEnter={handlePlayMouseEnter}
          onPlayMouseLeave={handlePlayMouseLeave}
        />

        <SongCardInfo song={song} isActiveSong={isActiveSong} />

        <SongCardMenu
          song={song}
          isFavourite={isFavourite}
          isInQueue={isInQueue}
          onRemove={onRemove}
          onToggleFavourite={handleToggleFavourite}
          onPlayNext={handlePlayNext}
          onStartRadio={handleStartRadio}
          onAddToQueue={handleAddToQueue}
          onRemoveFromQueue={handleRemoveFromQueue}
          onOpenPlaylistPicker={handleOpenPlaylistPicker}
          onOpenShareModal={handleOpenShareModal}
          onDislike={(e) => {
            e.stopPropagation();
            playerActions.dislikeSong(song.id);
          }}
        />
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
