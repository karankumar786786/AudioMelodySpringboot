"use client";

import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Play,
  Pause,
  Clock,
  Disc,
  Share2,
  Shuffle,
  ListPlus,
  Heart,
  MoreVertical,
  Headphones,
  Calendar,
  Globe,
  Radio,
  CornerDownRight,
  ListMusic,
  Tag,
  Music2,
} from "lucide-react";
import Link from "next/link";
import { type Song } from "@/lib/api";
import { getImageUrl } from "@/lib/image-utils";
import {
  formatDuration,
  formatStreamCount,
  mapListToPlayerSongs,
  mapToPlayerSong,
} from "@/lib/player-utils";
import { playerActions } from "@/store/player.store";
import { useAppSelector } from "@/store/hooks";
import { useAlbumSongs } from "@/hooks/queries";
import { previewPlayer } from "@/lib/preview-player";
import { SongThumbnail } from "@/components/SongThumbnail";
import { getSolidBgFromImage } from "@/lib/color-utils";
import { toast } from "sonner";
import { PlaylistPickerModal } from "@/components/PlaylistPickerModal";
import { ShareSongModal } from "@/components/ShareSongModal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AlbumSkeleton } from "./AlbumSkeleton";

interface AlbumClientViewProps {
  albumName: string;
  initialSongs?: Song[];
}

function formatAlbumDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return "";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hours > 0) {
    return `${hours} hr ${minutes} min`;
  }
  if (minutes > 0) {
    return secs > 0 ? `${minutes} min ${secs} sec` : `${minutes} min`;
  }
  return `${secs} sec`;
}

export function AlbumClientView({
  albumName,
  initialSongs = [],
}: AlbumClientViewProps) {
  const currentSong = useAppSelector((s) => s.player.currentSong);
  const isPlaying = useAppSelector((s) => s.player.isPlaying);
  const systemUser = useAppSelector((s) => s.auth.systemUser);
  const favourites = useAppSelector((s) => s.auth.favourites || []);

  // Modal states
  const [playlistModalSong, setPlaylistModalSong] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [shareModalSong, setShareModalSong] = useState<Song | null>(null);

  const { data: songsData, isLoading, error } = useAlbumSongs(albumName);
  const songs = songsData && songsData.length > 0 ? songsData : initialSongs;

  /* -------------------------------------------------------------------------- */
  /*                            METADATA EXTRACTIONS                            */
  /* -------------------------------------------------------------------------- */

  const totalDuration = useMemo(() => {
    return songs.reduce((acc, song) => acc + (Number(song.duration) || 0), 0);
  }, [songs]);

  const totalStreams = useMemo(() => {
    return songs.reduce(
      (acc, song) => acc + (Number(song.totalStreams) || 0),
      0
    );
  }, [songs]);

  // Distinct genres across all songs
  const distinctGenres = useMemo(() => {
    const set = new Set<string>();
    songs.forEach((s) => {
      if (s.genre && s.genre.trim()) {
        s.genre
          .split(/[,/]/)
          .map((g) => g.trim())
          .filter(Boolean)
          .forEach((g) => set.add(g));
      }
    });
    return Array.from(set);
  }, [songs]);

  // Distinct languages
  const distinctLanguages = useMemo(() => {
    const set = new Set<string>();
    songs.forEach((s) => {
      if (s.language && s.language.trim()) {
        set.add(s.language.trim());
      }
    });
    return Array.from(set);
  }, [songs]);

  // Release year extraction (earliest createdAt or available year)
  const releaseYear = useMemo(() => {
    let earliestYear: number | null = null;
    for (const song of songs) {
      if (song.createdAt) {
        const d = new Date(song.createdAt);
        const y = d.getFullYear();
        if (!isNaN(y) && y > 1900 && y <= new Date().getFullYear()) {
          if (earliestYear === null || y < earliestYear) {
            earliestYear = y;
          }
        }
      }
    }
    return earliestYear;
  }, [songs]);

  // Distinct artists list
  const distinctArtists = useMemo(() => {
    const map = new Map<string, number>();
    songs.forEach((s) => {
      if (s.artistName) {
        const parts = s.artistName.split(/[,&]|feat\.|ft\./i);
        parts.forEach((p) => {
          const trimmed = p.trim();
          if (trimmed) {
            map.set(trimmed, (map.get(trimmed) || 0) + 1);
          }
        });
      }
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name);
  }, [songs]);

  const [backgroundColor, setBackgroundColor] = useState("#181818");

  const coverImage = useMemo(() => {
    const songWithImage = songs.find(
      (s) => s.imageKey || (s as any).posterUrl || (s as any).coverUrl
    );
    if (!songWithImage) return null;
    if (songWithImage.imageKey) {
      return getImageUrl(songWithImage.imageKey, {
        width: 500,
        height: 500,
        aspectRatio: "1-1",
      });
    }
    return (
      (songWithImage as any).posterUrl ||
      (songWithImage as any).coverUrl ||
      null
    );
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

  /* -------------------------------------------------------------------------- */
  /*                              PLAYBACK ACTIONS                              */
  /* -------------------------------------------------------------------------- */

  const isAlbumActive = useMemo(() => {
    return songs.length > 0 && songs.some((s) => s.id === currentSong?.id);
  }, [songs, currentSong]);

  const isAlbumPlaying = isAlbumActive && isPlaying;

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

  const handleTogglePlayAlbum = () => {
    if (songs.length === 0) return;
    previewPlayer.stopPreview(true);
    if (isAlbumPlaying) {
      playerActions.setIsPlaying(false);
    } else if (isAlbumActive) {
      playerActions.setIsPlaying(true);
    } else {
      const allPlayerSongs = mapListToPlayerSongs(songs);
      playerActions.playAll(allPlayerSongs);
      toast.success("Playing album", {
        description: `Now playing all ${songs.length} tracks from ${albumName}`,
      });
    }
  };

  const handleShufflePlay = () => {
    if (songs.length === 0) return;
    previewPlayer.stopPreview(true);
    const shuffled = [...songs].sort(() => Math.random() - 0.5);
    const allPlayerSongs = mapListToPlayerSongs(shuffled);
    playerActions.playAll(allPlayerSongs);
    toast.success("Playing shuffle", {
      description: `Shuffling ${songs.length} tracks from ${albumName}`,
    });
  };

  const handleAddAllToQueue = () => {
    if (songs.length === 0) return;
    playerActions.enqueue(mapListToPlayerSongs(songs));
    toast.success("Added to queue", {
      description: `All ${songs.length} tracks added to your queue.`,
    });
  };

  const handleShareAlbum = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: `${albumName} - One Melody`,
          text: `Listen to "${albumName}" in lossless audio on One Melody`,
          url,
        });
        return;
      } catch {
        // user canceled or unsupported, fallback to clipboard
      }
    }
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(url);
      toast.success("Album link copied", {
        description: "Album URL copied to clipboard",
      });
    }
  };

  const handleToggleFavourite = async (song: Song, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!systemUser?.id) {
      toast.error("Sign in required", {
        description: "Please sign in to add songs to favourites.",
      });
      return;
    }
    const isFav = favourites.includes(String(song.id));
    try {
      await playerActions.toggleFavourite(String(song.id));
      toast.success(
        isFav ? "Removed from favourites" : "Added to favourites",
        {
          description: isFav
            ? `"${song.title}" removed from your favourites.`
            : `"${song.title}" saved to your favourites.`,
        }
      );
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to update favourites"
      );
    }
  };

  const handleAddToQueue = (song: Song, e: React.MouseEvent) => {
    e.stopPropagation();
    playerActions.enqueue([mapToPlayerSong(song)]);
    toast.success("Added to queue", {
      description: `"${song.title}" added to queue.`,
    });
  };

  const handlePlayNext = (song: Song, e: React.MouseEvent) => {
    e.stopPropagation();
    playerActions.playNext(mapToPlayerSong(song));
    toast.success("Playing next", {
      description: `"${song.title}" will play next.`,
    });
  };

  const handleStartRadio = (song: Song, e: React.MouseEvent) => {
    e.stopPropagation();
    previewPlayer.stopPreview(true);
    playerActions.playWithRadio(mapToPlayerSong(song));
    toast.success("Playing Song Radio", {
      description: `Starting infinite radio for "${song.title}"...`,
    });
  };

  const handleOpenPlaylistPicker = (song: Song, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!systemUser?.id) {
      toast.error("Sign in required", {
        description: "Please sign in to add songs to playlists.",
      });
      return;
    }
    setPlaylistModalSong({ id: song.id, title: song.title });
  };

  const handleOpenShareModal = (song: Song, e: React.MouseEvent) => {
    e.stopPropagation();
    setShareModalSong(song);
  };

  /* -------------------------------------------------------------------------- */
  /*                               LOADING & EMPTY                              */
  /* -------------------------------------------------------------------------- */

  if (isLoading && songs.length === 0) {
    return <AlbumSkeleton />;
  }

  if (error || (songs.length === 0 && !isLoading)) {
    return (
      <div className="flex h-full min-h-[60vh] flex-col items-center justify-center p-8 text-center select-none">
        <div className="h-20 w-20 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center mb-4 text-zinc-500 shadow-xl">
          <Disc size={40} />
        </div>
        <h2 className="text-2xl font-bold text-white tracking-tight">
          Album Not Found
        </h2>
        <p className="text-sm text-zinc-400 mt-2 max-w-md">
          No songs were found matching album "{albumName}". It may have been
          renamed or is currently unavailable.
        </p>
        <Link
          href="/home"
          className="mt-6 px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/15 text-white text-xs font-semibold tracking-wide uppercase transition-colors"
        >
          Explore Music
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-full pb-24 px-2 md:px-4">
      {/* -------------------------------------------------------------------- */}
      {/*                              HERO SECTION                            */}
      {/* -------------------------------------------------------------------- */}
      <section
        className="relative overflow-hidden px-6 pb-8 pt-16 md:px-10 md:pt-20 rounded-2xl border border-white/5 transition-colors duration-500 shadow-2xl"
        style={{
          background: `linear-gradient(to bottom, ${backgroundColor} 0%, ${backgroundColor} 30%, rgba(10,10,10,0.95) 100%)`,
        }}
      >
        <div className="pointer-events-none absolute inset-0 bg-black/20 backdrop-blur-[2px]" />

        <div className="relative z-10 flex flex-col items-center gap-7 md:flex-row md:items-end">
          {/* Cover Art */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="group relative h-48 w-48 shrink-0 overflow-hidden rounded-2xl bg-zinc-900 shadow-2xl md:h-56 md:w-56 border border-white/15 ring-1 ring-black/40"
          >
            {coverImage ? (
              <img
                src={coverImage}
                alt={albumName}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-zinc-800 text-zinc-600">
                <Disc size={64} />
              </div>
            )}
            <div className="absolute inset-0 bg-linear-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
          </motion.div>

          {/* Album Metadata */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.05, ease: "easeOut" }}
            className="flex flex-col items-center text-center md:items-start md:text-left min-w-0 flex-1"
          >
            {/* Badges / Chips */}
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mb-2">
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/20 border border-primary/40 text-[11px] font-bold text-primary uppercase tracking-wider shadow-xs">
                <Disc size={12} className="animate-spin-slow" />
                <span>Album</span>
              </span>

              {releaseYear && (
                <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/10 text-[11px] font-medium text-zinc-200 border border-white/10">
                  <Calendar size={11} className="text-zinc-400" />
                  <span>{releaseYear}</span>
                </span>
              )}

              {distinctLanguages.length > 0 && (
                <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/10 text-[11px] font-medium text-zinc-200 border border-white/10">
                  <Globe size={11} className="text-zinc-400" />
                  <span>{distinctLanguages.join(", ")}</span>
                </span>
              )}

              {distinctGenres.slice(0, 3).map((genre) => (
                <span
                  key={genre}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/10 text-[11px] font-medium text-zinc-300 border border-white/5"
                >
                  <Tag size={10} className="text-zinc-400" />
                  <span>{genre}</span>
                </span>
              ))}
            </div>

            {/* Album Title */}
            <h1 className="text-3xl font-black tracking-tight my-1 py-1 text-white md:text-5xl lg:text-6xl line-clamp-2 drop-shadow-md">
              {albumName}
            </h1>

            {/* Artist Credits Line */}
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-1.5 text-sm md:text-base mt-2">
              <span className="text-zinc-400 font-medium">By</span>
              {distinctArtists.length > 0 ? (
                distinctArtists.map((artist, idx) => (
                  <React.Fragment key={artist}>
                    <Link
                      href={`/artists/${encodeURIComponent(artist)}`}
                      className="font-bold text-white hover:text-primary hover:underline transition-colors"
                    >
                      {artist}
                    </Link>
                    {idx < distinctArtists.length - 1 && (
                      <span className="text-zinc-400 font-normal mr-1">,</span>
                    )}
                  </React.Fragment>
                ))
              ) : (
                <span className="font-bold text-white">Various Artists</span>
              )}
            </div>

            {/* Subtitle Stats */}
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-2.5 gap-y-1.5 text-xs text-zinc-300 mt-2">
              <span className="font-medium text-zinc-300">
                {songs.length} {songs.length === 1 ? "track" : "tracks"}
              </span>

              {totalDuration > 0 && (
                <>
                  <span className="text-zinc-500">&bull;</span>
                  <span className="font-medium text-zinc-300">
                    {formatAlbumDuration(totalDuration)}
                  </span>
                </>
              )}

              {totalStreams > 0 && (
                <>
                  <span className="text-zinc-500">&bull;</span>
                  <span className="inline-flex items-center gap-1.5 font-medium text-zinc-300 bg-white/5 px-2 py-0.5 rounded-full border border-white/5">
                    <Headphones size={12} className="text-primary" />
                    <span>{formatStreamCount(totalStreams)} streams</span>
                  </span>
                </>
              )}
            </div>

            {/* ACTION BUTTONS */}
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3.5 mt-6">
              {/* Play / Pause Toggle */}
              <button
                type="button"
                onClick={handleTogglePlayAlbum}
                className="flex h-12 px-6 items-center justify-center gap-2 rounded-full bg-primary text-black font-bold text-sm shadow-xl shadow-primary/25 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer"
                title={isAlbumPlaying ? "Pause Album" : "Play Album"}
              >
                {isAlbumPlaying ? (
                  <>
                    <Pause size={18} className="fill-current" />
                    <span>Pause</span>
                  </>
                ) : (
                  <>
                    <Play size={18} className="fill-current ml-0.5" />
                    <span>Play Album</span>
                  </>
                )}
              </button>

              {/* Shuffle Play */}
              <button
                type="button"
                onClick={handleShufflePlay}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-zinc-900/80 text-zinc-300 hover:text-white hover:border-white/20 hover:bg-zinc-800 transition-all cursor-pointer shadow-md"
                title="Shuffle Play"
              >
                <Shuffle size={17} />
              </button>

              {/* Add All to Queue */}
              <button
                type="button"
                onClick={handleAddAllToQueue}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-zinc-900/80 text-zinc-300 hover:text-white hover:border-white/20 hover:bg-zinc-800 transition-all cursor-pointer shadow-md"
                title="Add Album to Queue"
              >
                <ListPlus size={17} />
              </button>

              {/* Share Album */}
              <button
                type="button"
                onClick={handleShareAlbum}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-zinc-900/80 text-zinc-300 hover:text-white hover:border-white/20 hover:bg-zinc-800 transition-all cursor-pointer shadow-md"
                title="Share Album"
              >
                <Share2 size={17} />
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* -------------------------------------------------------------------- */}
      {/*                            TRACKLIST TABLE                           */}
      {/* -------------------------------------------------------------------- */}
      <section className="px-1 md:px-4 pt-6">
        <div className="rounded-2xl border border-white/5 bg-[#121212]/60 backdrop-blur-md overflow-hidden shadow-xl">
          {/* Table Header: 12-column responsive layout */}
          <div className="grid grid-cols-12 items-center border-b border-white/5 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-400 select-none">
            <span className="col-span-1 text-center">#</span>
            <span className="col-span-8 sm:col-span-5 md:col-span-4 lg:col-span-4">
              Title
            </span>
            <span className="col-span-3 hidden sm:block md:col-span-3 lg:col-span-2">
              Artist
            </span>
            <span className="col-span-2 hidden lg:block">Album</span>
            <span className="col-span-1 hidden md:block">Genre</span>
            <span className="col-span-1 hidden sm:block md:col-span-1 lg:col-span-1 text-right pr-3">
              Plays
            </span>
            <span className="col-span-3 sm:col-span-2 md:col-span-2 lg:col-span-1 flex items-center justify-end pr-3">
              <Clock size={15} />
            </span>
          </div>

          {/* Table Rows */}
          <div className="divide-y divide-white/5">
            {songs.map((song, index) => {
              const isActive = currentSong?.id === song.id;
              const isCurrentPlaying = isActive && isPlaying;
              const isFavourite = favourites.includes(String(song.id));

              return (
                <div
                  key={song.id || index}
                  onClick={() => handlePlaySong(song, index)}
                  className={`group grid grid-cols-12 items-center px-4 py-2.5 transition-colors duration-150 cursor-pointer ${
                    isActive
                      ? "bg-white/10 text-white"
                      : "text-zinc-300 hover:bg-white/[0.06] hover:text-white"
                  }`}
                >
                  {/* Column 1: Index / Play Icon (col-span-1) */}
                  <div className="col-span-1 flex items-center justify-center">
                    {isActive ? (
                      isCurrentPlaying ? (
                        <Pause
                          size={14}
                          className="text-primary fill-current"
                        />
                      ) : (
                        <Play
                          size={14}
                          className="text-primary fill-current ml-0.5"
                        />
                      )
                    ) : (
                      <>
                        <span className="text-xs font-medium text-zinc-500 group-hover:hidden">
                          {index + 1}
                        </span>
                        <Play
                          size={14}
                          className="hidden text-white fill-current ml-0.5 group-hover:block"
                        />
                      </>
                    )}
                  </div>

                  {/* Column 2: Title + Thumbnail (col-span-8 sm:col-span-5 md:col-span-4 lg:col-span-4) */}
                  <div className="col-span-8 sm:col-span-5 md:col-span-4 lg:col-span-4 flex items-center gap-3 min-w-0 pr-3">
                    <SongThumbnail
                      song={song}
                      sizeClass="w-10 h-10"
                      roundedClass="rounded-lg"
                      enablePreviewHover={true}
                      onPlayClick={() => handlePlaySong(song, index)}
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        className={`truncate text-sm font-semibold tracking-tight transition-colors ${
                          isActive ? "text-primary" : "text-white"
                        }`}
                      >
                        {song.title}
                      </p>
                      {/* Mobile & Small Screen Subtitle: Artist • Album • Genre */}
                      <p className="mt-0.5 truncate text-xs text-zinc-400 sm:hidden">
                        {[
                          song.artistName,
                          song.album || albumName,
                          song.genre,
                          song.totalStreams
                            ? `${formatStreamCount(song.totalStreams)} plays`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" • ")}
                      </p>
                    </div>
                  </div>

                  {/* Column 3: Artist (col-span-3 hidden sm:block md:col-span-3 lg:col-span-2) */}
                  <div className="col-span-3 hidden sm:block md:col-span-3 lg:col-span-2 min-w-0 pr-3">
                    <Link
                      href={`/artists/${encodeURIComponent(song.artistName || "")}`}
                      onClick={(e) => e.stopPropagation()}
                      className="block truncate text-sm text-zinc-400 hover:text-white hover:underline transition-colors"
                      title={song.artistName}
                    >
                      {song.artistName || "Unknown Artist"}
                    </Link>
                  </div>

                  {/* Column 4: Album (col-span-2 hidden lg:block) */}
                  <div className="col-span-2 hidden lg:block min-w-0 pr-3">
                    <Link
                      href={`/albums/${encodeURIComponent(song.album || albumName)}`}
                      onClick={(e) => e.stopPropagation()}
                      className="block truncate text-sm text-zinc-400 hover:text-white hover:underline transition-colors"
                      title={song.album || albumName}
                    >
                      {song.album || albumName}
                    </Link>
                  </div>

                  {/* Column 5: Genre (col-span-1 hidden md:block) */}
                  <div className="col-span-1 hidden md:block min-w-0 pr-3">
                    {song.genre ? (
                      <span className="inline-block max-w-full truncate rounded-full bg-white/5 border border-white/5 px-2.5 py-0.5 text-[11px] font-medium text-zinc-400">
                        {song.genre}
                      </span>
                    ) : (
                      <span className="text-zinc-600 text-xs">—</span>
                    )}
                  </div>

                  {/* Column 6: Plays (col-span-1 hidden sm:block md:col-span-1 lg:col-span-1) */}
                  <div className="col-span-1 hidden sm:flex items-center justify-end font-mono text-xs text-zinc-400 pr-3">
                    <span className="text-zinc-300 font-medium">
                      {song.totalStreams
                        ? formatStreamCount(song.totalStreams)
                        : "—"}
                    </span>
                  </div>

                  {/* Column 7: Actions & Duration (col-span-3 sm:col-span-2 md:col-span-2 lg:col-span-1) */}
                  <div className="col-span-3 sm:col-span-2 md:col-span-2 lg:col-span-1 flex items-center justify-end gap-2 pr-3">
                    {/* Favorite Heart Button */}
                    <button
                      type="button"
                      onClick={(e) => handleToggleFavourite(song, e)}
                      className={`p-1.5 rounded-full transition-transform active:scale-90 ${
                        isFavourite
                          ? "text-red-500 hover:text-red-400"
                          : "text-zinc-500 opacity-0 group-hover:opacity-100 hover:text-white"
                      }`}
                      title={
                        isFavourite
                          ? "Remove from favourites"
                          : "Add to favourites"
                      }
                    >
                      <Heart
                        size={15}
                        className={isFavourite ? "fill-current" : ""}
                      />
                    </button>

                    {/* More Options Dropdown */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          onClick={(e) => e.stopPropagation()}
                          className="p-1.5 rounded-full text-zinc-500 opacity-0 group-hover:opacity-100 hover:text-white transition-opacity focus:opacity-100 cursor-pointer"
                          title="More options"
                        >
                          <MoreVertical size={15} />
                        </button>
                      </DropdownMenuTrigger>

                      <DropdownMenuContent
                        align="end"
                        sideOffset={6}
                        className="w-48 bg-[#181818]/95 border border-white/10 backdrop-blur-xl shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <DropdownMenuItem
                          onClick={(e) => handlePlayNext(song, e)}
                          className="gap-2.5 text-xs text-zinc-200 focus:bg-white/10 cursor-pointer"
                        >
                          <CornerDownRight size={14} className="text-zinc-400" />
                          <span>Play Next</span>
                        </DropdownMenuItem>

                        <DropdownMenuItem
                          onClick={(e) => handleAddToQueue(song, e)}
                          className="gap-2.5 text-xs text-zinc-200 focus:bg-white/10 cursor-pointer"
                        >
                          <ListPlus size={14} className="text-zinc-400" />
                          <span>Add to Queue</span>
                        </DropdownMenuItem>

                        <DropdownMenuItem
                          onClick={(e) => handleStartRadio(song, e)}
                          className="gap-2.5 text-xs text-zinc-200 focus:bg-white/10 cursor-pointer"
                        >
                          <Radio size={14} className="text-zinc-400" />
                          <span>Song Radio</span>
                        </DropdownMenuItem>

                        <DropdownMenuSeparator className="bg-white/10" />

                        <DropdownMenuItem
                          onClick={(e) => handleOpenPlaylistPicker(song, e)}
                          className="gap-2.5 text-xs text-zinc-200 focus:bg-white/10 cursor-pointer"
                        >
                          <ListMusic size={14} className="text-zinc-400" />
                          <span>Add to Playlist</span>
                        </DropdownMenuItem>

                        <DropdownMenuItem
                          onClick={(e) => handleOpenShareModal(song, e)}
                          className="gap-2.5 text-xs text-zinc-200 focus:bg-white/10 cursor-pointer"
                        >
                          <Share2 size={14} className="text-zinc-400" />
                          <span>Share Song</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Track Duration */}
                    <span className="text-xs tabular-nums text-zinc-400 min-w-[36px] text-right">
                      {song.duration ? formatDuration(song.duration) : "--:--"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------------- */}
      {/*                            MODALS                                    */}
      {/* -------------------------------------------------------------------- */}
      {playlistModalSong && (
        <PlaylistPickerModal
          songId={playlistModalSong.id}
          songTitle={playlistModalSong.title}
          isOpen={Boolean(playlistModalSong)}
          onClose={() => setPlaylistModalSong(null)}
        />
      )}

      {shareModalSong && (
        <ShareSongModal
          song={shareModalSong}
          isOpen={Boolean(shareModalSong)}
          onClose={() => setShareModalSong(null)}
        />
      )}
    </div>
  );
}