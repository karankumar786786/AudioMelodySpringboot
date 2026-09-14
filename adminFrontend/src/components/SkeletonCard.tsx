"use client";

import React from "react";

interface SkeletonCardProps {
  variant?: "stat" | "table-row" | "activity" | "card";
  count?: number;
  className?: string;
}

export function SkeletonCard({
  variant = "stat",
  count = 1,
  className = "",
}: SkeletonCardProps) {
  const items = Array.from({ length: count });

  if (variant === "table-row") {
    return (
      <>
        {items.map((_, idx) => (
          <tr key={idx} className="animate-pulse border-b border-[#282828]">
            <td className="px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-zinc-800 shrink-0" />
                <div className="space-y-2">
                  <div className="h-4 w-28 bg-zinc-800 rounded-md" />
                  <div className="h-3 w-16 bg-zinc-800/60 rounded-md" />
                </div>
              </div>
            </td>
            <td className="px-6 py-4">
              <div className="h-4 w-40 bg-zinc-800 rounded-md" />
            </td>
            <td className="px-6 py-4">
              <div className="h-6 w-16 bg-zinc-800 rounded-full" />
            </td>
            <td className="px-6 py-4">
              <div className="h-6 w-20 bg-zinc-800 rounded-full" />
            </td>
            <td className="px-6 py-4 text-right">
              <div className="inline-flex gap-2">
                <div className="w-8 h-8 rounded-lg bg-zinc-800" />
                <div className="w-8 h-8 rounded-lg bg-zinc-800" />
              </div>
            </td>
          </tr>
        ))}
      </>
    );
  }

  if (variant === "activity") {
    return (
      <div className={`space-y-3 ${className}`}>
        {items.map((_, idx) => (
          <div
            key={idx}
            className="animate-pulse flex items-center justify-between p-3.5 rounded-2xl bg-black/60 border border-[#282828]"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-zinc-800 shrink-0" />
              <div className="space-y-1.5">
                <div className="h-4 w-32 bg-zinc-800 rounded-md" />
                <div className="h-3 w-20 bg-zinc-800/60 rounded-md" />
              </div>
            </div>
            <div className="h-5 w-16 bg-zinc-800 rounded-full" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === "card") {
    return (
      <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 ${className}`}>
        {items.map((_, idx) => (
          <div
            key={idx}
            className="animate-pulse bg-[#121212] rounded-3xl p-6 border border-[#282828] space-y-4"
          >
            <div className="aspect-square w-full rounded-2xl bg-zinc-800" />
            <div className="space-y-2">
              <div className="h-5 w-3/4 bg-zinc-800 rounded-md" />
              <div className="h-4 w-1/2 bg-zinc-800/60 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Default "stat" variant
  return (
    <>
      {items.map((_, idx) => (
        <div
          key={idx}
          className={`animate-pulse relative overflow-hidden bg-[#121212] p-7 rounded-3xl border border-[#282828] shadow-sm ${className}`}
        >
          <div className="flex items-center justify-between mb-5">
            <div className="w-12 h-12 rounded-2xl bg-zinc-800" />
            <div className="w-16 h-5 rounded-full bg-zinc-800/60" />
          </div>
          <div className="space-y-2.5">
            <div className="h-9 w-24 bg-zinc-800 rounded-lg" />
            <div className="h-4 w-32 bg-zinc-800/60 rounded-md" />
          </div>
          <div className="mt-4 pt-4 border-t border-[#282828] flex items-center justify-between">
            <div className="h-3 w-20 bg-zinc-800/60 rounded" />
            <div className="h-3 w-12 bg-zinc-800/60 rounded" />
          </div>
        </div>
      ))}
    </>
  );
}
