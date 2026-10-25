"use client";

import React, { useState } from "react";
import { useAppSelector } from "@/store/hooks";
import { motion } from "framer-motion";
import {
  Ban,
  CornerDownRight,
  Heart,
  ListMinus,
  ListPlus,
  Pause,
  Play,
  Plus,
  Radio,
  Share2,
} from "lucide-react";
import { toast } from "sonner";
import { musicApi } from "@/lib/api";
import { getImageUrl } from "@/lib/image-utils";
import { mapToPlayerSong } from "@/lib/player-utils";
import { previewPlayer } from "@/lib/preview-player";
import { playerActions } from "@/store/player.store";
import { cn } from "@/lib/utils";
import { PlaylistPickerModal } from "@/components/PlaylistPickerModal";
import { ShareSongModal } from "@/components/ShareSongModal";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
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
  const systemUser = useAppSelector((s) => s.auth.systemUser);
  const currentSong = useAppSelector((s) => s.player.currentSong);
  const isPlaying = useAppSelector((s) => s.player.isPlaying);
  const isAudioLoading = useAppSelector((s) => s.player.isLoading);
  const favourites = useAppSelector((s) => s.auth.favourites);
  const isInQueue = useAppSelector((s) =>
    s.queue.queue.some((item, idx) => idx > s.queue.lastQueueIndex && item.id === song.id),
  );
  const previewState = useAppSelector((s) => s.preview);

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

  const handlePlayToggle = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    previewPlayer.stopPreview(true);
    if (isActiveSong) {
      playerActions.setIsPlaying(!isPlaying);
    } else {
      let songToPlay = song;
      if (!song.songKey && song.id) {
        try {
          const res = await musicApi.songs.getById(song.id);
          if (res?.data) {
            songToPlay = { ...song, ...res.data };
          }
        } catch (err) {
          console.warn("Failed to load song details from DB for card:", err);
        }
      }
      playerActions.playWithRadio(mapToPlayerSong(songToPlay));
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

  const handlePlayNext = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    playerActions.playNext(mapToPlayerSong(song));
    toast.success("Playing next", {
      description: `"${song.title}" will play next.`,
    });
  };

  const handleStartRadio = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    previewPlayer.stopPreview(true);
    playerActions.playWithRadio(mapToPlayerSong(song));
    toast.success("Playing Song Radio", {
      description: `Starting infinite radio for "${song.title}"...`,
    });
  };

  const handleAddToQueue = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    playerActions.enqueue([mapToPlayerSong(song)]);
    toast.success("Added to queue", {
      description: `"${song.title}" added to queue.`,
    });
  };

  const handleRemoveFromQueue = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    playerActions.removeSongFromQueue(song.id);
    toast.success("Removed from queue", {
      description: `"${song.title}" removed from queue.`,
    });
  };

  const handleOpenPlaylistPicker = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    e?.preventDefault();
    if (!systemUser?.id) {
      toast.error("Sign in required", {
        description: "Please sign in to add songs to playlists.",
      });
      return;
    }
    setIsPlaylistModalOpen(true);
  };

  const handleOpenShareModal = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    e?.preventDefault();
    setIsShareModalOpen(true);
  };

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            onClick={handlePlayToggle}
            className={cn(
              "h-full p-2 sm:p-2.5 rounded-xl group cursor-pointer relative transition-all duration-300 hover:bg-[#222222] border",
              isActiveSong
                ? "bg-[#222222] border-primary/40 shadow-sm shadow-primary/10"
                : "bg-black/90 border-white/10 hover:border-white/20",
              className
            )}
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
        </ContextMenuTrigger>

        {/* Right Click Context Menu */}
        <ContextMenuContent className="w-52 bg-[#181818]/95 border-white/10 backdrop-blur-xl">
          <ContextMenuItem
            onClick={handlePlayToggle}
            className="gap-2.5 text-xs text-zinc-200 focus:bg-white/10 cursor-pointer"
          >
            {isActiveSong && isPlaying ? (
              <Pause size={14} className="text-primary" />
            ) : (
              <Play size={14} className="text-primary fill-primary" />
            )}
            <span>{isActiveSong && isPlaying ? "Pause" : "Play"}</span>
          </ContextMenuItem>

          <ContextMenuItem
            onClick={handlePlayNext}
            className="gap-2.5 text-xs text-zinc-200 focus:bg-white/10 cursor-pointer"
          >
            <CornerDownRight size={14} className="text-primary" />
            <span>Play next</span>
          </ContextMenuItem>

          <ContextMenuItem
            onClick={handleStartRadio}
            className="gap-2.5 text-xs text-zinc-200 focus:bg-white/10 cursor-pointer"
          >
            <Radio size={14} className="text-cyan-400" />
            <span>Start song radio</span>
          </ContextMenuItem>

          <ContextMenuSeparator className="bg-white/10" />

          <ContextMenuItem
            onClick={handleToggleFavourite}
            className="gap-2.5 text-xs text-zinc-200 focus:bg-white/10 cursor-pointer"
          >
            <Heart
              size={14}
              className={
                isFavourite ? "text-primary fill-primary" : "text-zinc-400"
              }
            />
            <span>
              {isFavourite ? "Remove from favourites" : "Save to favourites"}
            </span>
          </ContextMenuItem>

          {isInQueue ? (
            <ContextMenuItem
              onClick={handleRemoveFromQueue}
              className="gap-2.5 text-xs text-red-400 focus:text-red-300 focus:bg-red-500/10 cursor-pointer"
            >
              <ListMinus size={14} className="text-red-400" />
              <span>Remove from queue</span>
            </ContextMenuItem>
          ) : (
            <ContextMenuItem
              onClick={handleAddToQueue}
              className="gap-2.5 text-xs text-zinc-200 focus:bg-white/10 cursor-pointer"
            >
              <ListPlus size={14} className="text-zinc-400" />
              <span>Add to queue</span>
            </ContextMenuItem>
          )}

          <ContextMenuItem
            onClick={handleOpenPlaylistPicker}
            className="gap-2.5 text-xs text-zinc-200 focus:bg-white/10 cursor-pointer"
          >
            <Plus size={14} className="text-zinc-400" />
            <span>Add to playlist</span>
          </ContextMenuItem>

          <ContextMenuItem
            onClick={handleOpenShareModal}
            className="gap-2.5 text-xs text-zinc-200 focus:bg-white/10 cursor-pointer"
          >
            <Share2 size={14} className="text-primary" />
            <span>Share track</span>
          </ContextMenuItem>

          <ContextMenuSeparator className="bg-white/10" />

          <ContextMenuItem
            onClick={(e) => {
              e.stopPropagation();
              playerActions.dislikeSong(song.id);
            }}
            className="gap-2.5 text-xs text-zinc-400 focus:text-red-400 focus:bg-red-500/10 cursor-pointer"
          >
            <Ban size={14} className="text-zinc-400" />
            <span>Don't play this again</span>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

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
