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

  const [isPlaylistModalOpen, setIsPlaylistModalOpen] = useState(false);
  const [isFavourite, setIsFavourite] = useState(false);

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
        width: 500,
        height: 500,
        aspectRatio: "1-1",
      })
    : "";

  const artistCoverUrl = currentSong.imageKey
    ? getImageUrl(currentSong.imageKey, {
        width: 400,
        height: 400,
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
    setIsFavourite((prev) => !prev);

    // Connect your actual favourite API here.
    // Example:
    // musicApi.interactions.toggleFavourite(currentSong.id)
  };

  return (
    <>
      <aside className="w-80 bg-black  h-screen fixed right-0 top-0 z-40 p-5 flex flex-col overflow-y-auto no-scrollbar pb-28">
        {isLoading ? (
          <div className="space-y-6 animate-pulse">
            <div className="w-full h-64 bg-zinc-900 rounded-xl" />
            <div className="h-5 w-3/4 bg-zinc-800 rounded" />
            <div className="h-3 w-1/2 bg-zinc-800 rounded" />
            <div className="h-px bg-[#282828]" />
            <div className="h-4 w-1/2 bg-zinc-800 rounded" />
            <div className="h-20 bg-zinc-900 rounded" />
          </div>
        ) : (
          <div className="space-y-7">
            {/* ============================= */}
            {/* 1. CURRENT SONG */}
            {/* ============================= */}

            <section>
              {/* Song Image */}
              <div className="w-full aspect-square rounded-xl overflow-hidden bg-zinc-900 shadow-xl">
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

              {/* Song title + artist + actions */}
              <div className="mt-4">
                <div className="flex items-center gap-2">
                  {/* Title */}
                  <h2 className="text-lg font-bold text-white truncate min-w-0 flex-1">
                    {currentSong.title}
                  </h2>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={handleFavourite}
                      className={`w-10 h-10 rounded-full border flex items-center justify-center transition-all ${
                        isFavourite
                          ? "border-primary text-primary"
                          : "border-[#333] text-zinc-400 hover:text-white hover:border-white"
                      }`}
                      title="Favourite"
                    >
                      <Heart
                        size={19}
                        fill={isFavourite ? "currentColor" : "none"}
                      />
                    </button>

                    <button
                      onClick={handlePlaylist}
                      className="w-10 h-10 rounded-full border border-[#333] text-zinc-400 hover:text-white hover:border-white flex items-center justify-center transition-all"
                      title="Add to playlist"
                    >
                      <Plus size={19} />
                    </button>
                  </div>
                </div>

                {/* Artist */}
                <p className="text-sm text-zinc-400 truncate mt-1">
                  {currentSong.artistName}
                </p>
              </div>
            </section>

            {/* ============================= */}
            {/* 2. RELATED SONGS */}
            {/* ============================= */}

            {artistMoreSongs.length > 0 && (
              <section className="border-t border-[#282828] pt-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <ListMusic size={16} className="text-zinc-400" />

                    <h3 className="text-sm font-bold text-white">
                      Related Songs
                    </h3>
                  </div>
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
                        className="group flex items-center gap-3 p-2 rounded-lg hover:bg-[#181818] transition-colors cursor-pointer"
                      >
                        {/* Image */}
                        <div className="relative w-12 h-12 rounded-md overflow-hidden bg-zinc-900 shrink-0">
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
            {/* 3. ABOUT SONG */}
            {/* ============================= */}

            <section className="border-t border-[#282828] pt-5">
              <div className="flex items-center gap-2 mb-3">
                <Music size={16} className="text-primary" />

                <h3 className="text-sm font-bold text-white">About the Song</h3>
              </div>

              <p className="text-xs text-zinc-300 leading-relaxed">
                {info?.song?.description ||
                  "No additional background description found for this song."}
              </p>

              {info?.song?.source && (
                <a
                  href={info.song.source}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-medium mt-3"
                >
                  View on Wikipedia
                  <ExternalLink size={12} />
                </a>
              )}
            </section>

            {/* ============================= */}
            {/* 4. ABOUT ARTIST */}
            {/* ============================= */}

            <section className="border-t border-[#282828] pt-5">
              <div className="flex items-center gap-2 mb-3">
                <User size={16} className="text-primary" />

                <h3 className="text-sm font-bold text-white">
                  About the Artist
                </h3>
              </div>

              {/* Artist image */}
              <div className="relative w-full h-48 rounded-xl overflow-hidden bg-zinc-900 border border-[#282828] shadow-lg">
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

                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent flex items-end p-3">
                  <h4 className="text-base font-bold text-white">
                    {info?.artist?.name || currentSong.artistName}
                  </h4>
                </div>
              </div>

              {/* Artist description */}
              <p className="text-xs text-zinc-300 leading-relaxed mt-4">
                {info?.artist?.description ||
                  "No artist biography available at this time."}
              </p>

              {info?.artist?.source && (
                <a
                  href={info.artist.source}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-medium mt-3"
                >
                  View on Wikipedia
                  <ExternalLink size={12} />
                </a>
              )}
            </section>
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
