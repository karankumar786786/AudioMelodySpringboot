"use client";

import { useQuery } from "@tanstack/react-query";
import { musicApi } from "@/lib/api";
import { ArtistCard } from "../../components/ArtistCard";
import { Users2, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

export default function ArtistsPage() {
  const { data: artistsResponse, isLoading } = useQuery({
    queryKey: ["artists"],
    queryFn: () => musicApi.artists.list(1, 100),
  });

  const artists = artistsResponse?.data?.data || [];

  return (
    <div className="px-10 pb-20 pt-6 space-y-8">
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

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
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
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6"
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
