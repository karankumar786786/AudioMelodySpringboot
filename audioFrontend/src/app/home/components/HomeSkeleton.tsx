import type React from "react";
import { Skeleton } from "@/components/ui/skeleton";

export const HomeSkeleton: React.FC = () => {
  return (
    <div className="px-4 sm:px-6 md:px-8 xl:px-10 pb-20 bg-black pt-(--app-content-pt,1.5rem) space-y-7 sm:space-y-8 select-none">
      {/* Header Skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-8 sm:h-9 w-56 rounded-lg" />
      </div>

      {/* Quick Picks Skeleton (2 rows x 3 columns) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-2.5">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="h-11 sm:h-12 rounded-lg bg-zinc-900/80 border border-white/5 flex items-center gap-2.5 overflow-hidden"
          >
            <Skeleton className="w-11 sm:w-12 h-full rounded-none shrink-0" />
            <div className="flex-1 space-y-1.5 pr-3">
              <Skeleton className="h-3 w-3/5" />
              <Skeleton className="h-2 w-2/5" />
            </div>
          </div>
        ))}
      </div>

      {/* Shelf 1 Skeleton (Jump back in) */}
      <div className="space-y-3">
        <Skeleton className="h-6 w-36 rounded-lg" />
        <div className="flex gap-3 overflow-hidden">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="flex-none w-36 sm:w-44 space-y-2.5">
              <Skeleton className="aspect-square rounded-xl" />
              <Skeleton className="h-3.5 w-4/5" />
              <Skeleton className="h-2.5 w-1/2" />
            </div>
          ))}
        </div>
      </div>

      {/* Shelf 2 Skeleton (Artists) */}
      <div className="space-y-3">
        <Skeleton className="h-6 w-36 rounded-lg" />
        <div className="flex gap-4 overflow-hidden">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="flex-none w-28.75 sm:w-31 space-y-2.5">
              <Skeleton className="aspect-square rounded-full mx-auto" />
              <Skeleton className="h-3 w-3/4 mx-auto" />
              <Skeleton className="h-2 w-1/2 mx-auto" />
            </div>
          ))}
        </div>
      </div>

      {/* Shelf 3 Skeleton (Trending) */}
      <div className="space-y-3">
        <Skeleton className="h-6 w-36 rounded-lg" />
        <div className="flex gap-3 overflow-hidden">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="flex-none w-36 sm:w-44 space-y-2.5">
              <Skeleton className="aspect-square rounded-xl" />
              <Skeleton className="h-3.5 w-4/5" />
              <Skeleton className="h-2.5 w-1/2" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
