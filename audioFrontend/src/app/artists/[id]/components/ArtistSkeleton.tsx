import React from "react";

export const ArtistSkeleton: React.FC = () => {
  return (
    <div className="min-h-full pb-20 animate-pulse select-none">
      {/* Hero Banner Skeleton */}
      <section className="relative overflow-hidden px-8 pb-8 pt-24 md:px-10 md:pt-28 rounded-2xl bg-zinc-900/60 border border-white/5">
        <div className="absolute inset-0 bg-linear-to-b from-zinc-800/25 via-zinc-900/40 to-black/90 pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center gap-7 md:flex-row md:items-end">
          {/* Circular Cover Art */}
          <div className="h-52 w-52 shrink-0 overflow-hidden rounded-full bg-zinc-800/80 shadow-2xl ring-2 ring-white/10 md:h-56 md:w-56" />

          {/* Details Column */}
          <div className="min-w-0 flex-1 pb-1 w-full flex flex-col items-center md:items-start text-center md:text-left">
            {/* Verified Artist Pill */}
            <div className="mb-3 h-5 w-32 rounded-full bg-zinc-800/80 border border-white/5" />

            {/* Artist Name */}
            <div className="h-10 md:h-14 w-64 md:w-96 max-w-full rounded-xl bg-zinc-800/90" />

            {/* Bio Snippet */}
            <div className="mt-4 space-y-2 w-full max-w-xl">
              <div className="h-3.5 w-full rounded bg-zinc-800/50" />
              <div className="h-3.5 w-3/4 rounded bg-zinc-800/40 mx-auto md:mx-0" />
            </div>

            {/* Metadata Stats Row */}
            <div className="mt-4 flex flex-wrap items-center justify-center md:justify-start gap-3">
              <div className="h-4 w-24 rounded bg-zinc-800/60" />
              <div className="h-1 w-1 rounded-full bg-zinc-700" />
              <div className="h-4 w-16 rounded bg-zinc-800/60" />
              <div className="h-1 w-1 rounded-full bg-zinc-700" />
              <div className="h-4 w-28 rounded bg-zinc-800/60" />
              <div className="h-1 w-1 rounded-full bg-zinc-700" />
              <div className="h-4 w-20 rounded bg-zinc-800/60" />
            </div>

            {/* Action Buttons Row */}
            <div className="mt-6 flex items-center justify-center md:justify-start gap-3">
              <div className="h-10 w-28 rounded-full bg-white/20" />
              <div className="h-10 w-32 rounded-full bg-zinc-800 border border-white/10" />
            </div>
          </div>
        </div>
      </section>

      {/* Popular Songs Section Skeleton */}
      <section className="px-6 pb-10 pt-6 md:px-10">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-4">
          <div className="h-6 w-36 rounded-md bg-zinc-800/80" />
          <div className="h-4 w-24 rounded bg-zinc-800/50" />
        </div>

        {/* Table Column Headers */}
        <div className="grid grid-cols-12 items-center border-b border-white/10 px-4 pb-3 text-xs font-medium uppercase tracking-wider text-zinc-600">
          <div className="col-span-1 text-center">#</div>
          <div className="col-span-6 sm:col-span-6 md:col-span-5 lg:col-span-4">Title</div>
          <div className="col-span-3 hidden md:block">Album</div>
          <div className="col-span-1 hidden lg:block">Genre</div>
          <div className="col-span-3 sm:col-span-3 md:col-span-2 hidden sm:block text-right">Plays</div>
          <div className="col-span-5 sm:col-span-2 md:col-span-1 text-right">Duration</div>
        </div>

        {/* Tracks List */}
        <div className="mt-2 flex flex-col gap-1">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((index) => (
            <div
              key={index}
              className="grid grid-cols-12 items-center rounded-md px-4 py-2.5 bg-zinc-900/20 border border-white/2"
            >
              {/* Track Index */}
              <div className="col-span-1 text-center flex justify-center">
                <div className="h-3 w-3 rounded bg-zinc-800" />
              </div>

              {/* Title + Thumbnail */}
              <div className="col-span-6 sm:col-span-6 md:col-span-5 lg:col-span-4 flex items-center gap-3 min-w-0 pr-3">
                <div className="h-10 w-10 shrink-0 rounded-md bg-zinc-800" />
                <div className="flex-1 space-y-1.5 min-w-0">
                  <div className="h-3.5 w-4/5 rounded bg-zinc-800" />
                  <div className="h-2.5 w-1/2 rounded bg-zinc-800/60" />
                </div>
              </div>

              {/* Album */}
              <div className="col-span-3 hidden md:block pr-3">
                <div className="h-3 w-3/5 rounded bg-zinc-800/60" />
              </div>

              {/* Genre */}
              <div className="col-span-1 hidden lg:block pr-3">
                <div className="h-3 w-16 rounded bg-zinc-800/60" />
              </div>

              {/* Plays */}
              <div className="col-span-3 sm:col-span-3 md:col-span-2 hidden sm:block text-right pr-2">
                <div className="h-3 w-16 rounded bg-zinc-800/60 ml-auto" />
              </div>

              {/* Duration */}
              <div className="col-span-5 sm:col-span-2 md:col-span-1 text-right">
                <div className="h-3 w-10 rounded bg-zinc-800/60 ml-auto" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
