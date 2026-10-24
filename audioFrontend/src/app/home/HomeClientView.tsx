"use client";

import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAppSelector } from "@/store/hooks";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ServerErrorPage,
  SomethingWentWrongPage,
} from "../../components/ErrorPages";
import {
  clearSessionStorage,
  formatPaginated,
  musicApi,
  subscribeHomeStream,
  type Song,
} from "../../lib/api";
import { mapListToPlayerSongs } from "../../lib/player-utils";
import { playerActions } from "../../store/player.store";
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

export function HomeClientView() {
  const queryClient = useQueryClient();
  const systemUser = useAppSelector((s) => s.auth.systemUser);
  const dominantColor = useAppSelector((s) => s.player.dominantColor);
  const [activeFilter, setActiveFilter] = useState("All");
  const [streamActive, setStreamActive] = useState(true);
  const [useFallback, setUseFallback] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);

  // 0. Primary: Single SSE Stream to progressively stream all homepage sections in 1 connection
  useEffect(() => {
    let timer: NodeJS.Timeout | null = setTimeout(() => {
      // If stream has not completed within 3.5s, trigger query fallback
      setUseFallback(true);
      setStreamActive(false);
    }, 3500);

    const unsubscribe = subscribeHomeStream({
      userId: systemUser?.id,
      onSection: (section, payload) => {
        if (section === "featured") {
          queryClient.setQueryData(["featured-songs"], payload);
        } else if (section === "trending") {
          queryClient.setQueryData(["trending-songs"], payload);
        } else if (section === "artists") {
          queryClient.setQueryData(["home-artists"], formatPaginated(payload));
        } else if (section === "playlists") {
          queryClient.setQueryData(["home-playlists"], formatPaginated(payload));
        } else if (section === "feed") {
          queryClient.setQueryData(["discover-songs"], {
            pages: [formatPaginated(payload)],
            pageParams: [1],
          });
        } else if (section === "recommendations" && systemUser?.id) {
          queryClient.setQueryData(["recommendations", systemUser.id], payload);
        }
      },
      onComplete: () => {
        if (timer) clearTimeout(timer);
        setStreamActive(false);
      },
      onError: () => {
        if (timer) clearTimeout(timer);
        setUseFallback(true);
        setStreamActive(false);
      },
    });

    return () => {
      if (timer) clearTimeout(timer);
      unsubscribe();
    };
  }, [systemUser?.id, queryClient]);

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

  // 1. Admin-Featured Songs (ONLY enabled if SSE stream fails)
  const { data: featuredSongs, isLoading: isFeaturedLoading } = useQuery({
    queryKey: ["featured-songs"],
    queryFn: () => musicApi.songs.getFeatured(),
    enabled: useFallback,
    staleTime: 5 * 60 * 1000,
  });

  // 2. Trending Songs (ONLY enabled if SSE stream fails)
  const { data: trending, isLoading: isTrendingLoading } = useQuery({
    queryKey: ["trending-songs"],
    queryFn: () => musicApi.interactions.getTrending(12),
    enabled: useFallback,
    staleTime: 5 * 60 * 1000,
  });

  // 3. Discover Feed (Infinite Scroll - enabled once feed page 1 is loaded or if fallback)
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, status } =
    useInfiniteQuery({
      queryKey: ["discover-songs"],
      queryFn: ({ pageParam }) =>
        musicApi.songs.getFeed(pageParam as number, 15),
      initialPageParam: 1,
      getNextPageParam: (lastPage: any) =>
        lastPage?.data?.pagination?.hasNext
          ? (lastPage.data.pagination.page || 1) + 1
          : undefined,
      enabled: useFallback || !streamActive,
      staleTime: 5 * 60 * 1000,
    });

  // 4. Top Artists (ONLY enabled if SSE stream fails)
  const {
    data: artists,
    isLoading: isArtistsLoading,
    error: artistsError,
  } = useQuery({
    queryKey: ["home-artists"],
    queryFn: () => musicApi.artists.list(1, 15),
    enabled: useFallback,
    staleTime: 5 * 60 * 1000,
  });

  // 5. Featured Playlists (ONLY enabled if SSE stream fails)
  const {
    data: playlists,
    isLoading: isPlaylistsLoading,
    error: playlistsError,
  } = useQuery({
    queryKey: ["home-playlists"],
    queryFn: () => musicApi.playlists.list(1, 15),
    enabled: useFallback,
    staleTime: 5 * 60 * 1000,
  });

  // 6. Recommendations (ONLY enabled if SSE stream fails)
  const { data: recommendations } = useQuery({
    queryKey: ["recommendations", systemUser?.id],
    queryFn: () => musicApi.interactions.getRecommendations(),
    enabled: useFallback && !!systemUser?.id,
    staleTime: 5 * 60 * 1000,
  });

  // Automatically add recommended songs to queue when loaded
  useEffect(() => {
    const songs = recommendations?.data?.data || recommendations?.data;
    if (Array.isArray(songs) && songs.length > 0) {
      playerActions.enqueue(mapListToPlayerSongs(songs));
    }
  }, [recommendations]);

  // 7. Recently Played: Read from localStorage first; if not present, load from separate API call
  const [localRecentlyPlayed, setLocalRecentlyPlayed] = useState<Song[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = localStorage.getItem("recently_played_songs");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
      const lastSong = localStorage.getItem("last_current_song");
      if (lastSong) {
        const parsed = JSON.parse(lastSong);
        if (parsed?.id) return [parsed];
      }
    } catch {}
    return [];
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleRecentUpdate = (e: any) => {
      if (e.detail && Array.isArray(e.detail)) {
        setLocalRecentlyPlayed(e.detail);
      }
    };
    window.addEventListener("audiomelody:recently_played_updated", handleRecentUpdate);
    return () => {
      window.removeEventListener("audiomelody:recently_played_updated", handleRecentUpdate);
    };
  }, []);

  const { data: serverRecentlyPlayed } = useQuery({
    queryKey: ["recently-played", systemUser?.id],
    queryFn: async () => {
      const res = await musicApi.users.getRecentlyPlayed();
      const songs = res?.data?.data || [];
      if (Array.isArray(songs) && songs.length > 0 && typeof window !== "undefined") {
        try {
          localStorage.setItem("recently_played_songs", JSON.stringify(songs));
          setLocalRecentlyPlayed(songs);
        } catch {}
      }
      return res;
    },
    enabled: !!systemUser?.id && localRecentlyPlayed.length === 0,
    staleTime: 5 * 60 * 1000,
  });

  const effectiveRecentlyPlayed = useMemo(() => {
    if (localRecentlyPlayed.length > 0) return localRecentlyPlayed;
    return serverRecentlyPlayed?.data?.data || [];
  }, [localRecentlyPlayed, serverRecentlyPlayed?.data?.data]);

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
    const recentList: Song[] = effectiveRecentlyPlayed;
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
    effectiveRecentlyPlayed,
    trending?.data?.data,
    featuredSongs,
    data?.pages,
  ]);

  const effectiveIsArtistsLoading =
    isArtistsLoading || (streamActive && !artists?.data?.data);
  const effectiveIsPlaylistsLoading =
    isPlaylistsLoading || (streamActive && !playlists?.data?.data);

  const isQuickPicksLoading =
    ((isFeaturedLoading || (streamActive && !featuredSongs)) ||
      (isTrendingLoading || (streamActive && !trending))) &&
    quickPicks.length === 0;

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

  const hasAnyData = Boolean(
    (featuredSongs && featuredSongs.length > 0) ||
      (trending?.data?.data && trending.data.data.length > 0) ||
      (artists?.data?.data && artists.data.data.length > 0) ||
      (playlists?.data?.data && playlists.data.data.length > 0) ||
      (data?.pages?.[0]?.data?.data && data.pages[0].data.data.length > 0)
  );

  // Initial loading state when critical data is pending
  const isInitialPageLoading =
    !hasAnyData && (effectiveIsArtistsLoading || streamActive);

  // Detect if all critical queries have failed (server unreachable / 500)
  const hasCriticalError =
    !isInitialPageLoading &&
    status === "error" &&
    !!artistsError &&
    !!playlistsError;

  if (hasCriticalError) {
    const anyError = (artistsError || playlistsError) as any;
    const isAuthError =
      anyError?.response?.status === 401 ||
      anyError?.response?.status === 403 ||
      anyError?.status === 401 ||
      anyError?.status === 403 ||
      anyError?.message?.toLowerCase()?.includes("authentication") ||
      anyError?.message?.toLowerCase()?.includes("unauthorized");

    if (isAuthError) {
      if (typeof window !== "undefined") {
        clearSessionStorage();
        window.location.replace("/signup?session_expired=1");
      }
      return <HomeSkeleton />;
    }

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
        isArtistsLoading={effectiveIsArtistsLoading}
        artists={artists?.data?.data}
      />

      {/* 4. Recently Played Section (Conditional) */}
      {systemUser && (
        <RecentlyPlayedSection
          scrollRef={recentlyPlayedScrollRef}
          onScroll={(dist) => scrollContainer(recentlyPlayedScrollRef, dist)}
          songs={effectiveRecentlyPlayed}
        />
      )}

      {/* 5. Featured Playlists Section */}
      <FeaturedPlaylistsSection
        sectionRef={playlistsSectionRef}
        scrollRef={playlistsScrollRef}
        onScroll={(dist) => scrollContainer(playlistsScrollRef, dist)}
        isPlaylistsLoading={effectiveIsPlaylistsLoading}
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
