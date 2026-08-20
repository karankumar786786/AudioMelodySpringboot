"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { musicApi } from "@/lib/api";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useStore } from "@tanstack/react-store";
import { getImageUrl } from "@/lib/image-utils";
import {
  Users,
  Play,
  Pause,
  Clock,
  Music,
  ArrowLeft,
  Shuffle,
  MoreHorizontal,
  Heart,
} from "lucide-react";
import { playerStore, playerActions } from "@/store/player.store";
import { mapListToPlayerSongs } from "@/lib/player-utils";
import { toast } from "sonner";
import { getSolidBgFromImage } from "@/lib/color-utils";

export default function ArtistPage() {
  const { id } = useParams();
  const router = useRouter();

  const currentSong = useStore(playerStore, (s) => s.currentSong);
  const isPlaying = useStore(playerStore, (s) => s.isPlaying);

  const [backgroundColor, setBackgroundColor] = useState("#181818");

  /* -------------------------------------------------------------------------- */
  /*                                ARTIST QUERY                                */
  /* -------------------------------------------------------------------------- */

  const { data: artistResponse, isLoading: isArtistLoading } = useQuery({
    queryKey: ["artist", id],
    queryFn: () => musicApi.artists.getById(id as string),
  });

  /* -------------------------------------------------------------------------- */
  /*                                 SONG QUERY                                 */
  /* -------------------------------------------------------------------------- */

  const { data: songsResponse, isLoading: isSongsLoading } = useQuery({
    queryKey: ["artist-songs", id],
    queryFn: () => musicApi.artists.getSongs(id as string),
  });

  /* -------------------------------------------------------------------------- */
  /*                              DERIVED VALUES                                */
  /* -------------------------------------------------------------------------- */

  const artist = artistResponse?.data;
  const songs = songsResponse?.data?.data || [];

  // Square cover, same treatment as the playlist page's art.
  const coverUrl = getImageUrl(artist?.coverImageKey, {
    width: 600,
    height: 600,
    focus: "auto",
    aspectRatio: "1-1",
  });

  /* -------------------------------------------------------------------------- */
  /*                         EXTRACT ARTIST COLOR                               */
  /* -------------------------------------------------------------------------- */

  useEffect(() => {
    let cancelled = false;

    async function extractColor() {
      if (!coverUrl) {
        setBackgroundColor("#181818");
        return;
      }

      const color = await getSolidBgFromImage(coverUrl, artist?.name || "artist");

      if (!cancelled) {
        setBackgroundColor(color);
      }
    }

    extractColor();

    return () => {
      cancelled = true;
    };
  }, [coverUrl, artist?.name]);

  /* -------------------------------------------------------------------------- */
  /*                              FORMAT DURATION                               */
  /* -------------------------------------------------------------------------- */

  const formatDuration = (val?: number | string) => {
    if (!val) return "0:00";

    const num = typeof val === "string" ? parseFloat(val) : val;

    if (isNaN(num) || num <= 0) {
      return "0:00";
    }

    const totalSeconds = num > 10000 ? Math.floor(num / 1000) : Math.floor(num);

    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  /* -------------------------------------------------------------------------- */
  /*                                  LOADING                                   */
  /* -------------------------------------------------------------------------- */

  if (isArtistLoading || isSongsLoading) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-4 text-zinc-500">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />

        <span className="text-xs font-black uppercase italic tracking-widest">
          Loading Artist...
        </span>
      </div>
    );
  }

  /* -------------------------------------------------------------------------- */
  /*                              PLAY ALL SONGS                                */
  /* -------------------------------------------------------------------------- */

  const handlePlayAll = () => {
    if (songs.length === 0) return;

    playerActions.playAll(mapListToPlayerSongs(songs));

    toast.success("Playing Songs", {
      description: `Starting playback for ${artist?.name}.`,
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

    const allPlayerSongs = mapListToPlayerSongs(songs);

    playerActions.playAllFrom(allPlayerSongs, index);
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
          background: `
            linear-gradient(
              to bottom,
              ${backgroundColor} 0%,
              ${backgroundColor} 35%,
              rgba(0,0,0,0.92) 100%
            )
          `,
        }}
      >
        {/* Subtle dark overlay */}
        <div className="pointer-events-none absolute inset-0 bg-black/10" />


        {/* Artist information */}
        <div className="relative z-10 flex flex-col items-center gap-7 md:flex-row md:items-end">
          {/* Cover — circular, since this is a person, not a playlist */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="h-52 w-52 shrink-0 overflow-hidden rounded-full bg-zinc-900 shadow-2xl ring-2 ring-white/15 md:h-56 md:w-56"
          >
            {coverUrl ? (
              <img
                src={coverUrl}
                alt={artist?.name || "Artist"}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Users size={64} className="text-zinc-600" />
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
            <div className="mb-2 flex items-center gap-1.5">
              <div className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-[9px] font-black text-white">
                ✓
              </div>

              <p className="text-xs font-semibold uppercase tracking-wider text-white/80">
                Verified Artist
              </p>
            </div>

            <h1 className="break-words text-4xl font-black tracking-tight text-white md:text-6xl">
              {artist?.name}
            </h1>

            {artist?.about && (
              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/70">
                {artist.about}
              </p>
            )}

            <div className="mt-4 flex items-center gap-4">
              <div className="flex items-center gap-2 text-xs text-white/80">
                <span className="font-semibold">
                  {songs.length} {songs.length === 1 ? "song" : "songs"}
                </span>

                {songs.length > 0 && (
                  <>
                    <span>•</span>

                    <span>
                      {formatDuration(
                        songs.reduce(
                          (total: number, song: any) => total + (Number(song.duration) || 0),
                          0
                        )
                      )}
                    </span>
                  </>
                )}
              </div>

              <button
                onClick={handlePlayAll}
                disabled={songs.length === 0}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-black shadow-lg transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50"
                title="Play all songs"
              >
                <Play size={18} fill="black" className="ml-0.5" />
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
        <div className="flex items-center justify-between px-4 pb-4">
          <h3 className="text-lg font-bold tracking-tight text-white">Popular Songs</h3>

          <span className="text-xs font-medium text-zinc-400">
            {songs.length} {songs.length === 1 ? "track" : "tracks"}
          </span>
        </div>

        <div className="grid grid-cols-12 items-center border-b border-white/10 px-4 pb-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
          <div className="col-span-1 text-center">#</div>

          <div className="col-span-7 md:col-span-6">Title</div>

          <div className="col-span-3 hidden md:block">Genre</div>

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

              const songImage = getImageUrl(song.imageKey, {
                width: 100,
                height: 100,
                aspectRatio: "1-1",
              });

              return (
                <motion.div
                  key={song.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{
                    duration: 0.2,
                    delay: Math.min(index * 0.015, 0.3),
                  }}
                  onClick={() => handlePlaySong(song, index)}
                  className={`group grid cursor-pointer grid-cols-12 items-center rounded-md px-4 py-2.5 transition-colors duration-150 ${
                    isActive ? "bg-white/10" : "hover:bg-white/[0.07]"
                  }`}
                >
                  {/* ======================================================== */}
                  {/* INDEX */}
                  {/* ======================================================== */}

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

                  {/* ======================================================== */}
                  {/* TITLE */}
                  {/* ======================================================== */}

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

                      <p className="mt-0.5 truncate text-xs text-zinc-400 md:hidden">
                        {song.genre || "Single"}
                      </p>
                    </div>
                  </div>

                  {/* ======================================================== */}
                  {/* GENRE */}
                  {/* ======================================================== */}

                  <div className="col-span-3 hidden min-w-0 md:block">
                    <span className="block truncate text-sm text-zinc-400 transition-colors group-hover:text-white">
                      {song.genre || "Single"}
                    </span>
                  </div>

                  {/* ======================================================== */}
                  {/* DURATION */}
                  {/* ======================================================== */}

                  <div className="col-span-4 flex items-center justify-end gap-4 text-xs tabular-nums text-zinc-400 md:col-span-2">
                    <span>{formatDuration(song.duration)}</span>
                  </div>
                </motion.div>
              );
            })
          ) : (
            <div className="rounded-xl border border-dashed border-white/10 py-20 text-center">
              <Music size={40} className="mx-auto mb-4 text-zinc-700" />

              <p className="text-sm text-zinc-500">No songs available</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}