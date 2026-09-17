"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useStore } from "@tanstack/react-store";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Clock, Flame } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArtistCard } from "../../components/ArtistCard";
import {
  ServerErrorPage,
  SomethingWentWrongPage,
} from "../../components/ErrorPages";
import { PlaylistCard } from "../../components/PlaylistCard";
import { QuickPicksGrid } from "../../components/QuickPicksGrid";
import { SongCard } from "../../components/SongCard";
import { type Artist, musicApi, type Playlist, type Song } from "../../lib/api";
import { mapListToPlayerSongs } from "../../lib/player-utils";
import { playerActions, playerStore } from "../../store/player.store";

export default function HomePage() {
  const systemUser = useStore(playerStore, (s) => s.systemUser);
  const systemToken = useStore(playerStore, (s) => s.systemToken);
  const [activeFilter, setActiveFilter] = useState("All");
  const triggerRef = useRef<HTMLDivElement>(null);

  // Section anchor refs for filter pills
  const trendingSectionRef = useRef<HTMLElement>(null);
  const artistsSectionRef = useRef<HTMLElement>(null);
  const playlistsSectionRef = useRef<HTMLElement>(null);
  const exploreSectionRef = useRef<HTMLElement>(null);

  // Horizontal scroll container refs
  const trendingScrollRef = useRef<HTMLDivElement>(null);
  const artistsScrollRef = useRef<HTMLDivElement>(null);
  const recentlyPlayedScrollRef = useRef<HTMLDivElement>(null);
  const playlistsScrollRef = useRef<HTMLDivElement>(null);
  const recommendationsScrollRef = useRef<HTMLDivElement>(null);

  const scrollContainer = (
    ref: React.RefObject<HTMLDivElement | null>,
    distance: number,
  ) => {
    if (ref.current) {
      ref.current.scrollBy({ left: distance, behavior: "smooth" });
    }
  };

  // 1. Admin-Featured Songs
  const { data: featuredSongs, isLoading: isFeaturedLoading } = useQuery({
    queryKey: ["featured-songs"],
    queryFn: () => musicApi.songs.getFeatured(),
  });

  // 2. Trending Songs (Always active to populate quick picks and trending hits)
  const { data: trending, isLoading: isTrendingLoading } = useQuery({
    queryKey: ["trending-songs"],
    queryFn: () => musicApi.interactions.getTrending(12),
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

  // 4. Top Artists
  const {
    data: artists,
    isLoading: isArtistsLoading,
    error: artistsError,
  } = useQuery({
    queryKey: ["home-artists"],
    queryFn: () => musicApi.artists.list(1, 15),
  });

  // 5. Featured Playlists
  const {
    data: playlists,
    isLoading: isPlaylistsLoading,
    error: playlistsError,
  } = useQuery({
    queryKey: ["home-playlists"],
    queryFn: () => musicApi.playlists.list(1, 15),
  });

  // 6. Recommendations (User specific)
  const { data: recommendations } = useQuery({
    queryKey: ["recommendations", systemUser?.id],
    queryFn: () => musicApi.interactions.getRecommendations(),
    enabled: !!systemUser?.id && !!systemToken,
  });

  // Automatically add recommended songs to queue when loaded
  useEffect(() => {
    const songs = recommendations?.data?.data || recommendations?.data;
    if (Array.isArray(songs) && songs.length > 0) {
      playerActions.enqueue(mapListToPlayerSongs(songs));
    }
  }, [recommendations]);

  // 7. Recently Played (User specific)
  const { data: recentlyPlayed } = useQuery({
    queryKey: ["recently-played", systemUser?.id],
    queryFn: () => musicApi.users.getRecentlyPlayed(),
    enabled: !!systemUser?.id && !!systemToken,
  });

  // Dynamic Time-aware Greeting
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return "Good morning";
    if (hour >= 12 && hour < 17) return "Good afternoon";
    if (hour >= 17 && hour < 22) return "Good evening";
    return "Late night vibes";
  }, []);

  // Quick Picks: Deduplicated high-priority songs (Recent -> Trending -> Featured -> Feed)
  const quickPicks = useMemo(() => {
    const recentList: Song[] = recentlyPlayed?.data?.data || [];
    const trendingList: Song[] = trending?.data?.data || [];
    const featuredList: Song[] = featuredSongs || [];
    const feedList: Song[] = data?.pages[0]?.data?.data || [];

    const seen = new Set<string>();
    const result: Song[] = [];

    const addSongs = (list: Song[]) => {
      for (const song of list) {
        if (song?.id && !seen.has(String(song.id))) {
          seen.add(String(song.id));
          result.push(song);
          if (result.length >= 8) return;
        }
      }
    };

    addSongs(recentList);
    if (result.length < 8) addSongs(trendingList);
    if (result.length < 8) addSongs(featuredList);
    if (result.length < 8) addSongs(feedList);

    return result;
  }, [
    recentlyPlayed?.data?.data,
    trending?.data?.data,
    featuredSongs,
    data?.pages,
  ]);

  const isQuickPicksLoading =
    (isFeaturedLoading || isTrendingLoading) && quickPicks.length === 0;

  // Filter Pill smooth scroll handler
  const handleFilterClick = (filter: string) => {
    setActiveFilter(filter);
    if (filter === "All") {
      const mainContainer = document.querySelector("main");
      mainContainer?.scrollTo({ top: 0, behavior: "smooth" });
    } else if (filter === "Trending") {
      trendingSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    } else if (filter === "Artists") {
      artistsSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    } else if (filter === "Playlists") {
      playlistsSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    } else if (filter === "Explore") {
      exploreSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  };

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

  // Initial loading state when critical data is pending
  const isInitialPageLoading =
    isArtistsLoading && isPlaylistsLoading && status === "pending";

  // Detect if all critical queries have failed (server unreachable / 500)
  const hasCriticalError =
    !isInitialPageLoading &&
    status === "error" &&
    !!artistsError &&
    !!playlistsError;

  if (hasCriticalError) {
    const anyError = artistsError || playlistsError;
    const isServerError = anyError && (anyError as any)?.status >= 500;
    if (isServerError) {
      return <ServerErrorPage onRetry={() => window.location.reload()} />;
    }
    return (
      <SomethingWentWrongPage
        error={anyError as Error}
        reset={() => window.location.reload()}
      />
    );
  }

  if (isInitialPageLoading) {
    return (
      <div className="px-4 sm:px-6 md:px-8 xl:px-10 pb-20 bg-black pt-[var(--app-content-pt,1.5rem)] space-y-8 animate-pulse select-none">
        {/* Header & Filter Pills Skeleton */}
        <div className="space-y-3">
          <div className="h-8 w-48 bg-zinc-800/80 rounded-lg" />
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-7 w-20 bg-zinc-850 rounded-full border border-white/5"
              />
            ))}
          </div>
        </div>

        {/* Quick Picks Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-2.5 sm:gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-14 sm:h-16 rounded-lg bg-zinc-900/80 border border-white/5 flex items-center gap-3 overflow-hidden"
            >
              <div className="w-14 sm:w-16 h-full bg-zinc-800 shrink-0" />
              <div className="flex-1 space-y-1.5 pr-4">
                <div className="h-3 w-3/5 bg-zinc-800 rounded" />
                <div className="h-2.5 w-2/5 bg-zinc-850 rounded" />
              </div>
            </div>
          ))}
        </div>

        {/* Artists Skeleton */}
        <div className="space-y-3">
          <div className="h-6 w-32 bg-zinc-800/80 rounded-lg" />
          <div className="flex gap-4 overflow-hidden">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="flex-none w-[125px] sm:w-[130px] space-y-3"
              >
                <div className="aspect-square rounded-full bg-zinc-900 border border-white/5" />
                <div className="h-3 w-3/4 bg-zinc-900 rounded mx-auto" />
              </div>
            ))}
          </div>
        </div>

        {/* Playlists Skeleton */}
        <div className="space-y-3">
          <div className="h-6 w-40 bg-zinc-800/80 rounded-lg" />
          <div className="flex gap-4 overflow-hidden">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="flex-none w-[145px] sm:w-[155px] space-y-3"
              >
                <div className="aspect-square rounded-xl bg-zinc-900 border border-white/5" />
                <div className="h-3 w-3/4 bg-zinc-900 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const trendingSongs: Song[] = trending?.data?.data || [];

  return (
    <div className="px-4 sm:px-6 md:px-8 xl:px-10 pb-20 bg-black pt-[var(--app-content-pt,1.5rem)] space-y-8 select-none">
      {/* 1. Header with Time-of-Day Greeting, User Welcome & Filter Pills */}
      <section className="space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
              <span>{greeting}</span>
              {systemUser?.name && (
                <span className="text-zinc-200">
                  , {systemUser.name.split(" ")[0]}
                </span>
              )}
            </h1>
          </div>

          {/* Quick Filter / Navigation Pills */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
            {["All", "Trending", "Artists", "Playlists", "Explore"].map(
              (filter) => {
                const isActive = activeFilter === filter;
                return (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => handleFilterClick(filter)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-all duration-200 shrink-0 ${
                      isActive
                        ? "bg-white text-black shadow-sm scale-100"
                        : "bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-white/10"
                    }`}
                  >
                    {filter === "Trending" && "🔥 "}
                    {filter === "Artists" && "🎤 "}
                    {filter === "Playlists" && "💿 "}
                    {filter}
                  </button>
                );
              },
            )}
          </div>
        </div>

        {/* 2. Quick Picks 6-to-8 Card Grid (Spotify Style: Instant 1-Click Play) */}
        <QuickPicksGrid songs={quickPicks} isLoading={isQuickPicksLoading} />
      </section>

      {/* 2. Trending Hits Section (Always visible with rich track cards) */}
      {trendingSongs.length > 0 && (
        <section ref={trendingSectionRef} className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flame size={20} className="text-amber-500 fill-amber-500/20" />
              <h2 className="text-xl font-bold text-white tracking-tight">
                Trending Hits
              </h2>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => scrollContainer(trendingScrollRef, -380)}
                type="button"
                aria-label="Scroll left"
                className="w-7 h-7 rounded-full bg-zinc-900/90 hover:bg-zinc-800 border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-all active:scale-95 shadow-sm cursor-pointer"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => scrollContainer(trendingScrollRef, 380)}
                type="button"
                aria-label="Scroll right"
                className="w-7 h-7 rounded-full bg-zinc-900/90 hover:bg-zinc-800 border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-all active:scale-95 shadow-sm cursor-pointer"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          <div className="relative">
            <motion.div
              ref={trendingScrollRef}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="flex flex-row overflow-x-auto gap-3 pb-3 no-scrollbar px-1 snap-x snap-mandatory scroll-smooth"
            >
              {trendingSongs.map((song: Song) => (
                <SongCard
                  key={`trending-${song.id}`}
                  song={song}
                  className="flex-none snap-start w-[calc(50%-6px)] sm:w-[calc(33.333%-8px)] md:w-[calc(25%-9px)] lg:w-[calc(20%-10px)] xl:w-[calc(20%-10px)] 2xl:w-[calc(16.666%-10px)]"
                />
              ))}
            </motion.div>
            <div className="pointer-events-none absolute top-0 right-0 h-[calc(100%-1rem)] w-20 " />
          </div>
        </section>
      )}

      {/* 3. Top Artists Section */}
      <section ref={artistsSectionRef} className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white tracking-tight">
            Top Artists
          </h2>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => scrollContainer(artistsScrollRef, -380)}
              type="button"
              aria-label="Scroll left"
              className="w-7 h-7 rounded-full bg-zinc-900/90 hover:bg-zinc-800 border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-all active:scale-95 shadow-sm cursor-pointer"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => scrollContainer(artistsScrollRef, 380)}
              type="button"
              aria-label="Scroll right"
              className="w-7 h-7 rounded-full bg-zinc-900/90 hover:bg-zinc-800 border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-all active:scale-95 shadow-sm cursor-pointer"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        <motion.div
          ref={artistsScrollRef}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="flex flex-row overflow-x-auto gap-3 pb-3 no-scrollbar px-1 scroll-smooth"
        >
          {isArtistsLoading
            ? [1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="flex-none w-[125px] sm:w-[130px] space-y-3"
                >
                  <div className="aspect-square rounded-full bg-zinc-900 animate-pulse border border-white/5" />
                  <div className="h-3 w-3/4 bg-zinc-900 rounded mx-auto animate-pulse" />
                </div>
              ))
            : artists?.data?.data?.map((artist: Artist) => (
                <ArtistCard key={artist.id} artist={artist} />
              ))}
        </motion.div>
      </section>

      {/* 4. Recently Played Section (Conditional) */}
      {systemUser && (recentlyPlayed?.data?.data?.length ?? 0) > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock size={20} className="text-primary" />
              <h2 className="text-xl font-bold text-white tracking-tight">
                Recently Played
              </h2>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => scrollContainer(recentlyPlayedScrollRef, -380)}
                type="button"
                aria-label="Scroll left"
                className="w-7 h-7 rounded-full bg-zinc-900/90 hover:bg-zinc-800 border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-all active:scale-95 shadow-sm cursor-pointer"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => scrollContainer(recentlyPlayedScrollRef, 380)}
                type="button"
                aria-label="Scroll right"
                className="w-7 h-7 rounded-full bg-zinc-900/90 hover:bg-zinc-800 border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-all active:scale-95 shadow-sm cursor-pointer"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          <div className="relative">
            <motion.div
              ref={recentlyPlayedScrollRef}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="flex flex-row overflow-x-auto gap-3 pb-3 no-scrollbar px-1 snap-x snap-mandatory scroll-smooth"
            >
              {recentlyPlayed?.data?.data?.slice(0, 10).map((song: Song) => (
                <SongCard
                  key={`recent-${song.id}`}
                  song={song}
                  className="flex-none snap-start w-[calc(50%-6px)] sm:w-[calc(33.333%-8px)] md:w-[calc(25%-9px)] lg:w-[calc(20%-10px)] xl:w-[calc(20%-10px)] 2xl:w-[calc(16.666%-10px)]"
                />
              ))}
            </motion.div>
            <div className="pointer-events-none absolute top-0 right-0 h-[calc(100%-1rem)] w-20 " />
          </div>
        </section>
      )}

      {/* 5. Featured Playlists Section */}
      <section ref={playlistsSectionRef} className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white tracking-tight">
            Featured Playlists
          </h2>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => scrollContainer(playlistsScrollRef, -380)}
              type="button"
              aria-label="Scroll left"
              className="w-7 h-7 rounded-full bg-zinc-900/90 hover:bg-zinc-800 border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-all active:scale-95 shadow-sm cursor-pointer"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => scrollContainer(playlistsScrollRef, 380)}
              type="button"
              aria-label="Scroll right"
              className="w-7 h-7 rounded-full bg-zinc-900/90 hover:bg-zinc-800 border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-all active:scale-95 shadow-sm cursor-pointer"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        <motion.div
          ref={playlistsScrollRef}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="flex flex-row overflow-x-auto gap-3 md:gap-3.5 pb-3 no-scrollbar px-1 scroll-smooth"
        >
          {isPlaylistsLoading
            ? [1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="flex-none w-[150px] sm:w-[180px] space-y-3"
                >
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
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-white tracking-tight">
                  Recommended for You
                </h2>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() =>
                    scrollContainer(recommendationsScrollRef, -380)
                  }
                  type="button"
                  aria-label="Scroll left"
                  className="w-7 h-7 rounded-full bg-zinc-900/90 hover:bg-zinc-800 border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-all active:scale-95 shadow-sm cursor-pointer"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={() => scrollContainer(recommendationsScrollRef, 380)}
                  type="button"
                  aria-label="Scroll right"
                  className="w-7 h-7 rounded-full bg-zinc-900/90 hover:bg-zinc-800 border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-all active:scale-95 shadow-sm cursor-pointer"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            <div className="relative">
              <motion.div
                ref={recommendationsScrollRef}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="flex flex-row overflow-x-auto gap-3 md:gap-3.5 pb-3 no-scrollbar px-1 snap-x snap-mandatory scroll-smooth"
              >
                {recommendations.data.data.slice(0, 10).map((song: Song) => (
                  <SongCard
                    key={`rec-${song.id}`}
                    song={song}
                    className="flex-none snap-start w-[calc(50%-6px)] sm:w-[calc(33.333%-8px)] md:w-[calc(25%-9px)] lg:w-[calc(20%-10px)] xl:w-[calc(20%-10px)] 2xl:w-[calc(16.666%-10px)]"
                  />
                ))}
              </motion.div>
              <div className="pointer-events-none absolute top-0 right-0 h-[calc(100%-1rem)] w-20 " />
            </div>
          </section>
        )}

      {/* 7. Discovery Feed */}
      <section ref={exploreSectionRef} className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white tracking-tight">
            Explore All Tracks
          </h2>
        </div>

        {status === "pending" ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 sm:gap-3.5">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((i) => (
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
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 sm:gap-3.5"
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
