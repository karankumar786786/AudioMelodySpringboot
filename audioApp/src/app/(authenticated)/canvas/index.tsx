import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  FlatList,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Share,
  StatusBar,
  Platform,
  ActivityIndicator,
  Animated,
  Easing,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams, useIsFocused } from "expo-router";
import { useSelector, useDispatch } from "react-redux";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";

import { Song } from "@/types";
import { AppState, AppDispatch, toggleFavourite } from "@/store";
import { playWithSimilarSongs } from "@/store/queueActions";
import { canvasService, videoService, homeService } from "@/service";
import { CanvasVideoPlayer } from "@/components/common/CanvasVideoPlayer";
import { getImageUrl } from "@/utils/imageUtils";
import { hapticFeedback } from "@/utils/haptics";
import { colors, radius, shadows, spacing } from "@/theme";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

export default function CanvasShortsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch<AppDispatch>();
  const isScreenFocused = useIsFocused();
  const params = useLocalSearchParams<{ songId?: string }>();

  const currentSong = useSelector((state: AppState) => state.player.currentSong);
  const isPlayerPlaying = useSelector((state: AppState) => state.player.isPlaying);
  const favouriteIds = useSelector((state: AppState) => state.favourites.favouriteIds);

  const flatListRef = useRef<FlatList<Song>>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showPlayPauseIcon, setShowPlayPauseIcon] = useState(false);
  const [showHeartBurst, setShowHeartBurst] = useState(false);
  const lastTapRef = useRef<number>(0);

  // Animations
  const playPauseAnim = useRef(new Animated.Value(0)).current;
  const heartScaleAnim = useRef(new Animated.Value(0)).current;
  const heartOpacityAnim = useRef(new Animated.Value(0)).current;
  const discRotationAnim = useRef(new Animated.Value(0)).current;

  // Continuous spinning vinyl disc animation
  useEffect(() => {
    let loopAnimation: Animated.CompositeAnimation | null = null;
    if (isPlayerPlaying && !isPaused && isScreenFocused) {
      loopAnimation = Animated.loop(
        Animated.timing(discRotationAnim, {
          toValue: 1,
          duration: 6000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      loopAnimation.start();
    } else {
      discRotationAnim.stopAnimation();
    }
    return () => {
      if (loopAnimation) loopAnimation.stop();
    };
  }, [isPlayerPlaying, isPaused, isScreenFocused]);

  const discRotateInterpolate = discRotationAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  // 1. Fetch Infinite Canvas Feed
  const {
    data: feedData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: isFeedLoading,
  } = useInfiniteQuery({
    queryKey: ["canvas-feed-shorts"],
    queryFn: ({ pageParam = 0 }) =>
      canvasService.getFeed({
        page: pageParam,
        size: 10,
        sort: "latest",
      }),
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

  // 2. Fallback pool: Popular videos & featured tracks in case canvas feed is small
  const { data: popularVideos } = useQuery({
    queryKey: ["canvas-fallback-videos"],
    queryFn: () => videoService.getVideos({ page: 0, size: 20, sort: "popular" }),
    staleTime: 5 * 60 * 1000,
  });

  const { data: featuredSongs = [] } = useQuery({
    queryKey: ["featured-songs"],
    queryFn: () => homeService.getFeaturedSongs(),
    staleTime: 5 * 60 * 1000,
  });

  // Consolidate unique songs list
  const songs: Song[] = useMemo(() => {
    const rawFeed = feedData?.pages?.flatMap((p) => p.content || []) || [];
    const videoPool = popularVideos?.content || [];
    const pool = [...rawFeed, ...videoPool, ...featuredSongs];

    const seen = new Set<string>();
    const result: Song[] = [];

    for (const song of pool) {
      if (!song || !song.id || seen.has(song.id)) continue;
      // Include tracks that have canvas videoKey or fullVideoKey
      if (song.videoKey || song.fullVideoKey || result.length < 5) {
        seen.add(song.id);
        result.push(song);
      }
    }
    return result;
  }, [feedData?.pages, popularVideos?.content, featuredSongs]);

  // Initial song jump if songId param is passed
  useEffect(() => {
    if (params.songId && songs.length > 0) {
      const targetIdx = songs.findIndex((s) => s.id === params.songId);
      if (targetIdx >= 0 && targetIdx !== activeIndex) {
        setActiveIndex(targetIdx);
        setTimeout(() => {
          flatListRef.current?.scrollToIndex({
            index: targetIdx,
            animated: false,
          });
        }, 100);
      }
    }
  }, [params.songId, songs.length]);

  // Auto-play the track audio when the active slide changes
  const activeSong = songs[activeIndex];
  useEffect(() => {
    if (!isScreenFocused || !activeSong || isPaused) return;

    if (currentSong?.id !== activeSong.id) {
      dispatch(playWithSimilarSongs(activeSong, songs));
    }
  }, [activeIndex, activeSong?.id, isScreenFocused, isPaused]);

  // Viewable items changed handler
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<any> }) => {
      if (viewableItems && viewableItems.length > 0) {
        const first = viewableItems[0];
        if (typeof first.index === "number" && first.index >= 0) {
          setActiveIndex(first.index);
          setIsPaused(false);
        }
      }
    }
  ).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 80,
  }).current;

  // Single / Double Tap Gestures
  const handleScreenPress = useCallback(() => {
    const now = Date.now();
    const DOUBLE_PRESS_DELAY = 300;

    if (now - lastTapRef.current < DOUBLE_PRESS_DELAY) {
      // Double tap -> Like song
      if (activeSong) {
        hapticFeedback.medium();
        const isFav = favouriteIds.some((id) => String(id) === String(activeSong.id));
        if (!isFav) {
          dispatch(toggleFavourite(activeSong));
        }

        // Trigger Heart Burst animation
        setShowHeartBurst(true);
        heartScaleAnim.setValue(0);
        heartOpacityAnim.setValue(1);
        Animated.parallel([
          Animated.spring(heartScaleAnim, {
            toValue: 1.4,
            friction: 4,
            useNativeDriver: true,
          }),
          Animated.timing(heartOpacityAnim, {
            toValue: 0,
            duration: 800,
            delay: 400,
            useNativeDriver: true,
          }),
        ]).start(() => {
          setShowHeartBurst(false);
        });
      }
    } else {
      // Single tap -> Play / Pause toggle
      hapticFeedback.light();
      setIsPaused((prev) => {
        const next = !prev;
        setShowPlayPauseIcon(true);
        playPauseAnim.setValue(1);
        Animated.timing(playPauseAnim, {
          toValue: 0,
          duration: 700,
          delay: 300,
          useNativeDriver: true,
        }).start(() => {
          setShowPlayPauseIcon(false);
        });
        return next;
      });
    }

    lastTapRef.current = now;
  }, [activeSong, favouriteIds, dispatch]);

  const handleToggleLike = useCallback(
    (song: Song) => {
      hapticFeedback.medium();
      dispatch(toggleFavourite(song));
    },
    [dispatch]
  );

  const handleOpenFullPlayer = useCallback(
    (song: Song) => {
      hapticFeedback.medium();
      router.push(`/song/${song.id}`);
    },
    [router]
  );

  const handleShare = useCallback(async (song: Song) => {
    hapticFeedback.light();
    try {
      await Share.share({
        message: `Listen to "${song.title}" by ${song.artistName} on Melody!`,
        title: song.title,
      });
    } catch {}
  }, []);

  const handleDismiss = useCallback(() => {
    hapticFeedback.light();
    router.back();
  }, [router]);

  const renderShortItem = useCallback(
    ({ item, index }: { item: Song; index: number }) => {
      const isActive = index === activeIndex;
      const isLiked = favouriteIds.some((id) => String(id) === String(item.id));
      const videoKey = item.videoKey || item.fullVideoKey;
      const artistImageUrl = getImageUrl(item.imageKey, {
        width: 120,
        height: 120,
        aspectRatio: "1-1",
      });

      return (
        <View style={styles.pageContainer}>
          <TouchableWithoutFeedback onPress={handleScreenPress}>
            <View style={StyleSheet.absoluteFill}>
              {/* Full-screen Looping Canvas Video Backdrop */}
              <CanvasVideoPlayer
                videoKey={videoKey}
                fallbackImageKey={item.imageKey}
                isPlaying={isActive && isScreenFocused && !isPaused}
                showFallbackImage={true}
                showLoader={false}
                style={StyleSheet.absoluteFill}
              />

              {/* Top Gradient */}
              <LinearGradient
                colors={["rgba(0,0,0,0.65)", "transparent"]}
                style={styles.topGradient}
              />

              {/* Bottom Gradient for Text & Control Readability */}
              <LinearGradient
                colors={["transparent", "rgba(0,0,0,0.45)", "rgba(0,0,0,0.92)"]}
                locations={[0.4, 0.7, 1.0]}
                style={styles.bottomGradient}
              />
            </View>
          </TouchableWithoutFeedback>

          {/* Centered Play / Pause Fade Indicator */}
          {showPlayPauseIcon && isActive && (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.centerPlayIndicator,
                {
                  opacity: playPauseAnim,
                  transform: [
                    {
                      scale: playPauseAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.8, 1.2],
                      }),
                    },
                  ],
                },
              ]}
            >
              <Ionicons
                name={isPaused ? "pause" : "play"}
                size={54}
                color="#FFFFFF"
              />
            </Animated.View>
          )}

          {/* Centered Heart Burst Animation on Double Tap */}
          {showHeartBurst && isActive && (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.centerPlayIndicator,
                {
                  opacity: heartOpacityAnim,
                  transform: [{ scale: heartScaleAnim }],
                },
              ]}
            >
              <Ionicons name="heart" size={88} color="#FF2D55" />
            </Animated.View>
          )}

          {/* Right Floating Actions Column */}
          <View
            style={[
              styles.rightActionsColumn,
              { bottom: insets.bottom + 90 },
            ]}
          >
            {/* Artist Avatar */}
            <TouchableOpacity
              style={styles.actionItem}
              onPress={() => {
                hapticFeedback.light();
                router.push({
                  pathname: "/(authenticated)/artist/[id]",
                  params: { id: item.artistName, name: item.artistName },
                });
              }}
              activeOpacity={0.8}
            >
              <View style={styles.avatarBorder}>
                <Image
                  source={{ uri: artistImageUrl }}
                  style={styles.artistAvatar}
                  contentFit="cover"
                  transition={100}
                />
              </View>
              <View style={styles.plusBadge}>
                <Ionicons name="add" size={12} color="#FFFFFF" />
              </View>
            </TouchableOpacity>

            {/* Like / Heart Button */}
            <TouchableOpacity
              style={styles.actionItem}
              onPress={() => handleToggleLike(item)}
              activeOpacity={0.75}
            >
              <View style={styles.actionIconCircle}>
                <Ionicons
                  name={isLiked ? "heart" : "heart-outline"}
                  size={28}
                  color={isLiked ? "#FF2D55" : "#FFFFFF"}
                />
              </View>
              <Text style={styles.actionText}>{isLiked ? "Liked" : "Like"}</Text>
            </TouchableOpacity>

            {/* Full Player / Audio Details */}
            <TouchableOpacity
              style={styles.actionItem}
              onPress={() => handleOpenFullPlayer(item)}
              activeOpacity={0.75}
            >
              <View style={styles.actionIconCircle}>
                <Ionicons name="musical-notes" size={26} color="#FFFFFF" />
              </View>
              <Text style={styles.actionText}>Play</Text>
            </TouchableOpacity>

            {/* Share Button */}
            <TouchableOpacity
              style={styles.actionItem}
              onPress={() => handleShare(item)}
              activeOpacity={0.75}
            >
              <View style={styles.actionIconCircle}>
                <Ionicons name="paper-plane-outline" size={24} color="#FFFFFF" />
              </View>
              <Text style={styles.actionText}>Share</Text>
            </TouchableOpacity>

            {/* Spinning Vinyl Disc with Artwork */}
            <TouchableOpacity
              style={styles.vinylDiscContainer}
              onPress={() => handleOpenFullPlayer(item)}
              activeOpacity={0.85}
            >
              <Animated.View
                style={[
                  styles.vinylDisc,
                  { transform: [{ rotate: discRotateInterpolate }] },
                ]}
              >
                <Image
                  source={{ uri: artistImageUrl }}
                  style={styles.discImage}
                  contentFit="cover"
                />
              </Animated.View>
            </TouchableOpacity>
          </View>

          {/* Bottom Left Info / Track Details */}
          <View
            style={[
              styles.bottomInfoContainer,
              { bottom: insets.bottom + 24 },
            ]}
          >
            {/* Verified Artist Pill */}
            <View style={styles.artistPill}>
              <Text style={styles.artistName} numberOfLines={1}>
                @{item.artistName}
              </Text>
              <Ionicons
                name="checkmark-circle"
                size={14}
                color="#3897F0"
                style={{ marginLeft: 4 }}
              />
            </View>

            {/* Song Title */}
            <Text style={styles.songTitle} numberOfLines={2}>
              {item.title}
            </Text>

            {/* Sound / Music Note Ticker */}
            <View style={styles.soundTickerRow}>
              <Ionicons
                name="musical-note"
                size={14}
                color="#FFFFFF"
                style={{ marginRight: 6 }}
              />
              <Text style={styles.soundTickerText} numberOfLines={1}>
                {item.title} • {item.artistName}
              </Text>
              {item.genre ? (
                <View style={styles.genreBadge}>
                  <Text style={styles.genreText}>{item.genre}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>
      );
    },
    [
      activeIndex,
      isScreenFocused,
      isPaused,
      favouriteIds,
      insets.bottom,
      handleScreenPress,
      showPlayPauseIcon,
      playPauseAnim,
      showHeartBurst,
      heartOpacityAnim,
      heartScaleAnim,
      handleToggleLike,
      handleOpenFullPlayer,
      handleShare,
      discRotateInterpolate,
      router,
    ]
  );

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />

      {/* Top Header Overlay */}
      <View style={[styles.headerOverlay, { top: insets.top + 8 }]}>
        <TouchableOpacity
          style={styles.headerIconButton}
          onPress={handleDismiss}
          activeOpacity={0.7}
        >
          <Ionicons name="close" size={26} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Canvas Shorts</Text>
          <View style={styles.liveIndicator}>
            <View style={[styles.liveDot, { backgroundColor: "#FF2D55" }]} />
            <Text style={styles.liveText}>DISCOVER</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.headerIconButton}
          onPress={() => {
            hapticFeedback.light();
            setIsMuted((prev) => !prev);
          }}
          activeOpacity={0.7}
        >
          <Ionicons
            name={isMuted ? "volume-mute" : "volume-high"}
            size={22}
            color="#FFFFFF"
          />
        </TouchableOpacity>
      </View>

      {/* Vertical Swipeable Shorts Feed */}
      {isFeedLoading && songs.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={styles.loadingText}>Loading Shorts...</Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={songs}
          renderItem={renderShortItem}
          keyExtractor={(item, index) =>
            item?.id ? `shorts-${item.id}-${index}` : `shorts-${index}`
          }
          pagingEnabled
          showsVerticalScrollIndicator={false}
          snapToInterval={SCREEN_HEIGHT}
          snapToAlignment="start"
          decelerationRate="fast"
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) {
              fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.5}
          initialNumToRender={2}
          maxToRenderPerBatch={3}
          windowSize={5}
          removeClippedSubviews={Platform.OS === "android"}
          getItemLayout={(_, index) => ({
            length: SCREEN_HEIGHT,
            offset: SCREEN_HEIGHT * index,
            index,
          })}
          onScrollToIndexFailed={(info) => {
            setTimeout(() => {
              if (songs.length > 0) {
                flatListRef.current?.scrollToIndex({
                  index: Math.min(info.index, songs.length - 1),
                  animated: false,
                });
              }
            }, 100);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#000000",
  },
  pageContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    position: "relative",
    backgroundColor: "#000000",
  },
  topGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 140,
    zIndex: 1,
  },
  bottomGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 320,
    zIndex: 1,
  },
  headerOverlay: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 10,
  },
  headerIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  headerTitleContainer: {
    alignItems: "center",
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  liveIndicator: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  liveText: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  centerPlayIndicator: {
    position: "absolute",
    top: SCREEN_HEIGHT / 2 - 40,
    left: SCREEN_WIDTH / 2 - 40,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 8,
  },
  rightActionsColumn: {
    position: "absolute",
    right: 14,
    alignItems: "center",
    zIndex: 5,
    gap: 18,
  },
  actionItem: {
    alignItems: "center",
  },
  actionIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  actionText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 4,
    textShadowColor: "rgba(0,0,0,0.75)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  avatarBorder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    overflow: "hidden",
  },
  artistAvatar: {
    width: "100%",
    height: "100%",
  },
  plusBadge: {
    position: "absolute",
    bottom: -4,
    alignSelf: "center",
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#FF2D55",
    justifyContent: "center",
    alignItems: "center",
  },
  vinylDiscContainer: {
    marginTop: 4,
    alignItems: "center",
  },
  vinylDisc: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#1C1C1E",
    borderWidth: 8,
    borderColor: "#000000",
    justifyContent: "center",
    alignItems: "center",
    ...shadows.lg,
  },
  discImage: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  bottomInfoContainer: {
    position: "absolute",
    left: 16,
    right: 80,
    zIndex: 4,
  },
  artistPill: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  artistName: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  songTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 22,
    marginBottom: 10,
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  soundTickerRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  soundTickerText: {
    color: "rgba(255, 255, 255, 0.85)",
    fontSize: 13,
    fontWeight: "600",
    flexShrink: 1,
  },
  genreBadge: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.full,
    backgroundColor: "rgba(255, 255, 255, 0.18)",
  },
  genreText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 14,
    fontWeight: "600",
    marginTop: 12,
  },
});
