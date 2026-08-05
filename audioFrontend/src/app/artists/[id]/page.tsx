"use client";

import { useQuery } from "@tanstack/react-query";
import { musicApi } from "@/lib/api";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useStore } from "@tanstack/react-store";
import { getImageUrl } from "@/lib/image-utils";
import { Play, Pause, ArrowLeft, Clock, Music, Sparkles } from "lucide-react";
import { playerStore, playerActions } from "@/store/player.store";
import { mapToPlayerSong, mapListToPlayerSongs } from "@/lib/player-utils";
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

  const formatDuration = (ms: number) => {
    if (!ms) return "0:00";
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  if (isArtistLoading || isSongsLoading) {
    return (
      <div className="p-20 text-center animate-pulse text-zinc-500 uppercase font-black text-xs italic tracking-widest flex flex-col items-center justify-center gap-4 h-[60vh]">
        <div className="w-10 h-10 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
        Synchronizing Vocal Node Memory...
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
    <div className="px-10 pb-20 space-y-10 relative">
      {/* Back Button */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors text-xs font-black uppercase tracking-wider bg-white/5 border border-white/5 px-4 py-2.5 rounded-full hover:bg-white/10 active:scale-95 duration-200"
      >
        <ArrowLeft size={14} /> Back
      </button>

      {/* Hero Banner */}
      <section className="relative h-[480px] w-full overflow-hidden rounded-[3.5rem] border border-white/5 shadow-2xl group">
        <div className="absolute inset-0 bg-zinc-950">
          {artist?.bannerImageKey ? (
            <motion.img
              src={bannerUrl}
              alt={artist.name}
              initial={{ scale: 1 }}
              animate={{ scale: 1.05 }}
              transition={{
                duration: 20,
                repeat: Infinity,
                repeatType: "mirror",
                ease: "linear",
              }}
              className="h-full w-full object-cover opacity-25 blur-[2px] transition-all duration-[2s]"
            />
          ) : (
            <div className="h-full w-full bg-linear-to-br from-primary/10 via-zinc-950 to-black" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-transparent z-10" />
        </div>

        <div className="absolute inset-0 flex items-end p-12 gap-10 z-20">
          {/* Main Portrait */}
          <div className="h-60 w-60 shrink-0 overflow-hidden rounded-[2.5rem] border-[6px] border-black/40 shadow-2xl hidden md:block group-hover:scale-103 transition-transform duration-700 relative bg-zinc-950">
            {artist?.coverImageKey ? (
              <img
                src={coverUrl}
                alt={artist.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-zinc-700 text-6xl font-black italic">
                {artist?.name?.charAt(0)}
              </div>
            )}
          </div>

          <div className="flex-1 space-y-5 pb-2">
            <div className="space-y-1">
              <span className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.3em] text-primary italic bg-primary/10 px-3 py-1 rounded-full border border-primary/20">
                <Sparkles size={10} className="fill-primary" /> Verified Artist
                Profile
              </span>
              <h1 className="text-6xl md:text-7xl font-black text-white italic tracking-tighter uppercase drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
                {artist?.name}
              </h1>
            </div>

            {artist?.about && (
              <p className="max-w-2xl text-zinc-400 font-medium italic text-xs line-clamp-2 opacity-80">
                {artist.about}
              </p>
            )}

            <div className="flex items-center gap-6">
              <button
                onClick={() => {
                  if (songs.length > 0) {
                    playerActions.playAll(mapListToPlayerSongs(songs));
                    toast.success("Playing Discography", {
                      description: `Starting playback for ${songs.length} tracks by ${artist?.name}.`,
                    });
                  }
                }}
                disabled={songs.length === 0}
                className="px-10 h-14 bg-primary text-black rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 active:scale-95 transition-all flex items-center gap-2.5 shadow-xl shadow-primary/25 disabled:opacity-50"
              >
                <Play fill="black" size={16} />
                Play Discography
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Content Grid */}
      <div className="space-y-6">
        <div className="flex items-center justify-between border-b border-white/5 pb-4">
          <div className="flex items-center gap-4">
            <h3 className="text-xl font-black italic uppercase tracking-tighter text-white">
              Popular Tracks
            </h3>
            <div className="px-3 py-0.5 rounded-full bg-white/5 border border-white/10 text-[9px] font-black text-zinc-400 uppercase tracking-widest">
              {songs.length} Tracks
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {/* Table Header */}
          <div className="grid grid-cols-12 w-full px-6 py-1.5 text-zinc-500 text-[9px] font-black uppercase tracking-[0.2em] italic">
            <div className="col-span-1 text-center">#</div>
            <div className="col-span-7 md:col-span-8">Title</div>
            <div className="col-span-2 hidden md:block">Genre</div>
            <div className="col-span-2 text-right md:text-left">Duration</div>
          </div>

          <div className="flex flex-col gap-2">
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
                        playerActions.playSong(mapToPlayerSong(song));
                      }
                    }}
                    className={`group grid grid-cols-12 items-center gap-4 p-4 rounded-[1.8rem] border transition-all duration-300 text-left cursor-pointer ${
                      isActive
                        ? "bg-primary/5 border-primary/20 shadow-[0_4px_20px_rgba(120,240,142,0.08)]"
                        : "bg-white/1 border-transparent hover:border-white/5 hover:bg-white/3"
                    }`}
                  >
                    {/* Index or Play icon */}
                    <div className="col-span-1 text-center text-zinc-500 font-black text-xs group-hover:text-primary transition-colors italic flex items-center justify-center">
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
                        <span className="group-hover:hidden">
                          {(index + 1).toString().padStart(2, "0")}
                        </span>
                      )}
                      {!isActive && (
                        <Play
                          size={12}
                          className="hidden group-hover:block text-primary fill-primary"
                        />
                      )}
                    </div>

                    {/* Image & Title */}
                    <div className="col-span-7 md:col-span-8 flex items-center gap-4">
                      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-white/5 shadow-md">
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
                            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center bg-zinc-900 text-zinc-700">
                            <Music size={16} />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <h4
                          className={`font-black italic uppercase tracking-tighter transition-colors truncate text-base ${
                            isActive
                              ? "text-primary"
                              : "text-white group-hover:text-primary"
                          }`}
                        >
                          {song.title}
                        </h4>
                        <div className="flex items-center gap-2 mt-0.5">
                          {song.language && (
                            <span className="px-1.5 py-0.5 rounded bg-primary/10 border border-primary/20 text-[7px] text-primary font-black uppercase tracking-widest whitespace-nowrap">
                              {song.language}
                            </span>
                          )}
                          <span className="text-[8px] text-zinc-500 font-black uppercase italic tracking-widest truncate md:hidden">
                            {song.genre || "Acoustic"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Genre (Desktop) */}
                    <div className="col-span-2 hidden md:block">
                      <span className="text-zinc-400 font-black uppercase italic tracking-widest text-[9px] group-hover:text-white transition-colors truncate block">
                        {song.genre || "Acoustic"}
                      </span>
                    </div>

                    {/* Duration */}
                    <div className="col-span-4 md:col-span-2 flex items-center justify-end md:justify-start gap-2 text-zinc-400 text-[9px] font-black uppercase tracking-widest italic group-hover:text-white transition-colors tabular-nums">
                      <span>{formatDuration(song.duration)}</span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-28 text-center border-2 border-dashed border-zinc-900 rounded-[3rem]">
                <Music className="mx-auto text-zinc-800 mb-4" size={48} />
                <p className="text-zinc-600 font-black uppercase italic tracking-[0.3em] text-[9px]">
                  Transmission Silent
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
