import React from "react";

export const HomeSkeleton: React.FC = () => {
  return (
    <div className="px-4 sm:px-6 md:px-8 xl:px-10 pb-20 bg-black pt-(--app-content-pt,1.5rem) space-y-5 sm:space-y-6 animate-pulse select-none">
      {/* Header & Filter Pills Skeleton */}
      <div className="space-y-2.5">
        <div className="h-7 sm:h-8 w-48 bg-zinc-800/80 rounded-lg" />
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-7 w-20 bg-zinc-850 rounded-full border border-white/5"
            />
          ))}
        </div>
      </div>

      {/* Quick Picks Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-2.5">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="h-11 sm:h-12 rounded-lg bg-zinc-900/80 border border-white/5 flex items-center gap-2.5 overflow-hidden"
          >
            <div className="w-11 sm:w-12 h-full bg-zinc-800 shrink-0" />
            <div className="flex-1 space-y-1 pr-3">
              <div className="h-2.5 w-3/5 bg-zinc-800 rounded" />
              <div className="h-2 w-2/5 bg-zinc-850 rounded" />
            </div>
          </div>
        ))}
      </div>

      {/* Artists Skeleton */}
      <div className="space-y-3">
        <div className="h-6 w-32 bg-zinc-800/80 rounded-lg" />
        <div className="flex gap-4 overflow-hidden">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="flex-none w-31.5 sm:w-32.5 space-y-3"
            >
              <div className="aspect-square rounded-full bg-zinc-900 border border-white/5" />
              <div className="h-3 w-3/4 bg-zinc-900 rounded mx-auto" />
            </div>
          ))}
        </div>
      </div>

      {/* Playlists Skeleton */}
      <div className="space-y-3">
        <div className="h-6 w-40 bg-zinc-800/80 rounded-lg" />
        <div className="flex gap-4 overflow-hidden">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="flex-none w-36.25 sm:w-38.75 space-y-3"
            >
              <div className="aspect-square rounded-xl bg-zinc-900 border border-white/5" />
              <div className="h-3 w-3/4 bg-zinc-900 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
