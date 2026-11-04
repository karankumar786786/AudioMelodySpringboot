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
  LayoutAnimation,
  Platform,
  UIManager,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useDispatch, useSelector } from "react-redux";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { AppDispatch, AppState, loadUserProfile } from "@/store";
import { playWithSimilarSongs } from "@/store/queueActions";
import { homeService, albumService } from "@/service";
import {
  TrendingSongCard,
  ArtistCircleCard,
  PlaylistCard,
  AlbumCard,
  SongRowItem,
  HomeSkeleton,
  QuickPickCard,
  SectionHeader,
} from "@/components";
import { homeStyles as styles } from "@/styles";
import { hapticFeedback } from "@/utils/haptics";
import { colors, spacing } from "@/theme";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Space reserved for the tab bar + mini player
const TAB_BAR_HEIGHT = 64;
const MINI_PLAYER_HEIGHT = 74;
const EXTRA_BREATHING_ROOM = 32;

const SIDE = spacing.side;
const GRID_GAP = 8;

const CATEGORIES = [
  "All",
  "Trending",
  "Albums",
  "Artists",
  "Playlists",
  "Explore",
] as const;
type Category = (typeof CATEGORIES)[number];

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

  // 1. Featured Songs (Quick Picks Grid)
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

  // 3. Albums Catalog
  const {
    data: rawAlbums = [],
    isLoading: isAlbumsLoading,
    refetch: refetchAlbums,
  } = useQuery({
    queryKey: ["home-albums"],
    queryFn: () => albumService.getAllAlbums(),
    staleTime: 5 * 60 * 1000,
  });

  // 4. Artists Catalog
  const {
    data: artistsData,
    isLoading: isArtistsLoading,
    refetch: refetchArtists,
  } = useQuery({
    queryKey: ["home-artists"],
    queryFn: () => homeService.getTopArtists(0, 15),
    staleTime: 5 * 60 * 1000,
  });

  // 5. Playlists Catalog
  const {
    data: playlistsData,
    isLoading: isPlaylistsLoading,
    refetch: refetchPlaylists,
  } = useQuery({
    queryKey: ["home-playlists"],
    queryFn: () => homeService.getFeaturedPlaylists(0, 15),
    staleTime: 5 * 60 * 1000,
  });

  // 6. Infinite Discover Feed
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

  // Dynamic quick picks (always 6 top tracks)
  const quickPicks = useMemo(() => {
    const source = featuredSongs.length > 0 ? featuredSongs : trendingSongs;
    return source.slice(0, 6);
  }, [featuredSongs, trendingSongs]);

  // Curated Albums: deduplicate by album name and strictly cap to TOP 10
  const displayAlbums = useMemo(() => {
    const albumMap = new Map<string, any>();

    // 1. Process backend albums if available
    if (Array.isArray(rawAlbums)) {
      for (const item of rawAlbums) {
        const name = item?.name?.trim();
        if (name && !albumMap.has(name.toLowerCase())) {
          albumMap.set(name.toLowerCase(), {
            name,
            artistName: item.artistName,
            imageKey: item.imageKey,
            genre: item.genre,
            trackCount: item.trackCount,
          });
        }
      }
    }

    // 2. Fallback / supplement: extract distinct albums from trending and featured songs
    const pool = [...trendingSongs, ...featuredSongs];
    for (const song of pool) {
      const alb = song.album?.trim();
      if (alb && !albumMap.has(alb.toLowerCase())) {
        albumMap.set(alb.toLowerCase(), {
          name: alb,
          artistName: song.artistName,
          imageKey: song.imageKey,
          genre: song.genre,
          trackCount: undefined,
        });
      }
    }

    // Strictly top 10 albums
    return Array.from(albumMap.values()).slice(0, 10);
  }, [rawAlbums, trendingSongs, featuredSongs]);

  // Strictly top 10 playlists
  const topPlaylists = useMemo(() => {
    const list = playlistsData?.content || [];
    return list.slice(0, 10);
  }, [playlistsData?.content]);

  // Strictly top 10 trending hits
  const topTrending = useMemo(() => {
    return trendingSongs.slice(0, 10);
  }, [trendingSongs]);

  // Strictly top 10 artists
  const topArtists = useMemo(() => {
    const list = artistsData?.content || [];
    return list.slice(0, 10);
  }, [artistsData?.content]);

  const onRefresh = async () => {
    hapticFeedback.light();
    setRefreshing(true);
    await Promise.allSettled([
      dispatch(loadUserProfile()).unwrap(),
      refetchFeatured(),
      refetchTrending(),
      refetchAlbums(),
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

  const playSong = (song: any, context?: any[]) => {
    hapticFeedback.medium();
    dispatch(playWithSimilarSongs(song, context || allSongs));
    router.push(`/song/${song.id}`);
  };

  const handleSelectCategory = (cat: Category) => {
    hapticFeedback.selection();
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSelectedCategory(cat);
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
        {/* Dynamic Header */}
        <View style={styles.header}>
          <View style={styles.headerGreetingCol}>
            <Text style={styles.greetingSubtitle}>Welcome back</Text>
            <Text style={styles.greeting} numberOfLines={1}>
              {greeting}
              {profile?.userName ? `, ${profile.userName}` : ""}
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
                {(profile?.userName || profile?.email || "U")
                  .charAt(0)
                  .toUpperCase()}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Filter Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pillsRow}
          style={styles.pillsScrollView}
        >
          {CATEGORIES.map((cat) => {
            const isActive = selectedCategory === cat;
            return (
              <TouchableOpacity
                key={cat}
                style={[styles.pill, isActive && styles.pillActive]}
                onPress={() => handleSelectCategory(cat)}
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
            {/* Quick picks 2x3 Grid */}
            {selectedCategory === "All" && quickPicks.length > 0 ? (
              <View style={styles.grid}>
                {quickPicks.map((song: any) => {
                  const active = currentSong?.id === song.id;
                  return (
                    <QuickPickCard
                      key={song.id}
                      song={song}
                      width={tileWidth}
                      isActive={active}
                      isPlaying={active && isPlaying}
                      onPress={() => playSong(song, quickPicks)}
                    />
                  );
                })}
              </View>
            ) : null}

            {/* Trending Shelf (Top 10) */}
            {show("Trending") && topTrending.length > 0 ? (
              <View style={styles.section}>
                <SectionHeader
                  title="Trending now"
                  subtitle="Top tracks taking over the charts"
                />
                <FlatList
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalList}
                  data={topTrending}
                  keyExtractor={(item, index) =>
                    item?.id ? `${item.id}-${index}` : `trend-${index}`
                  }
                  renderItem={({ item, index }) => (
                    <TrendingSongCard
                      song={item}
                      rank={index + 1}
                      onPress={() => playSong(item, topTrending)}
                    />
                  )}
                />
              </View>
            ) : null}

            {/* Popular Albums Shelf (Top 10) */}
            {show("Albums") && displayAlbums.length > 0 ? (
              <View style={styles.section}>
                <SectionHeader
                  title="Popular albums"
                  subtitle="Soundtracks & full artist collections"
                />
                <FlatList
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalList}
                  data={displayAlbums}
                  keyExtractor={(item, index) =>
                    item?.name ? `${item.name}-${index}` : `album-${index}`
                  }
                  renderItem={({ item }) => (
                    <AlbumCard
                      album={item}
                      onPress={() => {
                        hapticFeedback.light();
                        router.push(
                          `/album/${encodeURIComponent(item.name)}` as any
                        );
                      }}
                    />
                  )}
                />
              </View>
            ) : null}

            {/* Top Artists Shelf (Top 10) */}
            {show("Artists") && topArtists.length > 0 ? (
              <View style={styles.section}>
                <SectionHeader
                  title="Featured artists"
                  subtitle="Voices you might like"
                />
                <FlatList
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalList}
                  data={topArtists}
                  keyExtractor={(item, index) =>
                    item?.id ? `${item.id}-${index}` : `artist-${index}`
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

            {/* Featured Playlists Shelf (Top 10) */}
            {show("Playlists") && topPlaylists.length > 0 ? (
              <View style={styles.section}>
                <SectionHeader
                  title="Curated playlists"
                  subtitle="Handpicked mixes for your day"
                />
                <FlatList
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalList}
                  data={topPlaylists}
                  keyExtractor={(item, index) =>
                    item?.id ? `${item.id}-${index}` : `playlist-${index}`
                  }
                  renderItem={({ item }) => (
                    <PlaylistCard
                      playlist={item}
                      onPress={() => {
                        hapticFeedback.light();
                        router.push(`/playlist/${item.id}`);
                      }}
                    />
                  )}
                />
              </View>
            ) : null}

            {/* Explore Infinite Feed */}
            {show("Explore") && allSongs.length > 0 ? (
              <View style={styles.section}>
                <SectionHeader
                  title="Discover more"
                  subtitle="Infinite stream based on your taste"
                />
                <View style={styles.exploreList}>
                  {allSongs.map((song: any, index: number) => {
                    const active = currentSong?.id === song.id;
                    return (
                      <SongRowItem
                        key={`${song.id}-${index}`}
                        song={song}
                        index={index}
                        isActive={active}
                        isPlaying={active && isPlaying}
                        onPress={() => playSong(song, allSongs)}
                      />
                    );
                  })}
                </View>

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
