"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useStore } from "@tanstack/react-store";
import {
  ExternalLink,
  Music,
  User,
  Info,
  ListMusic,
  Play,
  Heart,
  Plus,
  MoreHorizontal,
  CheckCircle2,
} from "lucide-react";

import { playerStore, playerActions } from "@/store/player.store";
import { getSongInfo } from "@/lib/song-info";
import { getImageUrl, getVideoUrl } from "@/lib/image-utils";
import { musicApi, Song } from "@/lib/api";
import { mapToPlayerSong } from "@/lib/player-utils";
import { PlaylistPickerModal } from "./PlaylistPickerModal";
import { toast } from "sonner";

function formatDuration(num?: number) {
  if (!num || isNaN(num)) return "0:00";

  const sec = num > 10000 ? Math.floor(num / 1000) : Math.floor(num);
  const m = Math.floor(sec / 60);
  const s = sec % 60;

  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function RightInfoPanel() {
  const currentSong = useStore(playerStore, (s) => s.currentSong);
  const systemUser = useStore(playerStore, (s) => s.systemUser);
  const favourites = useStore(playerStore, (s) => s.favourites);

  const [isPlaylistModalOpen, setIsPlaylistModalOpen] = useState(false);

  const isFavourite = currentSong
    ? Array.from(favourites).some((id) => String(id) === String(currentSong.id))
    : false;

  // Song + Artist information
  const { data: info, isLoading } = useQuery({
    queryKey: [
      "song-info",
      currentSong?.id,
      currentSong?.title,
      currentSong?.artistName,
    ],
    queryFn: () =>
      getSongInfo(currentSong?.title || "", currentSong?.artistName || ""),
    enabled: !!currentSong,
    staleTime: 1000 * 60 * 60,
  });

  // Related songs
  const { data: songsFeed } = useQuery({
    queryKey: ["artist-more-songs", currentSong?.artistName],
    queryFn: async () => {
      const res = await musicApi.songs.getFeed(1, 50);
      return res?.data?.data || [];
    },
    enabled: !!currentSong?.artistName,
    staleTime: 1000 * 60 * 5,
  });

  const artistMoreSongs = React.useMemo<Song[]>(() => {
    if (!songsFeed || !currentSong) return [];

    const normalizedArtist = currentSong.artistName.trim().toLowerCase();

    const matches = songsFeed.filter(
      (s: Song) =>
        s.id !== currentSong.id &&
        s.artistName?.trim().toLowerCase().includes(normalizedArtist),
    );

    if (matches.length < 4) {
      const remaining = songsFeed.filter(
        (s: Song) =>
          s.id !== currentSong.id && !matches.some((m: Song) => m.id === s.id),
      );

      return [...matches, ...remaining].slice(0, 5);
    }

    return matches.slice(0, 5);
  }, [songsFeed, currentSong]);

  if (!currentSong) {
    return (
      <aside className="w-80 bg-black border-l border-[#282828] h-screen fixed right-0 top-0 z-40 p-6 flex flex-col items-center justify-center text-center pb-24">
        <div className="w-14 h-14 rounded-full bg-[#181818] border border-[#282828] flex items-center justify-center text-zinc-600 mb-3">
          <Info size={24} />
        </div>

        <p className="text-sm font-semibold text-white">Song & Artist Info</p>

        <p className="text-xs text-zinc-400 mt-1 max-w-[200px]">
          Play a song to view description, artist biography, and source links.
        </p>
      </aside>
    );
  }

  const activeVideoKey = currentSong.videoKey || (
    currentSong.id === "afcef7ca-367e-4f15-97c8-9564af846a4d" ||
    currentSong.title?.toLowerCase().includes("o soniya")
      ? "o soniya clip.mp4"
      : undefined
  );

  const videoUrl = activeVideoKey
    ? getVideoUrl(activeVideoKey, {
        width: 640,
        height: 880,
        quality: 80,
      })
    : undefined;

  const songImage = currentSong.imageKey
    ? getImageUrl(currentSong.imageKey, {
        width: 700,
        height: 700,
        quality: 90,
        aspectRatio: "1-1",
      })
    : currentSong.posterUrl;

  const artistCoverUrl = currentSong.imageKey
    ? getImageUrl(currentSong.imageKey, {
        width: 600,
        height: 600,
        aspectRatio: "1-1",
      })
    : null;

  const handlePlaylist = () => {
    if (!systemUser?.id) {
      toast.error("Sign in required", {
        description: "Please sign in to add songs to playlists.",
      });
      return;
    }

    setIsPlaylistModalOpen(true);
  };

  const handleFavourite = () => {
    if (!systemUser?.id) {
      toast.error("Sign in required", {
        description: "Please sign in to save songs to your library.",
      });
      return;
    }

    toast.promise(playerActions.toggleFavourite(currentSong.id), {
      loading: isFavourite
        ? "Removing from Favourites..."
        : "Adding to Favourites...",
      success: () => {
        return isFavourite ? "Removed from Favourites" : "Added to Favourites";
      },
      error: "Failed to update favourites",
      description: () => {
        return isFavourite
          ? `"${currentSong.title}" removed from your collection.`
          : `"${currentSong.title}" added to your collection.`;
      },
    });
  };

  return (
    <>
      <aside className="w-80 bg-black border-l border-[#282828] h-screen fixed right-0 top-0 z-40 overflow-y-auto no-scrollbar pb-28">
        {isLoading ? (
          <div className="p-4 space-y-4 animate-pulse">
            <div className="w-full h-[440px] bg-zinc-900 rounded-2xl" />
            <div className="h-5 w-3/4 bg-zinc-800 rounded" />
            <div className="h-28 bg-zinc-900 rounded-xl" />
          </div>
        ) : (
          <div>
            {/* ========================================================== */}
            {/* 1. SPOTIFY TALL VIDEO CANVAS (full width of aside, h-[440px]) */}
            {/* ========================================================== */}
            <div className="relative w-full h-[440px] overflow-hidden bg-zinc-900  shadow-2xl flex flex-col justify-end group">
              {/* Full-bleed Looping Canvas Video */}
              {videoUrl ? (
                <video
                  src={videoUrl}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="absolute inset-0 w-full h-full object-cover object-center"
                />
              ) : songImage ? (
                <img
                  src={songImage}
                  alt={currentSong.title}
                  className="absolute inset-0 w-full h-full object-cover object-center"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-zinc-700 bg-zinc-950">
                  <Music size={48} />
                </div>
              )}

              {/* Seamless Bottom Gradient Overlay (Spotify Canvas style) */}
              <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black via-black/80 to-transparent pointer-events-none" />

              {/* Overlaid Song Title, Artist & Like Status */}
              <div className="relative z-10 p-4 pb-4 flex items-end justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className="text-xl font-bold text-white tracking-tight truncate hover:underline cursor-pointer leading-tight drop-shadow-md">
                    {currentSong.title}
                  </h2>
                  <p className="text-xs font-medium text-zinc-300 truncate mt-1 hover:text-white hover:underline cursor-pointer drop-shadow">
                    {currentSong.artistName}
                  </p>
                </div>

                {/* Right Action Icons */}
                <div className="flex items-center gap-2.5 shrink-0 pb-0.5">
                  <button
                    onClick={handlePlaylist}
                    className="text-zinc-400 hover:text-white transition-colors cursor-pointer p-1"
                    title="Add to playlist"
                  >
                    <Plus size={20} />
                  </button>

                  <button
                    onClick={handleFavourite}
                    className="transition-transform active:scale-90 cursor-pointer p-1"
                    title={isFavourite ? "Liked" : "Like"}
                  >
                    {isFavourite ? (
                      <CheckCircle2
                        size={22}
                        className="text-[#1ed760] fill-white text-black"
                      />
                    ) : (
                      <Heart
                        size={20}
                        className="text-zinc-400 hover:text-white transition-colors"
                      />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Content Below Video */}
            <div className="px-4 space-y-4">
              {/* ========================================================== */}
              {/* 2. RELATED MUSIC VIDEOS CAROUSEL (from screenshot)         */}
              {/* ========================================================== */}
              {artistMoreSongs.length > 0 && (
                <section className="bg-black  rounded-2xl py-4 px-2 mt-2 shadow-xl">
                  <h3 className="text-sm font-bold text-white  pb-2 tracking-tight">
                    Related Songs
                  </h3>

                  <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
                    {artistMoreSongs.map((song: Song) => {
                      const songImg = song.imageKey
                        ? getImageUrl(song.imageKey, {
                            width: 350,
                            height: 350,
                            focus: "auto",
                            aspectRatio: "1-1",
                          })
                        : "";

                      return (
                        <div
                          key={song.id}
                          onClick={() => playerActions.play(mapToPlayerSong(song))}
                          className="group flex-shrink-0 w-32 cursor-pointer space-y-1.5"
                        >
                          {/* 1:1 square cover like SongCard */}
                          <div className="relative aspect-square w-full rounded-md overflow-hidden bg-zinc-900 shadow-md border border-white/5 group-hover:border-zinc-500 transition-colors">
                            {songImg ? (
                              <img
                                src={songImg}
                                alt={song.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ease-out"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-zinc-600">
                                <Music size={20} />
                              </div>
                            )}

                            {/* Play overlay button like SongCard */}
                            <div className="absolute bottom-2 right-2 translate-y-2 group-hover:translate-y-0 opacity-0 group-hover:opacity-100 transition-all duration-300 z-10">
                              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-black shadow-lg">
                                <Play fill="black" size={14} className="translate-x-0.5" />
                              </div>
                            </div>
                          </div>

                          {/* Title & Artist */}
                          <div className="space-y-0.5">
                            <p className="text-xs font-bold text-white truncate group-hover:text-primary transition-colors">
                              {song.title}
                            </p>
                            <p className="text-[11px] text-zinc-400 truncate hover:text-white">
                              {song.artistName}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* ========================================================== */}
              {/* 3. ABOUT THE ARTIST                                        */}
              {/* ========================================================== */}
              <section className="bg-[#121212] border border-[#222] rounded-2xl overflow-hidden p-4 shadow-xl">
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="text-sm font-bold text-white">
                    About the artist
                  </h3>
                </div>

                {/* Artist image */}
                <div className="relative w-full h-40 rounded-xl overflow-hidden bg-zinc-900 border border-[#282828] shadow-md">
                  {info?.artist?.image ? (
                    <img
                      src={info.artist.image}
                      alt={info.artist.name}
                      className="w-full h-full object-cover object-top"
                    />
                  ) : artistCoverUrl ? (
                    <img
                      src={artistCoverUrl}
                      alt={info?.artist?.name || currentSong.artistName}
                      className="w-full h-full object-cover object-top"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-zinc-800 to-black text-zinc-500 font-bold text-4xl">
                      {currentSong.artistName?.charAt(0) || "A"}
                    </div>
                  )}

                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent flex items-end p-3">
                    <h4 className="text-sm font-bold text-white truncate">
                      {info?.artist?.name || currentSong.artistName}
                    </h4>
                  </div>
                </div>

                {/* Artist description */}
                <p className="text-xs text-zinc-300 leading-relaxed mt-3 line-clamp-4">
                  {info?.artist?.description ||
                    "No artist biography available at this time."}
                </p>

                {info?.artist?.source && (
                  <a
                    href={info.artist.source}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline font-medium mt-2.5"
                  >
                    View on Wikipedia
                    <ExternalLink size={11} />
                  </a>
                )}
              </section>

              {/* ========================================================== */}
              {/* 4. ABOUT THE SONG                                          */}
              {/* ========================================================== */}
              {info?.song?.description && (
                <section className="bg-[#121212] border border-[#222] rounded-2xl overflow-hidden p-4 shadow-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <Music size={15} className="text-primary" />
                    <h3 className="text-sm font-bold text-white">
                      About the Song
                    </h3>
                  </div>

                  <p className="text-xs text-zinc-300 leading-relaxed line-clamp-5">
                    {info.song.description}
                  </p>

                  {info.song.source && (
                    <a
                      href={info.song.source}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline font-medium mt-2.5"
                    >
                      View on Wikipedia
                      <ExternalLink size={11} />
                    </a>
                  )}
                </section>
              )}
            </div>
          </div>
        )}
      </aside>

      {/* Playlist Modal */}
      <PlaylistPickerModal
        isOpen={isPlaylistModalOpen}
        onClose={() => setIsPlaylistModalOpen(false)}
        songId={currentSong.id}
        songTitle={currentSong.title}
      />
    </>
  );
}
