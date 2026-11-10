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
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams, useIsFocused } from "expo-router";
import { useDispatch } from "react-redux";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { createAudioPlayer, preload, AudioPlayer, AudioStatus } from "expo-audio";

import { Song } from "@/types";
import { AppDispatch } from "@/store";
import { playWithSimilarSongs } from "@/store/queueActions";
import {
  canvasService,
  videoService,
  homeService,
  audioPlayerService,
  resolveStreamUrl,
} from "@/service";
import { CanvasVideoPlayer } from "@/components/common/CanvasVideoPlayer";
import { getImageUrl } from "@/utils/imageUtils";
import { hapticFeedback } from "@/utils/haptics";
import { radius, shadows } from "@/theme";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

export function parseArtistNames(artistStr?: string | null): string[] {
  if (!artistStr) return [];
  return artistStr
    .split(/[,;&]|(?:\s+feat\.?\s+)|\s+ft\.?\s+/i)
    .map((a) => a.trim())
    .filter(Boolean);
}

interface CanvasShortsScreenProps {
  isTab?: boolean;
}

export default function CanvasShortsScreen({ isTab = false }: CanvasShortsScreenProps = {}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch<AppDispatch>();
  const queryClient = useQueryClient();
  const isScreenFocused = useIsFocused();
  const params = useLocalSearchParams<{ songId?: string }>();

  // Full-height measurement accounting for tabs & safe areas
  const [containerHeight, setContainerHeight] = useState<number>(SCREEN_HEIGHT);

  // Spacing above the bottom tab bar or safe area
  const tabBottomSpace = isTab
    ? (Platform.OS === "ios" ? 49 + insets.bottom : 80 + insets.bottom)
    : insets.bottom;

  const flatListRef = useRef<FlatList<Song>>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showPlayPauseIcon, setShowPlayPauseIcon] = useState(false);
  const [showHeartBurst, setShowHeartBurst] = useState(false);
  const lastTapRef = useRef<number>(0);

  // Isolated Shorts Audio Player & playback state
  const shortsPlayerRef = useRef<AudioPlayer | null>(null);
  const [isShortsPlaying, setIsShortsPlaying] = useState<boolean>(false);

  // Separate Shorts Like tracking
  const [likedShortsMap, setLikedShortsMap] = useState<Record<string, boolean>>({});
  const [likeCountsMap, setLikeCountsMap] = useState<Record<string, number>>({});

  // Animations
  const playPauseAnim = useRef(new Animated.Value(0)).current;
  const heartScaleAnim = useRef(new Animated.Value(0)).current;
  const heartOpacityAnim = useRef(new Animated.Value(0)).current;
  const discRotationAnim = useRef(new Animated.Value(0)).current;

  // 1. Fetch User's Liked Shorts to initialize like state
  const { data: initialLikedIds } = useQuery({
    queryKey: ["user-liked-shorts-feed"],
    queryFn: () => canvasService.getLikedShorts(),
    staleTime: 60 * 1000,
  });

  useEffect(() => {
    if (Array.isArray(initialLikedIds) && initialLikedIds.length > 0) {
      setLikedShortsMap((prev) => {
        const next = { ...prev };
        initialLikedIds.forEach((id) => {
          next[String(id)] = true;
        });
        return next;
      });
    }
  }, [initialLikedIds]);

  // 2. Fetch Infinite Canvas Feed with random sort for fresh results every time
  const {
    data: feedData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: isFeedLoading,
    refetch,
  } = useInfiniteQuery({
    queryKey: ["canvas-feed-shorts"],
    queryFn: ({ pageParam = 0 }) =>
      canvasService.getFeed({
        page: pageParam,
        size: 10,
        sort: "random",
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
    staleTime: 0, // Fresh on refresh
  });

  // 3. Fallback pool: Popular videos & featured tracks in case canvas feed is small
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

  const activeSong = songs[activeIndex];

  // 4. Audio Isolation: Pause main listening session when entering Shorts
  useEffect(() => {
    if (isScreenFocused) {
      // Pause main listening session so audio does not overlap
      audioPlayerService.pause();
    } else {
      // Pause shorts preview audio when user leaves Shorts screen/tab
      shortsPlayerRef.current?.pause();
      setIsShortsPlaying(false);
    }
  }, [isScreenFocused]);

  // 5. Isolated Preview Player: Plays the active short on an endless loop
  useEffect(() => {
    if (!isScreenFocused || !activeSong) {
      shortsPlayerRef.current?.pause();
      setIsShortsPlaying(false);
      return;
    }

    const streamUrl = resolveStreamUrl(activeSong);
    if (!streamUrl) return;

    let isMounted = true;

    const setupIsolatedPlayer = async () => {
      try {
        if (!shortsPlayerRef.current) {
          const player = createAudioPlayer(
            { uri: streamUrl },
            {
              keepAudioSessionActive: true,
              updateInterval: 250,
            }
          );
          player.loop = true;
          player.muted = isMuted;

          player.addListener("playbackStatusUpdate", (status: AudioStatus) => {
            if (!isMounted) return;
            setIsShortsPlaying(status.playing);
            if (status.didJustFinish && !isPaused) {
              player.seekTo(0);
              player.play();
            }
          });

          shortsPlayerRef.current = player;
        } else {
          shortsPlayerRef.current.replace({ uri: streamUrl });
          shortsPlayerRef.current.loop = true;
          shortsPlayerRef.current.muted = isMuted;
        }

        if (!isPaused && isScreenFocused) {
          shortsPlayerRef.current.play();
          setIsShortsPlaying(true);
        } else {
          shortsPlayerRef.current.pause();
          setIsShortsPlaying(false);
        }
      } catch (err) {
        console.warn("[CanvasShorts] Isolated player error:", err);
      }
    };

    setupIsolatedPlayer();

    return () => {
      isMounted = false;
    };
  }, [activeIndex, activeSong?.id, isScreenFocused]);

  // Handle Play / Pause state for isolated preview audio
  useEffect(() => {
    if (!shortsPlayerRef.current || !isScreenFocused) return;
    if (isPaused) {
      shortsPlayerRef.current.pause();
      setIsShortsPlaying(false);
    } else {
      shortsPlayerRef.current.play();
      setIsShortsPlaying(true);
    }
  }, [isPaused, isScreenFocused]);

  // Handle Mute toggle for isolated preview audio
  useEffect(() => {
    if (shortsPlayerRef.current) {
      shortsPlayerRef.current.muted = isMuted;
    }
  }, [isMuted]);

  // Cleanup isolated audio player on unmount
  useEffect(() => {
    return () => {
      try {
        shortsPlayerRef.current?.pause();
        shortsPlayerRef.current?.remove();
        shortsPlayerRef.current = null;
      } catch {}
    };
  }, []);

  // 6. Eager Preload: Next 2-3 songs audio & artwork
  useEffect(() => {
    if (songs.length === 0) return;
    const nextTracks = songs.slice(activeIndex + 1, activeIndex + 4);
    nextTracks.forEach((track) => {
      // Preload image
      if (track.imageKey) {
        const imgUrl = getImageUrl(track.imageKey, { width: 400, height: 400 });
        if (imgUrl) Image.prefetch(imgUrl);
      }
      // Preload audio stream
      const streamUrl = resolveStreamUrl(track);
      if (streamUrl) {
        try {
          preload(streamUrl);
        } catch {}
      }
    });
  }, [activeIndex, songs]);

  // 7. Continuous Vinyl Disc Spin Animation (Purely visual)
  useEffect(() => {
    let loopAnimation: Animated.CompositeAnimation | null = null;
    if (isShortsPlaying && !isPaused && isScreenFocused) {
      loopAnimation = Animated.loop(
        Animated.timing(discRotationAnim, {
          toValue: 1,
          duration: 5000,
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
  }, [isShortsPlaying, isPaused, isScreenFocused]);

  const discRotateInterpolate = discRotationAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  // Pull to refresh with randomized fresh content
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    hapticFeedback.light();
    try {
      await queryClient.invalidateQueries({ queryKey: ["canvas-feed-shorts"] });
      await refetch();
      setActiveIndex(0);
      flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
    } finally {
      setIsRefreshing(false);
    }
  }, [queryClient, refetch]);

  // Viewable item changed in swipe feed
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

  // 8. Separate Shorts Like Toggle (Does NOT affect Library Favourites)
  const handleToggleLike = useCallback(
    async (song: Song) => {
      if (!song?.id) return;
      hapticFeedback.medium();
      const songIdStr = String(song.id);
      const currentlyLiked = !!likedShortsMap[songIdStr];
      const currentCount = likeCountsMap[songIdStr] ?? 0;

      // Optimistic update
      setLikedShortsMap((prev) => ({ ...prev, [songIdStr]: !currentlyLiked }));
      setLikeCountsMap((prev) => ({
        ...prev,
        [songIdStr]: Math.max(0, currentCount + (currentlyLiked ? -1 : 1)),
      }));

      try {
        const res = await canvasService.toggleLike(song.id);
        setLikedShortsMap((prev) => ({ ...prev, [songIdStr]: res.isLiked }));
        setLikeCountsMap((prev) => ({ ...prev, [songIdStr]: res.count }));
      } catch (err) {
        // Revert on failure
        setLikedShortsMap((prev) => ({ ...prev, [songIdStr]: currentlyLiked }));
        setLikeCountsMap((prev) => ({ ...prev, [songIdStr]: currentCount }));
      }
    },
    [likedShortsMap, likeCountsMap]
  );

  // Single / Double Tap Gestures
  const handleScreenPress = useCallback(() => {
    const now = Date.now();
    const DOUBLE_PRESS_DELAY = 300;

    if (now - lastTapRef.current < DOUBLE_PRESS_DELAY) {
      // Double tap -> Like Shorts
      if (activeSong) {
        handleToggleLike(activeSong);

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
      // Single tap -> Play / Pause preview
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
  }, [activeSong, handleToggleLike, heartOpacityAnim, heartScaleAnim, playPauseAnim]);

  // 9. Play on Main Player and Main Queue ONLY when user explicitly clicks "Play"
  const handlePlayMainSong = useCallback(
    (song: Song) => {
      hapticFeedback.medium();
      // Stop isolated preview audio
      shortsPlayerRef.current?.pause();
      setIsShortsPlaying(false);

      // Play on main player & populate main queue
      dispatch(playWithSimilarSongs(song, songs));

      // Open full song player
      router.push(`/song/${song.id}`);
    },
    [songs, dispatch, router]
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
    if (router.canGoBack()) {
      router.back();
    } else {
      router.push("/(authenticated)/(tabs)/home" as any);
    }
  }, [router]);

  // Render individual vertical Short slide
  const renderShortItem = useCallback(
    ({ item, index }: { item: Song; index: number }) => {
      const isActive = index === activeIndex;
      const isLiked = !!likedShortsMap[String(item.id)];
      const likeCount = likeCountsMap[String(item.id)];
      const videoKey = item.videoKey || item.fullVideoKey;
      const artistImageUrl = getImageUrl(item.imageKey, {
        width: 120,
        height: 120,
        aspectRatio: "1-1",
      });

      // Split multiple artists into clean individual names
      const artistNames = parseArtistNames(item.artistName);
      const primaryArtist = artistNames[0] || item.artistName || "Unknown Artist";

      return (
        <View style={[styles.pageContainer, { height: containerHeight }]}>
          <TouchableWithoutFeedback onPress={handleScreenPress}>
            <View style={StyleSheet.absoluteFill}>
              {/* Full-screen Edge-to-Edge Looping Canvas Video Backdrop */}
              <CanvasVideoPlayer
                videoKey={videoKey}
                fallbackImageKey={item.imageKey}
                isPlaying={isActive && isScreenFocused && !isPaused}
                showFallbackImage={true}
                showLoader={false}
                style={StyleSheet.absoluteFill}
              />

              {/* Top Gradient for Status Bar & Header clarity */}
              <LinearGradient
                colors={["rgba(0,0,0,0.7)", "rgba(0,0,0,0.2)", "transparent"]}
                locations={[0, 0.45, 1]}
                style={styles.topGradient}
              />

              {/* Bottom Gradient for Text & Control Readability */}
              <LinearGradient
                colors={[
                  "transparent",
                  "rgba(0,0,0,0.15)",
                  "rgba(0,0,0,0.65)",
                  "rgba(0,0,0,0.95)",
                ]}
                locations={[0, 0.35, 0.7, 1]}
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
              { bottom: tabBottomSpace + 16 },
            ]}
          >
            {/* Artist Avatar (Primary Artist) */}
            <TouchableOpacity
              style={styles.actionItem}
              onPress={() => {
                hapticFeedback.light();
                router.push({
                  pathname: "/(authenticated)/artist/[id]",
                  params: { id: primaryArtist, name: primaryArtist },
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
                <Ionicons name="person" size={10} color="#FFFFFF" />
              </View>
            </TouchableOpacity>

            {/* Separate Shorts Like / Heart Button */}
            <TouchableOpacity
              style={styles.actionItem}
              onPress={() => handleToggleLike(item)}
              activeOpacity={0.75}
            >
              <View
                style={[
                  styles.actionIconCircle,
                  isLiked && styles.actionIconCircleLiked,
                ]}
              >
                <Ionicons
                  name={isLiked ? "heart" : "heart-outline"}
                  size={26}
                  color={isLiked ? "#FF2D55" : "#FFFFFF"}
                />
              </View>
              <Text style={styles.actionText}>
                {likeCount !== undefined && likeCount > 0
                  ? String(likeCount)
                  : isLiked
                  ? "Liked"
                  : "Like"}
              </Text>
            </TouchableOpacity>

            {/* Play on Main Player Action */}
            <TouchableOpacity
              style={styles.actionItem}
              onPress={() => handlePlayMainSong(item)}
              activeOpacity={0.75}
            >
              <View style={styles.actionIconCircle}>
                <Ionicons name="play" size={24} color="#FFFFFF" />
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
                <Ionicons name="paper-plane-outline" size={22} color="#FFFFFF" />
              </View>
              <Text style={styles.actionText}>Share</Text>
            </TouchableOpacity>

            {/* Non-Pressable Revolving Vinyl Disc */}
            <View pointerEvents="none" style={styles.vinylDiscContainer}>
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
            </View>
          </View>

          {/* Bottom Left Info / Track Details — Hugs Close Above Bottom Tabs */}
          <View
            style={[
              styles.bottomInfoContainer,
              { bottom: tabBottomSpace + 8 },
            ]}
          >
            {/* Multi-Artist Parsing with Clickable Tags */}
            <View style={styles.artistRow}>
              {artistNames.map((name, idx) => (
                <TouchableOpacity
                  key={`${name}-${idx}`}
                  onPress={() => {
                    hapticFeedback.light();
                    router.push({
                      pathname: "/(authenticated)/artist/[id]",
                      params: { id: name, name },
                    });
                  }}
                  activeOpacity={0.7}
                  style={styles.artistPill}
                >
                  <Text style={styles.artistName} numberOfLines={1}>
                    @{name}
                  </Text>
                  {idx === 0 && (
                    <Ionicons
                      name="checkmark-circle"
                      size={13}
                      color="#3897F0"
                      style={{ marginLeft: 3 }}
                    />
                  )}
                  {idx < artistNames.length - 1 && (
                    <Text style={styles.artistComma}>,</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {/* Song Title & Optional Genre Pill */}
            <View style={styles.titleRow}>
              <Text style={styles.songTitle} numberOfLines={2}>
                {item.title}
              </Text>
              {item.genre ? (
                <View style={styles.genreBadge}>
                  <Text style={styles.genreText}>{item.genre}</Text>
                </View>
              ) : null}
            </View>

            {/* Sound Ticker / Play Prompt Row */}
            <TouchableOpacity
              style={styles.soundTickerRow}
              onPress={() => handlePlayMainSong(item)}
              activeOpacity={0.8}
            >
              <Ionicons
                name="musical-notes"
                size={14}
                color="#FFFFFF"
                style={{ marginRight: 6 }}
              />
              <Text style={styles.soundTickerText} numberOfLines={1}>
                {item.title} • {primaryArtist}
              </Text>
              <View style={styles.playHintBadge}>
                <Ionicons name="play" size={10} color="#FFFFFF" style={{ marginRight: 3 }} />
                <Text style={styles.playHintText}>Full Song</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      );
    },
    [
      activeIndex,
      containerHeight,
      likedShortsMap,
      likeCountsMap,
      isScreenFocused,
      isPaused,
      tabBottomSpace,
      handleScreenPress,
      showPlayPauseIcon,
      playPauseAnim,
      showHeartBurst,
      heartOpacityAnim,
      heartScaleAnim,
      handleToggleLike,
      handlePlayMainSong,
      handleShare,
      discRotateInterpolate,
      router,
    ]
  );

  return (
    <View
      style={styles.root}
      onLayout={(e) => {
        const h = e.nativeEvent.layout.height;
        if (h > 0 && Math.abs(h - containerHeight) > 1) {
          setContainerHeight(h);
        }
      }}
    >
      <StatusBar barStyle="light-content" />

      {/* Top Header Overlay */}
      <View style={[styles.headerOverlay, { top: insets.top + 8 }]}>
        <TouchableOpacity
          style={styles.headerIconButton}
          onPress={handleDismiss}
          activeOpacity={0.7}
        >
          <Ionicons name="close" size={24} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Shorts</Text>
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
            size={20}
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
          snapToInterval={containerHeight}
          snapToAlignment="start"
          decelerationRate="fast"
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) {
              fetchNextPage();
            }
          }}
          onEndReachedThreshold={1.5}
          initialNumToRender={2}
          maxToRenderPerBatch={4}
          windowSize={7}
          removeClippedSubviews={Platform.OS === "android"}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor="#FFFFFF"
              colors={["#FF2D55"]}
            />
          }
          getItemLayout={(_, index) => ({
            length: containerHeight,
            offset: containerHeight * index,
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
    position: "relative",
    backgroundColor: "#000000",
  },
  topGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 150,
    zIndex: 1,
  },
  bottomGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 340,
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
    width: 38,
    height: 38,
    borderRadius: 19,
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
    color: "rgba(255, 255, 255, 0.65)",
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
    gap: 16,
  },
  actionItem: {
    alignItems: "center",
  },
  actionIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "rgba(0, 0, 0, 0.42)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  actionIconCircleLiked: {
    backgroundColor: "rgba(255, 45, 85, 0.18)",
    borderColor: "rgba(255, 45, 85, 0.4)",
  },
  actionText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 3,
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  avatarBorder: {
    width: 46,
    height: 46,
    borderRadius: 23,
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
    bottom: -3,
    alignSelf: "center",
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#FF2D55",
    justifyContent: "center",
    alignItems: "center",
  },
  vinylDiscContainer: {
    marginTop: 2,
    alignItems: "center",
  },
  vinylDisc: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#1C1C1E",
    borderWidth: 7,
    borderColor: "#0A0A0A",
    justifyContent: "center",
    alignItems: "center",
    ...shadows.lg,
  },
  discImage: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  bottomInfoContainer: {
    position: "absolute",
    left: 14,
    right: 76,
    zIndex: 4,
    gap: 4,
  },
  artistRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 4,
  },
  artistPill: {
    flexDirection: "row",
    alignItems: "center",
  },
  artistName: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  artistComma: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 14,
    fontWeight: "700",
    marginRight: 2,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  songTitle: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "800",
    lineHeight: 21,
    textShadowColor: "rgba(0,0,0,0.85)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
    flexShrink: 1,
  },
  genreBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.full,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderWidth: 0.5,
    borderColor: "rgba(255, 255, 255, 0.25)",
  },
  genreText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  soundTickerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  soundTickerText: {
    color: "rgba(255, 255, 255, 0.88)",
    fontSize: 12,
    fontWeight: "600",
    flexShrink: 1,
  },
  playHintBadge: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.full,
    backgroundColor: "rgba(255, 45, 85, 0.8)",
  },
  playHintText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
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
