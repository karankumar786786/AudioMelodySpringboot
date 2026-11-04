import React from "react";

export const AlbumSkeleton: React.FC = () => {
  return (
    <div className="min-h-full pb-24 px-2 md:px-4 animate-pulse select-none">
      {/* Hero Section Skeleton */}
      <section className="relative overflow-hidden px-6 pb-8 pt-16 md:px-10 md:pt-20 rounded-2xl border border-white/5 bg-zinc-900/60">
        <div className="absolute inset-0 bg-linear-to-b from-zinc-800/25 via-zinc-900/40 to-black/90 pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center gap-7 md:flex-row md:items-end">
          {/* Rounded Album Art */}
          <div className="h-44 w-44 md:h-52 md:w-52 shrink-0 rounded-2xl bg-zinc-800/80 border border-white/10 shadow-2xl" />

          {/* Album Metadata */}
          <div className="flex flex-col items-center text-center md:items-start md:text-left min-w-0 w-full">
            {/* Badges */}
            <div className="flex items-center gap-2 mb-2">
              <div className="h-5 w-20 rounded-full bg-zinc-800/80" />
              <div className="h-5 w-16 rounded-full bg-zinc-800/60" />
              <div className="h-5 w-14 rounded-full bg-zinc-800/60" />
            </div>

            {/* Title */}
            <div className="h-10 md:h-14 w-64 md:w-96 max-w-full rounded-xl bg-zinc-800/90 my-2" />

            {/* Subtitle / Meta */}
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mt-2">
              <div className="h-4 w-28 rounded bg-zinc-800/70" />
              <div className="h-1 w-1 rounded-full bg-zinc-700" />
              <div className="h-4 w-16 rounded bg-zinc-800/60" />
              <div className="h-1 w-1 rounded-full bg-zinc-700" />
              <div className="h-4 w-20 rounded bg-zinc-800/60" />
              <div className="h-1 w-1 rounded-full bg-zinc-700" />
              <div className="h-4 w-24 rounded bg-zinc-800/60" />
            </div>

            {/* Hero Actions */}
            <div className="mt-6 flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-primary/30" />
              <div className="h-10 w-10 rounded-full bg-zinc-800 border border-white/10" />
              <div className="h-10 w-10 rounded-full bg-zinc-800 border border-white/10" />
              <div className="h-10 w-10 rounded-full bg-zinc-800 border border-white/10" />
            </div>
          </div>
        </div>
      </section>

      {/* Tracklist Skeleton */}
      <section className="px-2 pb-10 pt-6 md:px-6">
        <div className="grid grid-cols-12 items-center border-b border-white/10 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          <div className="col-span-1 text-center">#</div>
          <div className="col-span-8 sm:col-span-5 md:col-span-4 lg:col-span-4">Title</div>
          <div className="col-span-3 hidden sm:block md:col-span-3 lg:col-span-2">Artist</div>
          <div className="col-span-2 hidden lg:block">Album</div>
          <div className="col-span-1 hidden md:block">Genre</div>
          <div className="col-span-1 hidden sm:block md:col-span-1 lg:col-span-1 text-right pr-3">Plays</div>
          <div className="col-span-3 sm:col-span-2 md:col-span-2 lg:col-span-1 text-right">Duration</div>
        </div>

        <div className="mt-2 flex flex-col gap-1">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((index) => (
            <div
              key={index}
              className="grid grid-cols-12 items-center rounded-xl px-4 py-2.5 bg-zinc-900/30 border border-white/5"
            >
              <div className="col-span-1 text-center flex justify-center">
                <div className="h-3 w-3 rounded bg-zinc-800" />
              </div>

              <div className="col-span-8 sm:col-span-5 md:col-span-4 lg:col-span-4 flex items-center gap-3 min-w-0 pr-3">
                <div className="h-10 w-10 shrink-0 rounded-lg bg-zinc-800" />
                <div className="flex-1 space-y-1.5 min-w-0">
                  <div className="h-3.5 w-4/5 rounded bg-zinc-800" />
                  <div className="h-2.5 w-1/2 rounded bg-zinc-800/60" />
                </div>
              </div>

              <div className="col-span-3 hidden sm:block md:col-span-3 lg:col-span-2 pr-3">
                <div className="h-3 w-24 rounded bg-zinc-800/60" />
              </div>

              <div className="col-span-2 hidden lg:block pr-3">
                <div className="h-3 w-20 rounded bg-zinc-800/60" />
              </div>

              <div className="col-span-1 hidden md:block pr-3">
                <div className="h-3 w-14 rounded bg-zinc-800/60" />
              </div>

              <div className="col-span-1 hidden sm:block md:col-span-1 lg:col-span-1 text-right pr-3">
                <div className="h-3 w-10 rounded bg-zinc-800/60 ml-auto" />
              </div>

              <div className="col-span-3 sm:col-span-2 md:col-span-2 lg:col-span-1 text-right">
                <div className="h-3 w-10 rounded bg-zinc-800/60 ml-auto" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
