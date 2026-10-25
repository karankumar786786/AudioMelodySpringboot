import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useDispatch, useSelector } from "react-redux";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { AppDispatch, AppState, loadUserProfile } from "@/store";
import { playAllFrom } from "@/store/queueActions";
import { homeService } from "@/service";
import { SectionHeader } from "@/components/home/SectionHeader";
import { FeaturedSongsCarousel } from "@/components/home/FeaturedSongsCarousel";
import { TrendingSongCard } from "@/components/home/TrendingSongCard";
import { ArtistCircleCard } from "@/components/home/ArtistCircleCard";
import { PlaylistCard } from "@/components/home/PlaylistCard";
import { SongRowItem } from "@/components/home/SongRowItem";
import { HomeSkeleton } from "@/components/home/HomeSkeleton";

export default function HomeScreen() {
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const [refreshing, setRefreshing] = useState(false);

  // User profile from Redux store
  const profile = useSelector((state: AppState) => state.user.profile);

  // 1. Featured Songs
  const {
    data: featuredSongs = [],
    isLoading: isFeaturedLoading,
    refetch: refetchFeatured,
  } = useQuery({
    queryKey: ["featured-songs"],
    queryFn: () => homeService.getFeaturedSongs(),
    staleTime: 5 * 60 * 1000,
  });
  // 2. Trending Songs
  const {
    data: trendingSongs = [],
    isLoading: isTrendingLoading,
    refetch: refetchTrending,
  } = useQuery({
    queryKey: ["trending-songs"],
    queryFn: () => homeService.getTrendingSongs(12),
    staleTime: 5 * 60 * 1000,
  });

  // 3. Top Artists
  const {
    data: artistsData,
    isLoading: isArtistsLoading,
    refetch: refetchArtists,
  } = useQuery({
    queryKey: ["home-artists"],
    queryFn: () => homeService.getTopArtists(0, 15),
    staleTime: 5 * 60 * 1000,
  });

  // 4. Featured Playlists
  const {
    data: playlistsData,
    isLoading: isPlaylistsLoading,
    refetch: refetchPlaylists,
  } = useQuery({
    queryKey: ["home-playlists"],
    queryFn: () => homeService.getFeaturedPlaylists(0, 15),
    staleTime: 5 * 60 * 1000,
  });

  // 5. Discover Feed with Infinite Pagination (Explore All Songs)
  const {
    data: feedData,
    isLoading: isFeedLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch: refetchFeed,
  } = useInfiniteQuery({
    queryKey: ["discover-feed-infinite"],
    queryFn: ({ pageParam = 0 }) => homeService.getDiscoverFeed(pageParam, 15),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      if (!lastPage || !lastPage.content || lastPage.content.length === 0) {
        return undefined;
      }
      const totalCount = lastPage.paginationMetaData?.totalCount;
      const nextPage = lastPage.page + 1;
      if (totalCount !== undefined && nextPage * lastPage.size >= totalCount) {
        return undefined;
      }
      return nextPage;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Flatten paginated pages into a single continuous list of songs
  const allSongs = useMemo(() => {
    if (!feedData?.pages) return [];
    return feedData.pages.flatMap((page) => page.content || []);
  }, [feedData?.pages]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.allSettled([
      dispatch(loadUserProfile()).unwrap(),
      refetchFeatured(),
      refetchTrending(),
      refetchArtists(),
      refetchPlaylists(),
      refetchFeed(),
    ]);
    setRefreshing(false);
  };

  // Infinite scroll trigger when user scrolls near the bottom
  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const isCloseToBottom =
      layoutMeasurement.height + contentOffset.y >= contentSize.height - 250;

    if (isCloseToBottom && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  }, []);

  const artistsList = artistsData?.content || [];
  const playlistsList = playlistsData?.content || [];

  const isInitialLoading =
    isFeaturedLoading &&
    isTrendingLoading &&
    isArtistsLoading &&
    isPlaylistsLoading;

  const [selectedCategory, setSelectedCategory] = useState<
    "All" | "Music" | "Trending" | "Artists"
  >("All");

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#FFFFFF"
            colors={["#FFFFFF"]}
          />
        }
      >
        {/* Top Header Bar */}
        <View style={styles.header}>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.greetingTitle} numberOfLines={1}>
              {greeting}
              {profile?.userName ? `, ${profile.userName}` : ""}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.avatarButton}
            onPress={() => router.push("/(authenticated)/(tabs)/profile")}
            activeOpacity={0.8}
          >
            <Text style={styles.avatarText}>
              {(profile?.userName || profile?.email || "U")
                .charAt(0)
                .toUpperCase()}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Category Filter Pills */}
        <View style={styles.categoryPillsRow}>
          {(["All", "Music", "Trending", "Artists"] as const).map((cat) => {
            const isActive = selectedCategory === cat;
            return (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.categoryPill,
                  isActive && styles.categoryPillActive,
                ]}
                onPress={() => setSelectedCategory(cat)}
                activeOpacity={0.75}
              >
                <Text
                  style={[
                    styles.categoryPillText,
                    isActive && styles.categoryPillTextActive,
                  ]}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {isInitialLoading ? (
          <HomeSkeleton />
        ) : (
          <>
            {/* Spotlight / Slidable Featured Releases */}
            {(selectedCategory === "All" || selectedCategory === "Music") &&
            featuredSongs.length > 0 ? (
              <View style={styles.heroSection}>
                <FeaturedSongsCarousel
                  songs={featuredSongs}
                  onSongPress={(song) => {
                    const idx = featuredSongs.findIndex((s) => s.id === song.id);
                    dispatch(playAllFrom(featuredSongs, idx !== -1 ? idx : 0));
                    router.push(`/song/${song.id}`);
                  }}
                />
              </View>
            ) : null}

            {/* Trending Songs Section */}
            {(selectedCategory === "All" || selectedCategory === "Trending") &&
            trendingSongs.length > 0 ? (
              <View>
                <SectionHeader
                  title="Trending Now"
                  subtitle="Most streamed tracks this week"
                />
                <FlatList
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalList}
                  data={trendingSongs}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => (
                    <TrendingSongCard
                      song={item}
                      onPress={() => {
                        const idx = trendingSongs.findIndex((s) => s.id === item.id);
                        dispatch(playAllFrom(trendingSongs, idx !== -1 ? idx : 0));
                        router.push(`/song/${item.id}`);
                      }}
                    />
                  )}
                />
              </View>
            ) : null}

            {/* Top Artists Section */}
            {(selectedCategory === "All" || selectedCategory === "Artists") &&
            artistsList.length > 0 ? (
              <View>
                <SectionHeader
                  title="Popular Artists"
                  subtitle="Top creators you might love"
                />
                <FlatList
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalList}
                  data={artistsList}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => (
                    <ArtistCircleCard
                      artist={item}
                      onPress={() => router.push(`/artist/${item.id}`)}
                    />
                  )}
                />
              </View>
            ) : null}

            {/* Featured Playlists Section */}
            {(selectedCategory === "All" || selectedCategory === "Trending") &&
            playlistsList.length > 0 ? (
              <View>
                <SectionHeader
                  title="Featured Playlists"
                  subtitle="Handcrafted playlists for your mood"
                />
                <FlatList
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalList}
                  data={playlistsList}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => (
                    <PlaylistCard
                      playlist={item}
                      onPress={() => router.push(`/playlist/${item.id}`)}
                    />
                  )}
                />
              </View>
            ) : null}

            {/* Explore All Songs / Infinite Discover Feed */}
            {(selectedCategory === "All" || selectedCategory === "Music") &&
            allSongs.length > 0 ? (
              <View style={styles.feedSection}>
                <SectionHeader
                  title="Explore All Songs"
                  subtitle={`${allSongs.length} track${allSongs.length === 1 ? "" : "s"} loaded • scroll for more`}
                />

                {allSongs.map((song, index) => (
                  <SongRowItem
                    key={`${song.id}-${index}`}
                    song={song}
                    onPress={() => {
                      dispatch(playAllFrom(allSongs, index));
                      router.push(`/song/${song.id}`);
                    }}
                  />
                ))}

                {/* Loading indicator when fetching next page */}
                {isFetchingNextPage ? (
                  <View style={styles.paginationLoading}>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                    <Text style={styles.paginationLoadingText}>
                      Loading more songs...
                    </Text>
                  </View>
                ) : null}

                {/* Manual tap button to load more as fallback */}
                {hasNextPage && !isFetchingNextPage ? (
                  <TouchableOpacity
                    style={styles.loadMoreButton}
                    onPress={() => fetchNextPage()}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name="arrow-down"
                      size={16}
                      color="#FFFFFF"
                      style={{ marginRight: 6 }}
                    />
                    <Text style={styles.loadMoreText}>Load More Songs</Text>
                  </TouchableOpacity>
                ) : null}

                {/* End of feed indicator */}
                {!hasNextPage && allSongs.length > 0 ? (
                  <View style={styles.endContainer}>
                    <Text style={styles.endText}>
                      ✓ You've explored all songs
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#121212",
  },
  scrollContainer: {
    paddingBottom: 110,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 10,
  },
  headerTitleContainer: {
    flex: 1,
    marginRight: 12,
  },
  greetingTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: -0.3,
  },
  avatarButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#FFFFFF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.65,
    shadowRadius: 8,
    elevation: 4,
  },
  avatarText: {
    color: "#000000",
    fontSize: 16,
    fontWeight: "bold",
  },
  categoryPillsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingBottom: 14,
    gap: 8,
  },
  categoryPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#1E1E1E",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  categoryPillActive: {
    backgroundColor: "#FFFFFF",
    borderColor: "#FFFFFF",
    shadowColor: "#FFFFFF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 4,
  },
  categoryPillText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
  categoryPillTextActive: {
    color: "#000000",
    fontWeight: "800",
  },
  heroSection: {
    marginTop: 4,
  },
  horizontalList: {
    paddingHorizontal: 18,
  },
  feedSection: {
    marginBottom: 20,
  },
  paginationLoading: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 18,
    gap: 8,
  },
  paginationLoadingText: {
    color: "#888888",
    fontSize: 13,
  },
  loadMoreButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 18,
    marginTop: 14,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#1E1E1E",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.25)",
  },
  loadMoreText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  endContainer: {
    alignItems: "center",
    paddingVertical: 24,
  },
  endText: {
    color: "#666666",
    fontSize: 13,
    fontWeight: "500",
  },
});
