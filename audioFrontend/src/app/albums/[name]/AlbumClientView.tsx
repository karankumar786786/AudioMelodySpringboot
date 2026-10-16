"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useStore } from "@tanstack/react-store";
import { motion } from "framer-motion";
import { Play, Pause, Clock, Disc, Share2, Sparkles, Headphones } from "lucide-react";
import { musicApi, type Song } from "@/lib/api";
import { getImageUrl } from "@/lib/image-utils";
import { formatDuration, formatStreamCount, mapListToPlayerSongs } from "@/lib/player-utils";
import { playerActions, playerStore } from "@/store/player.store";
import { previewPlayer } from "@/lib/preview-player";
import { SongThumbnail } from "@/components/SongThumbnail";
import { getSolidBgFromImage } from "@/lib/color-utils";
import { toast } from "sonner";

interface AlbumClientViewProps {
  albumName: string;
  initialSongs?: Song[];
}

export function AlbumClientView({ albumName, initialSongs = [] }: AlbumClientViewProps) {
  const currentSong = useStore(playerStore, (s) => s.currentSong);
  const isPlaying = useStore(playerStore, (s) => s.isPlaying);

  const { data: songs = initialSongs, isLoading, error } = useQuery({
    queryKey: ["album-songs", albumName],
    queryFn: () => musicApi.albums.getByName(albumName),
    initialData: initialSongs.length > 0 ? initialSongs : undefined,
    enabled: !!albumName,
  });

  const totalDuration = useMemo(() => {
    return songs.reduce((acc, song) => acc + (Number(song.duration) || 0), 0);
  }, [songs]);

  const totalStreams = useMemo(() => {
    return songs.reduce((acc, song) => acc + (Number(song.totalStreams) || 0), 0);
  }, [songs]);

  const artistName = useMemo(() => {
    return songs[0]?.artistName || "Various Artists";
  }, [songs]);

  const primaryGenre = useMemo(() => {
    return songs.find((s) => s.genre)?.genre || null;
  }, [songs]);

  const [backgroundColor, setBackgroundColor] = useState("#181818");

  const coverImage = useMemo(() => {
    const songWithImage = songs.find((s) => s.imageKey);
    if (!songWithImage?.imageKey) return null;
    return getImageUrl(songWithImage.imageKey, {
      width: 500,
      height: 500,
      aspectRatio: "1-1",
    });
  }, [songs]);

  /* -------------------------------------------------------------------------- */
  /*                          EXTRACT DOMINANT COLOR                            */
  /* -------------------------------------------------------------------------- */
  useEffect(() => {
    let cancelled = false;

    async function extractColor() {
      if (!coverImage) {
        setBackgroundColor("#181818");
        return;
      }

      const color = await getSolidBgFromImage(coverImage, albumName || "album");

      if (!cancelled) {
        setBackgroundColor(color);
      }
    }

    extractColor();

    return () => {
      cancelled = true;
    };
  }, [coverImage, albumName]);

  const handlePlaySong = (song: Song, index: number) => {
    previewPlayer.stopPreview(true);
    const isActive = currentSong?.id === song.id;
    if (isActive) {
      playerActions.setIsPlaying(!isPlaying);
      return;
    }
    const allPlayerSongs = mapListToPlayerSongs(songs);
    playerActions.playAllFrom(allPlayerSongs, index);
    toast.success("Playing track", {
      description: `"${song.title}" from ${albumName}`,
    });
  };

  const handlePlayAll = () => {
    if (songs.length === 0) return;
    previewPlayer.stopPreview(true);
    const allPlayerSongs = mapListToPlayerSongs(songs);
    playerActions.playAll(allPlayerSongs);
    toast.success("Playing album", {
      description: `Now playing all ${songs.length} tracks from ${albumName}`,
    });
  };

  const handleShare = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      toast.success("Link copied", {
        description: "Album link copied to clipboard",
      });
    }
  };

  if (isLoading && songs.length === 0) {
    return (
      <div className="flex h-full min-h-[50vh] items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <Sparkles className="h-4 w-4 animate-spin text-primary" />
          <span>Loading album tracks...</span>
        </div>
      </div>
    );
  }

  if (error || (songs.length === 0 && !isLoading)) {
    return (
      <div className="flex h-full min-h-[50vh] flex-col items-center justify-center p-8 text-center">
        <Disc size={48} className="text-zinc-600 mb-3" />
        <h2 className="text-lg font-bold text-white">Album Not Found</h2>
        <p className="text-xs text-zinc-400 mt-1">
          No songs were found matching album "{albumName}".
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-full pb-24 px-2">
      {/* HERO */}
      <section
        className="relative overflow-hidden px-8 pb-8 pt-20 md:px-10 md:pt-24 rounded-2xl border-b border-white/5 transition-colors duration-500"
        style={{
          background: `linear-gradient(to bottom, ${backgroundColor} 0%, ${backgroundColor} 35%, rgba(0,0,0,0.92) 100%)`,
        }}
      >
        <div className="pointer-events-none absolute inset-0 bg-black/10" />

        <div className="relative z-10 flex flex-col items-center gap-7 md:flex-row md:items-end">
          {/* Cover Art */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="h-48 w-48 shrink-0 overflow-hidden rounded-2xl bg-zinc-900 shadow-2xl md:h-56 md:w-56 border border-white/10"
          >
            {coverImage ? (
              <img
                src={coverImage}
                alt={albumName}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-zinc-800 text-zinc-600">
                <Disc size={64} />
              </div>
            )}
          </motion.div>

          {/* Album Metadata */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.05 }}
            className="flex flex-col items-center text-center md:items-start md:text-left min-w-0"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/20 border border-primary/30 text-[11px] font-bold text-primary uppercase tracking-wider">
                <Disc size={11} />
                <span>Album</span>
              </span>
              {primaryGenre && (
                <span className="px-2.5 py-0.5 rounded-full bg-white/10 text-[11px] font-medium text-zinc-300">
                  {primaryGenre}
                </span>
              )}
            </div>

            <h1 className="text-3xl font-black tracking-tight my-2 py-2 text-white md:text-5xl lg:text-6xl line-clamp-2">
              {albumName}
            </h1>

            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 text-xs text-zinc-300 mt-2">
              <span className="font-semibold text-white hover:underline cursor-pointer">
                {artistName}
              </span>
              <span>&bull;</span>
              <span>{songs.length} tracks</span>
              {totalDuration > 0 && (
                <>
                  <span>&bull;</span>
                  <span>{formatDuration(totalDuration)}</span>
                </>
              )}
              {totalStreams > 0 && (
                <>
                  <span>&bull;</span>
                  <span className="flex items-center gap-1 text-zinc-400">
                    <Headphones size={12} />
                    {formatStreamCount(totalStreams)} streams
                  </span>
                </>
              )}
            </div>
          </motion.div>
        </div>
      </section>

      {/* CONTROLS */}
      <div className="flex items-center gap-4 px-6 py-6 md:px-8">
        <button
          type="button"
          onClick={handlePlayAll}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-black shadow-lg shadow-primary/30 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer"
        >
          <Play size={24} className="fill-current ml-0.5" />
        </button>

        <button
          type="button"
          onClick={handleShare}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900/60 text-zinc-300 hover:text-white hover:border-zinc-500 hover:bg-zinc-800 transition-colors cursor-pointer"
        >
          <Share2 size={16} />
        </button>
      </div>

      {/* TRACKS LIST */}
      <div className="px-4 md:px-8">
        <div className="rounded-xl border border-white/5 bg-[#121212]/50 backdrop-blur-sm overflow-hidden">
          {/* Header Row */}
          <div className="grid grid-cols-[auto_1fr_auto] md:grid-cols-[auto_1fr_auto_auto] items-center gap-4 px-4 py-3 text-xs font-semibold text-zinc-400 border-b border-white/5">
            <span className="w-8 text-center">#</span>
            <span>Title</span>
            <span className="hidden md:block text-right pr-6">Streams</span>
            <span className="flex justify-end pr-2">
              <Clock size={14} />
            </span>
          </div>

          {/* Song Rows */}
          <div className="divide-y divide-white/5">
            {songs.map((song, index) => {
              const isCurrentSongActive = currentSong?.id === song.id;

              return (
                <div
                  key={song.id || index}
                  onClick={() => handlePlaySong(song, index)}
                  className={`group grid grid-cols-[auto_1fr_auto] md:grid-cols-[auto_1fr_auto_auto] items-center gap-4 px-4 py-3 text-sm transition-colors cursor-pointer ${
                    isCurrentSongActive
                      ? "bg-white/10 text-primary"
                      : "text-zinc-300 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  {/* Number / Play Button */}
                  <div className="w-8 flex items-center justify-center">
                    <span
                      className={`text-xs ${
                        isCurrentSongActive
                          ? "text-primary font-bold"
                          : "text-zinc-500 group-hover:hidden"
                      }`}
                    >
                      {index + 1}
                    </span>
                    <button
                      type="button"
                      className={`hidden group-hover:flex items-center justify-center text-white ${
                        isCurrentSongActive ? "!flex text-primary" : ""
                      }`}
                    >
                      {isCurrentSongActive && isPlaying ? (
                        <Pause size={14} className="fill-current" />
                      ) : (
                        <Play size={14} className="fill-current ml-0.5" />
                      )}
                    </button>
                  </div>

                  {/* Title & Artist */}
                  <div className="flex items-center gap-3 min-w-0">
                    <SongThumbnail song={song} sizeClass="w-10 h-10" />
                    <div className="min-w-0 flex-1">
                      <p
                        className={`truncate font-medium text-sm ${
                          isCurrentSongActive
                            ? "text-primary font-semibold"
                            : "text-white"
                        }`}
                      >
                        {song.title}
                      </p>
                      <p className="truncate text-xs text-zinc-400">
                        {song.artistName || artistName}
                      </p>
                    </div>
                  </div>

                  {/* Streams */}
                  <div className="hidden md:block text-right pr-6 text-xs text-zinc-400">
                    {song.totalStreams
                      ? formatStreamCount(song.totalStreams)
                      : "-"}
                  </div>

                  {/* Duration */}
                  <div className="text-right pr-2 text-xs text-zinc-400">
                    {song.duration ? formatDuration(song.duration) : "--:--"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
