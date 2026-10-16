"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useStore } from "@tanstack/react-store";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ServerErrorPage,
  SomethingWentWrongPage,
} from "../../components/ErrorPages";
import { musicApi, type Song } from "../../lib/api";
import { mapListToPlayerSongs } from "../../lib/player-utils";
import { playerActions, playerStore } from "../../store/player.store";
import {
  HomeSkeleton,
  HomeHeader,
  TrendingSection,
  TopArtistsSection,
  RecentlyPlayedSection,
  FeaturedPlaylistsSection,
  RecommendationsSection,
  ExploreFeedSection,
} from "./components";

export default function HomePage() {
  const systemUser = useStore(playerStore, (s) => s.systemUser);
  const systemToken = useStore(playerStore, (s) => s.systemToken);
  const dominantColor = useStore(playerStore, (s) => s.dominantColor);
  const [activeFilter, setActiveFilter] = useState("All");
  const triggerRef = useRef<HTMLDivElement>(null);

  const userName = useMemo(() => {
    if (!systemUser?.name) return null;
    const first = systemUser.name.trim().split(" ")[0];
    if (!first) return null;
    return first.charAt(0).toUpperCase() + first.slice(1);
  }, [systemUser?.name]);

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
          if (result.length >= 6) return;
        }
      }
    };

    addSongs(recentList);
    if (result.length < 6) addSongs(trendingList);
    if (result.length < 6) addSongs(featuredList);
    if (result.length < 6) addSongs(feedList);

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
    return <HomeSkeleton />;
  }

  const trendingSongs: Song[] = trending?.data?.data || [];

  return (
    <div className="relative px-4 pb-20 bg-black pt-2 sm:pt-2.5 space-y-3 sm:space-y-3.5 select-none overflow-hidden min-h-full">
      {/* Dynamic Ambient Color Glow bleeding smoothly behind top section */}
      <div
        className="pointer-events-none absolute -top-28 left-1/2 -translate-x-1/2 w-full max-w-6xl h-105 transition-all duration-1000 ease-out opacity-20 blur-3xl z-0"
        style={{
          background: `radial-gradient(ellipse 80% 60% at 50% 15%, ${
            dominantColor || "#2563eb"
          } 0%, transparent 75%)`,
        }}
      />

      {/* 1. Header with Time-of-Day Greeting, User Welcome & Filter Pills */}
      <HomeHeader
        greeting={greeting}
        userName={userName}
        activeFilter={activeFilter}
        onFilterClick={handleFilterClick}
        quickPicks={quickPicks}
        isQuickPicksLoading={isQuickPicksLoading}
      />

      {/* 2. Trending Hits Section */}
      <TrendingSection
        sectionRef={trendingSectionRef}
        scrollRef={trendingScrollRef}
        onScroll={(dist) => scrollContainer(trendingScrollRef, dist)}
        trendingSongs={trendingSongs}
      />

      {/* 3. Top Artists Section */}
      <TopArtistsSection
        sectionRef={artistsSectionRef}
        scrollRef={artistsScrollRef}
        onScroll={(dist) => scrollContainer(artistsScrollRef, dist)}
        isArtistsLoading={isArtistsLoading}
        artists={artists?.data?.data}
      />

      {/* 4. Recently Played Section (Conditional) */}
      {systemUser && (
        <RecentlyPlayedSection
          scrollRef={recentlyPlayedScrollRef}
          onScroll={(dist) => scrollContainer(recentlyPlayedScrollRef, dist)}
          songs={recentlyPlayed?.data?.data}
        />
      )}

      {/* 5. Featured Playlists Section */}
      <FeaturedPlaylistsSection
        sectionRef={playlistsSectionRef}
        scrollRef={playlistsScrollRef}
        onScroll={(dist) => scrollContainer(playlistsScrollRef, dist)}
        isPlaylistsLoading={isPlaylistsLoading}
        playlists={playlists?.data?.data}
      />

      {/* 6. Recommendations (Conditional) */}
      {systemUser && (
        <RecommendationsSection
          scrollRef={recommendationsScrollRef}
          onScroll={(dist) => scrollContainer(recommendationsScrollRef, dist)}
          songs={recommendations?.data?.data}
        />
      )}

      {/* 7. Discovery Feed */}
      <ExploreFeedSection
        sectionRef={exploreSectionRef}
        triggerRef={triggerRef}
        status={status}
        pages={data?.pages}
        isFetchingNextPage={isFetchingNextPage}
      />
    </div>
  );
}
