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
    <div className="px-10 pb-20 pt-6 space-y-12">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="flex items-center gap-6"
      >
        <div className="p-2.5 bg-primary/10 rounded-xl border border-primary/20">
          <Users2 className="text-primary" size={24} />
        </div>
        <div>
          <h2 className="text-3xl font-black italic tracking-tight uppercase text-white flex items-center gap-2">
            Artists{" "}
            <Sparkles size={20} className="text-primary animate-pulse" />
          </h2>
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 italic mt-0.5">
            Verified vocal synchronization nodes in the network
          </p>
        </div>
      </motion.div>

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-8">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((i) => (
            <div key={i} className="space-y-4 animate-pulse">
              <div className="aspect-square rounded-full bg-zinc-900/60 border border-white/5 shimmer-loader" />
              <div className="h-3.5 w-2/3 bg-zinc-900/60 rounded mx-auto" />
              <div className="h-2.5 w-1/3 bg-zinc-900/60 rounded mx-auto" />
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
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-8"
        >
          {artists.map((artist: any) => (
            <motion.div
              key={artist.id}
              variants={{
                hidden: { opacity: 0, y: 15 },
                show: {
                  opacity: 1,
                  y: 0,
                  transition: { type: "spring", stiffness: 100 },
                },
              }}
            >
              <ArtistCard artist={artist} />
            </motion.div>
          ))}
        </motion.div>
      ) : (
        <div className="py-32 text-center text-zinc-700 border-2 border-dashed border-zinc-900 rounded-[4rem] font-bold italic tracking-tight uppercase">
          No Artists found
        </div>
      )}
    </div>
  );
}
