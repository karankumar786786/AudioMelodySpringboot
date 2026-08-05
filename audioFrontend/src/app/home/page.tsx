"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useStore } from "@tanstack/react-store";
import { motion } from "framer-motion";
import { Clock, ListMusic, Sparkles, Users2, Zap } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ArtistCard } from "../../components/ArtistCard";
import { HeroSection } from "../../components/HeroSection";
import { PlaylistCard } from "../../components/PlaylistCard";
import { SongCard } from "../../components/SongCard";
import { type Artist, musicApi, type Playlist, type Song } from "../../lib/api";
import { playerActions, playerStore } from "../../store/player.store";

export default function HomePage() {
  const systemUser = useStore(playerStore, (s) => s.systemUser);
  const [heroIndex, setHeroIndex] = useState(0);
  const triggerRef = useRef<HTMLDivElement>(null);

  const getGreeting = () => {
    const hrs = new Date().getHours();
    if (hrs < 12) return "Good Morning";
    if (hrs < 18) return "Good Afternoon";
    return "Good Evening";
  };

  // Trending Songs (Featured)
  const { data: trending, isLoading: isTrendingLoading } = useQuery({
    queryKey: ["trending-songs"],
    queryFn: () => musicApi.interactions.getTrending(),
  });

  // Top Artists
  const { data: artists, isLoading: isArtistsLoading } = useQuery({
    queryKey: ["home-artists"],
    queryFn: () => musicApi.artists.list(1, 15),
  });

  // Featured Playlists
  const { data: playlists, isLoading: isPlaylistsLoading } = useQuery({
    queryKey: ["home-playlists"],
    queryFn: () => musicApi.playlists.list(1, 15),
  });

  // Discover Feed (Infinite Scroll)
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, status } =
    useInfiniteQuery({
      queryKey: ["discover-songs"],
      queryFn: ({ pageParam }) =>
        musicApi.songs.getFeed(pageParam as number, 15),
      initialPageParam: 1,
      getNextPageParam: (lastPage) =>
        lastPage.data.pagination.hasNext
          ? lastPage.data.pagination.page + 1
          : undefined,
    });

  const systemToken = useStore(playerStore, (s) => s.systemToken);
  const { clearQueue, initQueue } = playerActions;

  const { data: recommendations } = useQuery({
    queryKey: ["recommendations", systemUser?.id],
    queryFn: () => musicApi.interactions.getRecommendations(),
    enabled: !!systemUser?.id && !!systemToken,
  });

  // Auto-switch hero if trending data exists
  useEffect(() => {
    if (!trending?.data?.data || trending.data.data.length <= 1) return;
    const interval = setInterval(() => {
      setHeroIndex(
        (prev) => (prev + 1) % Math.min(trending.data.data.length, 5),
      );
    }, 8000);
    return () => clearInterval(interval);
  }, [trending?.data?.data]);

  // Infinite scroll observer
  useEffect(() => {
    const target = triggerRef.current;
    if (!target) return;

    const rootElement = document.querySelector("main");
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      {
        root: rootElement,
        rootMargin: "200px",
        threshold: 0.01,
      },
    );

    observer.observe(target);
    return () => {
      observer.unobserve(target);
    };
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <div className="px-10 pb-20 pt-8 space-y-16">
      {/* 1. Hero Section (Featured/Trending) */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <HeroSection
          songs={trending?.data?.data?.slice(0, 5) || []}
          index={heroIndex}
          setIndex={setHeroIndex}
          isLoading={isTrendingLoading}
        />
      </motion.div>

      <div className="h-px bg-linear-to-r from-white/10 via-white/5 to-transparent" />

      {/* 2. Top Artists Section */}
      <section className="space-y-6">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 rounded-xl border border-primary/20">
              <Users2 className="text-primary" size={18} />
            </div>
            <h2 className="text-2xl font-black italic tracking-tight uppercase text-white">
              Top Artists
            </h2>
          </div>
          <div className="h-px flex-1 mx-8 bg-linear-to-r from-white/6 to-transparent" />
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="flex flex-row overflow-x-auto gap-12 pb-6 no-scrollbar mask-fade-right px-1 py-2"
        >
          {isArtistsLoading
            ? [1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="flex-none w-[160px] space-y-4">
                  <div className="aspect-square rounded-full bg-zinc-900/60 animate-pulse border border-white/5" />
                  <div className="h-3 w-3/4 bg-zinc-900/60 rounded mx-auto animate-pulse" />
                </div>
              ))
            : artists?.data?.data?.map((artist: Artist) => (
                <ArtistCard key={artist.id} artist={artist} />
              ))}
        </motion.div>
      </section>

      <div className="h-px bg-linear-to-r from-white/10 via-white/5 to-transparent" />

      {/* 3. Featured Playlists Section */}
      <section className="space-y-6">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 rounded-xl border border-primary/20">
              <ListMusic className="text-primary" size={18} />
            </div>
            <h2 className="text-2xl font-black italic tracking-tight uppercase text-white">
              Featured Playlists
            </h2>
          </div>
          <div className="h-px flex-1 mx-8 bg-linear-to-r from-white/6 to-transparent" />
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="flex flex-row overflow-x-auto gap-8 pb-6 no-scrollbar mask-fade-right px-1 py-2"
        >
          {isPlaylistsLoading
            ? [1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="flex-none w-[180px] space-y-4">
                  <div className="aspect-square rounded-[2.5rem] bg-zinc-900/60 animate-pulse border border-white/5" />
                  <div className="h-3 w-1/2 bg-zinc-900/60 rounded animate-pulse" />
                </div>
              ))
            : playlists?.data?.data?.map((playlist: Playlist) => (
                <PlaylistCard key={playlist.id} playlist={playlist} />
              ))}
        </motion.div>
      </section>

      {/* 4. Recommendations (Conditional) */}
      {systemUser &&
        recommendations?.data?.data &&
        recommendations.data.data.length > 0 && (
          <>
            <div className="h-px bg-linear-to-r from-white/10 via-white/5 to-transparent" />
            <section className="space-y-6">
              <div className="flex items-center gap-4 px-1">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-primary/10 rounded-xl border border-primary/20">
                    <Zap className="text-primary fill-primary" size={18} />
                  </div>
                  <h2 className="text-2xl font-black italic tracking-tight uppercase text-white">
                    Recommendations
                  </h2>
                </div>
                <div className="h-px flex-1 bg-linear-to-r from-white/6 to-transparent" />
              </div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.35 }}
                className="flex flex-row overflow-x-auto gap-6 pb-6 no-scrollbar mask-fade-right px-1 py-2"
              >
                {recommendations.data.data.slice(0, 10).map((song: Song) => (
                  <SongCard
                    key={`rec-${song.id}`}
                    song={song}
                    className="flex-none w-[220px]"
                  />
                ))}
              </motion.div>
            </section>
          </>
        )}

      <div className="h-px bg-linear-to-r from-white/10 via-white/5 to-transparent" />

      {/* 5. Discovery Feed */}
      <section className="space-y-6">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-zinc-800/60 rounded-xl border border-white/4">
                <Clock className="text-zinc-400" size={18} />
              </div>
              <h2 className="text-2xl font-black italic tracking-tight uppercase text-white">
                All Tracks
              </h2>
            </div>
            <div className="h-px w-16 bg-linear-to-r from-white/6 to-transparent" />
          </div>
        </div>

        {status === "pending" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
              <div
                key={i}
                className="aspect-square bg-zinc-900/30 border border-white/3 rounded-[1.8rem] animate-pulse shimmer-loader"
              />
            ))}
          </div>
        ) : status === "error" ? (
          <div className="p-20 text-center text-zinc-600 border border-dashed border-zinc-800 rounded-4xl font-bold italic tracking-tight uppercase">
            Failed to load tracks
          </div>
        ) : (
          <motion.div
            initial="hidden"
            animate="show"
            variants={{
              hidden: { opacity: 0 },
              show: {
                opacity: 1,
                transition: { staggerChildren: 0.05 },
              },
            }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6"
          >
            {data?.pages.map((page, i) =>
              page.data.data.map((song: Song, songIdx: number) => (
                <SongCard
                  key={`${song.id}-${i}-${songIdx}`}
                  song={song}
                  priority={i === 0 && songIdx < 6}
                />
              )),
            )}
          </motion.div>
        )}

        {/* Loader/Trigger */}
        <div
          ref={triggerRef}
          id="infinite-scroll-trigger"
          className="h-32 flex items-center justify-center mt-12"
        >
          {isFetchingNextPage && (
            <div className="relative w-10 h-10 flex items-center justify-center">
              <div className="absolute inset-0 border-[3px] border-primary/10 rounded-full" />
              <div className="absolute inset-0 border-[3px] border-t-primary rounded-full animate-spin" />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
