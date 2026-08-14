"use client";

import { useQuery } from "@tanstack/react-query";
import { musicApi } from "@/lib/api";
import { useParams, useRouter } from "next/navigation";
import { useStore } from "@tanstack/react-store";
import { getImageUrl } from "@/lib/image-utils";
import { Play, Pause, ArrowLeft, Clock, Music, Sparkles } from "lucide-react";
import { playerStore, playerActions } from "@/store/player.store";
import { mapListToPlayerSongs } from "@/lib/player-utils";
import { toast } from "sonner";

export default function ArtistPage() {
  const { id } = useParams();
  const router = useRouter();

  const currentSong = useStore(playerStore, (s) => s.currentSong);
  const isPlaying = useStore(playerStore, (s) => s.isPlaying);

  const { data: artistResponse, isLoading: isArtistLoading } = useQuery({
    queryKey: ["artist", id],
    queryFn: () => musicApi.artists.getById(id as string),
  });

  const { data: songsResponse, isLoading: isSongsLoading } = useQuery({
    queryKey: ["artist-songs", id],
    queryFn: () => musicApi.artists.getSongs(id as string),
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

  if (isArtistLoading || isSongsLoading) {
    return (
      <div className="p-20 text-center animate-pulse text-zinc-400 font-medium text-xs flex flex-col items-center justify-center gap-4 h-[60vh]">
        <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
        Loading Artist Details...
      </div>
    );
  }

  const artist = artistResponse?.data;
  const songs = songsResponse?.data?.data || [];

  const bannerUrl = getImageUrl(artist?.bannerImageKey, {
    width: 1600,
    height: 800,
    focus: "auto",
    aspectRatio: "2-1",
  });

  const coverUrl = getImageUrl(artist?.coverImageKey, {
    width: 400,
    height: 400,
    focus: "face",
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

      {/* Hero Banner */}
      <section className="relative h-80 w-full overflow-hidden rounded-xl border border-[#282828] bg-[#181818] group shadow-xl">
        <div className="absolute inset-0 bg-[#181818]">
          {artist?.bannerImageKey ? (
            <img
              src={bannerUrl}
              alt={artist.name}
              className="h-full w-full object-cover opacity-20 blur-md"
            />
          ) : (
            <div className="h-full w-full bg-[#181818]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#181818] via-[#181818]/80 to-transparent z-10" />
        </div>

        <div className="absolute inset-0 flex items-end p-8 gap-8 z-20">
          {/* Main Portrait */}
          <div className="h-44 w-44 shrink-0 overflow-hidden rounded-full border border-[#282828] shadow-md hidden md:block relative bg-zinc-900">
            {artist?.coverImageKey ? (
              <img
                src={coverUrl}
                alt={artist.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-zinc-600 text-5xl font-bold">
                {artist?.name?.charAt(0)}
              </div>
            )}
          </div>

          <div className="flex-1 space-y-3 pb-1">
            <div className="space-y-1">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
                Verified Artist
              </span>
              <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight">
                {artist?.name}
              </h1>
            </div>

            {artist?.about && (
              <p className="max-w-2xl text-zinc-400 font-normal text-xs line-clamp-2">
                {artist.about}
              </p>
            )}

            <div className="flex items-center gap-4 pt-2">
              <button
                onClick={() => {
                  if (songs.length > 0) {
                    playerActions.playAll(mapListToPlayerSongs(songs));
                    toast.success("Playing Songs", {
                      description: `Starting playback for ${artist?.name}.`,
                    });
                  }
                }}
                disabled={songs.length === 0}
                className="px-8 h-11 bg-primary text-black rounded-full font-bold text-xs uppercase tracking-wider hover:scale-105 transition-all flex items-center gap-2 shadow-md cursor-pointer disabled:opacity-50"
              >
                <Play fill="black" size={16} />
                Play All
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Content Grid */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-[#282828] pb-3">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-bold text-white tracking-tight">
              Popular Songs
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
            <div className="col-span-3 hidden md:block">Genre</div>
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

                    {/* Image & Title */}
                    <div className="col-span-6 md:col-span-6 flex items-center gap-3 min-w-0 pr-4">
                      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-zinc-900 shadow-sm">
                        {song.imageKey ? (
                          <img
                            src={
                              getImageUrl(song.imageKey, {
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
                          {song.genre || "Single"}
                        </p>
                      </div>
                    </div>

                    {/* Genre */}
                    <div className="col-span-3 hidden md:block min-w-0 pr-4">
                      <span className="text-zinc-400 font-normal text-xs transition-colors truncate block">
                        {song.genre || "Single"}
                      </span>
                    </div>

                    {/* Duration */}
                    <div className="col-span-2 flex items-center justify-end text-zinc-400 text-xs font-normal tabular-nums pr-4">
                      <span>{formatDuration(song.duration)}</span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-16 text-center border border-dashed border-[#282828] rounded-xl font-medium">
                <Music className="mx-auto text-zinc-600 mb-3" size={36} />
                <p className="text-zinc-400 text-xs font-normal">
                  No songs available
                </p>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
