"use client";

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
  ArrowLeft,
  Sparkles,
} from "lucide-react";
import { playerActions, playerStore } from "@/store/player.store";
import { mapListToPlayerSongs, mapToPlayerSong } from "@/lib/player-utils";
import { useStore } from "@tanstack/react-store";
import { toast } from "sonner";
import { getImageUrl } from "@/lib/image-utils";
import { useState, useEffect } from "react";

export default function PlaylistPage() {
  const { id } = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();

  const systemUser = useStore(playerStore, (s) => s.systemUser);
  const currentSong = useStore(playerStore, (s) => s.currentSong);
  const isPlaying = useStore(playerStore, (s) => s.isPlaying);

  const playlistType = searchParams.get("type");

  const { data: playlistResponse, isLoading: isPlaylistLoading } = useQuery({
    queryKey: ["playlist", id, playlistType],
    queryFn: async () => {
      if (playlistType === "user") {
        return await musicApi.users.getPlaylistById(id as string);
      } else if (playlistType === "system") {
        return await musicApi.playlists.getById(id as string);
      } else {
        try {
          return await musicApi.playlists.getById(id as string);
        } catch (err) {
          return await musicApi.users.getPlaylistById(id as string);
        }
      }
    },
  });

  const { data: songsResponse, isLoading: isSongsLoading } = useQuery({
    queryKey: ["playlist-songs", id, playlistType],
    queryFn: async () => {
      if (playlistType === "user") {
        return await musicApi.users.getPlaylistSongs(id as string);
      } else if (playlistType === "system") {
        return await musicApi.playlists.getSongs(id as string);
      } else {
        try {
          const res = await musicApi.playlists.getSongs(id as string);
          if (res.data?.data && res.data.data.length > 0) return res;
          return res;
        } catch (err) {
          return await musicApi.users.getPlaylistSongs(id as string);
        }
      }
    },
  });

  const deletePlaylist = useMutation({
    mutationFn: () => musicApi.users.deletePlaylist(id as string),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-playlists"] });
      router.push("/playlists");
    },
  });

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

  const formatDuration = (ms: number) => {
    if (!ms) return "0:00";
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  if (isPlaylistLoading || isSongsLoading) {
    return (
      <div className="p-20 text-center animate-pulse text-zinc-500 uppercase font-black text-xs italic tracking-widest flex flex-col items-center justify-center gap-4 h-[60vh]">
        <div className="w-10 h-10 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
        Loading Playlist Details...
      </div>
    );
  }

  const playlist = playlistResponse?.data;
  const songs = songsResponse?.data?.data || [];
  const isUserPlaylist =
    playlistType === "user" || (playlist && "userId" in playlist);

  const handleStreamAll = () => {
    if (songs.length === 0) return;
    const playerSongs = mapListToPlayerSongs(songs);
    playerActions.playAll(playerSongs);
    toast.success("Playing All", {
      description: `Starting playback for ${songs.length} tracks.`,
    });
  };

  const bannerUrl = getImageUrl(playlist?.bannerImageKey, {
    width: 1600,
    height: 800,
    focus: "auto",
    aspectRatio: "2-1",
  });
  const coverUrl = getImageUrl(playlist?.coverImageKey, {
    width: 400,
    height: 400,
    focus: "auto",
    aspectRatio: "1-1",
  });

  return (
    <div className="px-10 pb-20 space-y-10 relative">
      {/* Back Button */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors text-xs font-black uppercase tracking-wider bg-white/5 border border-white/5 px-4 py-2.5 rounded-full hover:bg-white/10 active:scale-95 duration-200"
      >
        <ArrowLeft size={14} /> Back
      </button>

      {/* Playlist Hero */}
      <section className="relative h-[480px] w-full overflow-hidden rounded-[3.5rem] border border-white/5 shadow-2xl group">
        <div className="absolute inset-0 bg-zinc-950">
          {playlist?.bannerImageKey ? (
            <motion.img
              src={bannerUrl}
              alt=""
              initial={{ scale: 1 }}
              animate={{ scale: 1.05 }}
              transition={{
                duration: 20,
                repeat: Infinity,
                repeatType: "mirror",
                ease: "linear",
              }}
              className="h-full w-full object-cover opacity-25 blur-[2px] transition-all duration-[2s]"
            />
          ) : (
            <div className="h-full w-full bg-linear-to-br from-primary/10 via-zinc-950 to-black" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-transparent z-10" />
        </div>

        <div className="absolute inset-0 flex items-end p-12 gap-10 z-20">
          {/* Cover Art */}
          <div className="h-60 w-60 shrink-0 overflow-hidden rounded-[2.5rem] border-[6px] border-black/40 shadow-2xl md:block group-hover:scale-103 transition-transform duration-700 relative bg-zinc-950 flex items-center justify-center">
            {playlist?.coverImageKey ? (
              <img
                src={coverUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <ListMusic className="text-zinc-700" size={72} />
            )}
          </div>

          <div className="flex-1 space-y-5 pb-2">
            <div className="space-y-1">
              <span className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.3em] text-primary italic bg-primary/10 px-3 py-1 rounded-full border border-primary/20">
                <Sparkles size={10} className="fill-primary" /> Playlist Cluster
              </span>
              <h1 className="text-6xl md:text-7xl font-black text-white italic tracking-tighter uppercase drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
                {playlist?.title || playlist?.name}
              </h1>
            </div>

            <p className="max-w-xl text-zinc-400 font-medium italic text-xs opacity-80 line-clamp-2 leading-relaxed">
              {playlist?.description ||
                "A curated cluster of synchronized acoustic signals compiled for neural alignment."}
            </p>

            <div className="flex items-center gap-4">
              <button
                onClick={handleStreamAll}
                disabled={songs.length === 0}
                className="px-10 h-14 bg-primary text-black rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 active:scale-95 transition-all flex items-center gap-2.5 shadow-xl shadow-primary/25 disabled:opacity-50"
              >
                <Play fill="black" size={16} />
                Stream Playlist
              </button>

              {isUserPlaylist && (
                <button
                  onClick={() => {
                    toast.promise(deletePlaylist.mutateAsync(), {
                      loading: "Deleting Playlist...",
                      success: "Playlist Deleted",
                      error: "Delete Failed",
                      description:
                        "The playlist has been removed from the synchronization grid.",
                    });
                  }}
                  className="h-14 w-14 rounded-2xl bg-red-500/10 border border-red-500/10 flex items-center justify-center text-red-500 hover:bg-red-500 hover:text-white transition-all duration-300 shadow-lg hover:shadow-red-500/20 active:scale-95"
                  title="Delete Playlist"
                >
                  <Trash2 size={18} />
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Tracks Section */}
      <section className="space-y-6">
        <div className="flex items-center justify-between border-b border-white/5 pb-4">
          <div className="flex items-center gap-4">
            <h3 className="text-xl font-black italic uppercase tracking-tighter text-white">
              Songs
            </h3>
            <div className="px-3 py-0.5 rounded-full bg-white/5 border border-white/10 text-[9px] font-black text-zinc-400 uppercase tracking-widest">
              {songs.length} Nodes
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {/* Table Header */}
          <div className="grid grid-cols-12 w-full px-6 py-1.5 text-zinc-500 text-[9px] font-black uppercase tracking-[0.2em] italic">
            <div className="col-span-1 text-center">#</div>
            <div className="col-span-6 md:col-span-7">Title</div>
            <div className="col-span-3 hidden md:block">Artist</div>
            <div className="col-span-2 text-right md:text-left">Duration</div>
          </div>

          <div className="flex flex-col gap-2">
            {songs.length > 0 ? (
              songs.map((song: any, index: number) => {
                const isActive = currentSong?.id === song.id;
                const isCurrentPlaying = isActive && isPlaying;
                return (
                  <div
                    key={song.id}
                    onClick={() => {
                      if (isActive) {
                        playerActions.setIsPlaying(!isPlaying);
                      } else {
                        playerActions.playSong(mapToPlayerSong(song));
                      }
                    }}
                    className={`group grid grid-cols-12 items-center gap-4 p-4 rounded-[1.8rem] border transition-all duration-300 text-left cursor-pointer ${
                      isActive
                        ? "bg-primary/5 border-primary/20 shadow-[0_4px_20px_rgba(120,240,142,0.08)]"
                        : "bg-white/1 border-transparent hover:border-white/5 hover:bg-white/3"
                    }`}
                  >
                    {/* Index */}
                    <div className="col-span-1 text-center text-zinc-500 font-black text-xs group-hover:text-primary transition-colors italic flex items-center justify-center">
                      {isActive ? (
                        isCurrentPlaying ? (
                          <Pause
                            size={14}
                            className="text-primary fill-primary"
                          />
                        ) : (
                          <Play
                            size={14}
                            className="text-primary fill-primary"
                          />
                        )
                      ) : (
                        <span className="group-hover:hidden">
                          {(index + 1).toString().padStart(2, "0")}
                        </span>
                      )}
                      {!isActive && (
                        <Play
                          size={12}
                          className="hidden group-hover:block text-primary fill-primary"
                        />
                      )}
                    </div>

                    {/* Title & Image */}
                    <div className="col-span-6 md:col-span-7 flex items-center gap-4">
                      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-white/5 shadow-md">
                        {song.imageKey || song.coverImageKey ? (
                          <img
                            src={
                              getImageUrl(song.imageKey || song.coverImageKey, {
                                width: 100,
                                height: 100,
                                aspectRatio: "1-1",
                              })!
                            }
                            alt={song.title}
                            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center bg-zinc-900 text-zinc-700">
                            <Music size={16} />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <h4
                          className={`font-black italic uppercase tracking-tighter transition-colors truncate text-base leading-tight ${
                            isActive
                              ? "text-primary"
                              : "text-white group-hover:text-primary"
                          }`}
                        >
                          {song.title}
                        </h4>
                        <div className="flex items-center gap-2 mt-0.5">
                          {song.language && (
                            <span className="px-1.5 py-0.5 rounded bg-primary/10 border border-primary/20 text-[7px] text-primary font-black uppercase tracking-widest whitespace-nowrap">
                              {song.language}
                            </span>
                          )}
                          <p className="text-[8px] font-black uppercase tracking-widest text-zinc-500 italic group-hover:text-zinc-300 transition-colors block md:hidden truncate">
                            {song.artistName}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Artist */}
                    <div className="col-span-3 hidden md:block">
                      <span className="text-zinc-400 font-black uppercase italic tracking-widest text-[9px] group-hover:text-white transition-colors truncate block">
                        {song.artistName}
                      </span>
                    </div>

                    {/* Duration & Delete */}
                    <div className="col-span-5 md:col-span-1 flex items-center justify-between text-zinc-400 text-[9px] font-black uppercase tracking-widest italic group-hover:text-white transition-colors tabular-nums">
                      <span>{formatDuration(song.duration)}</span>
                      {isUserPlaylist && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toast.promise(removeSong.mutateAsync(song.id), {
                              loading: "Severing Node...",
                              success: "Track Removed",
                              error: "Failed to remove",
                              description:
                                "The song has been decoupled from this cluster.",
                            });
                          }}
                          className="p-2.5 rounded-xl bg-red-500/5 text-red-500/40 hover:bg-red-500 hover:text-white opacity-0 group-hover:opacity-100 transition-all scale-75 group-hover:scale-100 shadow-md shadow-red-500/10 ml-2"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-32 text-center border-2 border-dashed border-zinc-900 rounded-[3rem]">
                <Music className="mx-auto text-zinc-800 mb-4" size={48} />
                <p className="text-zinc-600 font-black uppercase italic tracking-[0.3em] text-[9px]">
                  Neural Pathways Empty
                </p>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
