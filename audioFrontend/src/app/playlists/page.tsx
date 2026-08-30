"use client";

import { useQuery } from "@tanstack/react-query";
import { musicApi } from "@/lib/api";
import { PlaylistCard } from "../../components/PlaylistCard";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ServerErrorPage, SomethingWentWrongPage } from "@/components/ErrorPages";

export default function PlaylistsPage() {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const { data: systemPlaylistsResponse, isLoading: isSystemLoading, error: playlistsError, refetch } =
    useQuery({
      queryKey: ["system-playlists"],
      queryFn: () => musicApi.playlists.list(1, 20),
    });

  const systemPlaylists = systemPlaylistsResponse?.data?.data || [];

  if (!isMounted) return null;

  return (
    <div className="px-10 pb-20 bg-black pt-[var(--app-content-pt,5rem)] space-y-8">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-center gap-4"
      >
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            Playlists
          </h2>
          <p className="text-xs font-medium text-zinc-400 mt-1">
            Explore curated playlists for every mood and genre.
          </p>
        </div>
      </motion.div>

      {playlistsError ? (
        (playlistsError as any)?.status >= 500 ? (
          <ServerErrorPage onRetry={() => refetch()} />
        ) : (
          <SomethingWentWrongPage error={playlistsError as Error} reset={() => refetch()} />
        )
      ) : isSystemLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="space-y-3 animate-pulse">
              <div className="aspect-square rounded-md bg-zinc-900" />
              <div className="h-3 w-2/3 bg-zinc-900 rounded" />
              <div className="h-2.5 w-1/3 bg-zinc-900 rounded" />
            </div>
          ))}
        </div>
      ) : systemPlaylists.length > 0 ? (
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
          {systemPlaylists.map((playlist: any) => (
            <motion.div
              key={playlist.id}
              variants={{
                hidden: { opacity: 0, y: 10 },
                show: {
                  opacity: 1,
                  y: 0,
                },
              }}
            >
              <PlaylistCard playlist={playlist} />
            </motion.div>
          ))}
        </motion.div>
      ) : (
        <div className="py-20 text-center text-zinc-500 border border-dashed border-[#282828] rounded-xl font-medium">
          No playlists found
        </div>
      )}
    </div>
  );
}
