"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useStore } from "@tanstack/react-store";
import { motion } from "framer-motion";
import { Clock } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArtistCard } from "../../components/ArtistCard";
import { HeroSection } from "../../components/HeroSection";
import { PlaylistCard } from "../../components/PlaylistCard";
import { SongCard } from "../../components/SongCard";
import { type Artist, musicApi, type Playlist, type Song } from "../../lib/api";
import { playerActions, playerStore } from "../../store/player.store";

export default function HomePage() {
  const systemUser = useStore(playerStore, (s) => s.systemUser);
  const systemToken = useStore(playerStore, (s) => s.systemToken);
  const [heroIndex, setHeroIndex] = useState(0);
  const triggerRef = useRef<HTMLDivElement>(null);

  // 1. Admin-Featured Songs for Hero
  const { data: featuredSongs, isLoading: isFeaturedLoading } = useQuery({
    queryKey: ["featured-songs"],
    queryFn: () => musicApi.songs.getFeatured(),
  });

  // 2. Trending (used as fallback when no featured songs set by admin)
  const { data: trending, isLoading: isTrendingLoading } = useQuery({
    queryKey: ["trending-songs"],
    queryFn: () => musicApi.interactions.getTrending(),
    enabled: !featuredSongs || featuredSongs.length === 0,
  });

  // 3. Discover Feed (Infinite Scroll)
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

  // 4. Hero Songs: Featured -> Trending -> Feed (Dynamic, no hardcoded fallbacks)
  const heroSongs = useMemo(() => {
    if (featuredSongs && featuredSongs.length > 0) {
      return featuredSongs.slice(0, 5);
    }
    const trendingList = trending?.data?.data || [];
    if (trendingList.length > 0) {
      return trendingList.slice(0, 5);
    }
    const feedList = data?.pages[0]?.data?.data || [];
    if (feedList.length > 0) {
      return feedList.slice(0, 5);
    }
    return [];
  }, [featuredSongs, trending?.data?.data, data?.pages]);

  const isHeroLoading =
    (isFeaturedLoading || isTrendingLoading) && heroSongs.length === 0;

  // 5. Top Artists
  const { data: artists, isLoading: isArtistsLoading } = useQuery({
    queryKey: ["home-artists"],
    queryFn: () => musicApi.artists.list(1, 15),
  });

  // 6. Featured Playlists
  const { data: playlists, isLoading: isPlaylistsLoading } = useQuery({
    queryKey: ["home-playlists"],
    queryFn: () => musicApi.playlists.list(1, 15),
  });

  // 7. Recommendations (User specific)
  const { data: recommendations } = useQuery({
    queryKey: ["recommendations", systemUser?.id],
    queryFn: () => musicApi.interactions.getRecommendations(),
    enabled: !!systemUser?.id && !!systemToken,
  });

  // 8. Recently Played (User specific)
  const { data: recentlyPlayed } = useQuery({
    queryKey: ["recently-played", systemUser?.id],
    queryFn: () => musicApi.users.getRecentlyPlayed(),
    enabled: !!systemUser?.id && !!systemToken,
  });

  // Auto-switch hero slide every 12 seconds
  useEffect(() => {
    if (heroSongs.length <= 1) return;
    const interval = setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % heroSongs.length);
    }, 12000);
    return () => clearInterval(interval);
  }, [heroSongs.length]);

  // Infinite scroll observer for Discovery Feed
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

  // Premium initial page loading state when all essential content is pending
  const isInitialPageLoading =
    isHeroLoading && isArtistsLoading && isPlaylistsLoading && status === "pending";

  if (isInitialPageLoading) {
    return (
      <div className="px-10 pb-20 bg-black pt-20 space-y-16 animate-pulse select-none">
        {/* Hero Skeleton */}
        <div className="w-full h-[290px] md:h-[325px] rounded-2xl bg-zinc-900/60 border border-[#282828] flex flex-col justify-end p-8 md:p-10 space-y-3">
          <div className="h-4 w-28 bg-zinc-800/80 rounded-full" />
          <div className="h-10 w-2/5 bg-zinc-800/80 rounded-xl" />
          <div className="h-4 w-1/4 bg-zinc-800/80 rounded-md" />
          <div className="flex items-center gap-3 pt-1">
            <div className="h-3 w-12 bg-zinc-800/80 rounded" />
            <div className="h-3 w-16 bg-zinc-800/80 rounded" />
          </div>
        </div>

        {/* Artists Skeleton */}
        <div className="space-y-4 -mt-7">
          <div className="h-6 w-32 bg-zinc-800/80 rounded-lg" />
          <div className="flex gap-4 overflow-hidden">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="flex-none w-[160px] space-y-3">
                <div className="aspect-square rounded-full bg-zinc-900 border border-white/5" />
                <div className="h-3 w-3/4 bg-zinc-900 rounded mx-auto" />
              </div>
            ))}
          </div>
        </div>

        {/* Playlists Skeleton */}
        <div className="space-y-4">
          <div className="h-6 w-40 bg-zinc-800/80 rounded-lg" />
          <div className="flex gap-6 overflow-hidden">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="flex-none w-[180px] space-y-3">
                <div className="aspect-square rounded-xl bg-zinc-900 border border-white/5" />
                <div className="h-3 w-3/4 bg-zinc-900 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-10 pb-20 bg-black pt-20 space-y-16">
      {/* 1. Hero Section (Featured / Trending) */}
      {(isHeroLoading || heroSongs.length > 0) && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <HeroSection
            songs={heroSongs}
            index={heroIndex}
            setIndex={setHeroIndex}
            isLoading={isHeroLoading}
          />
        </motion.div>
      )}

      {/* 2. Top Artists Section */}
      <section className="space-y-1 -mt-7">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white tracking-tight">
            Top Artists
          </h2>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="flex flex-row overflow-x-auto gap-4 pb-4 no-scrollbar px-1"
        >
          {isArtistsLoading
            ? [1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="flex-none w-[160px] space-y-3">
                  <div className="aspect-square rounded-full bg-zinc-900 animate-pulse border border-white/5" />
                  <div className="h-3 w-3/4 bg-zinc-900 rounded mx-auto animate-pulse" />
                </div>
              ))
            : artists?.data?.data?.map((artist: Artist) => (
                <ArtistCard key={artist.id} artist={artist} />
              ))}
        </motion.div>
      </section>

      {/* 3. Recently Played Section (Conditional) */}
      {systemUser && (recentlyPlayed?.data?.data?.length ?? 0) > 0 && (
        <section className="space-y-4 -mt-12">
          <div className="flex items-center gap-2">
            <Clock size={20} className="text-primary" />
            <h2 className="text-xl font-bold text-white tracking-tight">
              Recently Played
            </h2>
          </div>

          <div className="relative">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
              className="flex flex-row overflow-x-auto gap-6 pb-4 no-scrollbar px-1 snap-x snap-mandatory"
            >
              {recentlyPlayed?.data?.data?.slice(0, 10).map((song: Song) => (
                <SongCard
                  key={`recent-${song.id}`}
                  song={song}
                  className="flex-none snap-start w-full sm:w-[calc(50%-12px)] lg:w-[calc(33.333%-16px)] xl:w-[calc(25%-18px)] 2xl:w-[calc(20%-19.2px)]"
                />
              ))}
            </motion.div>
            <div className="pointer-events-none absolute top-0 right-0 h-[calc(100%-1rem)] w-20 " />
          </div>
        </section>
      )}

      {/* 4. Featured Playlists Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white tracking-tight">
            Featured Playlists
          </h2>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="flex flex-row overflow-x-auto gap-6 pb-4 no-scrollbar px-1"
        >
          {isPlaylistsLoading
            ? [1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="flex-none w-[180px] space-y-3">
                  <div className="aspect-square rounded-xl bg-zinc-900 animate-pulse border border-white/5" />
                  <div className="h-3 w-1/2 bg-zinc-900 rounded animate-pulse" />
                </div>
              ))
            : playlists?.data?.data?.map((playlist: Playlist) => (
                <PlaylistCard key={playlist.id} playlist={playlist} />
              ))}
        </motion.div>
      </section>

      {/* 5. Recommendations (Conditional) */}
      {systemUser &&
        recommendations?.data?.data &&
        recommendations.data.data.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-white tracking-tight">
                Recommended for You
              </h2>
            </div>

            <div className="relative">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4 }}
                className="flex flex-row overflow-x-auto gap-6 pb-4 no-scrollbar px-1 snap-x snap-mandatory"
              >
                {recommendations.data.data.slice(0, 10).map((song: Song) => (
                  <SongCard
                    key={`rec-${song.id}`}
                    song={song}
                    className="flex-none snap-start w-full sm:w-[calc(50%-12px)] lg:w-[calc(33.333%-16px)] xl:w-[calc(25%-18px)] 2xl:w-[calc(20%-19.2px)]"
                  />
                ))}
              </motion.div>
              <div className="pointer-events-none absolute top-0 right-0 h-[calc(100%-1rem)] w-20" />
            </div>
          </section>
        )}

      {/* 6. Discovery Feed */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white tracking-tight">
            Explore All Tracks
          </h2>
        </div>

        {status === "pending" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
              <div
                key={i}
                className="aspect-square bg-zinc-900 rounded-xl animate-pulse border border-white/5"
              />
            ))}
          </div>
        ) : status === "error" ? (
          <div className="p-16 text-center text-zinc-500 border border-dashed border-[#282828] rounded-xl font-medium">
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

        {/* Loader / Infinite Scroll Trigger */}
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
