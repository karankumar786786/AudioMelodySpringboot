"use client";

import { use, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useStore } from "@tanstack/react-store";
import { motion } from "framer-motion";
import { Play, Pause, Clock, Disc, Share2, Music, Sparkles } from "lucide-react";
import { musicApi, Song } from "@/lib/api";
import { getImageUrl } from "@/lib/image-utils";
import { formatDuration, mapListToPlayerSongs } from "@/lib/player-utils";
import { playerActions, playerStore } from "@/store/player.store";
import { previewPlayer } from "@/lib/preview-player";
import { SongThumbnail } from "@/components/SongThumbnail";
import { toast } from "sonner";

interface AlbumPageProps {
  params: Promise<{ name: string }>;
}

export default function AlbumPage({ params }: AlbumPageProps) {
  const resolvedParams = use(params);
  const albumName = decodeURIComponent(resolvedParams.name);

  const currentSong = useStore(playerStore, (s) => s.currentSong);
  const isPlaying = useStore(playerStore, (s) => s.isPlaying);

  const { data: songs = [], isLoading, error } = useQuery({
    queryKey: ["album-songs", albumName],
    queryFn: () => musicApi.albums.getByName(albumName),
    enabled: !!albumName,
  });

  const totalDuration = useMemo(() => {
    return songs.reduce((acc, song) => acc + (Number(song.duration) || 0), 0);
  }, [songs]);

  const artistName = useMemo(() => {
    return songs[0]?.artistName || "Various Artists";
  }, [songs]);

  const primaryGenre = useMemo(() => {
    return songs.find((s) => s.genre)?.genre || null;
  }, [songs]);

  const coverImage = useMemo(() => {
    const songWithImage = songs.find((s) => s.imageKey);
    if (!songWithImage?.imageKey) return null;
    return getImageUrl(songWithImage.imageKey, {
      width: 500,
      height: 500,
      aspectRatio: "1-1",
    });
  }, [songs]);

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
        description: `Album link copied to clipboard`,
      });
    }
  };

  if (isLoading) {
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
    <div className="min-h-full pb-24">
      {/* ====================================================================== */}
      {/*                              HERO                                      */}
      {/* ====================================================================== */}
      <section className="relative overflow-hidden px-8 pb-8 pt-20 md:px-10 md:pt-24 bg-gradient-to-b from-primary/20 via-zinc-900/60 to-black/90 border-b border-white/5">
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

            <h1 className="text-3xl font-black tracking-tight text-white md:text-5xl lg:text-6xl line-clamp-2">
              {albumName}
            </h1>

            <p className="mt-2 text-sm font-semibold text-zinc-300 md:text-base">
              By <span className="text-white font-bold">{artistName}</span>
            </p>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-xs font-medium text-zinc-400 md:justify-start">
              <span>{songs.length} {songs.length === 1 ? "track" : "tracks"}</span>
              <span>•</span>
              <span>{formatDuration(totalDuration)}</span>

              {/* Action Buttons */}
              <button
                type="button"
                onClick={handlePlayAll}
                disabled={songs.length === 0}
                className="ml-2 flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-xs font-bold text-black transition-transform hover:scale-105 active:scale-95 cursor-pointer shadow-lg disabled:opacity-50"
              >
                <Play size={14} fill="currentColor" />
                <span>Play Album</span>
              </button>

              <button
                type="button"
                onClick={handleShare}
                className="flex items-center gap-1.5 rounded-full bg-white/10 hover:bg-white/15 px-3.5 py-2.5 text-xs font-semibold text-white transition-colors cursor-pointer border border-white/10"
                title="Share album"
              >
                <Share2 size={13} />
                <span>Share</span>
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ====================================================================== */}
      {/*                              TRACK LIST                                */}
      {/* ====================================================================== */}
      <section className="px-6 pb-10 pt-6 md:px-10">
        {/* Table Header */}
        <div className="grid grid-cols-12 items-center border-b border-white/10 px-4 pb-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
          <div className="col-span-1 text-center">#</div>
          <div className="col-span-6 md:col-span-5 lg:col-span-4">Title</div>
          <div className="col-span-3 hidden md:block lg:col-span-3">Artist</div>
          <div className="col-span-2 hidden lg:block">Genre</div>
          <div className="col-span-5 text-right md:col-span-3 lg:col-span-2">
            <Clock size={16} className="ml-auto" />
          </div>
        </div>

        {/* Songs */}
        <div className="mt-2 flex flex-col">
          {songs.map((song: Song, index: number) => {
            const isActive = currentSong?.id === song.id;
            const isCurrentPlaying = isActive && isPlaying;

            return (
              <motion.div
                key={song.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{
                  duration: 0.15,
                  delay: Math.min(index * 0.015, 0.25),
                }}
                onClick={() => handlePlaySong(song, index)}
                className={`group grid cursor-pointer grid-cols-12 items-center rounded-xl px-4 py-2.5 transition-colors select-none ${
                  isActive ? "bg-white/10" : "hover:bg-white/[0.06]"
                }`}
              >
                {/* Index / Play indicator */}
                <div className="col-span-1 flex items-center justify-center">
                  {isActive ? (
                    isCurrentPlaying ? (
                      <Pause
                        size={14}
                        className="text-primary"
                        fill="currentColor"
                      />
                    ) : (
                      <Play
                        size={14}
                        className="text-primary"
                        fill="currentColor"
                      />
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

                {/* Title */}
                <div className="col-span-6 flex min-w-0 items-center gap-3 md:col-span-5 lg:col-span-4">
                  <SongThumbnail
                    song={song}
                    sizeClass="h-10 w-10"
                    roundedClass="rounded-lg"
                    enablePreviewHover={true}
                    onPlayClick={() => handlePlaySong(song, index)}
                  />
                  <div className="min-w-0 flex-1">
                    <h4
                      className={`truncate text-sm font-semibold transition-colors ${
                        isActive ? "text-primary" : "text-white"
                      }`}
                    >
                      {song.title}
                    </h4>
                    <p className="mt-0.5 truncate text-xs text-zinc-400 md:hidden">
                      {song.artistName}
                      {song.genre ? ` • ${song.genre}` : ""}
                    </p>
                  </div>
                </div>

                {/* Artist */}
                <div className="col-span-3 hidden min-w-0 md:block lg:col-span-3">
                  <span className="block truncate text-sm text-zinc-400 group-hover:text-white transition-colors">
                    {song.artistName}
                  </span>
                </div>

                {/* Genre */}
                <div className="col-span-2 hidden min-w-0 lg:block">
                  <span className="block truncate text-xs text-zinc-400 group-hover:text-zinc-300">
                    {song.genre || "—"}
                  </span>
                </div>

                {/* Duration */}
                <div className="col-span-5 flex items-center justify-end gap-3 text-xs tabular-nums text-zinc-400 md:col-span-3 lg:col-span-2">
                  <span>{formatDuration(song.duration)}</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
