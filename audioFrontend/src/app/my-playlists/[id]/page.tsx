"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { musicApi } from "@/lib/api";
import { useParams, useRouter } from "next/navigation";
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
import { getSolidBgFromImage } from "@/lib/color-utils";
import { NotFoundPage, ServerErrorPage, SomethingWentWrongPage } from "@/components/ErrorPages";

export default function MyPlaylistPage() {
  const { id } = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();

  const systemUser = useStore(playerStore, (s) => s.systemUser);
  const currentSong = useStore(playerStore, (s) => s.currentSong);
  const isPlaying = useStore(playerStore, (s) => s.isPlaying);

  const [backgroundColor, setBackgroundColor] = useState("#181818");

  /* -------------------------------------------------------------------------- */
  /*                                  PLAYLIST                                  */
  /* -------------------------------------------------------------------------- */

  const { data: playlistResponse, isLoading: isPlaylistLoading, error: playlistError, refetch: refetchPlaylist } = useQuery({
    queryKey: ["user-playlist", id],
    queryFn: () => musicApi.users.getPlaylistById(id as string),
    enabled: !!systemUser?.id,
  });

  /* -------------------------------------------------------------------------- */
  /*                                    SONGS                                   */
  /* -------------------------------------------------------------------------- */

  const { data: songsResponse, isLoading: isSongsLoading, error: songsError, refetch: refetchSongs } = useQuery({
    queryKey: ["user-playlist-songs", id],
    queryFn: () => musicApi.users.getPlaylistSongs(id as string),
    enabled: !!systemUser?.id,
  });

  /* -------------------------------------------------------------------------- */
  /*                               DELETE PLAYLIST                              */
  /* -------------------------------------------------------------------------- */

  const deletePlaylist = useMutation({
    mutationFn: () => musicApi.users.deletePlaylist(id as string),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-playlists"] });
      toast.success("Playlist deleted");
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
        queryKey: ["user-playlist-songs", id],
        exact: false,
      });
    },
  });

  /* -------------------------------------------------------------------------- */
  /*                                  DATA                                      */
  /* -------------------------------------------------------------------------- */

  const playlist = playlistResponse?.data;
  const songs = songsResponse?.data?.data || [];

  /* -------------------------------------------------------------------------- */
  /*                                COVER IMAGE                                 */
  /* -------------------------------------------------------------------------- */

  // A playlist may have an explicit custom cover. If it doesn't, we build a
  // Spotify-style cover from the tracks themselves: a 2x2 mosaic when there
  // are 4+ songs, the first song's art when there are 1-3, or the plain
  // ListMusic icon when the playlist is empty.
  const coverUrl = getImageUrl(playlist?.coverImageKey, {
    width: 600,
    height: 600,
    focus: "auto",
    aspectRatio: "1-1",
  });

  const hasCustomCover = Boolean(coverUrl);

  const mosaicImages = songs.slice(0, 4).map((song: any) =>
    getImageUrl(song.imageKey || song.coverImageKey, {
      width: 300,
      height: 300,
      aspectRatio: "1-1",
    })
  );

  const showMosaic = !hasCustomCover && songs.length >= 4;
  const showSingleSongImage =
    !hasCustomCover && songs.length > 0 && songs.length < 4;
  const singleSongImage = showSingleSongImage ? mosaicImages[0] : null;

  // Whichever image is actually on screen is what we pull the background
  // gradient color from, same as Spotify does off the visible artwork.
  const colorSourceImage = coverUrl || mosaicImages[0] || null;

  /* -------------------------------------------------------------------------- */
  /*                         EXTRACT PLAYLIST COLOR                             */
  /* -------------------------------------------------------------------------- */

  useEffect(() => {
    let cancelled = false;
    async function extractColor() {
      if (!colorSourceImage) {
        setBackgroundColor("#181818");
        return;
      }
      const color = await getSolidBgFromImage(
        colorSourceImage,
        playlist?.name || "playlist"
      );
      if (!cancelled) setBackgroundColor(color);
    }
    extractColor();
    return () => {
      cancelled = true;
    };
  }, [colorSourceImage, playlist?.name]);

  /* -------------------------------------------------------------------------- */
  /*                                  LOADING                                   */
  /* -------------------------------------------------------------------------- */

  if (!systemUser?.id) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-4 text-zinc-500">
        <p className="text-sm font-medium">Sign in to view your playlists.</p>
      </div>
    );
  }

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

  // Error & Not Found handling
  if (playlistError || !playlist) {
    const is404 =
      !playlist ||
      (playlistError as any)?.status === 404 ||
      (playlistError as any)?.response?.status === 404;
    const is500 =
      (playlistError as any)?.status >= 500 ||
      (playlistError as any)?.response?.status >= 500;

    if (is404 && !is500) {
      return <NotFoundPage />;
    }
    if (is500) {
      return <ServerErrorPage onRetry={() => { refetchPlaylist(); refetchSongs(); }} />;
    }
    return (
      <SomethingWentWrongPage
        error={playlistError as Error}
        reset={() => { refetchPlaylist(); refetchSongs(); }}
      />
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
      {/*                              HERO                                      */}
      {/* ====================================================================== */}

      <section
        className="relative overflow-hidden px-8 pb-8 pt-24 md:px-10 md:pt-28"
        style={{
          background: `linear-gradient(to bottom, ${backgroundColor} 0%, ${backgroundColor} 35%, rgba(0,0,0,0.92) 100%)`,
        }}
      >
       

        {/* Playlist information */}
        <div className="relative z-10 flex flex-col items-center gap-7 md:flex-row md:items-end">
          {/* Cover — custom cover, 4-song mosaic, single song art, or icon */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="h-52 w-52 shrink-0 overflow-hidden rounded-md bg-zinc-900 shadow-2xl md:h-56 md:w-56"
          >
            {hasCustomCover ? (
              <img
                src={coverUrl}
                alt={playlist?.name || "Playlist"}
                className="h-full w-full object-cover"
              />
            ) : showMosaic ? (
              <div className="grid h-full w-full grid-cols-2 grid-rows-2">
                {mosaicImages.map((img: string | null, i: number) =>
                  img ? (
                    <img
                      key={i}
                      src={img}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div
                      key={i}
                      className="flex h-full w-full items-center justify-center bg-zinc-800"
                    >
                      <Music size={20} className="text-zinc-600" />
                    </div>
                  )
                )}
              </div>
            ) : showSingleSongImage && singleSongImage ? (
              <img
                src={singleSongImage}
                alt={playlist?.name || "Playlist"}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <ListMusic size={64} className="text-zinc-600" />
              </div>
            )}
          </motion.div>

          {/* Details */}
          <motion.div
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35, delay: 0.05 }}
            className="min-w-0 flex-1 pb-1"
          >
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/80">
              Your Playlist
            </p>

            <h1 className="break-words text-4xl font-black tracking-tight text-white md:text-6xl">
              {playlist?.name}
            </h1>

            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/70">
              {playlist?.description || "A curated playlist of songs."}
            </p>

            <div className="mt-4 flex items-center gap-2 text-xs text-white/80">
              <span className="font-semibold">
                {systemUser?.username || systemUser?.name || "You"}
              </span>
              <span>•</span>
              <span>
                {songs.length} {songs.length === 1 ? "song" : "songs"}
              </span>

              {songs.length > 0 && (
                <>
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
                    type="button"
                    onClick={handleStreamAll}
                    className="ml-3 flex items-center gap-1.5 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-white/80"
                  >
                    <Play size={16} fill="black" />
                    Play All
                  </button>
                </>
              )}

              {/* Delete playlist */}
              <button
                onClick={() => {
                  if (!confirm(`Delete "${playlist.name}"? This cannot be undone.`)) return;
                  toast.promise(deletePlaylist.mutateAsync(), {
                    loading: "Deleting playlist...",
                    success: "Playlist deleted",
                    error: "Failed to delete playlist",
                  });
                }}
                className="ml-2 flex items-center gap-1.5 rounded-full border border-red-500/30 px-3 py-1.5 text-xs font-semibold text-red-400 transition-colors hover:border-red-400 hover:text-red-300"
                title="Delete playlist"
              >
                <Trash2 size={13} /> Delete
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ====================================================================== */}
      {/*                              TRACK LIST                                */}
      {/* ====================================================================== */}

      <section className="px-6 pb-10 pt-6 md:px-10">
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
                  {/* Index */}
                  <div className="col-span-1 flex items-center justify-center">
                    {isActive ? (
                      isCurrentPlaying ? (
                        <Pause size={14} className="text-primary" fill="currentColor" />
                      ) : (
                        <Play size={14} className="text-primary" fill="currentColor" />
                      )
                    ) : (
                      <>
                        <span className="text-xs text-zinc-500 group-hover:hidden">{index + 1}</span>
                        <Play size={14} fill="white" className="hidden text-white group-hover:block" />
                      </>
                    )}
                  </div>

                  {/* Title */}
                  <div className="col-span-7 flex min-w-0 items-center gap-3 md:col-span-6">
                    <div className="h-11 w-11 shrink-0 overflow-hidden rounded-md bg-zinc-900">
                      {songImage ? (
                        <img src={songImage} alt={song.title} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <Music size={17} className="text-zinc-600" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className={`truncate text-sm font-medium transition-colors ${isActive ? "text-primary" : "text-white"}`}>
                        {song.title}
                      </h4>
                      <p className="mt-0.5 truncate text-xs text-zinc-400">{song.artistName}</p>
                    </div>
                  </div>

                  {/* Artist */}
                  <div className="col-span-3 hidden min-w-0 md:block">
                    <span className="block truncate text-sm text-zinc-400 transition-colors group-hover:text-white">
                      {song.artistName}
                    </span>
                  </div>

                  {/* Duration / Remove */}
                  <div className="col-span-4 flex items-center justify-end gap-4 text-xs tabular-nums text-zinc-400 md:col-span-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toast.promise(removeSong.mutateAsync(song.id), {
                          loading: "Removing track...",
                          success: "Track removed",
                          error: "Failed to remove",
                          description: `"${song.title}" removed from playlist.`,
                        });
                      }}
                      className="hidden rounded p-1 text-zinc-500 transition-colors hover:text-red-400 group-hover:block"
                      title="Remove from playlist"
                    >
                      <Trash2 size={14} />
                    </button>
                    <span>{formatDuration(song.duration)}</span>
                  </div>
                </motion.div>
              );
            })
          ) : (
            <div className="rounded-xl border border-dashed border-white/10 py-20 text-center">
              <Music size={40} className="mx-auto mb-4 text-zinc-700" />
              <p className="text-sm text-zinc-500">No songs in this playlist yet.</p>
              <p className="mt-1 text-xs text-zinc-600">Add songs using the playlist picker on any song.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}