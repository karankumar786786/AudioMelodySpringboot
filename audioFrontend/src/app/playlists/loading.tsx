import React from "react";

export default function LoadingPlaylistsPage() {
  return (
    <div className="px-4 sm:px-6 md:px-8 xl:px-10 pb-20 bg-black pt-(--app-content-pt,5rem) space-y-8 animate-pulse select-none">
      <div className="space-y-2">
        <div className="h-8 w-40 rounded-lg bg-zinc-800" />
        <div className="h-4 w-72 rounded bg-zinc-850" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 md:gap-6">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((i) => (
          <div key={i} className="space-y-3">
            <div className="aspect-square rounded-xl bg-zinc-900 border border-white/5" />
            <div className="h-3.5 w-3/4 rounded bg-zinc-800" />
            <div className="h-3 w-1/2 rounded bg-zinc-850" />
          </div>
        ))}
      </div>
    </div>
  );
}
