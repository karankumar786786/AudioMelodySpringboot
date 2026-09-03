"use client";

import { useQuery } from "@tanstack/react-query";
import { musicApi, type Song } from "@/lib/api";
import { SongCard } from "@/components/SongCard";
import { useStore } from "@tanstack/react-store";
import { playerStore } from "@/store/player.store";
import { Heart, Sparkles, Clock } from "lucide-react";
import { useState, useEffect } from "react";
import { ServerErrorPage, SomethingWentWrongPage } from "@/components/ErrorPages";

export default function FavouritesPage() {
  const systemUser = useStore(playerStore, (s) => s.systemUser);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const { data: favouritesResponse, isLoading, error: favouritesError, refetch } = useQuery({
    queryKey: ["favourites", systemUser?.id],
    queryFn: () => musicApi.users.getFavourites(),
    enabled: !!systemUser?.id,
  });

  const songs = favouritesResponse?.data?.data || [];

  if (!isMounted) return null;

  return (
    <div className="px-4 sm:px-6 md:px-8 xl:px-10 pb-20 bg-black pt-[var(--app-content-pt,5rem)] space-y-8">
      <section>
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold text-white tracking-tight">
            Your Favourites
          </h2>
        </div>

        {favouritesError ? (
          (favouritesError as any)?.status >= 500 ? (
            <ServerErrorPage onRetry={() => refetch()} />
          ) : (
            <SomethingWentWrongPage error={favouritesError as Error} reset={() => refetch()} />
          )
        ) : isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 md:gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="aspect-square bg-zinc-900 rounded-md animate-pulse"
              />
            ))}
          </div>
        ) : songs.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 md:gap-6">
            {songs.map((song: Song) => (
              <SongCard key={song.id} song={song} />
            ))}
          </div>
        ) : (
          <div className="py-20 text-center text-zinc-500 border border-dashed border-[#282828] rounded-xl font-medium px-10">
            {systemUser ? "No favourite songs added yet" : "Sign in to view your favourites"}
          </div>
        )}
      </section>
    </div>
  );
}
