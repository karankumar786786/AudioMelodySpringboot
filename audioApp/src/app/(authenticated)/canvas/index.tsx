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
import {
  createAudioPlayer,
  preload,
  AudioPlayer,
  AudioStatus,
} from "expo-audio";

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
import { getImageUrl, getVideoUrl } from "@/utils/imageUtils";
import { configureAudioPriority, safeSetActiveForLockScreen } from "@/utils";
import { hapticFeedback } from "@/utils/haptics";
import { radius, shadows } from "@/theme";

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

async function safeSeek(player: AudioPlayer | null, seconds: number) {
  if (!player) return;
  try {
    if (typeof player.seekTo === "function") {
      await player.seekTo(Math.max(0, seconds));
    }
  } catch {
    // Player may still be loading, seeking, or transitioning
  }
}

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

  // Spacing above the bottom home indicator / safe area (Shorts is full-screen)
  const tabBottomSpace = insets.bottom;

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

  const seedRef = useRef(Date.now());
  const hasRefreshedRef = useRef(false);

  // Optional target song if navigated from external card
  const { data: targetSong } = useQuery({
    queryKey: ["canvas-target-song", params.songId],
    queryFn: () => homeService.getSongById(String(params.songId)),
    enabled: Boolean(params.songId),
    staleTime: 5 * 60 * 1000,
  });

  // 2. Fetch Infinite Canvas Feed with random sort for fresh results every time
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
      console.log(`[CanvasShorts] 🚀 Fetching feed page=${pageParam}, seed=${seedRef.current}`);
      try {
        const res = await canvasService.getFeed({
          page: pageParam,
          size: 10,
          sort: "random",
          seed: seedRef.current,
        });
        console.log(
          `[CanvasShorts] 📦 Feed page=${pageParam} response: ${res?.content?.length || 0} songs (total: ${res?.paginationMetaData?.totalCount ?? "?"})`
        );
        return res;
      } catch (e: any) {
        console.error(`[CanvasShorts] ❌ Feed fetch error:`, e?.response?.status, e?.message);
        throw e;
      }
    },
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
    staleTime: 0,
  });

  // Consolidate unique songs list directly from the Canvas Feed (no non-canvas fallbacks)
  const songs: Song[] = useMemo(() => {
    const rawFeed = feedData?.pages?.flatMap((p) => p.content || []) || [];
    const seen = new Set<string>();
    const result: Song[] = [];

    // If navigated with a specific songId, pin it at the top until user refreshes
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
    console.log(`[CanvasShorts] 🎶 Consolidated songs count: ${result.length} (from ${rawFeed.length} raw items)`);
    return result;
  }, [feedData?.pages, params.songId, targetSong]);

  // Sync server-returned isLiked and likesCount from the feed items
  useEffect(() => {
    if (songs.length > 0) {
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
    }
  }, [songs]);

  // Initial song jump if songId param is passed
  useEffect(() => {
    if (params.songId && songs.length > 0 && !hasRefreshedRef.current) {
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

  // Scroll navigation helpers for tap and remote lock screen commands
  const handleScrollToNext = useCallback(() => {
    setActiveIndex((prev) => {
      const nextIdx = Math.min(prev + 1, songs.length - 1);
      if (nextIdx !== prev) {
        flatListRef.current?.scrollToIndex({ index: nextIdx, animated: true });
      }
      return nextIdx;
    });
  }, [songs.length]);

  const handleScrollToPrev = useCallback(() => {
    setActiveIndex((prev) => {
      const prevIdx = Math.max(prev - 1, 0);
      if (prevIdx !== prev) {
        flatListRef.current?.scrollToIndex({ index: prevIdx, animated: true });
      }
      return prevIdx;
    });
  }, []);

  // 4. Audio Isolation: Pause main listening session when entering Shorts; restore lock screen on exit
  useEffect(() => {
    if (isScreenFocused) {
      // Pause main listening session so audio does not overlap
      audioPlayerService.pause();
    } else {
      // Pause shorts preview audio when user leaves Shorts screen/tab
      try {
        shortsPlayerRef.current?.pause();
        shortsPlayerRef.current = null;
      } catch {}
      setIsShortsPlaying(false);

      // Re-configure audio priority and restore lock screen for the main listening session
      configureAudioPriority(true)
        .catch(() => {})
        .finally(() => {
          if (audioPlayerService.currentSong) {
            audioPlayerService.refreshLockScreen(true);
          }
        });
    }
  }, [isScreenFocused]);

  // 5. Isolated Preview Player: Plays the active short on an endless loop
  useEffect(() => {
    if (!isScreenFocused || !activeSong) {
      try {
        shortsPlayerRef.current?.pause();
      } catch {}
      setIsShortsPlaying(false);
      return;
    }

    const streamUrl = resolveStreamUrl(activeSong);
    if (!streamUrl) return;

    let isMounted = true;
    const startSec =
      typeof activeSong.previewStartTime === "number" && activeSong.previewStartTime > 0
        ? activeSong.previewStartTime
        : 0;
    const endSec =
      typeof activeSong.previewEndTime === "number" && activeSong.previewEndTime > startSec
        ? activeSong.previewEndTime
        : 0;

    // Clean up any existing player from the previous slide without calling native remove()
    // (native remove() deactivates the shared AVAudioSession and drops lock screen controls)
    if (shortsPlayerRef.current) {
      try {
        shortsPlayerRef.current.pause();
        shortsPlayerRef.current.volume = 0;
      } catch {}
      shortsPlayerRef.current = null;
    }

    const setupIsolatedPlayer = async () => {
      try {
        console.log(`[CanvasShorts] 🎵 Audio setup for "${activeSong.title}": streamUrl="${streamUrl}"`);
        let initialSeekDone = startSec <= 0;

        const onStatus = async (status: AudioStatus) => {
          if (!isMounted) return;
          setIsShortsPlaying(status.playing);

          // Handle lock screen next/previous commands while on Shorts
          if ((status as any)?.remoteCommand === "nextTrack") {
            handleScrollToNext();
            return;
          }
          if ((status as any)?.remoteCommand === "previousTrack") {
            handleScrollToPrev();
            return;
          }

          // Once player is loaded, perform initial hook window seek if needed
          if (!initialSeekDone && (status as any)?.isLoaded) {
            initialSeekDone = true;
            if (startSec > 0) {
              await safeSeek(shortsPlayerRef.current, startSec);
            }
          }

          // Looping preview hook window or track end
          if (endSec > 0 && status.currentTime >= endSec && !isPaused) {
            await safeSeek(shortsPlayerRef.current, startSec);
          } else if (status.didJustFinish && !isPaused) {
            await safeSeek(shortsPlayerRef.current, startSec);
            try {
              shortsPlayerRef.current?.play();
            } catch {}
          }
        };

        const player = createAudioPlayer(
          { uri: streamUrl },
          {
            keepAudioSessionActive: true,
            updateInterval: 250,
          }
        );
        player.volume = 1.0;
        player.loop = false; // Always keep native loop false; loop via onStatus didJustFinish
        player.muted = isMuted;
        player.addListener("playbackStatusUpdate", onStatus);
        shortsPlayerRef.current = player;

        // Configure lock screen controls for the currently active short
        const rawCover =
          (activeSong as any).coverUrl ||
          (activeSong as any).posterUrl ||
          activeSong.imageKey ||
          (activeSong as any).imageUrl;
        const artworkUrl =
          (typeof rawCover === "string" && rawCover.startsWith("http")
            ? rawCover
            : getImageUrl(rawCover, {
                width: 500,
                height: 500,
                focus: "auto",
                aspectRatio: "1-1",
                format: "jpg",
                quality: 85,
              })) || undefined;

        safeSetActiveForLockScreen(
          player,
          true,
          {
            title: activeSong.title || "One Melody Shorts",
            artist: activeSong.artistName || "Unknown Artist",
            albumTitle: "Shorts",
            artworkUrl,
          },
          {
            showSeekForward: false,
            showSeekBackward: false,
            showNextTrack: true,
            showPreviousTrack: true,
          },
          true
        );

        if (!isPaused && isScreenFocused) {
          try {
            player.play();
            setIsShortsPlaying(true);
          } catch {}
        } else {
          try {
            player.pause();
            setIsShortsPlaying(false);
          } catch {}
        }
      } catch (err) {
        console.warn("[CanvasShorts] Isolated player error:", err);
      }
    };

    setupIsolatedPlayer();

    return () => {
      isMounted = false;
      if (shortsPlayerRef.current) {
        try {
          shortsPlayerRef.current.pause();
          shortsPlayerRef.current.volume = 0;
        } catch {}
        shortsPlayerRef.current = null;
      }
    };
  }, [activeIndex, activeSong?.id, isScreenFocused]);

  // Handle Play / Pause state for isolated preview audio
  useEffect(() => {
    if (!shortsPlayerRef.current || !isScreenFocused) return;
    try {
      if (isPaused) {
        shortsPlayerRef.current.pause();
        setIsShortsPlaying(false);
      } else {
        shortsPlayerRef.current.play();
        setIsShortsPlaying(true);
      }
    } catch {}
  }, [isPaused, isScreenFocused]);

  // 6. Preload Audio for upcoming short (N+1) so audio buffers in background
  useEffect(() => {
    if (!isScreenFocused || songs.length === 0) return;

    const nextSong = songs[activeIndex + 1];
    if (!nextSong) return;

    const nextStreamUrl = resolveStreamUrl(nextSong);
    if (!nextStreamUrl) return;

    console.log(
      `[CanvasShorts] ⚡ Preloading audio for next short [${activeIndex + 1}]: "${nextSong.title}"`
    );

    preload({ uri: nextStreamUrl }, { preferredForwardBufferDuration: 15 }).catch((err) => {
      // Non-fatal: playback will fall back to live load if preload fails
      console.warn("[CanvasShorts] Next audio preload error (non-fatal):", err);
    });
  }, [activeIndex, songs, isScreenFocused]);

  // Handle Mute toggle for isolated preview audio
  useEffect(() => {
    if (shortsPlayerRef.current) {
      try {
        shortsPlayerRef.current.muted = isMuted;
      } catch {}
    }
  }, [isMuted]);

  // Cleanup isolated audio player on unmount and restore lock screen for main session
  useEffect(() => {
    return () => {
      try {
        shortsPlayerRef.current?.pause();
        shortsPlayerRef.current = null;
      } catch {}
      if (audioPlayerService.currentSong) {
        audioPlayerService.refreshLockScreen(true);
      }
    };
  }, []);

  // 6. Eager Preload: Next 2-3 songs audio, canvas video & artwork
  useEffect(() => {
    if (songs.length === 0) return;
    const nextTracks = songs.slice(activeIndex + 1, activeIndex + 4);
    nextTracks.forEach((track) => {
      // 1. Eagerly preload artwork
      if (track.imageKey) {
        const imgUrl = getImageUrl(track.imageKey, { width: 800, height: 1400 });
        if (imgUrl) Image.prefetch(imgUrl);
      }

      // 2. Eagerly preload audio stream with 15s forward buffer
      const streamUrl = resolveStreamUrl(track);
      if (streamUrl) {
        try {
          preload(streamUrl, { preferredForwardBufferDuration: 15 }).catch(() => {});
          fetch(streamUrl).catch(() => {});
        } catch {}
      }

      // 3. Eagerly fetch and cache upcoming canvas video
      const videoKey = track.videoKey || track.fullVideoKey;
      const canvasVideoUrl =
        (track as any)?.canvasVideoUrl || (videoKey ? getVideoUrl(videoKey) : null);
      if (canvasVideoUrl) {
        try {
          fetch(canvasVideoUrl).catch(() => {});
        } catch {}
      }
    });
  }, [activeIndex, songs]);

  // Pull to refresh with randomized fresh content
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
      console.warn("[CanvasShorts] Refresh error:", e);
    } finally {
      setIsRefreshing(false);
    }
  }, [queryClient]);

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
      const videoKey = item.videoKey || (item.fullVideoKey?.includes(".") ? item.fullVideoKey : null);
      const artistImageUrl = getImageUrl(item.imageKey, {
        width: 120,
        height: 120,
        aspectRatio: "1-1",
      });

      // Split multiple artists into clean individual names
      const artistNames = parseArtistNames(item.artistName);
      const primaryArtist = artistNames[0] || item.artistName || "Unknown Artist";
      const shouldMountVideo = (isActive || index === activeIndex + 1) && Boolean(videoKey);

      if (isActive) {
        console.log(
          `[CanvasShorts] 🎯 Active slide [${index}]: id=${item.id}, title="${item.title}", videoKey="${videoKey}", shouldMount=${shouldMountVideo}, isActive=${isActive}, isScreenFocused=${isScreenFocused}, isPaused=${isPaused}`
        );
      }

      return (
        <View style={[styles.pageContainer, { height: containerHeight }]}>
          <TouchableWithoutFeedback onPress={handleScreenPress}>
            <View style={StyleSheet.absoluteFill}>
              {/* Full-screen Edge-to-Edge Looping Canvas Video Backdrop */}
              {shouldMountVideo ? (
                <CanvasVideoPlayer
                  videoUrl={(item as any)?.canvasVideoUrl}
                  videoKey={videoKey}
                  fallbackImageKey={item.imageKey}
                  isPlaying={isActive && isScreenFocused && !isPaused}
                  showFallbackImage={true}
                  showLoader={false}
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

            {/* Play on Main Player Action */}
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

            {/* Share Button */}
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

            {/* Non-Pressable Revolving Vinyl Disc */}
            <SpinningVinylDisc
              isActive={isActive && isShortsPlaying && !isPaused && isScreenFocused}
              imageUrl={artistImageUrl}
            />
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
            if (hasNextPage && !isFetchingNextPage) {
              fetchNextPage();
            }
          }}
          onEndReachedThreshold={1.5}
          initialNumToRender={1}
          maxToRenderPerBatch={2}
          windowSize={3}
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
