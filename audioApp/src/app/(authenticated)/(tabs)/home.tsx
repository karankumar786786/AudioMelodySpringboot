import React, { useState, useMemo, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
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
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { AppDispatch, AppState, loadUserProfile } from "@/store";
import { playWithSimilarSongs } from "@/store/queueActions";
import { homeService, albumService, userService, videoService, canvasService } from "@/service";
import { audioPlayerService } from "@/service/audioPlayerService";
import {
  FeaturedSongsCarousel,
  JumpBackInCard,
  WatchVideoCard,
  ShortsPreviewCard,
  SongRowItem,
  AlbumCard,
  ArtistCircleCard,
  SectionHeader,
  HomeSkeleton,
} from "@/components";
import { homeStyles as styles } from "@/styles";
import { hapticFeedback } from "@/utils/haptics";
import { Song } from "@/types";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Space reserved for the tab bar + mini player
const TAB_BAR_HEIGHT = 64;
const MINI_PLAYER_HEIGHT = 74;
const EXTRA_BREATHING_ROOM = 32;

const CATEGORIES = ["All", "Featured", "Videos", "Albums"] as const;
type Category = (typeof CATEGORIES)[number];

export default function HomeScreen() {
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category>("All");

  const bottomSpace =
    TAB_BAR_HEIGHT + MINI_PLAYER_HEIGHT + EXTRA_BREATHING_ROOM + insets.bottom;

  const profile = useSelector((state: AppState) => state.user.profile);
  const currentSong = useSelector((state: AppState) => state.player.currentSong);
  const isPlaying = useSelector((state: AppState) => state.player.isPlaying);

  // 1. Featured Songs (Hero Carousel)
  const {
    data: featuredSongs = [],
    isLoading: isFeaturedLoading,
    refetch: refetchFeatured,
  } = useQuery({
    queryKey: ["featured-songs"],
    queryFn: () => homeService.getFeaturedSongs(),
    staleTime: 5 * 60 * 1000,
  });

  // 2. Trending Songs (Trending Now vertical list)
  const {
    data: trendingSongs = [],
    isLoading: isTrendingLoading,
    refetch: refetchTrending,
  } = useQuery({
    queryKey: ["trending-songs"],
    queryFn: () => homeService.getTrendingSongs(15),
    staleTime: 5 * 60 * 1000,
  });

  // 3. Recently Played Songs (Jump Back In)
  const {
    data: recentlyPlayed = [],
    isLoading: isRecentLoading,
    refetch: refetchRecent,
  } = useQuery({
    queryKey: ["home-recently-played"],
    queryFn: () =>
      userService.getRecentlyPlayed ? userService.getRecentlyPlayed() : Promise.resolve([]),
    staleTime: 2 * 60 * 1000,
  });

  // 4. Albums Catalog (Popular Albums)
  const {
    data: rawAlbums = [],
    isLoading: isAlbumsLoading,
    refetch: refetchAlbums,
  } = useQuery({
    queryKey: ["home-albums"],
    queryFn: () => albumService.getAllAlbums(),
    staleTime: 5 * 60 * 1000,
  });

  // 5. Artists Catalog (Artists)
  const {
    data: artistsData,
    isLoading: isArtistsLoading,
    refetch: refetchArtists,
  } = useQuery({
    queryKey: ["home-artists"],
    queryFn: () => homeService.getTopArtists(0, 15),
    staleTime: 5 * 60 * 1000,
  });

  // 5b. Music Videos (Watch section)
  const {
    data: videosData,
    refetch: refetchVideos,
  } = useQuery({
    queryKey: ["home-videos"],
    queryFn: () =>
      videoService.getVideos({
        page: 0,
        size: 15,
        sort: "popular",
      }),
    staleTime: 5 * 60 * 1000,
  });

  const canvasSeedRef = useRef(Date.now());

  // 5c. Canvas Shorts (Vertical video loops)
  const {
    data: canvasData,
    refetch: refetchCanvas,
  } = useQuery({
    queryKey: ["home-canvas-shorts"],
    queryFn: () =>
      canvasService.getFeed({
        page: 0,
        size: 10,
        sort: "random",
        seed: canvasSeedRef.current,
      }),
    staleTime: 5 * 60 * 1000,
  });

  // 6. Infinite Discover Feed (Discover More)
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

  // Jump Back In pool: User history or fallback to top featured/trending tracks
  const jumpBackInSongs = useMemo(() => {
    if (recentlyPlayed && recentlyPlayed.length > 0) {
      return recentlyPlayed.slice(0, 10);
    }
    const fallback = featuredSongs.length > 0 ? featuredSongs : trendingSongs;
    return fallback.slice(0, 8);
  }, [recentlyPlayed, featuredSongs, trendingSongs]);

  // Trending Now: top 4 tracks shown as vertical list
  const trendingNowList = useMemo(() => {
    return trendingSongs.slice(0, 4);
  }, [trendingSongs]);

  // Watch (Full Videos): queried from video API, with pool fallback strictly for tracks with video
  const videoSongs = useMemo(() => {
    if (videosData?.content && videosData.content.length > 0) {
      const valid = videosData.content.filter((s) => Boolean(s.fullVideoKey || s.videoKey));
      if (valid.length > 0) return valid;
    }

    const pool = [...allSongs, ...trendingSongs, ...featuredSongs];
    const seen = new Set<string>();
    const withVideo: Song[] = [];

    for (const song of pool) {
      if (!song || !song.id || seen.has(song.id)) continue;
      if (song.fullVideoKey || song.videoKey) {
        seen.add(song.id);
        withVideo.push(song);
      }
    }

    // Strictly return songs that actually have a video; never fall back to non-video songs
    return withVideo.slice(0, 10);
  }, [videosData?.content, featuredSongs, trendingSongs, allSongs]);

  // Canvas Shorts: strictly from genuine canvas feed (no fallbacks)
  const canvasSongs = useMemo(() => {
    return canvasData?.content || [];
  }, [canvasData?.content]);

  // Popular Albums: deduplicate and cap to 10
  const displayAlbums = useMemo(() => {
    const albumMap = new Map<string, any>();

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

    // Supplement from trending & featured songs
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

    return Array.from(albumMap.values()).slice(0, 10);
  }, [rawAlbums, trendingSongs, featuredSongs]);

  // Artists: top 10
  const topArtists = useMemo(() => {
    const list = artistsData?.content || [];
    return list.slice(0, 10);
  }, [artistsData?.content]);

  // Pull-to-refresh
  const onRefresh = async () => {
    hapticFeedback.light();
    setRefreshing(true);
    canvasSeedRef.current = Date.now();
    await Promise.allSettled([
      dispatch(loadUserProfile()).unwrap(),
      refetchFeatured(),
      refetchTrending(),
      refetchRecent(),
      refetchAlbums(),
      refetchArtists(),
      refetchVideos(),
      refetchCanvas(),
      refetchFeed(),
    ]);
    setRefreshing(false);
  };

  // Infinite scroll trigger for Discover More
  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const isCloseToBottom =
      layoutMeasurement.height + contentOffset.y >= contentSize.height - 300;
    if (isCloseToBottom && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  const playSong = (song: Song, context?: Song[]) => {
    hapticFeedback.medium();
    dispatch(playWithSimilarSongs(song, context || allSongs));
    router.push(`/song/${song.id}`);
  };

  const playVideoSong = (song: Song, context?: Song[]) => {
    hapticFeedback.medium();
    dispatch(playWithSimilarSongs(song, context || allSongs));
    router.push({
      pathname: "/song/[id]",
      params: { id: song.id, mode: "video" },
    });
  };

  const handleHeroPlayPress = (song: Song) => {
    if (currentSong?.id === song.id) {
      audioPlayerService.togglePlay();
    } else {
      playSong(song, featuredSongs);
    }
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

  const userName = profile?.userName || profile?.email?.split("@")[0] || "karan";

  const isInitialLoading =
    isFeaturedLoading &&
    isTrendingLoading &&
    isArtistsLoading &&
    isAlbumsLoading;

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
            <Text style={styles.greetingSubtitle}>WELCOME BACK</Text>
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
            {/* 1. Hero Featured Canvas Video Carousel */}
            {show("Featured") && featuredSongs.length > 0 ? (
              <FeaturedSongsCarousel
                songs={featuredSongs}
                onSongPress={(song) => playSong(song, featuredSongs)}
                onPlayPress={handleHeroPlayPress}
              />
            ) : null}

            {/* 2. Jump Back In Shelf */}
            {show("Featured") && jumpBackInSongs.length > 0 ? (
              <View style={styles.section}>
                <SectionHeader title="Jump back in" />
                <FlatList
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalList}
                  data={jumpBackInSongs}
                  keyExtractor={(item, index) =>
                    item?.id ? `${item.id}-${index}` : `jump-${index}`
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

            {/* 3. Trending Now (Vertical list of 4 tracks) */}
            {selectedCategory === "All" && trendingNowList.length > 0 ? (
              <View style={styles.section}>
                <SectionHeader
                  title="Trending now"
                  subtitle="Top tracks taking over the charts"
                />
                <View style={styles.verticalList}>
                  {trendingNowList.map((song: Song, index: number) => {
                    const active = currentSong?.id === song.id;
                    return (
                      <SongRowItem
                        key={`trend-${song.id}-${index}`}
                        song={song}
                        index={index}
                        isActive={active}
                        isPlaying={active && isPlaying}
                        onPress={() => playSong(song, trendingSongs)}
                      />
                    );
                  })}
                </View>
              </View>
            ) : null}

            {/* 3b. Canvas Shorts Shelf (Vertical looping visual cards) */}
            {selectedCategory === "All" && canvasSongs.length > 0 ? (
              <View style={styles.section}>
                <SectionHeader
                  title="Canvas Shorts"
                  subtitle="Looping visual vertical clips"
                />
                <FlatList
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalList}
                  data={canvasSongs}
                  keyExtractor={(item, index) =>
                    item?.id ? `canvas-short-${item.id}-${index}` : `short-${index}`
                  }
                  renderItem={({ item }) => (
                    <ShortsPreviewCard
                      song={item}
                      onPress={() => {
                        router.push({
                          pathname: "/(authenticated)/canvas" as any,
                          params: { songId: item.id },
                        });
                      }}
                    />
                  )}
                />
              </View>
            ) : null}

            {/* 4. Watch Shelf (Full Videos) */}
            {show("Videos") && videoSongs.length > 0 ? (
              <View style={styles.section}>
                <SectionHeader
                  title="Watch"
                  subtitle="Full videos"
                />
                <FlatList
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalList}
                  data={videoSongs}
                  keyExtractor={(item, index) =>
                    item?.id ? `video-${item.id}-${index}` : `video-${index}`
                  }
                  renderItem={({ item }) => (
                    <WatchVideoCard
                      song={item}
                      onPress={() => playVideoSong(item, videoSongs)}
                    />
                  )}
                />
              </View>
            ) : null}

            {/* 5. Popular Albums Shelf */}
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

            {/* 6. Artists Shelf */}
            {selectedCategory === "All" && topArtists.length > 0 ? (
              <View style={styles.section}>
                <SectionHeader title="Artists" />
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

            {/* 7. Discover More Infinite Stream (At the very end) */}
            {selectedCategory === "All" && allSongs.length > 0 ? (
              <View style={styles.section}>
                <SectionHeader
                  title="Discover more"
                  subtitle="Infinite stream based on your taste"
                />
                <View style={styles.exploreList}>
                  {allSongs.map((song: Song, index: number) => {
                    const active = currentSong?.id === song.id;
                    return (
                      <SongRowItem
                        key={`discover-${song.id}-${index}`}
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
