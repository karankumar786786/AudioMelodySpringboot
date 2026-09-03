"use client";

import { useQuery } from "@tanstack/react-query";
import { musicApi } from "@/lib/api";
import { ArtistCard } from "../../components/ArtistCard";
import { Users2, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { ServerErrorPage, SomethingWentWrongPage } from "@/components/ErrorPages";

export default function ArtistsPage() {
  const { data: artistsResponse, isLoading, error: artistsError, refetch } = useQuery({
    queryKey: ["artists"],
    queryFn: () => musicApi.artists.list(1, 100),
  });

  const artists = artistsResponse?.data?.data || [];

  return (
    <div className="px-4 sm:px-6 md:px-8 xl:px-10 pb-20 bg-black pt-[var(--app-content-pt,5rem)] space-y-8">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-center gap-4"
      >
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            Artists
          </h2>
          <p className="text-xs font-medium text-zinc-400 mt-1">
            Discover top artists and creators.
          </p>
        </div>
      </motion.div>

      {artistsError ? (
        (artistsError as any)?.status >= 500 ? (
          <ServerErrorPage onRetry={() => refetch()} />
        ) : (
          <SomethingWentWrongPage error={artistsError as Error} reset={() => refetch()} />
        )
      ) : isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 md:gap-6">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((i) => (
            <div key={i} className="space-y-3 animate-pulse">
              <div className="aspect-square rounded-full bg-zinc-900 mx-auto" />
              <div className="h-3 w-2/3 bg-zinc-900 rounded mx-auto" />
              <div className="h-2.5 w-1/3 bg-zinc-900 rounded mx-auto" />
            </div>
          ))}
        </div>
      ) : artists.length > 0 ? (
        <motion.div
          initial="hidden"
          animate="show"
          variants={{
            hidden: { opacity: 0 },
            show: {
              opacity: 1,
              transition: { staggerChildren: 0.04 },
            },
          }}
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 md:gap-6"
        >
          {artists.map((artist: any) => (
            <motion.div
              key={artist.id}
              variants={{
                hidden: { opacity: 0, y: 10 },
                show: {
                  opacity: 1,
                  y: 0,
                },
              }}
            >
              <ArtistCard artist={artist} />
            </motion.div>
          ))}
        </motion.div>
      ) : (
        <div className="py-20 text-center text-zinc-500 border border-dashed border-[#282828] rounded-xl font-medium">
          No artists found
        </div>
      )}
    </div>
  );
}
