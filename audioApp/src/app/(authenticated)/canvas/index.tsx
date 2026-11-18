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
  AppState,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams, useIsFocused } from "expo-router";
import { useDispatch } from "react-redux";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { setAudioModeAsync } from "expo-audio";

import { Song } from "@/types";
import { AppDispatch } from "@/store";
import { playWithSimilarSongs } from "@/store/queueActions";
import {
  canvasService,
  homeService,
  audioPlayerService,
  resolveStreamUrl,
} from "@/service";
import { CanvasVideoPlayer } from "@/components/common/CanvasVideoPlayer";
import { ShortsProgressBar } from "@/components/shorts/ShortsProgressBar";
import { getImageUrl, getVideoUrl } from "@/utils/imageUtils";
import { configureAudioPriority } from "@/utils";
import { hapticFeedback } from "@/utils/haptics";
import { radius, shadows } from "@/theme";
import { useShortsAudioPlayer } from "@/hooks/useShortsAudioPlayer";
import { useShortsPreload } from "@/hooks/useShortsPreload";

const screenDimensions = Dimensions.get("screen");
const windowDimensions = Dimensions.get("window");
const SCREEN_WIDTH = windowDimensions.width;
const SCREEN_HEIGHT = Math.max(screenDimensions.height, windowDimensions.height);

export function parseArtistNames(artistStr?: string | null): string[] {
  if (!artistStr) return [];
  return artistStr
    .split(/[,;&]|(?:\s+feat\.?\s+)|\s+ft\.?\s+/i)
    .map((a) => a.trim())
    .filter(Boolean);
}

// ─── Spinning Vinyl Disc ─────────────────────────────────────────────────────

interface SpinningVinylDiscProps {
  isActive: boolean;
  imageUrl?: string | null;
}

const SpinningVinylDisc = React.memo(function SpinningVinylDisc({
  isActive,
  imageUrl,
}: SpinningVinylDiscProps) {
  const rotationAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let anim: Animated.CompositeAnimation | null = null;
    if (isActive) {
      anim = Animated.loop(
        Animated.timing(rotationAnim, {
          toValue: 1,
          duration: 5000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      anim.start();
    } else {
      rotationAnim.stopAnimation();
      rotationAnim.setValue(0);
    }
    return () => {
      if (anim) anim.stop();
      rotationAnim.stopAnimation();
    };
  }, [isActive, rotationAnim]);

  const rotate = rotationAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <View pointerEvents="none" style={styles.vinylDiscContainer}>
      <Animated.View style={[styles.vinylDisc, { transform: [{ rotate }] }]}>
        <Image
          source={imageUrl ? { uri: imageUrl } : undefined}
          style={styles.discImage}
          contentFit="cover"
        />
      </Animated.View>
    </View>
  );
});

// ─── Main Screen ─────────────────────────────────────────────────────────────

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

  // Container height
  const [containerHeight, setContainerHeight] = useState<number>(SCREEN_HEIGHT);
  const tabBottomSpace = insets.bottom;

  const flatListRef = useRef<FlatList<Song>>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showPlayPauseIcon, setShowPlayPauseIcon] = useState(false);
  const [showHeartBurst, setShowHeartBurst] = useState(false);
  const lastTapRef = useRef<number>(0);

  // ── App Active State ───────────────────────────────────────────────────────
  // Track app foreground state for the FlatList render (the hook handles its own ref)
  const [isAppActive, setIsAppActive] = useState<boolean>(
    AppState.currentState === "active"
  );
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      setIsAppActive(next === "active");
    });
    return () => sub.remove();
  }, []);

  // ── Shorts Like State ──────────────────────────────────────────────────────
  const [likedShortsMap, setLikedShortsMap] = useState<Record<string, boolean>>({});
  const [likeCountsMap, setLikeCountsMap] = useState<Record<string, number>>({});

  // ── Progress Bar State ─────────────────────────────────────────────────────
  const [currentPlaybackTime, setCurrentPlaybackTime] = useState(0);

  // ── Animations ────────────────────────────────────────────────────────────
  const playPauseAnim = useRef(new Animated.Value(0)).current;
  const heartScaleAnim = useRef(new Animated.Value(0)).current;
  const heartOpacityAnim = useRef(new Animated.Value(0)).current;

  // ── Seed for feed randomisation ────────────────────────────────────────────
  const seedRef = useRef(Date.now());
  const hasRefreshedRef = useRef(false);

  // ── Liked Shorts (server) ─────────────────────────────────────────────────
  const { data: initialLikedIds } = useQuery({
    queryKey: ["user-liked-shorts-feed"],
    queryFn: () => canvasService.getLikedShorts(),
    staleTime: 60 * 1000,
  });

  useEffect(() => {
    if (Array.isArray(initialLikedIds) && initialLikedIds.length > 0) {
      setLikedShortsMap((prev) => {
        const next = { ...prev };
        initialLikedIds.forEach((id) => { next[String(id)] = true; });
        return next;
      });
    }
  }, [initialLikedIds]);

  // ── Target song from deep link ─────────────────────────────────────────────
  const { data: targetSong } = useQuery({
    queryKey: ["canvas-target-song", params.songId],
    queryFn: () => homeService.getSongById(String(params.songId)),
    enabled: Boolean(params.songId),
    staleTime: 5 * 60 * 1000,
  });

  // ── Infinite Canvas Feed ───────────────────────────────────────────────────
  const {
    data: feedData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: isFeedLoading,
    isError: isFeedError,
    error: feedError,
  } = useInfiniteQuery({
    queryKey: ["canvas-feed-shorts"],
    queryFn: async ({ pageParam = 0 }) => {
      if (__DEV__) console.log(`[CanvasShorts] 🚀 Fetching feed page=${pageParam}, seed=${seedRef.current}`);
      try {
        const res = await canvasService.getFeed({
          page: pageParam,
          size: 10,
          sort: "random",
          seed: seedRef.current,
        });
        if (__DEV__) console.log(`[CanvasShorts] 📦 Feed page=${pageParam}: ${res?.content?.length || 0} songs`);
        return res;
      } catch (e: any) {
        console.error(`[CanvasShorts] ❌ Feed fetch error:`, e?.response?.status, e?.message);
        throw e;
      }
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      if (!lastPage || !lastPage.content || lastPage.content.length === 0) return undefined;
      const totalCount = lastPage.paginationMetaData?.totalCount;
      const nextPage = lastPage.page + 1;
      if (totalCount !== undefined && nextPage * lastPage.size >= totalCount) return undefined;
      return nextPage;
    },
    staleTime: 0,
  });

  // ── Consolidated unique song list ──────────────────────────────────────────
  const songs: Song[] = useMemo(() => {
    const rawFeed = feedData?.pages?.flatMap((p) => p.content || []) || [];
    const seen = new Set<string>();
    const result: Song[] = [];

    if (params.songId && !hasRefreshedRef.current) {
      const match = rawFeed.find((s) => s.id === params.songId) || targetSong;
      if (match && match.id && (match.videoKey || (match as any).canvasVideoUrl)) {
        seen.add(match.id);
        result.push(match);
      }
    }

    for (const song of rawFeed) {
      if (!song || !song.id || seen.has(song.id)) continue;
      seen.add(song.id);
      result.push(song);
    }
    if (__DEV__) console.log(`[CanvasShorts] 🎶 Songs: ${result.length} (raw: ${rawFeed.length})`);
    return result;
  }, [feedData?.pages, params.songId, targetSong]);

  // ── Sync server isLiked / likesCount ──────────────────────────────────────
  useEffect(() => {
    if (songs.length === 0) return;
    setLikedShortsMap((prev) => {
      let changed = false;
      const next = { ...prev };
      songs.forEach((song) => {
        if (song.id && song.isLiked !== undefined && next[String(song.id)] === undefined) {
          next[String(song.id)] = song.isLiked;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
    setLikeCountsMap((prev) => {
      let changed = false;
      const next = { ...prev };
      songs.forEach((song) => {
        if (song.id && song.likesCount !== undefined && next[String(song.id)] === undefined) {
          next[String(song.id)] = song.likesCount;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [songs]);

  // ── Jump to target song on deep-link ──────────────────────────────────────
  useEffect(() => {
    if (params.songId && songs.length > 0 && !hasRefreshedRef.current) {
      const targetIdx = songs.findIndex((s) => s.id === params.songId);
      if (targetIdx >= 0 && targetIdx !== activeIndex) {
        setActiveIndex(targetIdx);
        setTimeout(() => {
          flatListRef.current?.scrollToIndex({ index: targetIdx, animated: false });
        }, 100);
      }
    }
  }, [params.songId, songs.length]);

  const activeSong = songs[activeIndex];

  // ── Scroll helpers ─────────────────────────────────────────────────────────
  const handleScrollToNext = useCallback(() => {
    setActiveIndex((prev) => {
      const nextIdx = Math.min(prev + 1, songs.length - 1);
      if (nextIdx !== prev) flatListRef.current?.scrollToIndex({ index: nextIdx, animated: true });
      return nextIdx;
    });
  }, [songs.length]);

  const handleScrollToPrev = useCallback(() => {
    setActiveIndex((prev) => {
      const prevIdx = Math.max(prev - 1, 0);
      if (prevIdx !== prev) flatListRef.current?.scrollToIndex({ index: prevIdx, animated: true });
      return prevIdx;
    });
  }, []);

  // ── Phase 1A: Audio session on screen enter/exit ──────────────────────────
  // Flips `shouldPlayInBackground` to false so Shorts NEVER bleeds into bg/lock screen.
  // Restores the main music session when leaving Shorts.
  useEffect(() => {
    if (isScreenFocused) {
      // Pause main listening session
      audioPlayerService.pause();

      // Flip audio session to foreground-only for Shorts
      setAudioModeAsync({
        playsInSilentMode: true,
        interruptionMode: "doNotMix",
        interruptionModeAndroid: "doNotMix",
        shouldPlayInBackground: false, // 🔑 Shorts MUST NOT play in background
        allowsRecording: false,
        shouldRouteThroughEarpiece: false,
      }).catch(() => {});
    } else {
      // Restore full background audio for the main music session
      configureAudioPriority(true)
        .catch(() => {})
        .finally(() => {
          if (audioPlayerService.currentSong) {
            audioPlayerService.refreshLockScreen(true);
          }
        });
    }
  }, [isScreenFocused]);

  // ── Phase 6A: Isolated audio player via custom hook ───────────────────────
  const [isShortsPlaying, setIsShortsPlaying] = useState(false);

  const { playerRef: shortsPlayerRef } = useShortsAudioPlayer({
    activeSong,
    activeIndex,
    isScreenFocused,
    isAppActive,
    isPaused,
    isMuted,
    onPlayingChange: setIsShortsPlaying,
  });

  // ── Phase 6B: Preloading via custom hook ──────────────────────────────────
  useShortsPreload({ songs, activeIndex, isScreenFocused });

  // ── Cleanup on unmount ─────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (audioPlayerService.currentSong) {
        audioPlayerService.refreshLockScreen(true);
      }
    };
  }, []);

  // ── Pull-to-refresh ────────────────────────────────────────────────────────
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    hapticFeedback.light();
    try {
      hasRefreshedRef.current = true;
      seedRef.current = Date.now();
      setActiveIndex(0);
      flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
      await queryClient.resetQueries({ queryKey: ["canvas-feed-shorts"] });
    } catch (e) {
      if (__DEV__) console.warn("[CanvasShorts] Refresh error:", e);
    } finally {
      setIsRefreshing(false);
    }
  }, [queryClient]);

  // ── Viewable items ─────────────────────────────────────────────────────────
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<any> }) => {
      if (viewableItems && viewableItems.length > 0) {
        const first = viewableItems[0];
        if (typeof first.index === "number" && first.index >= 0) {
          setActiveIndex(first.index);
          setIsPaused(false);
          setCurrentPlaybackTime(0); // Reset progress bar on slide change
        }
      }
    }
  ).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 80,
  }).current;

  // ── Shorts Like Toggle ─────────────────────────────────────────────────────
  const handleToggleLike = useCallback(
    async (song: Song) => {
      if (!song?.id) return;
      hapticFeedback.medium();
      const songIdStr = String(song.id);
      const currentlyLiked = !!likedShortsMap[songIdStr];
      const currentCount = likeCountsMap[songIdStr] ?? 0;

      setLikedShortsMap((prev) => ({ ...prev, [songIdStr]: !currentlyLiked }));
      setLikeCountsMap((prev) => ({
        ...prev,
        [songIdStr]: Math.max(0, currentCount + (currentlyLiked ? -1 : 1)),
      }));

      try {
        const res = await canvasService.toggleLike(song.id);
        setLikedShortsMap((prev) => ({ ...prev, [songIdStr]: res.isLiked }));
        setLikeCountsMap((prev) => ({ ...prev, [songIdStr]: res.count }));
      } catch {
        setLikedShortsMap((prev) => ({ ...prev, [songIdStr]: currentlyLiked }));
        setLikeCountsMap((prev) => ({ ...prev, [songIdStr]: currentCount }));
      }
    },
    [likedShortsMap, likeCountsMap]
  );

  // ── Single / Double Tap ────────────────────────────────────────────────────
  const handleScreenPress = useCallback(() => {
    const now = Date.now();
    const DOUBLE_PRESS_DELAY = 300;

    if (now - lastTapRef.current < DOUBLE_PRESS_DELAY) {
      // Double tap → Like
      if (activeSong) {
        handleToggleLike(activeSong);
        setShowHeartBurst(true);
        heartScaleAnim.setValue(0);
        heartOpacityAnim.setValue(1);
        Animated.parallel([
          Animated.spring(heartScaleAnim, { toValue: 1.4, friction: 4, useNativeDriver: true }),
          Animated.timing(heartOpacityAnim, {
            toValue: 0,
            duration: 800,
            delay: 400,
            useNativeDriver: true,
          }),
        ]).start(() => setShowHeartBurst(false));
      }
    } else {
      // Single tap → Play/Pause
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
        }).start(() => setShowPlayPauseIcon(false));
        return next;
      });
    }

    lastTapRef.current = now;
  }, [activeSong, handleToggleLike, heartOpacityAnim, heartScaleAnim, playPauseAnim]);

  // ── Play on Main Player ────────────────────────────────────────────────────
  const handlePlayMainSong = useCallback(
    (song: Song) => {
      hapticFeedback.medium();
      try { shortsPlayerRef.current?.pause(); } catch {}
      setIsShortsPlaying(false);
      dispatch(playWithSimilarSongs(song, songs));
      router.push(`/song/${song.id}`);
    },
    [songs, dispatch, router, shortsPlayerRef]
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

  // ── Render individual slide ────────────────────────────────────────────────
  const renderShortItem = useCallback(
    ({ item, index }: { item: Song; index: number }) => {
      const isActive = index === activeIndex;
      const isLiked = !!likedShortsMap[String(item.id)];
      const likeCount = likeCountsMap[String(item.id)];
      const videoKey = item.videoKey || (item.fullVideoKey?.includes(".") ? item.fullVideoKey : null);
      const artistImageUrl = getImageUrl(item.imageKey, {
        width: 120,
        height: 120,
        aspectRatio: "1-1",
      });

      const artistNames = parseArtistNames(item.artistName);
      const primaryArtist = artistNames[0] || item.artistName || "Unknown Artist";

      // Mount video for active slide and the next slide (pre-buffer), not beyond
      const shouldMountVideo = (isActive || index === activeIndex + 1) && Boolean(videoKey);

      if (__DEV__ && isActive) {
        console.log(
          `[CanvasShorts] 🎯 Active [${index}]: id=${item.id}, title="${item.title}", videoKey="${videoKey}", shouldMount=${shouldMountVideo}`
        );
      }

      return (
        <View style={[styles.pageContainer, { height: containerHeight }]}>
          <TouchableWithoutFeedback onPress={handleScreenPress} accessibilityRole="button" accessibilityLabel="Play or pause" accessibilityHint="Double tap twice quickly to like the song">
            <View style={StyleSheet.absoluteFill}>
              {/* Full-screen canvas video or artwork fallback */}
              {shouldMountVideo ? (
                <CanvasVideoPlayer
                  videoUrl={(item as any)?.canvasVideoUrl}
                  videoKey={videoKey}
                  fallbackImageKey={item.imageKey}
                  isPlaying={isActive && isScreenFocused && !isPaused && isAppActive}
                  showFallbackImage={true}
                  showLoader={false}
                  contentFit="cover"
                  staysActiveInBackground={false}
                  style={StyleSheet.absoluteFill}
                />
              ) : (
                <Image
                  source={{
                    uri: getImageUrl(item.imageKey, {
                      width: 800,
                      height: 1400,
                      aspectRatio: "9-16",
                      crop: "at_least",
                    }),
                  }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                />
              )}

              {/* Top gradient */}
              <LinearGradient
                colors={["rgba(0,0,0,0.7)", "rgba(0,0,0,0.2)", "transparent"]}
                locations={[0, 0.45, 1]}
                style={styles.topGradient}
              />

              {/* Bottom gradient */}
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

          {/* Play / Pause indicator */}
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

          {/* Heart burst on double tap */}
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

          {/* Right actions column */}
          <View
            style={[
              styles.rightActionsColumn,
              { bottom: tabBottomSpace + 16 },
            ]}
          >
            {/* Artist avatar */}
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={`Open artist ${primaryArtist}`}
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

            {/* Like button */}
            <TouchableOpacity
              style={styles.actionItem}
              onPress={() => handleToggleLike(item)}
              activeOpacity={0.75}
            >
              <View style={styles.actionIconCircle}>
                <Ionicons
                  name={isLiked ? "heart" : "heart-outline"}
                  size={30}
                  color={isLiked ? "#FF2D55" : "#FFFFFF"}
                  style={styles.actionIconShadow}
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

            {/* Play on main player */}
            <TouchableOpacity
              style={styles.actionItem}
              onPress={() => handlePlayMainSong(item)}
              activeOpacity={0.75}
            >
              <View style={styles.actionIconCircle}>
                <Ionicons
                  name="play"
                  size={28}
                  color="#FFFFFF"
                  style={styles.actionIconShadow}
                />
              </View>
              <Text style={styles.actionText}>Play</Text>
            </TouchableOpacity>

            {/* Share */}
            <TouchableOpacity
              style={styles.actionItem}
              onPress={() => handleShare(item)}
              activeOpacity={0.75}
            >
              <View style={styles.actionIconCircle}>
                <Ionicons
                  name="paper-plane-outline"
                  size={26}
                  color="#FFFFFF"
                  style={styles.actionIconShadow}
                />
              </View>
              <Text style={styles.actionText}>Share</Text>
            </TouchableOpacity>

            {/* Spinning vinyl disc */}
            <SpinningVinylDisc
              isActive={isActive && isShortsPlaying && !isPaused && isScreenFocused}
              imageUrl={artistImageUrl}
            />
          </View>

          {/* Bottom info */}
          <View
            style={[
              styles.bottomInfoContainer,
              { bottom: tabBottomSpace + 8 },
            ]}
          >
            {/* Artist pills */}
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

            {/* Song title + genre */}
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

            {/* Sound ticker */}
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

          {/* Phase 5A: Preview progress bar */}
          {isActive && (
            <ShortsProgressBar
              currentTime={currentPlaybackTime}
              startTime={typeof item.previewStartTime === "number" ? item.previewStartTime : 0}
              endTime={typeof item.previewEndTime === "number" ? item.previewEndTime : 0}
              duration={typeof (item as any).duration === "number" ? (item as any).duration : 30}
              isPaused={isPaused}
              isVisible={isShortsPlaying}
            />
          )}
        </View>
      );
    },
    [
      activeIndex,
      containerHeight,
      likedShortsMap,
      likeCountsMap,
      isScreenFocused,
      isAppActive,
      isPaused,
      isShortsPlaying,
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
      currentPlaybackTime,
      router,
    ]
  );

  // ── Root render ────────────────────────────────────────────────────────────
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

      {/* Top header */}
      <View style={[styles.headerOverlay, { top: insets.top + 8 }]}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Close shorts"
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
          accessibilityRole="button"
          accessibilityLabel={isMuted ? "Unmute" : "Mute"}
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

      {/* Feed */}
      {isFeedLoading && songs.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF2D55" />
          <Text style={styles.loadingText}>Loading Shorts...</Text>
        </View>
      ) : songs.length === 0 ? (
        <View style={styles.loadingContainer}>
          <Ionicons name="film-outline" size={54} color="rgba(255,255,255,0.4)" />
          <Text style={styles.loadingText}>
            {isFeedError
              ? `Failed to load shorts feed (${(feedError as any)?.message || "Network Error"})`
              : "No canvas videos available"}
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={handleRefresh}
            activeOpacity={0.7}
          >
            <Ionicons name="refresh" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.retryButtonText}>Tap to Retry</Text>
          </TouchableOpacity>
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
          snapToInterval={Platform.OS === "android" ? containerHeight : undefined}
          snapToAlignment={Platform.OS === "android" ? "start" : undefined}
          decelerationRate={Platform.OS === "ios" ? "normal" : "fast"}
          disableIntervalMomentum={true}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) fetchNextPage();
          }}
          onEndReachedThreshold={1.5}
          initialNumToRender={1}
          maxToRenderPerBatch={2}
          windowSize={3}
          removeClippedSubviews={true} // Phase 4A: enabled on both platforms
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
    overflow: "hidden",
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
    top: "50%",
    left: "50%",
    width: 80,
    height: 80,
    marginLeft: -40,
    marginTop: -40,
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
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent",
  },
  actionIconShadow: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.85,
    shadowRadius: 3,
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
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: radius.full,
    backgroundColor: "#FF2D55",
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
});
