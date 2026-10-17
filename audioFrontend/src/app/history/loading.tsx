import React from "react";

export default function LoadingHistoryPage() {
  return (
    <div className="px-4 sm:px-6 md:px-8 xl:px-10 pb-28 bg-black pt-[var(--app-content-pt,5rem)] space-y-8 min-h-screen animate-pulse select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#282828] pb-6">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-zinc-800" />
          <div className="space-y-2">
            <div className="h-6 w-48 rounded bg-zinc-800" />
            <div className="h-3.5 w-64 rounded bg-zinc-850" />
          </div>
        </div>
      </div>

      {/* Rows */}
      <div className="flex flex-col gap-1">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
          <div
            key={i}
            className="grid grid-cols-12 items-center rounded-lg px-4 py-3 bg-zinc-900/20 border border-white/2"
          >
            <div className="col-span-1 flex justify-center">
              <div className="h-3 w-3 rounded bg-zinc-800" />
            </div>
            <div className="col-span-6 sm:col-span-6 md:col-span-5 flex items-center gap-3">
              <div className="h-11 w-11 shrink-0 rounded-lg bg-zinc-800" />
              <div className="space-y-1.5 flex-1 min-w-0 pr-4">
                <div className="h-3.5 w-3/4 rounded bg-zinc-800" />
                <div className="h-2.5 w-1/2 rounded bg-zinc-850" />
              </div>
            </div>
            <div className="col-span-3 hidden md:block">
              <div className="h-3 w-28 rounded bg-zinc-850" />
            </div>
            <div className="col-span-5 sm:col-span-5 md:col-span-3 text-right">
              <div className="h-3 w-16 rounded bg-zinc-850 ml-auto" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
