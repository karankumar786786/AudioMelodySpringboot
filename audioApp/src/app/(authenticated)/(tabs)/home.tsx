import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import {
  SafeAreaView,
} from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useDispatch, useSelector } from "react-redux";
import { useQuery } from "@tanstack/react-query";
import { AppDispatch, AppState, loadUserProfile } from "@/store";
import { playWithSimilarSongs } from "@/store/queueActions";
import { homeService, userService, audioPlayerService } from "@/service";
import {
  QuickPickCard,
  JumpBackInCard,
  ArtistCircleCard,
  SectionHeader,
  HomeSkeleton,
} from "@/components";
import { homeStyles as styles } from "@/styles";
import { hapticFeedback } from "@/utils/haptics";
import { configureAudioPriority } from "@/utils/audioConfig";
import { Song } from "@/types";
import { useBottomBarSpacing } from "@/hooks";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const GRID_GAP = 8;
const GRID_PADDING = 18 * 2;
const CARD_WIDTH = Math.floor((SCREEN_WIDTH - GRID_PADDING - GRID_GAP) / 2);

export default function HomeScreen() {
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const [refreshing, setRefreshing] = useState(false);

  // Exact tight spacing so content ends right above the miniplayer (or tab bar) without excess free space
  const { bottomSpace } = useBottomBarSpacing({ hasMarginBottom: 28, gap: 8 });

  const profile = useSelector((state: AppState) => state.user.profile);
  const currentSong = useSelector((state: AppState) => state.player.currentSong);
  const isPlaying = useSelector((state: AppState) => state.player.isPlaying);
  const favouriteIds = useSelector(
    (state: AppState) => state.favourites.favouriteIds || []
  );

  // 1. Recently Played Songs (User History)
  const {
    data: recentlyPlayed = [],
    isLoading: isRecentLoading,
    refetch: refetchRecent,
  } = useQuery({
    queryKey: ["home-recently-played"],
    queryFn: () => userService.getRecentlyPlayed(),
    staleTime: 2 * 60 * 1000,
  });

  // 2. Personalized Recommendations (Made For You via Recombee)
  const {
    data: recommendations = [],
    isLoading: isRecsLoading,
    refetch: refetchRecs,
  } = useQuery({
    queryKey: ["home-recommendations"],
    queryFn: () => homeService.getPersonalizedRecommendations(10),
    staleTime: 5 * 60 * 1000,
  });

  // 3. Trending Songs (Trending Now)
  const {
    data: trendingSongs = [],
    isLoading: isTrendingLoading,
    refetch: refetchTrending,
  } = useQuery({
    queryKey: ["home-trending"],
    queryFn: () => homeService.getTrendingSongs(10),
    staleTime: 5 * 60 * 1000,
  });

  // 4. Featured Songs (Lightweight fallback pool)
  const {
    data: featuredSongs = [],
    isLoading: isFeaturedLoading,
    refetch: refetchFeatured,
  } = useQuery({
    queryKey: ["home-featured"],
    queryFn: () => homeService.getFeaturedSongs(),
    staleTime: 5 * 60 * 1000,
  });

  // 5. Top Artists Catalog
  const {
    data: artistsData,
    isLoading: isArtistsLoading,
    refetch: refetchArtists,
  } = useQuery({
    queryKey: ["home-artists"],
    queryFn: () => homeService.getTopArtists(0, 10),
    staleTime: 5 * 60 * 1000,
  });

  // Pull-to-refresh
  const onRefresh = async () => {
    hapticFeedback.light();
    setRefreshing(true);
    await Promise.allSettled([
      dispatch(loadUserProfile()).unwrap(),
      refetchRecent(),
      refetchRecs(),
      refetchTrending(),
      refetchFeatured(),
      refetchArtists(),
    ]);
    setRefreshing(false);
  };

  const playSong = (song: Song, context?: Song[]) => {
    hapticFeedback.medium();
    configureAudioPriority().catch(() => {});
    if (currentSong?.id === song.id) {
      audioPlayerService.togglePlay();
      return;
    }
    const playbackContext = context && context.length > 0 ? context : [song];
    dispatch(playWithSimilarSongs(song, playbackContext));
    router.push(`/song/${song.id}`);
  };

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  }, []);

  const userName = profile?.userName || profile?.email?.split("@")[0] || "there";

  // Spotify-style 6-Pack Quick Access Grid (Liked Songs + Top 5 Recent/Personalized)
  const quickAccessItems = useMemo(() => {
    const items: Song[] = [];
    const seen = new Set<string>();

    // 1. Fill from recently played
    for (const song of recentlyPlayed) {
      if (!song || !song.id || seen.has(song.id)) continue;
      seen.add(song.id);
      items.push(song);
      if (items.length >= 5) break;
    }

    // 2. Supplement from personalized recommendations
    if (items.length < 5) {
      for (const song of recommendations) {
        if (!song || !song.id || seen.has(song.id)) continue;
        seen.add(song.id);
        items.push(song);
        if (items.length >= 5) break;
      }
    }

    // 3. Supplement from trending / featured pool if brand new user
    if (items.length < 5) {
      const fallback = trendingSongs.length > 0 ? trendingSongs : featuredSongs;
      for (const song of fallback) {
        if (!song || !song.id || seen.has(song.id)) continue;
        seen.add(song.id);
        items.push(song);
        if (items.length >= 5) break;
      }
    }

    return items;
  }, [recentlyPlayed, recommendations, trendingSongs, featuredSongs]);

  // Jump Back In pool: user history or graceful fallback
  const hasRecentHistory = Boolean(recentlyPlayed && recentlyPlayed.length > 0);
  const jumpBackInSongs = useMemo(() => {
    if (hasRecentHistory) {
      return recentlyPlayed.slice(0, 10);
    }
    const fallback = featuredSongs.length > 0 ? featuredSongs : trendingSongs;
    return fallback.slice(0, 8);
  }, [hasRecentHistory, recentlyPlayed, featuredSongs, trendingSongs]);

  const jumpBackInTitle = hasRecentHistory ? "Jump back in" : "Featured for you";
  const jumpBackInSubtitle = hasRecentHistory
    ? "Your recent listening"
    : "Handpicked tracks to start your journey";

  // Made For You: personalized algorithmic tracks or distinct fallback
  const hasRecommendations = Boolean(recommendations && recommendations.length > 0);
  const madeForYouSongs = useMemo(() => {
    if (hasRecommendations) {
      return recommendations.slice(0, 10);
    }
    if (hasRecentHistory && featuredSongs.length > 0) {
      return featuredSongs.slice(0, 10);
    }
    if (trendingSongs.length > 6) {
      return trendingSongs.slice(0, 6);
    }
    return [];
  }, [hasRecommendations, recommendations, hasRecentHistory, featuredSongs, trendingSongs]);

  // Trending Now Shelf: deduplicated from fallback shelves
  const trendingShelfSongs = useMemo(() => {
    if (hasRecommendations || hasRecentHistory) {
      return trendingSongs.slice(0, 12);
    }
    return trendingSongs.length > 6 ? trendingSongs.slice(6, 16) : trendingSongs;
  }, [hasRecommendations, hasRecentHistory, trendingSongs]);

  // Top Artists
  const topArtists = useMemo(() => {
    return artistsData?.content || [];
  }, [artistsData?.content]);

  const isInitialLoading =
    isRecentLoading && isTrendingLoading && isArtistsLoading && isFeaturedLoading;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: bottomSpace }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#FFFFFF"
            colors={["#FFFFFF"]}
            progressBackgroundColor="#1A1A1A"
          />
        }
      >
        {/* Dynamic Header */}
        <View style={styles.header}>
          <View style={styles.headerGreetingCol}>
            <Text style={styles.greeting} numberOfLines={1}>
              {greeting}, {userName}
            </Text>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.avatar}
              onPress={() => {
                hapticFeedback.light();
                router.push("/(authenticated)/(tabs)/profile");
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.avatarText}>
                {userName.charAt(0).toUpperCase()}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {isInitialLoading ? (
          <HomeSkeleton />
        ) : (
          <>
            {/* Spotify-style 6-Pack Quick Access Grid */}
            <View style={styles.quickAccessGrid}>
              {/* Tile 1: Liked Songs with Spotify purple gradient heart */}
              <QuickPickCard
                width={CARD_WIDTH}
                isLikedSongs={true}
                likedCount={favouriteIds.length}
                onPress={() => {
                  hapticFeedback.light();
                  router.push("/(authenticated)/favourites" as any);
                }}
              />

              {/* Tiles 2-6: Personalized Quick Picks */}
              {quickAccessItems.map((song, index) => {
                const active = currentSong?.id === song.id;
                return (
                  <QuickPickCard
                    key={`quick-${song.id}-${index}`}
                    song={song}
                    width={CARD_WIDTH}
                    isActive={active}
                    isPlaying={active && isPlaying}
                    onPress={() => playSong(song, quickAccessItems)}
                  />
                );
              })}
            </View>

            {/* 1. Jump Back In Shelf (User Listening History or Featured Fallback) */}
            {jumpBackInSongs.length > 0 ? (
              <View style={styles.section}>
                <SectionHeader
                  title={jumpBackInTitle}
                  subtitle={jumpBackInSubtitle}
                />
                <FlatList
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalList}
                  data={jumpBackInSongs}
                  keyExtractor={(item, index) =>
                    item?.id ? `jump-${item.id}-${index}` : `jump-${index}`
                  }
                  renderItem={({ item }) => {
                    const active = currentSong?.id === item.id;
                    return (
                      <JumpBackInCard
                        song={item}
                        isActive={active}
                        isPlaying={active && isPlaying}
                        onPress={() => playSong(item, jumpBackInSongs)}
                      />
                    );
                  }}
                />
              </View>
            ) : null}

            {/* 2. Made For You Shelf (Algorithmic Recommendations) */}
            {madeForYouSongs.length > 0 ? (
              <View style={styles.section}>
                <SectionHeader
                  title="Made for you"
                  subtitle="Based on your listening taste"
                />
                <FlatList
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalList}
                  data={madeForYouSongs}
                  keyExtractor={(item, index) =>
                    item?.id ? `rec-${item.id}-${index}` : `rec-${index}`
                  }
                  renderItem={({ item }) => {
                    const active = currentSong?.id === item.id;
                    return (
                      <JumpBackInCard
                        song={item}
                        isActive={active}
                        isPlaying={active && isPlaying}
                        onPress={() => playSong(item, madeForYouSongs)}
                      />
                    );
                  }}
                />
              </View>
            ) : null}

            {/* 3. Artists You Love (Top Artists) */}
            {topArtists.length > 0 ? (
              <View style={styles.section}>
                <SectionHeader
                  title="Artists you love"
                  subtitle="Based on your taste"
                />
                <FlatList
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalList}
                  data={topArtists}
                  keyExtractor={(item, index) =>
                    item?.id ? `artist-${item.id}-${index}` : `artist-${index}`
                  }
                  renderItem={({ item }) => (
                    <ArtistCircleCard
                      artist={item}
                      onPress={() => {
                        hapticFeedback.light();
                        router.push({
                          pathname: "/(authenticated)/artist/[id]",
                          params: { id: item.id, name: item.name },
                        });
                      }}
                    />
                  )}
                />
              </View>
            ) : null}

            {/* 4. Trending Now Shelf */}
            {trendingShelfSongs.length > 0 ? (
              <View style={styles.section}>
                <SectionHeader
                  title="Trending now"
                  subtitle="Top tracks taking over the charts"
                />
                <FlatList
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalList}
                  data={trendingShelfSongs}
                  keyExtractor={(item, index) =>
                    item?.id ? `trend-${item.id}-${index}` : `trend-${index}`
                  }
                  renderItem={({ item }) => {
                    const active = currentSong?.id === item.id;
                    return (
                      <JumpBackInCard
                        song={item}
                        isActive={active}
                        isPlaying={active && isPlaying}
                        onPress={() => playSong(item, trendingShelfSongs)}
                      />
                    );
                  }}
                />
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
