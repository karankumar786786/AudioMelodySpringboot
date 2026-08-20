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
import { getImageUrl } from "@/lib/image-utils";
import { musicApi, Song } from "@/lib/api";
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
      <aside className="w-80 bg-black border-l border-[#282828] h-screen fixed right-0 top-0 z-40 p-4 flex flex-col overflow-y-auto no-scrollbar pb-28">

        {isLoading ? (
          <div className="space-y-6 animate-pulse mt-2">
            <div className="w-full h-64 bg-zinc-900 rounded-lg" />
            <div className="h-5 w-3/4 bg-zinc-800 rounded" />
            <div className="h-3 w-1/2 bg-zinc-800 rounded" />
            <div className="h-px bg-[#282828]" />
            <div className="h-4 w-1/2 bg-zinc-800 rounded" />
            <div className="h-20 bg-zinc-900 rounded" />
          </div>
        ) : (
          <div className="space-y-6 mt-1">
            {/* ============================= */}
            {/* 1. SPOTIFY TRACK CARD */}
            {/* ============================= */}
            <section>
              {/* Song Image */}
              <div className="w-full aspect-square rounded-lg overflow-hidden bg-zinc-900 shadow-2xl relative group">
                {songImage ? (
                  <img
                    src={songImage}
                    alt={currentSong.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-600">
                    <Music size={40} />
                  </div>
                )}
              </div>

              {/* Track Info & Actions (Spotify Layout) */}
              <div className="mt-3.5 flex items-start justify-between gap-3 px-0.5">
                <div className="min-w-0 flex-1">
                  <h2 className="text-xl font-bold text-white tracking-tight truncate hover:underline cursor-pointer leading-tight">
                    {currentSong.title}
                  </h2>
                  <p className="text-sm font-normal text-zinc-400 truncate mt-1 hover:text-white hover:underline cursor-pointer">
                    {currentSong.artistName}
                  </p>
                </div>

                {/* Right Action Icons */}
                <div className="flex items-center gap-3 shrink-0 pt-1">
                  <button
                    onClick={handlePlaylist}
                    className="text-zinc-400 hover:text-white transition-colors cursor-pointer"
                    title="Add to playlist"
                  >
                    <Plus size={20} />
                  </button>

                  <button
                    onClick={handleFavourite}
                    className="transition-transform active:scale-90 cursor-pointer"
                    title={isFavourite ? "Liked" : "Like"}
                  >
                    {isFavourite ? (
                      <CheckCircle2
                        size={20}
                        className="text-[#1ed760] fill-[#1ed760] text-black"
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
            </section>

            {/* ============================= */}
            {/* 2. ABOUT THE ARTIST */}
            {/* ============================= */}
            <section className="bg-[#181818] border border-[#282828] rounded-xl overflow-hidden p-4">
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-sm font-bold text-white">About the artist</h3>
              </div>

              {/* Artist image */}
              <div className="relative w-full h-44 rounded-lg overflow-hidden bg-zinc-900 border border-[#282828] shadow-md">
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

            {/* ============================= */}
            {/* 3. RELATED SONGS */}
            {/* ============================= */}
            {artistMoreSongs.length > 0 && (
              <section className="bg-[#181818] border border-[#282828] rounded-xl overflow-hidden p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-white">
                    Related Songs
                  </h3>
                </div>

                <div className="space-y-1">
                  {artistMoreSongs.map((song: Song) => {
                    const songImg = song.imageKey
                      ? getImageUrl(song.imageKey, {
                          width: 100,
                          height: 100,
                          aspectRatio: "1-1",
                        })
                      : "";

                    return (
                      <div
                        key={song.id}
                        onClick={() => playerActions.playSong(song)}
                        className="group flex items-center gap-3 p-2 rounded-lg hover:bg-[#282828] transition-colors cursor-pointer"
                      >
                        {/* Image */}
                        <div className="relative w-11 h-11 rounded-md overflow-hidden bg-zinc-900 shrink-0">
                          {songImg ? (
                            <img
                              src={songImg}
                              alt={song.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-zinc-600">
                              <Music size={16} />
                            </div>
                          )}

                          {/* Play overlay */}
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <Play
                              size={16}
                              fill="white"
                              className="text-white"
                            />
                          </div>
                        </div>

                        {/* Song details */}
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-white truncate group-hover:text-primary transition-colors">
                            {song.title}
                          </p>

                          <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                            {song.artistName}
                          </p>
                        </div>

                        {/* Duration */}
                        <span className="text-[11px] text-zinc-500 tabular-nums">
                          {formatDuration(song.duration)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* ============================= */}
            {/* 4. ABOUT THE SONG */}
            {/* ============================= */}
            {info?.song?.description && (
              <section className="bg-[#181818] border border-[#282828] rounded-xl overflow-hidden p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Music size={15} className="text-primary" />
                  <h3 className="text-sm font-bold text-white">About the Song</h3>
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
