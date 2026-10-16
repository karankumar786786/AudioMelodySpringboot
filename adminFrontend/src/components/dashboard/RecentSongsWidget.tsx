"use client";

import Link from "next/link";
import Image from "next/image";
import { Music, ArrowUpRight, Sparkles } from "lucide-react";
import { Song } from "@/lib/api";
import { SkeletonCard } from "@/components/SkeletonCard";
import { getImageUrl } from "@/lib/image-utils";

interface RecentSongsWidgetProps {
  songs: Song[] | undefined;
  loading: boolean;
}

export function RecentSongsWidget({ songs, loading }: RecentSongsWidgetProps) {
  const formatDuration = (seconds?: number) => {
    if (!seconds) return "--:--";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  return (
    <div className="bg-[#121212] rounded-2xl border border-[#282828] p-6 shadow-sm">
      <div className="flex items-center justify-between mb-5 pb-4 border-b border-[#282828]">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-zinc-900 border border-[#282828] text-white">
            <Music className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Recent Songs</h2>
            <p className="text-xs text-zinc-400">Latest additions to the music catalog</p>
          </div>
        </div>
        <Link
          href="/songs"
          className="text-xs font-bold text-white hover:underline flex items-center gap-1"
        >
          View All <ArrowUpRight className="w-3.5 h-3.5" />
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
        <div className="space-y-2.5">
          {songs.map((song) => (
            <div
              key={song.id}
              className="group flex items-center justify-between p-3 rounded-xl bg-black/50 hover:bg-[#181818] border border-[#282828] hover:border-zinc-700 transition-all"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-zinc-900 border border-[#282828] shrink-0">
                  {song.imageKey ? (
                    <Image
                      src={getImageUrl(song.imageKey, { width: 88, height: 88, quality: 75 })}
                      alt={song.title}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-500">
                      <Music className="w-4 h-4" />
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white text-sm truncate">
                      {song.title}
                    </span>
                    {song.isFeatured && (
                      <span className="shrink-0 flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/10 text-white border border-white/20">
                        <Sparkles className="w-2.5 h-2.5" /> Featured
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-400 truncate">
                    {song.artistName}
                  </p>
                </div>
              </div>

              <div className="shrink-0 text-right text-xs font-mono text-zinc-400">
                {formatDuration(song.duration)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
