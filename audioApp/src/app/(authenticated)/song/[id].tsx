import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  GestureResponderEvent,
  ScrollView,
  Linking,
  Modal,
  Animated,
  Easing,
  LayoutAnimation,
  Platform,
  UIManager,
  Share,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import * as ScreenOrientation from "expo-screen-orientation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSelector, useDispatch } from "react-redux";
import { AppState } from "@/store/hook";
import { homeService, favouriteService, artistService, interactionService } from "@/service";
import { audioPlayerService } from "@/service/audioPlayerService";
import { useLyrics } from "@/hooks/useLyrics";
import { useSongInfo } from "@/hooks/useSongInfo";
import {
  playSong,
  nextTrack,
  prevTrack,
  dislikeCurrentSong,
  toggleShuffle,
  toggleRepeat,
  setDominantColor,
  selectIsFavourite,
  toggleFavourite,
  selectIsSongInAnyPlaylist,
} from "@/store";
import { CanvasVideoPlayer, QueueModal, FullVideoPlayerModal, PlayerSettingsModal, AddToPlaylistModal, DEFAULT_AUDIO_QUALITIES } from "@/components";
import { formatDuration, getImageUrl, getVideoUrl, useDominantColor, configureAudioPriority, S3_BASE_URL } from "@/utils";
import { hapticFeedback } from "@/utils/haptics";
import { usePanGesture, GestureDetector } from "react-native-gesture-handler";
import { songStyles as styles } from "@/styles";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const SIDE = 18;


type ViewMode = "canvas" | "artwork";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const WIKI_IMAGE_HEADERS = {
  "User-Agent": "OneMelodyAudioApp/1.0 (https://onemelody.com; support@onemelody.com)",
};

export default function SongDetailScreen() {
  const { id, mode } = useLocalSearchParams<{ id: string; mode?: string }>();
  const router = useRouter();
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const safeAreaHeight = Math.max(560, SCREEN_HEIGHT - insets.top);
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(mode === "video");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAddToPlaylistOpen, setIsAddToPlaylistOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(mode === "video" ? "artwork" : "canvas");
  const autoOpenedVideoIdRef = useRef<string | null>(null);
  const [isArtistImageModalOpen, setIsArtistImageModalOpen] = useState(false);

  // Tactile pulse animation for heart/like toggle
  const heartScaleAnim = useRef(new Animated.Value(1)).current;

  // Redux Player & Queue State
  const currentSong = useSelector((state: AppState) => state.player.currentSong);
  const isPlaying = useSelector((state: AppState) => state.player.isPlaying);
  const isLoading = useSelector((state: AppState) => state.player.isLoading);
  const currentTime = useSelector((state: AppState) => state.player.currentTime);
  const duration = useSelector((state: AppState) => state.player.duration);
  const bufferedTime = useSelector((state: AppState) => state.player.bufferedTime || 0);
  const repeatMode = useSelector((state: AppState) => state.queue.repeatMode);
  const isShuffle = useSelector((state: AppState) => state.queue.isShuffle);
  const queue = useSelector((state: AppState) => state.queue.queue);
  const currentIndex = useSelector((state: AppState) => state.queue.currentIndex);

  // Tactile artwork scale animation when playing (1.0) vs paused (0.90)
  const artworkPlayingScaleAnim = useRef(new Animated.Value(isPlaying ? 1 : 0.9)).current;

  useEffect(() => {
    Animated.spring(artworkPlayingScaleAnim, {
      toValue: isPlaying ? 1 : 0.9,
      friction: 8,
      tension: 40,
      useNativeDriver: true,
    }).start();
  }, [isPlaying]);

  // Local seekbar scrub / tap tracking to eliminate UI flicker during seeks
  const [progressBarWidth, setProgressBarWidth] = useState(0);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubTime, setScrubTime] = useState<number | null>(null);

  const upcomingCount = useMemo(() => {
    if (!queue || queue.length === 0) return 0;
    return Math.max(0, queue.length - (currentIndex + 1));
  }, [queue, currentIndex]);

  // Load song metadata from backend if needed (fallback if not already active in player)
  const { data: fetchedSong, isLoading: isFetching, isError, error } = useQuery({
    queryKey: ["song", id],
    queryFn: () => homeService.getSongById(id!),
    enabled: Boolean(id && (!currentSong || currentSong.id !== id)),
  });

  // Effective song to display: prefer currentSong from player state if matching id, then queue, fallback to fetchedSong
  const activeSong =
    currentSong && String(currentSong.id) === String(id)
      ? currentSong
      : (queue?.find((s) => String(s.id) === String(id)) || fetchedSong || currentSong);
  const targetSongId = (activeSong?.id || id) ? String(activeSong?.id || id) : undefined;
  const isLiked = useSelector((state: AppState) => selectIsFavourite(state, targetSongId));
  const isSongInAnyPlaylist = useSelector((state: AppState) =>
    selectIsSongInAnyPlaylist(state, targetSongId)
  );

  // Synced lyrics hook (with LRCLIB ID or title/artist fallback)
  const {
    currentLine,
    nextLine,
    transcriptions,
    plainLyrics,
    hasLyrics,
  } = useLyrics(
    activeSong?.lrclibId,
    currentTime,
    activeSong?.title,
    activeSong?.artistName,
    activeSong?.duration
  );

  const canShowLyrics = Boolean(hasLyrics);

  // Song description and biography from Wikipedia (like audioFrontend)
  const { data: songInfo, isLoading: isSongInfoLoading } = useSongInfo(
    activeSong?.title,
    activeSong?.artistName
  );

  // Natural aspect ratio for the artist Wikipedia photo (clamped between 0.72 portrait and 1.33 landscape)
  const artistImgAspectRatio = useMemo(() => {
    if (songInfo?.artist?.imageWidth && songInfo?.artist?.imageHeight) {
      const ratio = songInfo.artist.imageWidth / songInfo.artist.imageHeight;
      return Math.max(0.72, Math.min(1.33, ratio));
    }
    return 1;
  }, [songInfo?.artist?.imageWidth, songInfo?.artist?.imageHeight]);

  const posterUrl =
    (activeSong as any)?.posterUrl ||
    (activeSong as any)?.coverUrl ||
    (activeSong?.imageKey
      ? getImageUrl(activeSong.imageKey, {
          width: 720,
          height: 720,
          focus: "auto",
          aspectRatio: "1-1",
          quality: 90,
        })
      : undefined);

  const fallbackKey = `${activeSong?.title || ""}-${activeSong?.artistName || ""}-${activeSong?.id || ""}`;
  const dominantTheme = useDominantColor(posterUrl, fallbackKey);

  useEffect(() => {
    if (dominantTheme?.dominantColor) {
      dispatch(setDominantColor(dominantTheme.dominantColor));
    }
  }, [dominantTheme?.dominantColor, dispatch]);

  // Check favourites status from query cache
  const { data: favouritesData } = useQuery({
    queryKey: ["favourites-check"],
    queryFn: () => favouriteService.getFavourites(0, 50),
  });

  // Artist metadata (artistId for profile navigation)
  const { data: artistFollowData } = useQuery({
    queryKey: ["artist-follow-status", activeSong?.artistName],
    queryFn: () => artistService.getFollowStatus(activeSong!.artistName),
    enabled: Boolean(activeSong?.artistName),
    staleTime: 1000 * 60 * 5,
  });

  const handleOpenArtist = () => {
    if (artistFollowData?.artistId) {
      router.push({
        pathname: "/(authenticated)/artist/[id]",
        params: {
          id: artistFollowData.artistId,
          name: activeSong?.artistName,
        },
      });
    }
  };



  // Synchronize route param id with currentSong when track advances
  useEffect(() => {
    if (currentSong?.id && currentSong.id !== id) {
      router.setParams({ id: currentSong.id });
    }
  }, [currentSong?.id, id]);

  // Screen focus hook: ensure lock screen controls and audio priority remain solid when viewing full player
  useFocusEffect(
    useCallback(() => {
      const timer = setTimeout(async () => {
        await configureAudioPriority();
        audioPlayerService.refreshLockScreen();
      }, 80);
      return () => {
        clearTimeout(timer);
      };
    }, [currentSong?.id])
  );

  // Only auto-play if page is loaded directly with NO song currently playing in the app (cold start deep link)
  const hasAutoPlayedRef = useRef(false);
  useEffect(() => {
    if (!currentSong && fetchedSong && !hasAutoPlayedRef.current) {
      hasAutoPlayedRef.current = true;
      (dispatch as any)(playSong(fetchedSong));
    }
  }, [currentSong, fetchedSong]);

  const hasCanvas = Boolean(
    activeSong?.videoKey &&
    typeof activeSong.videoKey === "string" &&
    activeSong.videoKey.trim().length > 0 &&
    activeSong.videoKey !== "null" &&
    activeSong.videoKey !== "undefined"
  );

  const effectiveVideoUrl = useMemo(() => {
    if (activeSong?.fullVideoKey) {
      return `${S3_BASE_URL}/${activeSong.fullVideoKey}/master.m3u8`;
    }
    if (activeSong?.videoKey) {
      return getVideoUrl(activeSong.videoKey);
    }
    return undefined;
  }, [activeSong?.fullVideoKey, activeSong?.videoKey]);

  const hasFullVideo = Boolean(effectiveVideoUrl);

  // Automatically open video section if pushed with mode="video"
  useEffect(() => {
    if (mode === "video") {
      audioPlayerService.pause();
      if (
        activeSong?.id &&
        effectiveVideoUrl &&
        autoOpenedVideoIdRef.current !== String(activeSong.id)
      ) {
        autoOpenedVideoIdRef.current = String(activeSong.id);
        setIsVideoModalOpen(true);
      }
    }
  }, [mode, activeSong?.id, effectiveVideoUrl]);

  // If track has no canvas, effective mode is ALWAYS "artwork" — never leave user stranded in canvas mode
  const effectiveViewMode: ViewMode = hasCanvas ? viewMode : "artwork";

  // Available switcher modes based on media availability
  const availableModes = useMemo(() => {
    const modes: Array<{ key: "canvas" | "artwork" | "video"; label: string }> = [];
    if (hasCanvas) {
      modes.push({ key: "canvas", label: "Canvas" });
    }
    modes.push({ key: "artwork", label: "Artwork" });
    if (hasFullVideo) {
      modes.push({ key: "video", label: "Video" });
    }
    return modes;
  }, [hasCanvas, hasFullVideo]);

  // When activeSong changes (next track clicked or song ends):
  // If the new track does not have canvas, immediately switch to artwork mode; if it has canvas, default to canvas.
  const currentTrackId = activeSong?.id ? String(activeSong.id) : undefined;
  const lastTrackIdRef = useRef<string | undefined>(currentTrackId);
  useEffect(() => {
    if (currentTrackId && currentTrackId !== lastTrackIdRef.current) {
      lastTrackIdRef.current = currentTrackId;
      if (hasCanvas && mode !== "video") {
        setViewMode("canvas");
      } else {
        setViewMode("artwork");
      }
    } else if (!hasCanvas && viewMode === "canvas") {
      setViewMode("artwork");
    }
  }, [currentTrackId, hasCanvas, viewMode, mode]);

  // Navigation & mode switching handlers
  const handleDismissPlayer = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(authenticated)/(tabs)/home");
    }
  };

  const handleSelectMode = (mode: "canvas" | "artwork" | "video") => {
    hapticFeedback.selection();
    if (mode === "video") {
      // Direct full screen mode: pause audio and launch FullVideoPlayerModal
      audioPlayerService.pause();
      setIsVideoModalOpen(true);
      return;
    }
    if (mode !== viewMode) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setViewMode(mode);
    }
  };

  const handleNextMode = () => {
    if (availableModes.length <= 1) return;
    const currentIndex = availableModes.findIndex((m) => m.key === effectiveViewMode);
    if (currentIndex >= 0 && currentIndex < availableModes.length - 1) {
      const nextMode = availableModes[currentIndex + 1];
      handleSelectMode(nextMode.key);
    }
  };

  const handlePrevMode = () => {
    if (availableModes.length <= 1) return;
    const currentIndex = availableModes.findIndex((m) => m.key === effectiveViewMode);
    if (currentIndex > 0) {
      const prevMode = availableModes[currentIndex - 1];
      handleSelectMode(prevMode.key);
    }
  };

  const handleVideoModalClose = (finalTimestamp: number) => {
    setIsVideoModalOpen(false);
    setViewMode("artwork"); // Always return to artwork mode when video modal closes
    router.setParams({ mode: "" });
    if (typeof finalTimestamp === "number" && finalTimestamp >= 0) {
      audioPlayerService.seek(finalTimestamp);
      audioPlayerService.resume();
    }
  };

  const handleVideoTrackEnd = async () => {
    // Look ahead to the next track in queue
    const nextIndex = currentIndex + 1;
    let nextSong: any = undefined;

    if (nextIndex < queue.length) {
      nextSong = queue[nextIndex];
    } else if (repeatMode === "all" && queue.length > 0) {
      nextSong = queue[0];
    }

    const nextHasVideo = Boolean(nextSong?.fullVideoKey || nextSong?.videoStreamUrl);

    if (nextSong && nextHasVideo) {
      // Next track also has a full video: advance track while keeping video modal open
      await (dispatch as any)(nextTrack(false));
      // Ensure audio doesn't double-play since video player will play audio track
      audioPlayerService.pause();
    } else {
      // Next track has no video (or queue reached end):
      // Close video modal, lock back to portrait, return to artwork mode, and advance
      setIsVideoModalOpen(false);
      setViewMode("artwork");
      router.setParams({ mode: "" });
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
      await (dispatch as any)(nextTrack(false));
    }
  };

  // Gesture handler to slide horizontally between Canvas, Artwork, Video
  const stagePanGesture = usePanGesture({
    runOnJS: true,
    activeOffsetX: [-20, 20],
    onDeactivate: (e) => {
      const { translationX, translationY, velocityX } = e;

      // Horizontal Slide: switch between Canvas, Artwork, and Video
      if (
        Math.abs(translationX) > 35 &&
        Math.abs(translationX) > Math.abs(translationY) * 1.05
      ) {
        if (translationX < -35 || velocityX < -250) {
          // Swiped Right-to-Left (user dragged left) -> Advance to next mode
          handleNextMode();
        } else if (translationX > 35 || velocityX > 250) {
          // Swiped Left-to-Right (user dragged right):
          // Only switch back to previous view mode if there is one (e.g. artwork -> canvas or video -> artwork).
          // Dismissing the player on right swipe is removed because the OS already natively supports the back gesture.
          const currentIndex = availableModes.findIndex((m) => m.key === effectiveViewMode);
          if (currentIndex > 0 && effectiveViewMode !== "canvas") {
            handlePrevMode();
          }
        }
      }
    },
  });

  const topBarGesture = usePanGesture({
    runOnJS: true,
    activeOffsetY: [0, 15],
    onDeactivate: (e) => {
      if (e.translationY > 35) {
        handleDismissPlayer();
      }
    },
  });

  if (isFetching && !activeSong) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#FFFFFF" />
        <Text style={styles.loadingText}>Loading track...</Text>
      </SafeAreaView>
    );
  }

  if (isError || !activeSong) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <Ionicons name="alert-circle-outline" size={48} color="#FFFFFF" />
        <Text style={styles.errorTitle}>Song Not Found</Text>
        <Text style={styles.errorText}>
          {error instanceof Error ? error.message : "Unable to load song details"}
        </Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const effectiveDuration = duration > 0 ? duration : (activeSong.duration || 0);
  const displayTime = isScrubbing && scrubTime !== null ? scrubTime : currentTime;
  const progressPercent =
    effectiveDuration > 0
      ? Math.min(100, Math.max(0, (displayTime / effectiveDuration) * 100))
      : 0;

  const effectiveBuffer = Math.max(bufferedTime, displayTime);
  const bufferPercent =
    effectiveDuration > 0
      ? Math.min(100, Math.max(progressPercent, (effectiveBuffer / effectiveDuration) * 100))
      : 0;

  const calculateSecondsFromEvent = (e: GestureResponderEvent) => {
    const barWidth = progressBarWidth > 0 ? progressBarWidth : (SCREEN_WIDTH - SIDE * 2);
    const { locationX } = e.nativeEvent;
    const ratio = Math.max(0, Math.min(1, locationX / barWidth));
    return ratio * effectiveDuration;
  };

  const handleSeekStart = (e: GestureResponderEvent) => {
    hapticFeedback.selection();
    const targetSeconds = calculateSecondsFromEvent(e);
    setIsScrubbing(true);
    setScrubTime(targetSeconds);
  };

  const handleSeekMove = (e: GestureResponderEvent) => {
    const targetSeconds = calculateSecondsFromEvent(e);
    setScrubTime(targetSeconds);
  };

  const handleSeekEnd = (e: GestureResponderEvent) => {
    hapticFeedback.medium();
    const targetSeconds = calculateSecondsFromEvent(e);
    setIsScrubbing(false);
    setScrubTime(null);
    audioPlayerService.seek(targetSeconds);
  };

  const handleSeekCancel = () => {
    setIsScrubbing(false);
    setScrubTime(null);
  };

  const handleTogglePlay = () => {
    hapticFeedback.medium();
    audioPlayerService.togglePlay();
  };

  const handleNextTrack = () => {
    hapticFeedback.light();
    (dispatch as any)(nextTrack(true));
  };

  const handlePrevTrack = () => {
    hapticFeedback.light();
    (dispatch as any)(prevTrack());
  };

  const handleToggleShuffle = () => {
    hapticFeedback.selection();
    dispatch(toggleShuffle());
  };

  const handleToggleRepeat = () => {
    hapticFeedback.selection();
    dispatch(toggleRepeat());
  };

  const handleToggleLike = async () => {
    const songToToggle = activeSong || (targetSongId ? ({ id: targetSongId, title: "Song" } as any) : null);
    if (!songToToggle) return;
    const nextLiked = !isLiked;
    if (nextLiked) {
      hapticFeedback.success();
      Animated.sequence([
        Animated.timing(heartScaleAnim, {
          toValue: 1.35,
          duration: 130,
          easing: Easing.out(Easing.back(2)),
          useNativeDriver: true,
        }),
        Animated.spring(heartScaleAnim, {
          toValue: 1,
          friction: 4,
          tension: 100,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      hapticFeedback.light();
      Animated.sequence([
        Animated.timing(heartScaleAnim, {
          toValue: 0.8,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.spring(heartScaleAnim, {
          toValue: 1,
          useNativeDriver: true,
        }),
      ]).start();
    }
    try {
      await dispatch(toggleFavourite(songToToggle) as any).unwrap();
      queryClient.invalidateQueries({ queryKey: ["favourites"] });
      queryClient.invalidateQueries({ queryKey: ["favourites-check"] });
    } catch (e) {
      console.warn("[SongDetail] Toggle favourite error:", e);
    }
  };

  const handleDislikeSong = async () => {
    hapticFeedback.medium();
    await (dispatch as any)(dislikeCurrentSong());
  };

  const handleShareSong = async () => {
    const songToShare = activeSong || fetchedSong;
    if (!songToShare) return;
    hapticFeedback.light();
    try {
      const shareUrl = `https://audiomelody.me/song/${songToShare.id}`;
      const result = await Share.share({
        title: songToShare.title,
        message: `Listen to "${songToShare.title}" by ${songToShare.artistName} on One Melody: ${shareUrl}`,
        url: shareUrl,
      });
      if (result.action === Share.sharedAction) {
        interactionService.recordShare(songToShare.id);
      }
    } catch {
      // User cancelled share
    }
  };

  return (
    <View style={styles.root}>
      {/* 1. Base Ambient Blurred Backdrop & Dominant Color Gradient */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {posterUrl ? (
          <Image
            source={{ uri: posterUrl }}
            style={styles.ambientBlurImage}
            contentFit="cover"
            blurRadius={65}
            cachePolicy="memory"
          />
        ) : null}
        <LinearGradient
          colors={dominantTheme.gradientColors}
          locations={[0, 0.28, 0.58, 0.88, 1]}
          style={StyleSheet.absoluteFill}
        />
      </View>

      {/* 2. Full-Screen Canvas Video Backdrop */}
      {hasCanvas && activeSong.videoKey && effectiveViewMode === "canvas" ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <CanvasVideoPlayer
            videoUrl={(activeSong as any)?.canvasVideoUrl}
            videoKey={activeSong.videoKey}
            fallbackImageKey={null}
            isPlaying={isPlaying && !isVideoModalOpen}
            style={StyleSheet.absoluteFill}
          />
          {/* Multi-layered cinematic gradient wash for contrast */}
          <LinearGradient
            colors={[
              "rgba(0, 0, 0, 0.72)",
              "rgba(0, 0, 0, 0.2)",
              "rgba(0, 0, 0, 0.4)",
              "rgba(18, 18, 18, 0.94)",
              "#121212",
            ]}
            locations={[0, 0.28, 0.6, 0.88, 1]}
            style={StyleSheet.absoluteFill}
          />
        </View>
      ) : null}

      <SafeAreaView
        edges={["top","left","right"]}
        style={[
          styles.container,
          styles.containerTransparent,
        ]}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          bounces={true}
          scrollEnabled={!isScrubbing}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(36, insets.bottom + 24) },
          ]}
        >
          {/* Main Full-Screen Player: exactly 100% viewport height */}
          <View
            style={[
              styles.playerScreenSection,
              {
                minHeight: safeAreaHeight,
                paddingBottom: Math.max(28, insets.bottom + 12),
              },
            ]}
          >
            {/* 2. Top Navigation Bar with Down-Swipe Dismiss */}
            <GestureDetector gesture={topBarGesture}>
              <View style={styles.topBar}>
                <TouchableOpacity
                  style={styles.topBarCircleBtn}
                  onPress={handleDismissPlayer}
                  hitSlop={14}
                  activeOpacity={0.75}
                >
                  <Ionicons name="chevron-down" size={24} color="#FFFFFF" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.topBarTitleContainer}
                  activeOpacity={activeSong.album ? 0.7 : 1}
                  onPress={() => {
                    if (activeSong.album) {
                      router.push(`/album/${encodeURIComponent(activeSong.album)}` as any);
                    }
                  }}
                >
                  <Text style={styles.topBarSubtitle}>
                    {activeSong.album ? "PLAYING FROM ALBUM" : "PLAYING FROM ONE MELODY"}
                  </Text>
                  <Text style={styles.topBarTitle} numberOfLines={1}>
                    {activeSong.album || activeSong.genre || "Featured Collection"}
                  </Text>
                </TouchableOpacity>

                <View style={styles.topBarRightActions}>
                  <TouchableOpacity
                    style={styles.topBarCircleBtn}
                    hitSlop={14}
                    onPress={() => {
                      hapticFeedback.light();
                      setIsSettingsOpen(true);
                    }}
                    activeOpacity={0.75}
                  >
                    <Ionicons name="settings-outline" size={20} color="#FFFFFF" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.topBarCircleBtn}
                    hitSlop={14}
                    onPress={() => {
                      hapticFeedback.light();
                      setIsQueueOpen(true);
                    }}
                    activeOpacity={0.75}
                  >
                    <Ionicons name="list" size={22} color="#FFFFFF" />
                    {upcomingCount > 0 ? (
                      <View style={styles.queueCounterBadge}>
                        <Text style={styles.queueCounterText}>
                          {upcomingCount}
                        </Text>
                      </View>
                    ) : null}
                  </TouchableOpacity>
                </View>
              </View>
            </GestureDetector>

            {/* 3. Center Stage: Canvas / Artwork with Slide Gestures between Modes & Down-Swipe Dismiss */}
            <GestureDetector gesture={stagePanGesture}>
              <View style={styles.centerStage}>
                {/* Unified Mode Switcher Pill (Canvas, Artwork, Video) */}
                {availableModes.length > 1 ? (
                  <View style={styles.modeSwitcherContainer}>
                    <View style={styles.modeSwitcherPill}>
                      {availableModes.map((mode) => {
                        const isActive = effectiveViewMode === mode.key;
                        return (
                          <TouchableOpacity
                            key={mode.key}
                            style={[
                              styles.modeOptionBtn,
                              isActive && styles.modeOptionBtnActive,
                            ]}
                            onPress={() => handleSelectMode(mode.key)}
                            activeOpacity={0.8}
                          >
                            <View style={styles.modeOptionContent}>
                              {mode.key === "video" ? (
                                <Ionicons
                                  name="play"
                                  size={10}
                                  color={isActive ? "#000000" : "rgba(255, 255, 255, 0.75)"}
                                  style={{ marginRight: 4 }}
                                />
                              ) : null}
                              <Text
                                style={[
                                  styles.modeOptionText,
                                  isActive && styles.modeOptionTextActive,
                                ]}
                              >
                                {mode.label}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                ) : null}

                {/* Mode Stage Display: Centered 1:1 image for artwork with subtle scale */}
                <View
                  style={styles.artworkStageBox}
                  pointerEvents={effectiveViewMode === "artwork" ? "auto" : "none"}
                >
                  {effectiveViewMode === "artwork" ? (
                    <Animated.View
                      style={[
                        styles.artworkShadowContainer,
                        {
                          shadowColor: dominantTheme?.dominantColor || "#FFFFFF",
                          transform: [{ scale: artworkPlayingScaleAnim }],
                        },
                      ]}
                    >
                      <View style={styles.artworkWrapper}>
                        <Image
                          source={{ uri: posterUrl }}
                          style={styles.artworkImage}
                          contentFit="cover"
                          transition={200}
                          cachePolicy="memory"
                        />
                      </View>
                    </Animated.View>
                  ) : null}
                </View>
              </View>
            </GestureDetector>

        {/* 4. Song Metadata & Like Action */}
        <View style={styles.metaSection}>
          <View style={styles.titleContainer}>
            <Text style={styles.songTitle} numberOfLines={1}>
              {activeSong.title}
            </Text>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={handleOpenArtist}
              hitSlop={{ top: 8, bottom: 8, left: 0, right: 14 }}
            >
              <Text style={styles.artistName} numberOfLines={1}>
                {activeSong.artistName}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            {/* Share Song Button */}
            <TouchableOpacity
              hitSlop={14}
              onPress={handleShareSong}
              style={styles.likeButton}
              activeOpacity={0.75}
              accessibilityLabel="Share song"
            >
              <Ionicons
                name="share-outline"
                size={23}
                color="rgba(255, 255, 255, 0.75)"
              />
            </TouchableOpacity>

            {/* Dislike / Hide Button */}
            <TouchableOpacity
              hitSlop={14}
              onPress={handleDislikeSong}
              style={styles.likeButton}
              activeOpacity={0.75}
              accessibilityLabel="Don't recommend this song"
            >
              <Ionicons
                name="thumbs-down-outline"
                size={22}
                color="rgba(255, 255, 255, 0.75)"
              />
            </TouchableOpacity>

            {/* Add to Playlist Button */}
            <TouchableOpacity
              hitSlop={14}
              onPress={() => {
                hapticFeedback.light();
                setIsAddToPlaylistOpen(true);
              }}
              style={styles.likeButton}
              activeOpacity={0.75}
              accessibilityLabel="Add to playlist"
            >
              <Ionicons
                name={isSongInAnyPlaylist ? "checkmark-circle" : "add-circle-outline"}
                size={27}
                color={isSongInAnyPlaylist ? "#FFFFFF" : "rgba(255, 255, 255, 0.75)"}
              />
            </TouchableOpacity>

            {/* Like/Heart Button */}
            <TouchableOpacity
              hitSlop={14}
              onPress={handleToggleLike}
              style={styles.likeButton}
              activeOpacity={0.75}
            >
              <Animated.View style={{ transform: [{ scale: heartScaleAnim }] }}>
                <Ionicons
                  name={isLiked ? "heart" : "heart-outline"}
                  size={28}
                  color={isLiked ? "#FF3B30" : "rgba(255, 255, 255, 0.75)"}
                />
              </Animated.View>
            </TouchableOpacity>
          </View>
        </View>

        {/* 5. Interactive Timeline / Scrubber */}
        <View style={styles.progressContainer}>
          <View
            style={styles.progressBarTouchArea}
            onLayout={(e) => {
              const w = e.nativeEvent.layout.width;
              if (w > 0) setProgressBarWidth(w);
            }}
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
            onResponderGrant={handleSeekStart}
            onResponderMove={handleSeekMove}
            onResponderRelease={handleSeekEnd}
            onResponderTerminate={handleSeekCancel}
            onResponderTerminationRequest={() => false}
            hitSlop={{ top: 14, bottom: 14, left: 0, right: 0 }}
          >
            <View style={styles.progressBarBackground} pointerEvents="none">
              <View
                style={[styles.progressBarBuffer, { width: `${bufferPercent}%` }]}
                pointerEvents="none"
              />
              <View
                style={[styles.progressBarFill, { width: `${progressPercent}%` }]}
                pointerEvents="none"
              >
                <View
                  style={[
                    styles.progressThumb,
                    isScrubbing && styles.progressThumbActive,
                  ]}
                  pointerEvents="none"
                />
              </View>
            </View>
          </View>

          <View style={styles.timeRow}>
            <Text style={[styles.timeText, isScrubbing && styles.timeTextScrubbing]}>
              {formatDuration(displayTime)}
            </Text>
            <Text style={styles.timeText}>{formatDuration(effectiveDuration)}</Text>
          </View>
        </View>

        {/* 6. Primary Monochrome Playback Controls */}
        <View style={styles.controlsRow}>
          {/* Shuffle */}
          <TouchableOpacity
            hitSlop={14}
            onPress={handleToggleShuffle}
            style={styles.controlIconBtn}
            activeOpacity={0.75}
          >
            <Ionicons
              name="shuffle"
              size={22}
              color={isShuffle ? "#FFFFFF" : "rgba(255, 255, 255, 0.35)"}
            />
            {isShuffle ? <View style={styles.activeDot} /> : <View style={styles.inactiveDot} />}
          </TouchableOpacity>

          {/* Skip Back / Previous */}
          <TouchableOpacity
            hitSlop={14}
            onPress={handlePrevTrack}
            style={styles.controlIconBtn}
            activeOpacity={0.75}
          >
            <Ionicons name="play-skip-back" size={28} color="#FFFFFF" />
          </TouchableOpacity>

          {/* Hero Play / Pause (Solid White on Black) */}
          <TouchableOpacity
            style={styles.mainPlayButton}
            activeOpacity={0.88}
            onPress={handleTogglePlay}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#000000" />
            ) : (
              <Ionicons
                name={isPlaying ? "pause" : "play"}
                size={32}
                color="#000000"
                style={isPlaying ? undefined : { marginLeft: 3 }}
              />
            )}
          </TouchableOpacity>

          {/* Skip Forward / Next */}
          <TouchableOpacity
            hitSlop={14}
            onPress={handleNextTrack}
            style={styles.controlIconBtn}
            activeOpacity={0.75}
          >
            <Ionicons name="play-skip-forward" size={28} color="#FFFFFF" />
          </TouchableOpacity>

          {/* Repeat */}
          <TouchableOpacity
            hitSlop={14}
            onPress={handleToggleRepeat}
            style={styles.controlIconBtn}
            activeOpacity={0.75}
          >
            <Ionicons
              name="repeat"
              size={22}
              color={repeatMode !== "none" ? "#FFFFFF" : "rgba(255, 255, 255, 0.35)"}
            />
            {repeatMode === "one" ? (
              <View style={styles.repeatBadge}>
                <Text style={styles.repeatBadgeText}>1</Text>
              </View>
            ) : null}
            {repeatMode === "all" ? <View style={styles.activeDot} /> : <View style={styles.inactiveDot} />}
          </TouchableOpacity>
        </View>
      </View>

        {/* 7. Spotify-Style Lyrics Preview Card below the player (only if lrclib is present and lyrics exist) */}
        {canShowLyrics ? (
          <View style={styles.lyricsSection}>
            <TouchableOpacity
              style={[
                styles.lyricsCard,
                dominantTheme?.dominantColor
                  ? { backgroundColor: `${dominantTheme.dominantColor}38` }
                  : undefined,
              ]}
              activeOpacity={0.88}
              onPress={() => {
                hapticFeedback.light();
                if (activeSong?.id) {
                  router.push({
                    pathname: "/(authenticated)/lyrics/[id]",
                    params: { id: activeSong.id },
                  });
                }
              }}
            >
              <View style={styles.lyricsCardHeader}>
                <View style={styles.lyricsCardTitleRow}>
                  <Ionicons name="musical-notes" size={17} color="#FFFFFF" />
                  <Text style={styles.lyricsCardTitle}>Lyrics</Text>
                </View>
                <View style={styles.lyricsCardMorePill}>
                  <Text style={styles.lyricsCardMoreText}>FULL SCREEN</Text>
                  <Ionicons name="expand-outline" size={13} color="#FFFFFF" />
                </View>
              </View>

              <View style={styles.lyricsCardContent}>
                {currentLine?.text ? (
                  <>
                    <View style={styles.lyricsActiveIndicatorRow}>
                      <View style={styles.lyricsActiveDot} />
                      <Text style={styles.lyricsLinePrimary} numberOfLines={2}>
                        {currentLine.text}
                      </Text>
                    </View>
                    {nextLine?.text ? (
                      <Text style={styles.lyricsLineSecondary} numberOfLines={1}>
                        {nextLine.text}
                      </Text>
                    ) : null}
                  </>
                ) : transcriptions.length > 0 ? (
                  <>
                    <View style={styles.lyricsActiveIndicatorRow}>
                      <View style={styles.lyricsActiveDot} />
                      <Text style={styles.lyricsLinePrimary} numberOfLines={2}>
                        {transcriptions[0].text}
                      </Text>
                    </View>
                    {transcriptions[1]?.text ? (
                      <Text style={styles.lyricsLineSecondary} numberOfLines={1}>
                        {transcriptions[1].text}
                      </Text>
                    ) : null}
                  </>
                ) : plainLyrics ? (
                  <Text style={styles.lyricsLinePrimary} numberOfLines={3}>
                    {plainLyrics.trim().split("\n").slice(0, 3).join("\n")}
                  </Text>
                ) : (
                  <Text style={styles.lyricsLineSecondary}>
                    Tap to open lyrics
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* 8. Song Description Section (Total Streams, Title, Artist, & About) */}
        <View style={styles.aboutSection}>
          <View style={styles.aboutCard}>
            {/* Header: Title and Streams Badge */}
            <View style={styles.aboutHeader}>
              <View style={styles.aboutTitleRow}>
                <Ionicons name="information-circle-outline" size={18} color="#FFFFFF" />
                <Text style={styles.aboutCardTitle}>About the Track</Text>
              </View>

              {activeSong.totalStreams !== undefined && activeSong.totalStreams !== null ? (
                <View style={styles.streamsBadge}>
                  <Ionicons name="play" size={10} color="#FFFFFF" style={{ marginRight: 4 }} />
                  <Text style={styles.streamsBadgeText}>
                    {Number(activeSong.totalStreams).toLocaleString()} plays
                  </Text>
                </View>
              ) : null}
            </View>

            {/* Track Name & Artist */}
            <View style={styles.aboutIdentityContainer}>
              <Text style={styles.aboutSongTitle} numberOfLines={2}>
                {activeSong.title}
              </Text>
              <Text style={styles.aboutArtistName} numberOfLines={1}>
                {activeSong.artistName}
              </Text>

              {/* Optional Album / Genre / Language Pills */}
              {(activeSong.album || activeSong.genre || activeSong.language) ? (
                <View style={styles.aboutPillsRow}>
                  {activeSong.album ? (
                    <TouchableOpacity
                      style={styles.aboutPill}
                      activeOpacity={0.7}
                      onPress={() => {
                        router.push(`/album/${encodeURIComponent(activeSong.album!)}` as any);
                      }}
                    >
                      <Ionicons name="disc-outline" size={11} color="#FFFFFF" style={{ marginRight: 4 }} />
                      <Text style={styles.aboutPillText} numberOfLines={1}>{activeSong.album}</Text>
                    </TouchableOpacity>
                  ) : null}

                  {activeSong.genre ? (
                    <View style={styles.aboutPill}>
                      <Ionicons name="musical-notes-outline" size={11} color="#FFFFFF" style={{ marginRight: 4 }} />
                      <Text style={styles.aboutPillText} numberOfLines={1}>{activeSong.genre}</Text>
                    </View>
                  ) : null}

                  {activeSong.language ? (
                    <View style={styles.aboutPill}>
                      <Ionicons name="globe-outline" size={11} color="#FFFFFF" style={{ marginRight: 4 }} />
                      <Text style={styles.aboutPillText}>{activeSong.language.toUpperCase()}</Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>

            {/* Wikipedia Story / Description */}
            <View style={styles.aboutBioContainer}>
              {songInfo?.song?.description ? (
                <>
                  <Text style={styles.aboutBioText}>
                    {songInfo.song.description}
                  </Text>
                  {songInfo.song.source ? (
                    <TouchableOpacity
                      activeOpacity={0.75}
                      onPress={() => Linking.openURL(songInfo.song.source!)}
                      style={styles.wikiLinkRow}
                    >
                      <Text style={styles.wikiLinkText}>View on Wikipedia</Text>
                      <Ionicons name="open-outline" size={12} color="#FFFFFF" />
                    </TouchableOpacity>
                  ) : null}
                </>
              ) : isSongInfoLoading ? (
                <View style={styles.aboutLoadingRow}>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text style={styles.aboutLoadingText}>Loading track story...</Text>
                </View>
              ) : (
                <Text style={styles.aboutBioText}>
                  {activeSong.title} is a {activeSong.genre || "featured"} release by {activeSong.artistName}
                  {activeSong.album ? ` from the album "${activeSong.album}"` : ""}.
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* 9. About the Artist Section (like audioFrontend RightInfoArtistSection) */}
        <View style={styles.artistSection}>
          <View style={styles.artistCard}>
            <View style={styles.artistCardHeader}>
              <Text style={styles.artistCardHeaderTitle}>About the Artist</Text>
            </View>

            {/* Artist Hero Banner - Displays full Wikipedia artist photo */}
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => {
                if (songInfo?.artist?.image) {
                  setIsArtistImageModalOpen(true);
                } else {
                  handleOpenArtist();
                }
              }}
              style={[
                styles.artistHeroWrapper,
                { aspectRatio: artistImgAspectRatio },
              ]}
            >
              {songInfo?.artist?.image ? (
                <Image
                  source={{
                    uri: songInfo.artist.image,
                    headers: WIKI_IMAGE_HEADERS,
                  }}
                  style={styles.artistHeroImage}
                  contentFit="cover"
                  contentPosition="top center"
                  cachePolicy="memory-disk"
                />
              ) : (
                <View style={styles.artistHeroFallback}>
                  <Text style={styles.artistHeroFallbackInitial}>
                    {activeSong.artistName?.charAt(0)?.toUpperCase() || "A"}
                  </Text>
                </View>
              )}

              {/* Dark Gradient Overlay */}
              <LinearGradient
                colors={["transparent", "rgba(0,0,0,0.3)", "rgba(0,0,0,0.92)"]}
                locations={[0, 0.55, 1]}
                style={StyleSheet.absoluteFill}
              />

              {/* Bottom Info on Hero */}
              <View style={styles.artistHeroBottomBar}>
                <TouchableOpacity
                  style={{ flex: 1 }}
                  activeOpacity={0.8}
                  onPress={handleOpenArtist}
                >
                  <Text style={styles.artistHeroName} numberOfLines={1}>
                    {songInfo?.artist?.name || activeSong.artistName}
                  </Text>
                  <View style={styles.artistHeroMetaRow}>
                    <Text style={styles.artistHeroRole}>Artist</Text>
                    {artistFollowData?.artistId ? (
                      <Ionicons
                        name="chevron-forward"
                        size={12}
                        color="rgba(255, 255, 255, 0.6)"
                        style={{ marginLeft: 2 }}
                      />
                    ) : null}
                  </View>
                </TouchableOpacity>

                {songInfo?.artist?.image ? (
                  <View style={styles.expandPill}>
                    <Ionicons name="expand-outline" size={14} color="#FFFFFF" />
                  </View>
                ) : null}
              </View>
            </TouchableOpacity>

            {/* Artist Biography Description */}
            <View style={styles.artistBioContainer}>
              {songInfo?.artist?.description ? (
                <>
                  <Text style={styles.artistBioText} numberOfLines={4}>
                    {songInfo.artist.description}
                  </Text>
                  {songInfo.artist.source ? (
                    <TouchableOpacity
                      activeOpacity={0.75}
                      onPress={() => Linking.openURL(songInfo.artist.source!)}
                      style={styles.wikiLinkRow}
                    >
                      <Text style={styles.wikiLinkText}>View on Wikipedia</Text>
                      <Ionicons name="open-outline" size={12} color="#FFFFFF" />
                    </TouchableOpacity>
                  ) : null}
                </>
              ) : isSongInfoLoading ? (
                <View style={styles.aboutLoadingRow}>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text style={styles.aboutLoadingText}>Loading artist story...</Text>
                </View>
              ) : (
                <Text style={styles.artistBioText}>
                  Explore more releases and trending tracks from {activeSong.artistName} on OneMelody.
                </Text>
              )}
            </View>
          </View>
        </View>
      </ScrollView>
        <QueueModal
          visible={isQueueOpen}
          onClose={() => setIsQueueOpen(false)}
        />

        {/* Playback Settings Modal */}
        <PlayerSettingsModal
          visible={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          mode="audio"
          audioQualities={DEFAULT_AUDIO_QUALITIES}
          onSpeedChange={(rate) => audioPlayerService.setPlaybackRate(rate)}
          onAudioQualityChange={(quality) => audioPlayerService.setAudioQuality(quality)}
        />

        {/* Full Video Modal: mounted when explicitly opened or navigated via Watch */}
        {isVideoModalOpen && effectiveVideoUrl ? (
          <FullVideoPlayerModal
            visible={isVideoModalOpen}
            videoStreamUrl={effectiveVideoUrl}
            initialTime={currentTime}
            title={activeSong?.title || ""}
            artistName={activeSong?.artistName || ""}
            artworkUrl={posterUrl}
            onClose={handleVideoModalClose}
            onTrackEnd={handleVideoTrackEnd}
          />
        ) : null}

        {/* Full Artist Image Modal: View uncropped, full-resolution Wikipedia image */}
        <Modal
          visible={isArtistImageModalOpen}
          transparent={false}
          animationType="fade"
          onRequestClose={() => setIsArtistImageModalOpen(false)}
        >
          <SafeAreaView style={styles.fullImageModalRoot}>
            <View style={styles.fullImageModalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fullImageModalTitle} numberOfLines={1}>
                  {songInfo?.artist?.name || activeSong.artistName}
                </Text>
                <Text style={styles.fullImageModalSubtitle}>Wikipedia Photo</Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsArtistImageModalOpen(false)}
                style={styles.fullImageModalCloseBtn}
                activeOpacity={0.8}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <View style={styles.fullImageModalContent}>
              {songInfo?.artist?.image ? (
                <Image
                  source={{
                    uri: songInfo.artist.image,
                    headers: WIKI_IMAGE_HEADERS,
                  }}
                  style={styles.fullImageModalImage}
                  contentFit="contain"
                  cachePolicy="memory-disk"
                />
              ) : null}
            </View>
          </SafeAreaView>
        </Modal>

        {/* 10. Add To Playlist Modal */}
        <AddToPlaylistModal
          visible={isAddToPlaylistOpen}
          onClose={() => setIsAddToPlaylistOpen(false)}
          song={activeSong || { id: targetSongId || id, title: "Song" }}
        />
      </SafeAreaView>
    </View>
  );
}

