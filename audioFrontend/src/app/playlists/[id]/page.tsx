"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { musicApi } from "@/lib/api";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  ListMusic,
  Play,
  Pause,
  Trash2,
  Clock,
  Music,
} from "lucide-react";
import { playerActions, playerStore } from "@/store/player.store";
import { mapListToPlayerSongs } from "@/lib/player-utils";
import { useStore } from "@tanstack/react-store";
import { toast } from "sonner";
import { getImageUrl } from "@/lib/image-utils";

export default function PlaylistPage() {
  const { id } = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();

  const systemUser = useStore(playerStore, (s) => s.systemUser);
  const currentSong = useStore(playerStore, (s) => s.currentSong);
  const isPlaying = useStore(playerStore, (s) => s.isPlaying);

  const playlistType = searchParams.get("type");

  /* -------------------------------------------------------------------------- */
  /*                                  PLAYLIST                                  */
  /* -------------------------------------------------------------------------- */

  const { data: playlistResponse, isLoading: isPlaylistLoading } = useQuery({
    queryKey: ["playlist", id, playlistType],
    queryFn: async () => {
      if (playlistType === "user") {
        return await musicApi.users.getPlaylistById(id as string);
      }

      if (playlistType === "system") {
        return await musicApi.playlists.getById(id as string);
      }

      try {
        return await musicApi.playlists.getById(id as string);
      } catch {
        return await musicApi.users.getPlaylistById(id as string);
      }
    },
  });

  /* -------------------------------------------------------------------------- */
  /*                                    SONGS                                   */
  /* -------------------------------------------------------------------------- */

  const { data: songsResponse, isLoading: isSongsLoading } = useQuery({
    queryKey: ["playlist-songs", id, playlistType],
    queryFn: async () => {
      if (playlistType === "user") {
        return await musicApi.users.getPlaylistSongs(id as string);
      }

      if (playlistType === "system") {
        return await musicApi.playlists.getSongs(id as string);
      }

      try {
        return await musicApi.playlists.getSongs(id as string);
      } catch {
        return await musicApi.users.getPlaylistSongs(id as string);
      }
    },
  });

  /* -------------------------------------------------------------------------- */
  /*                               DELETE PLAYLIST                              */
  /* -------------------------------------------------------------------------- */

  const deletePlaylist = useMutation({
    mutationFn: () => musicApi.users.deletePlaylist(id as string),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-playlists"] });
      router.push("/playlists");
    },
  });

  /* -------------------------------------------------------------------------- */
  /*                               REMOVE SONG                                  */
  /* -------------------------------------------------------------------------- */

  const removeSong = useMutation({
    mutationFn: (songId: string) =>
      musicApi.users.removeSongFromPlaylist(id as string, songId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["playlist-songs", id],
        exact: false,
      });
    },
  });

  /* -------------------------------------------------------------------------- */
  /*                                  DATA                                      */
  /* -------------------------------------------------------------------------- */

  const playlist = playlistResponse?.data;
  const songs = songsResponse?.data?.data || [];

  const isUserPlaylist =
    playlistType === "user" || (playlist && "userId" in playlist);

  const coverUrl = getImageUrl(playlist?.coverImageKey, {
    width: 1600,
    height: 900,
    focus: "auto",
    aspectRatio: "16-9",
  });

  /* -------------------------------------------------------------------------- */
  /*                                  LOADING                                   */
  /* -------------------------------------------------------------------------- */

  if (isPlaylistLoading || isSongsLoading) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-4 text-zinc-500">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
        <span className="text-xs font-black uppercase italic tracking-widest">
          Loading Playlist...
        </span>
      </div>
    );
  }

  /* -------------------------------------------------------------------------- */
  /*                              PLAY ALL                                      */
  /* -------------------------------------------------------------------------- */

  const handleStreamAll = () => {
    if (songs.length === 0) return;
    const playerSongs = mapListToPlayerSongs(songs);
    playerActions.playAll(playerSongs);
    toast.success("Playing All", {
      description: `Starting playback for ${songs.length} tracks.`,
    });
  };

  /* -------------------------------------------------------------------------- */
  /*                              PLAY SONG                                     */
  /* -------------------------------------------------------------------------- */

  const handlePlaySong = (song: any, index: number) => {
    const isActive = currentSong?.id === song.id;

    if (isActive) {
      playerActions.setIsPlaying(!isPlaying);
      return;
    }

    const playerSongs = mapListToPlayerSongs(songs);
    playerActions.playAllFrom(playerSongs, index);
  };

  /* -------------------------------------------------------------------------- */
  /*                             FORMAT DURATION                                */
  /* -------------------------------------------------------------------------- */

  const formatDuration = (val?: number | string) => {
    if (!val) return "0:00";
    const num = typeof val === "string" ? parseFloat(val) : val;
    if (isNaN(num) || num <= 0) return "0:00";

    const totalSeconds = num > 10000 ? Math.floor(num / 1000) : Math.floor(num);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  /* -------------------------------------------------------------------------- */
  /*                                   UI                                       */
  /* -------------------------------------------------------------------------- */

  return (
    <div className="min-h-full pb-24">
      {/* ====================================================================== */}
      {/*                    HERO — full-bleed background image                 */}
      {/* ====================================================================== */}

      <section className="relative h-[45vh] min-h-[360px] max-h-[460px] w-full overflow-hidden">
        {/* Background image, or a plain dark fallback if there's no cover */}
        {coverUrl ? (
          <img
            src={coverUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-zinc-900" />
        )}

        {/* Gradient only where it's needed: behind the text, and fading
            the bottom of the hero into the page background. No gradient
            is applied over the rest of the image. */}
        {coverUrl && (
          <>
            <div className="absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-t from-black via-black/70 to-transparent" />
            <div className="absolute inset-0 bg-black/10" />
          </>
        )}

        {/* Content, pinned to the bottom of the image like a Netflix title card */}
        <div className="relative z-10 flex h-full flex-col justify-end px-8 pb-6 md:px-12 md:pb-8">
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/80"
          >
            {isUserPlaylist ? "Playlist" : "Public Playlist"}
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.05 }}
            className="max-w-3xl break-words text-3xl font-black tracking-tight text-white drop-shadow-lg md:text-5xl"
          >
            {playlist?.title || playlist?.name}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.1 }}
            className="mt-2 max-w-xl text-sm leading-relaxed text-white/80"
          >
            {playlist?.description || "A curated playlist of songs."}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.15 }}
            className="mt-3 flex flex-wrap items-center gap-2 text-xs text-white/80"
          >
            <span className="font-semibold">
              {systemUser?.username || "OneMelody"}
            </span>

            {songs.length > 0 && (
              <>
                <span>•</span>
                <span>
                  {songs.length} {songs.length === 1 ? "song" : "songs"}
                </span>
                <span>•</span>
                <span>
                  {formatDuration(
                    songs.reduce(
                      (total: number, song: any) =>
                        total + (Number(song.duration) || 0),
                      0
                    )
                  )}
                </span>

                <button
                  onClick={handleStreamAll}
                  className="ml-3 flex items-center gap-1.5 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-white/80"
                >
                  <Play size={16} fill="black" />
                  Play
                </button>
              </>
            )}
          </motion.div>
        </div>
      </section>

      {/* ====================================================================== */}
      {/*                              TRACK LIST                                */}
      {/* ====================================================================== */}

      <section className="px-6 pb-10 pt-4 md:px-10">
        {/* Header */}
        <div className="grid grid-cols-12 items-center border-b border-white/10 px-4 pb-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
          <div className="col-span-1 text-center">#</div>
          <div className="col-span-7 md:col-span-6">Title</div>
          <div className="col-span-3 hidden md:block">Artist</div>
          <div className="col-span-4 text-right md:col-span-2">
            <Clock size={16} className="ml-auto" />
          </div>
        </div>

        {/* Songs */}
        <div className="mt-2 flex flex-col">
          {songs.length > 0 ? (
            songs.map((song: any, index: number) => {
              const isActive = currentSong?.id === song.id;
              const isCurrentPlaying = isActive && isPlaying;

              const songImage = getImageUrl(song.imageKey || song.coverImageKey, {
                width: 100,
                height: 100,
                aspectRatio: "1-1",
              });

              return (
                <motion.div
                  key={song.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2, delay: Math.min(index * 0.015, 0.3) }}
                  onClick={() => handlePlaySong(song, index)}
                  className={`group grid cursor-pointer grid-cols-12 items-center rounded-md px-4 py-2.5 transition-colors duration-150 ${
                    isActive ? "bg-white/10" : "hover:bg-white/[0.07]"
                  }`}
                >
                  {/* INDEX */}
                  <div className="col-span-1 flex items-center justify-center">
                    {isActive ? (
                      isCurrentPlaying ? (
                        <Pause size={14} className="text-primary" fill="currentColor" />
                      ) : (
                        <Play size={14} className="text-primary" fill="currentColor" />
                      )
                    ) : (
                      <>
                        <span className="text-xs text-zinc-500 group-hover:hidden">
                          {index + 1}
                        </span>
                        <Play
                          size={14}
                          fill="white"
                          className="hidden text-white group-hover:block"
                        />
                      </>
                    )}
                  </div>

                  {/* TITLE */}
                  <div className="col-span-7 flex min-w-0 items-center gap-3 md:col-span-6">
                    <div className="h-11 w-11 shrink-0 overflow-hidden rounded-md bg-zinc-900">
                      {songImage ? (
                        <img
                          src={songImage}
                          alt={song.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <Music size={17} className="text-zinc-600" />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <h4
                        className={`truncate text-sm font-medium transition-colors ${
                          isActive ? "text-primary" : "text-white"
                        }`}
                      >
                        {song.title}
                      </h4>
                      <p className="mt-0.5 truncate text-xs text-zinc-400">
                        {song.artistName}
                      </p>
                    </div>
                  </div>

                  {/* ARTIST */}
                  <div className="col-span-3 hidden min-w-0 md:block">
                    <span className="block truncate text-sm text-zinc-400 transition-colors group-hover:text-white">
                      {song.artistName}
                    </span>
                  </div>

                  {/* DURATION / DELETE */}
                  <div className="col-span-4 flex items-center justify-end gap-4 text-xs tabular-nums text-zinc-400 md:col-span-2">
                    {isUserPlaylist && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toast.promise(removeSong.mutateAsync(song.id), {
                            loading: "Removing track...",
                            success: "Track Removed",
                            error: "Failed to remove",
                            description: `"${song.title}" removed from playlist.`,
                          });
                        }}
                        className="hidden rounded p-1 text-zinc-500 transition-colors hover:text-red-400 group-hover:block"
                        title="Remove from playlist"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                    <span>{formatDuration(song.duration)}</span>
                  </div>
                </motion.div>
              );
            })
          ) : (
            <div className="rounded-xl border border-dashed border-white/10 py-20 text-center">
              <Music size={40} className="mx-auto mb-4 text-zinc-700" />
              <p className="text-sm text-zinc-500">No songs in this playlist yet</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}