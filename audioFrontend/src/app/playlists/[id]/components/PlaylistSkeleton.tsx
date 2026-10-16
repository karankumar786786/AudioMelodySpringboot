import React from "react";

export const PlaylistSkeleton: React.FC = () => {
  return (
    <div className="min-h-full pb-20 animate-pulse select-none">
      {/* Hero Banner Skeleton */}
      <section className="relative h-[45vh] min-h-40 max-h-115 w-full overflow-hidden rounded-2xl bg-zinc-900/70 border border-white/5">
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent pointer-events-none" />

        <div className="relative z-10 flex h-full flex-col justify-end px-8 pb-6 md:px-12 md:pb-8">
          {/* Category Pill */}
          <div className="mb-2 h-4 w-28 rounded bg-zinc-800/80" />

          {/* Playlist Title */}
          <div className="h-9 md:h-12 w-64 md:w-96 max-w-full rounded-xl bg-zinc-800/90" />

          {/* Description */}
          <div className="mt-3 space-y-1.5 max-w-lg">
            <div className="h-3.5 w-full rounded bg-zinc-800/60" />
            <div className="h-3.5 w-3/4 rounded bg-zinc-800/40" />
          </div>

          {/* Metadata & Actions row */}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="h-4 w-24 rounded bg-zinc-800/60" />
            <div className="h-1 w-1 rounded-full bg-zinc-700" />
            <div className="h-4 w-16 rounded bg-zinc-800/60" />
            <div className="h-1 w-1 rounded-full bg-zinc-700" />
            <div className="h-4 w-24 rounded bg-zinc-800/60" />
            <div className="h-1 w-1 rounded-full bg-zinc-700" />
            <div className="h-4 w-16 rounded bg-zinc-800/60" />

            <div className="ml-2 h-10 w-28 rounded-full bg-white/20" />
          </div>
        </div>
      </section>

      {/* Playlist Track Table Skeleton */}
      <section className="px-6 pb-10 pt-4 md:px-10">
        {/* Table Column Headers */}
        <div className="grid grid-cols-12 items-center border-b border-white/10 px-4 pb-3 text-xs font-medium uppercase tracking-wider text-zinc-600">
          <div className="col-span-1 text-center">#</div>
          <div className="col-span-7 sm:col-span-5 md:col-span-4 lg:col-span-3">Title</div>
          <div className="col-span-2 hidden md:block">Artist</div>
          <div className="col-span-2 hidden lg:block">Album</div>
          <div className="col-span-1 hidden xl:block">Genre</div>
          <div className="col-span-3 sm:col-span-3 md:col-span-3 lg:col-span-2 xl:col-span-2 hidden sm:block text-right">Plays</div>
          <div className="col-span-4 sm:col-span-3 md:col-span-2 lg:col-span-2 xl:col-span-1 text-right">Duration</div>
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
              <div className="col-span-7 sm:col-span-5 md:col-span-4 lg:col-span-3 flex items-center gap-3 min-w-0 pr-3">
                <div className="h-10 w-10 shrink-0 rounded-md bg-zinc-800" />
                <div className="flex-1 space-y-1.5 min-w-0">
                  <div className="h-3.5 w-4/5 rounded bg-zinc-800" />
                  <div className="h-2.5 w-1/2 rounded bg-zinc-800/60" />
                </div>
              </div>

              {/* Artist */}
              <div className="col-span-2 hidden md:block pr-3">
                <div className="h-3 w-24 rounded bg-zinc-800/60" />
              </div>

              {/* Album */}
              <div className="col-span-2 hidden lg:block pr-3">
                <div className="h-3 w-28 rounded bg-zinc-800/60" />
              </div>

              {/* Genre */}
              <div className="col-span-1 hidden xl:block pr-3">
                <div className="h-3 w-16 rounded bg-zinc-800/60" />
              </div>

              {/* Plays */}
              <div className="col-span-3 sm:col-span-3 md:col-span-3 lg:col-span-2 xl:col-span-2 hidden sm:block text-right pr-2">
                <div className="h-3 w-16 rounded bg-zinc-800/60 ml-auto" />
              </div>

              {/* Duration */}
              <div className="col-span-4 sm:col-span-3 md:col-span-2 lg:col-span-2 xl:col-span-1 text-right">
                <div className="h-3 w-10 rounded bg-zinc-800/60 ml-auto" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
