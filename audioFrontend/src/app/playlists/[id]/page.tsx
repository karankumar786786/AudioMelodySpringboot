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

  const formatDuration = (val?: number | string) => {
    if (!val) return "0:00";
    const num = typeof val === "string" ? parseFloat(val) : val;
    if (isNaN(num) || num <= 0) return "0:00";
    const totalSeconds = num > 10000 ? Math.floor(num / 1000) : Math.floor(num);
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
    <div className="px-10 pb-20 space-y-8 relative pt-4">
      {/* Back Button */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-zinc-300 hover:text-white transition-colors text-xs font-semibold bg-[#282828] border border-[#383838] px-4 py-2 rounded-full hover:bg-[#333333] active:scale-95 duration-200 cursor-pointer"
      >
        <ArrowLeft size={14} /> Back
      </button>

      {/* Playlist Hero */}
      <section className="relative h-80 w-full overflow-hidden rounded-xl border border-[#282828] bg-[#181818] group shadow-xl">
        <div className="absolute inset-0 bg-[#181818]">
          {playlist?.bannerImageKey ? (
            <img
              src={bannerUrl}
              alt=""
              className="h-full w-full object-cover opacity-20 blur-md"
            />
          ) : (
            <div className="h-full w-full bg-[#181818]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#181818] via-[#181818]/80 to-transparent z-10" />
        </div>

        <div className="absolute inset-0 flex items-end p-8 gap-8 z-20">
          {/* Cover Art */}
          <div className="h-44 w-44 shrink-0 overflow-hidden rounded-md border border-[#282828] shadow-md relative bg-zinc-900 flex items-center justify-center">
            {playlist?.coverImageKey ? (
              <img
                src={coverUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <ListMusic className="text-zinc-600" size={56} />
            )}
          </div>

          <div className="flex-1 space-y-3 pb-1">
            <div className="space-y-1">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
                Playlist
              </span>
              <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight">
                {playlist?.title || playlist?.name}
              </h1>
            </div>

            <p className="max-w-xl text-zinc-400 font-normal text-xs line-clamp-2 leading-relaxed">
              {playlist?.description || "A curated playlist of songs."}
            </p>

            <div className="flex items-center gap-4 pt-2">
              <button
                onClick={handleStreamAll}
                disabled={songs.length === 0}
                className="px-8 h-11 bg-primary text-black rounded-full font-bold text-xs uppercase tracking-wider hover:scale-105 transition-all flex items-center gap-2 shadow-md cursor-pointer disabled:opacity-50"
              >
                <Play fill="black" size={16} />
                Play All
              </button>

              {isUserPlaylist && (
                <button
                  onClick={() => {
                    toast.promise(deletePlaylist.mutateAsync(), {
                      loading: "Deleting Playlist...",
                      success: "Playlist Deleted",
                      error: "Delete Failed",
                      description: "The playlist has been removed.",
                    });
                  }}
                  className="h-11 w-11 rounded-full bg-[#282828] border border-[#383838] flex items-center justify-center text-red-400 hover:bg-red-500 hover:text-white transition-all cursor-pointer shadow-md"
                  title="Delete Playlist"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Tracks Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-[#282828] pb-3">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-bold text-white tracking-tight">
              Songs
            </h3>
            <span className="text-xs font-medium text-zinc-400">
              {songs.length} {songs.length === 1 ? "track" : "tracks"}
            </span>
          </div>
        </div>

        <div className="space-y-1">
          {/* Table Header */}
          <div className="grid grid-cols-12 w-full px-4 py-2 text-zinc-400 text-xs font-semibold uppercase tracking-wider border-b border-[#282828] select-none">
            <div className="col-span-1 text-center">#</div>
            <div className="col-span-6 md:col-span-6">Title</div>
            <div className="col-span-3 hidden md:block">Artist</div>
            <div className="col-span-2 text-right pr-4 flex justify-end items-center">
              <Clock size={16} />
            </div>
          </div>

          <div className="flex flex-col gap-1 pt-1">
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
                        const allPlayerSongs = mapListToPlayerSongs(songs);
                        playerActions.playAllFrom(allPlayerSongs, index);
                      }
                    }}
                    className={`group grid grid-cols-12 items-center px-4 py-2.5 rounded-md border border-transparent transition-all duration-200 text-left cursor-pointer hover:bg-[#282828] ${
                      isActive ? "bg-[#282828]" : ""
                    }`}
                  >
                    {/* Index */}
                    <div className="col-span-1 text-center text-zinc-400 text-xs font-medium flex items-center justify-center">
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
                        <>
                          <span className="group-hover:hidden">
                            {index + 1}
                          </span>
                          <Play
                            size={14}
                            className="hidden group-hover:block text-white fill-white"
                          />
                        </>
                      )}
                    </div>

                    {/* Title & Thumbnail */}
                    <div className="col-span-6 md:col-span-6 flex items-center gap-3 min-w-0 pr-4">
                      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-zinc-900 shadow-sm">
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
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-zinc-600">
                            <Music size={16} />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4
                          className={`font-semibold truncate text-sm transition-colors ${
                            isActive
                              ? "text-primary"
                              : "text-white group-hover:text-white"
                          }`}
                        >
                          {song.title}
                        </h4>
                        <p className="text-xs text-zinc-400 truncate block md:hidden mt-0.5">
                          {song.artistName}
                        </p>
                      </div>
                    </div>

                    {/* Artist */}
                    <div className="col-span-3 hidden md:block min-w-0 pr-4">
                      <span className="text-zinc-400 font-normal text-xs hover:underline hover:text-white transition-colors truncate block">
                        {song.artistName}
                      </span>
                    </div>

                    {/* Duration & Delete Action */}
                    <div className="col-span-2 flex items-center justify-end gap-3 text-zinc-400 text-xs font-normal tabular-nums pr-2">
                      <span>{formatDuration(song.duration)}</span>
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
                          className="p-1 rounded text-zinc-400 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                          title="Remove from playlist"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-16 text-center border border-dashed border-[#282828] rounded-xl font-medium">
                <Music className="mx-auto text-zinc-600 mb-3" size={36} />
                <p className="text-zinc-400 text-xs font-normal">
                  No songs in this playlist yet
                </p>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
