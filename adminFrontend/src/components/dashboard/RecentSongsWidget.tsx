"use client";

import Link from "next/link";
import Image from "next/image";
import { Music, ArrowUpRight, Sparkles, Play, Pause } from "lucide-react";
import { Song } from "@/lib/api";
import { SkeletonCard } from "@/components/SkeletonCard";
import { getImageUrl } from "@/lib/image-utils";
import { useAudio } from "@/lib/audio-context";

interface RecentSongsWidgetProps {
  songs: Song[] | undefined;
  loading: boolean;
}

export function RecentSongsWidget({ songs, loading }: RecentSongsWidgetProps) {
  const { currentTrack, isPlaying, playTrack, pauseTrack, resumeTrack } = useAudio();

  const formatDuration = (seconds?: number) => {
    if (!seconds) return "--:--";
    const totalSec = seconds > 10000 ? Math.floor(seconds / 1000) : seconds;
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const handlePlaySong = (song: Song) => {
    if (currentTrack?.id === song.id) {
      if (isPlaying) {
        pauseTrack();
      } else {
        resumeTrack();
      }
    } else {
      playTrack({
        id: song.id,
        title: song.title,
        artistName: song.artistName,
        songKey: song.songKey || `audios/${song.id}`,
        imageKey: song.imageKey,
        videoKey: song.videoKey || undefined,
        duration: song.duration,
      });
    }
  };

  return (
    <div className="bg-[#121215] rounded-2xl border border-white/[0.08] p-6 shadow-sm">
      <div className="flex items-center justify-between mb-5 pb-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-black border border-white/[0.1] text-white">
            <Music className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Recent Songs</h2>
            <p className="text-xs text-zinc-400">Latest additions to the music catalog</p>
          </div>
        </div>
        <Link
          href="/songs"
          className="text-xs font-bold text-zinc-300 hover:text-white flex items-center gap-1 transition-colors"
        >
          <span>View All</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {loading ? (
        <SkeletonCard variant="activity" count={5} />
      ) : !songs || songs.length === 0 ? (
        <div className="py-12 text-center text-zinc-500 text-sm">
          <Music className="w-8 h-8 mx-auto mb-2 opacity-40" />
          No songs found in catalog.
        </div>
      ) : (
        <div className="space-y-2">
          {songs.map((song) => {
            const isCurrentPlaying = currentTrack?.id === song.id && isPlaying;
            return (
              <div
                key={song.id}
                className="group flex items-center justify-between p-2.5 rounded-xl bg-[#141418] hover:bg-[#1a1a20] border border-white/[0.06] hover:border-white/[0.14] transition-all"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative w-10 h-10 rounded-xl overflow-hidden bg-black border border-white/[0.1] shrink-0 group/cover">
                    {song.imageKey ? (
                      <Image
                        src={getImageUrl(song.imageKey, { width: 88, height: 88, quality: 75 })}
                        alt={song.title}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-600">
                        <Music className="w-4 h-4" />
                      </div>
                    )}

                    {/* Inline Play Button */}
                    <button
                      type="button"
                      onClick={() => handlePlaySong(song)}
                      className={`absolute inset-0 bg-black/60 flex items-center justify-center transition-opacity cursor-pointer ${
                        isCurrentPlaying
                          ? "opacity-100"
                          : "opacity-0 group-hover/cover:opacity-100"
                      }`}
                    >
                      {isCurrentPlaying ? (
                        <Pause className="w-4 h-4 text-white fill-white" />
                      ) : (
                        <Play className="w-4 h-4 text-white fill-white translate-x-0.5" />
                      )}
                    </button>
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-xs truncate group-hover:text-indigo-300 transition-colors">
                        {song.title}
                      </span>
                      {song.isFeatured && (
                        <span className="shrink-0 flex items-center gap-0.5 px-2 py-0.2 rounded-full text-[9px] font-bold bg-amber-400/10 text-amber-400 border border-amber-400/20">
                          <Sparkles className="w-2.5 h-2.5" />
                          <span>Featured</span>
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-400 truncate">
                      {song.artistName}
                    </p>
                  </div>
                </div>

                <div className="shrink-0 text-right text-xs font-mono text-zinc-400 tabular-nums">
                  {formatDuration(song.duration)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
