import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  useWindowDimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useDispatch, useSelector } from "react-redux";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { AppDispatch, AppState, loadUserProfile } from "@/store";
import { playWithSimilarSongs } from "@/store/queueActions";
import { homeService } from "@/service";
import { TrendingSongCard,ArtistCircleCard,PlaylistCard,SongRowItem,HomeSkeleton,QuickPickCard } from "@/components";
import { homeStyles as styles } from "@/styles";

// Space reserved for the tab bar + mini player so the end of the feed is reachable.
const TAB_BAR_HEIGHT = 64;
const MINI_PLAYER_HEIGHT = 72;
const EXTRA_BREATHING_ROOM = 32;

const SIDE = 18;
const GRID_GAP = 8;

const CATEGORIES = [
  "All",
  "Trending",
  "Artists",
  "Playlists",
  "Explore",
] as const;
type Category = (typeof CATEGORIES)[number];

function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

export default function HomeScreen() {
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category>("All");

  const bottomSpace =
    TAB_BAR_HEIGHT + MINI_PLAYER_HEIGHT + EXTRA_BREATHING_ROOM + insets.bottom;
  const tileWidth = (width - SIDE * 2 - GRID_GAP) / 2;

  const profile = useSelector((state: AppState) => state.user.profile);
  const currentSong = useSelector(
    (state: AppState) => state.player.currentSong,
  );
  const isPlaying = useSelector((state: AppState) => state.player.isPlaying);

  // Featured songs now feed the quick-pick grid (the video carousel is gone)
  const {
    data: featuredSongs = [],
    isLoading: isFeaturedLoading,
    refetch: refetchFeatured,
  } = useQuery({
    queryKey: ["featured-songs"],
    queryFn: () => homeService.getFeaturedSongs(),
    staleTime: 5 * 60 * 1000,
  });

  const {
    data: trendingSongs = [],
    isLoading: isTrendingLoading,
    refetch: refetchTrending,
  } = useQuery({
    queryKey: ["trending-songs"],
    queryFn: () => homeService.getTrendingSongs(12),
    staleTime: 5 * 60 * 1000,
  });

  const {
    data: artistsData,
    isLoading: isArtistsLoading,
    refetch: refetchArtists,
  } = useQuery({
    queryKey: ["home-artists"],
    queryFn: () => homeService.getTopArtists(0, 15),
    staleTime: 5 * 60 * 1000,
  });

  const {
    data: playlistsData,
    isLoading: isPlaylistsLoading,
    refetch: refetchPlaylists,
  } = useQuery({
    queryKey: ["home-playlists"],
    queryFn: () => homeService.getFeaturedPlaylists(0, 15),
    staleTime: 5 * 60 * 1000,
  });

  const {
    data: feedData,
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

  const allSongs = useMemo(() => {
    if (!feedData?.pages) return [];
    return feedData.pages.flatMap((page) => page.content || []);
  }, [feedData?.pages]);

  const quickPicks = useMemo(() => {
    const source = featuredSongs.length > 0 ? featuredSongs : trendingSongs;
    return source.slice(0, 6);
  }, [featuredSongs, trendingSongs]);

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

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const isCloseToBottom =
      layoutMeasurement.height + contentOffset.y >= contentSize.height - 250;
    if (isCloseToBottom && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  const playSong = (song: any) => {
    dispatch(playWithSimilarSongs(song));
    router.push(`/song/${song.id}`);
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

  const show = (...cats: Category[]) =>
    selectedCategory === "All" || cats.includes(selectedCategory);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: bottomSpace }}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
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
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.greeting} numberOfLines={1}>
            {greeting}
            {profile?.userName ? `, ${profile.userName}` : ""}
          </Text>
          <TouchableOpacity
            style={styles.avatar}
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

        {/* Filter pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pillsRow}
        >
          {CATEGORIES.map((cat) => {
            const isActive = selectedCategory === cat;
            return (
              <TouchableOpacity
                key={cat}
                style={[styles.pill, isActive && styles.pillActive]}
                onPress={() => setSelectedCategory(cat)}
                activeOpacity={0.75}
              >
                <Text
                  style={[styles.pillText, isActive && styles.pillTextActive]}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {isInitialLoading ? (
          <HomeSkeleton />
        ) : (
          <>
            {/* Quick picks: 2-column grid */}
            {selectedCategory === "All" && quickPicks.length > 0 ? (
              <View style={styles.grid}>
                {quickPicks.map((song: any, index: number) => {
                  const active = currentSong?.id === song.id;
                  if (index > 3) {
                    return;
                  }
                  return (
                    <QuickPickCard
                      key={song.id}
                      song={song}
                      width={tileWidth}
                      isActive={active}
                      isPlaying={active && isPlaying}
                      onPress={() => playSong(song)}
                    />
                  );
                })}
              </View>
            ) : null}

            {/* Trending */}
            {show("Trending") && trendingSongs.length > 0 ? (
              <View style={styles.section}>
                <SectionTitle title="Trending hits" />
                <FlatList
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalList}
                  data={trendingSongs}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => (
                    <TrendingSongCard
                      song={item}
                      onPress={() => playSong(item)}
                    />
                  )}
                />
              </View>
            ) : null}

            {/* Artists */}
            {show("Artists") && artistsList.length > 0 ? (
              <View style={styles.section}>
                <SectionTitle title="Top artists" />
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

            {/* Playlists */}
            {show("Playlists") && playlistsList.length > 0 ? (
              <View style={styles.section}>
                <SectionTitle title="Featured playlists" />
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

            {/* Explore feed */}
            {show("Explore") && allSongs.length > 0 ? (
              <View style={styles.section}>
                <SectionTitle title="Explore" />
                {allSongs.map((song: any, index: number) => {
                  const active = currentSong?.id === song.id;
                  return (
                    <SongRowItem
                      key={`${song.id}-${index}`}
                      song={song}
                      index={index}
                      isActive={active}
                      isPlaying={active && isPlaying}
                      onPress={() => playSong(song)}
                    />
                  );
                })}

                {isFetchingNextPage ? (
                  <View style={styles.footer}>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  </View>
                ) : null}

                {!hasNextPage ? (
                  <View style={styles.footer}>
                    <Text style={styles.endText}>You’ve reached the end</Text>
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
