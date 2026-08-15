"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useStore } from "@tanstack/react-store";
import { playerStore, playerActions } from "@/store/player.store";
import { getSongInfo } from "@/lib/song-info";
import { ExternalLink, Music, User, Info, ListMusic, Play } from "lucide-react";
import { getImageUrl } from "@/lib/image-utils";
import { musicApi, Song } from "@/lib/api";

function formatDuration(num?: number) {
  if (!num || isNaN(num)) return "0:00";
  const sec = num > 10000 ? Math.floor(num / 1000) : Math.floor(num);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function RightInfoPanel() {
  const currentSong = useStore(playerStore, (s) => s.currentSong);

  // 1. Fetch Wikipedia Info for Song & Artist
  const { data: info, isLoading } = useQuery({
    queryKey: ["song-info", currentSong?.id, currentSong?.title, currentSong?.artistName],
    queryFn: () => getSongInfo(currentSong?.title || "", currentSong?.artistName || ""),
    enabled: !!currentSong,
    staleTime: 1000 * 60 * 60, // Cache for 1 hour
  });

  // 2. Fetch More Songs by Artist from API
  const { data: songsFeed } = useQuery({
    queryKey: ["artist-more-songs", currentSong?.artistName],
    queryFn: async () => {
      const res = await musicApi.songs.getFeed(1, 50);
      return res?.data?.data || [];
    },
    enabled: !!currentSong?.artistName,
    staleTime: 1000 * 60 * 5,
  });

  // Filter 3 to 5 songs by the same artist (excluding current song)
  const artistMoreSongs = React.useMemo<Song[]>(() => {
    if (!songsFeed || !currentSong) return [];
    const normalizedArtist = currentSong.artistName.trim().toLowerCase();
    const matches = songsFeed.filter(
      (s: Song) =>
        s.id !== currentSong.id &&
        s.artistName?.trim().toLowerCase().includes(normalizedArtist)
    );
    if (matches.length < 4) {
      const remaining = songsFeed.filter(
        (s: Song) => s.id !== currentSong.id && !matches.some((m: Song) => m.id === s.id)
      );
      return [...matches, ...remaining].slice(0, 5);
    }
    return matches.slice(0, 5);
  }, [songsFeed, currentSong]);

  if (!currentSong) {
    return (
      <aside className="w-80 bg-[#121212] border-l border-[#282828] h-screen fixed right-0 top-0 z-40 p-6 flex flex-col items-center justify-center text-center pb-24">
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

  // Cover image fallback for artist if wikipedia image isn't available
  const artistCoverUrl = currentSong.imageKey
    ? getImageUrl(currentSong.imageKey, { width: 200, height: 200, aspectRatio: "1-1" })
    : null;

  return (
    <aside className="w-80 bg-[#121212] border-l border-[#282828] h-screen fixed right-0 top-0 z-40 p-5 flex flex-col overflow-y-auto no-scrollbar pb-28">
      {/* Header */}
      <div className="flex items-center gap-2 pb-4 border-b border-[#282828] mb-4">
        <Info size={18} className="text-primary" />
        <h2 className="text-sm font-bold text-white tracking-tight">
          About the Track
        </h2>
      </div>

      {isLoading ? (
        <div className="space-y-6 animate-pulse">
          {/* Song Skeleton */}
          <div className="space-y-2">
            <div className="h-4 w-3/4 bg-zinc-800 rounded" />
            <div className="h-3 w-1/2 bg-zinc-800 rounded" />
            <div className="h-16 w-full bg-zinc-900 rounded-md mt-2" />
          </div>

          <div className="h-px bg-[#282828]" />

          {/* Artist Skeleton */}
          <div className="space-y-3 flex flex-col items-center">
            <div className="w-20 h-20 rounded-full bg-zinc-800" />
            <div className="h-4 w-1/2 bg-zinc-800 rounded" />
            <div className="h-16 w-full bg-zinc-900 rounded-md" />
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* 1. Song Information */}
          <section className="space-y-2">
            <div className="flex items-center gap-2 text-primary text-xs font-semibold">
              <Music size={14} />
              <span>Song Overview</span>
            </div>
            <div>
              <h3 className="text-base font-bold text-white leading-tight">
                {currentSong.title}
              </h3>
              <p className="text-xs text-zinc-400 font-medium">
                {currentSong.artistName}
              </p>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed font-normal pt-1">
              {info?.song?.description ||
                "No additional background description found for this song."}
            </p>

            {info?.song?.source && (
              <a
                href={info.song.source}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-medium pt-1"
              >
                View on Wikipedia <ExternalLink size={12} />
              </a>
            )}
          </section>

          <div className="h-px bg-[#282828]" />

          {/* 2. Artist Information */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-primary text-xs font-semibold">
              <User size={14} />
              <span>About the Artist</span>
            </div>

            <div className="flex flex-col items-center text-center">
              <div className="relative w-20 h-20 rounded-full overflow-hidden bg-zinc-900 border border-[#282828] shadow-md mb-2">
                {info?.artist?.image ? (
                  <img
                    src={info.artist.image}
                    alt={info.artist.name}
                    className="w-full h-full object-cover"
                  />
                ) : artistCoverUrl ? (
                  <img
                    src={artistCoverUrl}
                    alt={info?.artist?.name || currentSong.artistName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-600 font-bold text-2xl">
                    {currentSong.artistName?.charAt(0) || "A"}
                  </div>
                )}
              </div>
              <h4 className="text-base font-bold text-white">
                {info?.artist?.name || currentSong.artistName}
              </h4>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed font-normal">
              {info?.artist?.description ||
                "No artist biography available at this time."}
            </p>

            {info?.artist?.source && (
              <a
                href={info.artist.source}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-medium"
              >
                View on Wikipedia <ExternalLink size={12} />
              </a>
            )}
          </section>

          {/* 3. More Songs by Artist Section */}
          {artistMoreSongs.length > 0 && (
            <>
              <div className="h-px bg-[#282828]" />
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-primary text-xs font-semibold">
                    <ListMusic size={14} />
                    <span>More by {currentSong.artistName}</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  {artistMoreSongs.map((song: Song) => {
                    const songImg = song.imageKey
                      ? getImageUrl(song.imageKey, { width: 80, height: 80, aspectRatio: "1-1" })
                      : song.imageKey || "";

                    return (
                      <div
                        key={song.id}
                        onClick={() => playerActions.playSong(song)}
                        className="group flex items-center gap-3 p-2 rounded-lg hover:bg-[#222222] transition-colors cursor-pointer border border-transparent hover:border-[#282828]"
                      >
                        <div className="relative w-10 h-10 rounded-md overflow-hidden bg-zinc-900 shrink-0 group/thumb">
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
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <Play size={14} fill="white" className="text-white ml-0.5" />
                          </div>
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-white truncate group-hover:text-primary transition-colors">
                            {song.title}
                          </p>
                          <p className="text-[11px] text-zinc-400 truncate">
                            {song.artistName}
                          </p>
                        </div>

                        <span className="text-[11px] font-normal text-zinc-400 tabular-nums shrink-0">
                          {formatDuration(song.duration)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>
            </>
          )}
        </div>
      )}
    </aside>
  );
}
