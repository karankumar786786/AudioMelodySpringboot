"use client";

import React from "react";

export interface TableSkeletonProps {
  columns?: number;
  rows?: number;
  variant?: "default" | "job" | "user" | "audit";
}

export function TableSkeleton({
  columns = 5,
  rows = 5,
  variant = "default",
}: TableSkeletonProps) {
  const rowList = Array.from({ length: rows });

  if (variant === "job") {
    return (
      <>
        {rowList.map((_, rIdx) => (
          <tr key={rIdx} className="animate-pulse border-b border-[#282828]">
            <td className="py-3 px-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-zinc-800 shrink-0" />
                <div className="space-y-1.5 min-w-0">
                  <div className="h-3.5 w-32 bg-zinc-800 rounded" />
                  <div className="h-2.5 w-20 bg-zinc-800/60 rounded" />
                </div>
              </div>
            </td>
            <td className="py-3 px-4">
              <div className="h-5 w-20 bg-zinc-800 rounded-full" />
            </td>
            <td className="py-3 px-4">
              <div className="h-5 w-24 bg-zinc-800 rounded-full" />
            </td>
            <td className="py-3 px-4">
              <div className="h-3.5 w-10 bg-zinc-800 rounded" />
            </td>
            <td className="py-3 px-4">
              <div className="h-3.5 w-14 bg-zinc-800 rounded" />
            </td>
            <td className="py-3 px-4">
              <div className="h-3.5 w-14 bg-zinc-800 rounded" />
            </td>
            <td className="py-3 px-4">
              <div className="h-3.5 w-16 bg-zinc-800 rounded" />
            </td>
            <td className="py-3 px-4 text-right">
              <div className="inline-flex gap-1.5 justify-end">
                <div className="w-7 h-7 rounded-lg bg-zinc-800" />
                <div className="w-7 h-7 rounded-lg bg-zinc-800" />
              </div>
            </td>
          </tr>
        ))}
      </>
    );
  }

  if (variant === "user") {
    return (
      <>
        {rowList.map((_, rIdx) => (
          <tr key={rIdx} className="animate-pulse border-b border-[#282828]">
            <td className="px-6 py-4">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-2xl bg-zinc-800 shrink-0" />
                <div className="space-y-1.5">
                  <div className="h-4 w-28 bg-zinc-800 rounded" />
                  <div className="h-2.5 w-24 bg-zinc-800/60 rounded" />
                </div>
              </div>
            </td>
            <td className="px-6 py-4">
              <div className="h-3.5 w-44 bg-zinc-800 rounded" />
            </td>
            <td className="px-6 py-4">
              <div className="h-6 w-16 bg-zinc-800 rounded-full" />
            </td>
            <td className="px-6 py-4">
              <div className="h-6 w-20 bg-zinc-800 rounded-full" />
            </td>
            <td className="px-6 py-4 text-right">
              <div className="inline-flex gap-2 justify-end">
                <div className="w-8 h-8 rounded-xl bg-zinc-800" />
                <div className="w-8 h-8 rounded-xl bg-zinc-800" />
              </div>
            </td>
          </tr>
        ))}
      </>
    );
  }

  if (variant === "audit") {
    return (
      <>
        {rowList.map((_, rIdx) => (
          <tr key={rIdx} className="animate-pulse border-b border-[#282828]">
            <td className="py-3 px-4">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-zinc-800 shrink-0" />
                <div className="h-3.5 w-24 bg-zinc-800 rounded" />
              </div>
            </td>
            <td className="py-3 px-4">
              <div className="h-3.5 w-28 bg-zinc-800 rounded" />
            </td>
            <td className="py-3 px-4">
              <div className="h-5 w-20 bg-zinc-800 rounded-full" />
            </td>
            <td className="py-3 px-4">
              <div className="h-5 w-24 bg-zinc-800 rounded-full" />
            </td>
            <td className="py-3 px-4">
              <div className="h-3.5 w-12 bg-zinc-800 rounded" />
            </td>
            <td className="py-3 px-4">
              <div className="h-3.5 w-16 bg-zinc-800 rounded" />
            </td>
            <td className="py-3 px-4 text-right">
              <div className="w-7 h-7 rounded-lg bg-zinc-800 ml-auto" />
            </td>
          </tr>
        ))}
      </>
    );
  }

  // Generic fallback
  return (
    <>
      {rowList.map((_, rIdx) => (
        <tr key={rIdx} className="animate-pulse border-b border-[#282828]">
          {Array.from({ length: columns }).map((_, cIdx) => (
            <td key={cIdx} className="py-3.5 px-4">
              <div className="h-4 bg-zinc-800 rounded w-3/4" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
