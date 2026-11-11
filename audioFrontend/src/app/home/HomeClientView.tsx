"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAppSelector } from "@/store/hooks";
import {
  ServerErrorPage,
  SomethingWentWrongPage,
} from "../../components/ErrorPages";
import {
  clearSessionStorage,
  formatPaginated,
  musicApi,
  type Song,
  subscribeHomeStream,
} from "../../lib/api";
import { mapListToPlayerSongs } from "../../lib/player-utils";
import { playerActions } from "../../store/player.store";
import {
  HomeHeader,
  HomeSkeleton,
  RecentlyPlayedSection,
  RecommendationsSection,
  TopArtistsSection,
  TrendingSection,
} from "./components";

export function HomeClientView() {
  const queryClient = useQueryClient();
  const systemUser = useAppSelector((s) => s.auth.systemUser);
  const favourites = useAppSelector((s) => s.auth.favourites || []);
  const dominantColor = useAppSelector((s) => s.player.dominantColor);
  const [streamActive, setStreamActive] = useState(true);
  const [useFallback, setUseFallback] = useState(false);

  // 0. Primary: Single SSE Stream to progressively stream all homepage sections in 1 connection
  useEffect(() => {
    const timer: NodeJS.Timeout | null = setTimeout(() => {
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

  // Section anchor & scroll refs
  const trendingSectionRef = useRef<HTMLElement>(null);
  const artistsSectionRef = useRef<HTMLElement>(null);
  const trendingScrollRef = useRef<HTMLDivElement>(null);
  const artistsScrollRef = useRef<HTMLDivElement>(null);
  const recentlyPlayedScrollRef = useRef<HTMLDivElement>(null);
  const recommendationsScrollRef = useRef<HTMLDivElement>(null);

  const scrollContainer = (
    ref: React.RefObject<HTMLDivElement | null>,
    distance: number,
  ) => {
    if (ref.current) {
      ref.current.scrollBy({ left: distance, behavior: "smooth" });
    }
  };

  // 1. Featured Songs (Fallback pool)
  const { data: featuredSongs, isLoading: isFeaturedLoading } = useQuery({
    queryKey: ["featured-songs"],
    queryFn: () => musicApi.songs.getFeatured(),
    enabled: useFallback,
    staleTime: 5 * 60 * 1000,
  });

  // 2. Trending Songs (Fallback pool)
  const { data: trending, isLoading: isTrendingLoading } = useQuery({
    queryKey: ["trending-songs"],
    queryFn: () => musicApi.interactions.getTrending(15),
    enabled: useFallback,
    staleTime: 5 * 60 * 1000,
  });

  // 3. Top Artists
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

  // 4. Personalized Recommendations (Recombee algorithmic tracks)
  const { data: recommendations } = useQuery({
    queryKey: ["recommendations", systemUser?.id],
    queryFn: () => musicApi.interactions.getRecommendations(10),
    enabled: useFallback && !!systemUser?.id,
    staleTime: 5 * 60 * 1000,
  });

  // Automatically enqueue recommendations when loaded
  useEffect(() => {
    const songs = recommendations?.data?.data || recommendations?.data;
    if (Array.isArray(songs) && songs.length > 0) {
      playerActions.enqueue(mapListToPlayerSongs(songs));
    }
  }, [recommendations]);

  // 5. Recently Played (User History from localStorage + API)
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
    window.addEventListener(
      "audiomelody:recently_played_updated",
      handleRecentUpdate,
    );
    return () => {
      window.removeEventListener(
        "audiomelody:recently_played_updated",
        handleRecentUpdate,
      );
    };
  }, []);

  const { data: serverRecentlyPlayed } = useQuery({
    queryKey: ["recently-played", systemUser?.id],
    queryFn: async () => {
      const res = await musicApi.users.getRecentlyPlayed();
      const songs = res?.data?.data || [];
      if (
        Array.isArray(songs) &&
        songs.length > 0 &&
        typeof window !== "undefined"
      ) {
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

  // Quick Picks: Deduplicated high-priority songs (Recent -> Recs -> Trending -> Featured)
  const quickPicks = useMemo(() => {
    const recentList: Song[] = effectiveRecentlyPlayed;
    const recsList: Song[] = (recommendations?.data?.data ||
      recommendations?.data ||
      []) as Song[];
    const trendingList: Song[] = trending?.data?.data || [];
    const featuredList: Song[] = featuredSongs || [];

    const seen = new Set<string>();
    const result: Song[] = [];

    // If user is logged in, slot 0 is the special Liked Songs tile, so fill up to 5 tracks.
    const targetCount = systemUser ? 5 : 6;

    const addSongs = (list: Song[]) => {
      for (const song of list) {
        if (song?.id && !seen.has(String(song.id))) {
          seen.add(String(song.id));
          result.push(song);
          if (result.length >= targetCount) return;
        }
      }
    };

    addSongs(recentList);
    if (result.length < targetCount) addSongs(recsList);
    if (result.length < targetCount) addSongs(trendingList);
    if (result.length < targetCount) addSongs(featuredList);

    return result;
  }, [
    effectiveRecentlyPlayed,
    recommendations,
    trending?.data?.data,
    featuredSongs,
    systemUser,
  ]);

  const effectiveIsArtistsLoading =
    isArtistsLoading || (streamActive && !artists?.data?.data);

  const isQuickPicksLoading =
    (isFeaturedLoading ||
      (streamActive && !featuredSongs) ||
      isTrendingLoading ||
      (streamActive && !trending)) &&
    quickPicks.length === 0;

  // Jump Back In pool: user history or graceful fallback
  const hasRecentHistory = Boolean(
    effectiveRecentlyPlayed && effectiveRecentlyPlayed.length > 0,
  );
  const jumpBackInSongs = useMemo(() => {
    if (hasRecentHistory) {
      return effectiveRecentlyPlayed.slice(0, 10);
    }
    const fallback =
      featuredSongs && featuredSongs.length > 0
        ? featuredSongs
        : trending?.data?.data || [];
    return fallback.slice(0, 10);
  }, [
    hasRecentHistory,
    effectiveRecentlyPlayed,
    featuredSongs,
    trending?.data?.data,
  ]);

  const jumpBackInTitle = hasRecentHistory
    ? "Jump back in"
    : "Featured for you";
  const jumpBackInSubtitle = hasRecentHistory
    ? "Your recent listening"
    : "Handpicked tracks to start your journey";

  // Made For You: personalized algorithmic tracks or distinct fallback
  const recsRaw = recommendations?.data?.data || recommendations?.data || [];
  const recsList: Song[] = Array.isArray(recsRaw) ? recsRaw : [];
  const hasRecommendations = recsList.length > 0;

  const madeForYouSongs = useMemo(() => {
    if (hasRecommendations) {
      return recsList.slice(0, 10);
    }
    // If user has recent listening history, featured songs are available for Made For You
    if (hasRecentHistory && featuredSongs && featuredSongs.length > 0) {
      return featuredSongs.slice(0, 10);
    }
    // Otherwise take first 6 of trending if trending has enough items
    const trendList = trending?.data?.data || [];
    if (trendList.length > 6) {
      return trendList.slice(0, 6);
    }
    return [];
  }, [
    hasRecommendations,
    recsList,
    hasRecentHistory,
    featuredSongs,
    trending?.data?.data,
  ]);

  // Trending Now Shelf: deduplicated from fallback shelves
  const trendingShelfSongs = useMemo(() => {
    const trendList: Song[] = trending?.data?.data || [];
    if (hasRecommendations || hasRecentHistory) {
      return trendList.slice(0, 12);
    }
    return trendList.length > 6 ? trendList.slice(6, 16) : trendList;
  }, [hasRecommendations, hasRecentHistory, trending?.data?.data]);

  const artistList = artists?.data?.data || [];

  const hasAnyData = Boolean(
    (featuredSongs && featuredSongs.length > 0) ||
      (trending?.data?.data && trending.data.data.length > 0) ||
      artistList.length > 0 ||
      quickPicks.length > 0,
  );

  // Initial loading state when critical data is pending
  const isInitialPageLoading =
    !hasAnyData && (effectiveIsArtistsLoading || streamActive);

  // Detect if critical queries failed
  const hasCriticalError =
    !isInitialPageLoading && !hasAnyData && !!artistsError;

  if (hasCriticalError) {
    const anyError = artistsError as any;
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

  return (
    <div className="relative px-4 sm:px-6 md:px-8 xl:px-10 pb-20 bg-black pt-2 sm:pt-3 space-y-7 sm:space-y-8 select-none overflow-hidden min-h-full">
      {/* Dynamic Ambient Color Glow bleeding smoothly behind top section */}
      <div
        className="pointer-events-none absolute -top-28 left-1/2 -translate-x-1/2 w-full max-w-6xl h-105 transition-all duration-1000 ease-out opacity-20 blur-3xl z-0"
        style={{
          background: `radial-gradient(ellipse 80% 60% at 50% 15%, ${
            dominantColor || "#2563eb"
          } 0%, transparent 75%)`,
        }}
      />

      {/* 1. Header with Time-of-Day Greeting, User Welcome & 6-Pack Quick Access Grid */}
      <HomeHeader
        greeting={greeting}
        userName={userName}
        quickPicks={quickPicks}
        isQuickPicksLoading={isQuickPicksLoading}
        favouritesCount={systemUser ? favourites.length : undefined}
      />

      {/* 2. Jump Back In Shelf (User Listening History or Featured Fallback) */}
      {jumpBackInSongs.length > 0 && (
        <RecentlyPlayedSection
          scrollRef={recentlyPlayedScrollRef}
          onScroll={(dist) => scrollContainer(recentlyPlayedScrollRef, dist)}
          songs={jumpBackInSongs}
          title={jumpBackInTitle}
          subtitle={jumpBackInSubtitle}
        />
      )}

      {/* 3. Made for You Shelf (Algorithmic Recommendations) */}
      {madeForYouSongs.length > 0 && (
        <RecommendationsSection
          scrollRef={recommendationsScrollRef}
          onScroll={(dist) => scrollContainer(recommendationsScrollRef, dist)}
          songs={madeForYouSongs}
          title="Made for you"
          subtitle="Based on your listening taste"
        />
      )}

      {/* 4. Artists You Love Section (Top Artists Catalog) */}
      <TopArtistsSection
        sectionRef={artistsSectionRef}
        scrollRef={artistsScrollRef}
        onScroll={(dist) => scrollContainer(artistsScrollRef, dist)}
        isArtistsLoading={effectiveIsArtistsLoading}
        artists={artistList}
        title="Artists you love"
        subtitle="Based on your taste"
      />

      {/* 5. Trending Now Shelf */}
      {trendingShelfSongs.length > 0 && (
        <TrendingSection
          sectionRef={trendingSectionRef}
          scrollRef={trendingScrollRef}
          onScroll={(dist) => scrollContainer(trendingScrollRef, dist)}
          trendingSongs={trendingShelfSongs}
          title="Trending now"
          subtitle="Top tracks taking over the charts"
        />
      )}
    </div>
  );
}
