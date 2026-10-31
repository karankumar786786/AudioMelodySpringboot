import { useEffect, useState, useMemo, useRef } from "react";
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
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as ScreenOrientation from "expo-screen-orientation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSelector, useDispatch } from "react-redux";
import { AppState } from "@/store/hook";
import { homeService, favouriteService, artistService } from "@/service";
import { audioPlayerService } from "@/service/audioPlayerService";
import { useLyrics } from "@/hooks/useLyrics";
import { useSongInfo } from "@/hooks/useSongInfo";
import {
  playSong,
  nextTrack,
  prevTrack,
  toggleShuffle,
  toggleRepeat,
} from "@/store";
import { CanvasVideoPlayer, QueueModal, FullVideoPlayerModal, PlayerSettingsModal, DEFAULT_AUDIO_QUALITIES } from "@/components";
import { formatDuration,  getImageUrl, useDominantColor,S3_BASE_URL } from "@/utils";
import { usePanGesture, GestureDetector } from "react-native-gesture-handler";
import { songStyles as styles } from "@/styles";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const SIDE = 18;


type ViewMode = "canvas" | "artwork";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function SongDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const safeAreaHeight = Math.max(560, SCREEN_HEIGHT - insets.top - insets.bottom);

  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("canvas");
  const [isLiked, setIsLiked] = useState(false);
  const [isArtistImageModalOpen, setIsArtistImageModalOpen] = useState(false);

  // Subtle fade and scale animation between canvas and artwork mode
  const modeFadeAnim = useRef(new Animated.Value(viewMode === "artwork" ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(modeFadeAnim, {
      toValue: viewMode === "artwork" ? 1 : 0,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [viewMode]);

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

  // Effective song to display: prefer currentSong from player state, fallback to fetchedSong
  const activeSong = currentSong || fetchedSong;

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
        params: { id: artistFollowData.artistId },
      });
    }
  };

  useEffect(() => {
    if (activeSong?.id && favouritesData?.content) {
      const isFav = favouritesData.content.some((s) => s.id === activeSong.id);
      setIsLiked(isFav);
    }
  }, [activeSong?.id, favouritesData?.content]);

  // Synchronize route param id with currentSong when track advances
  useEffect(() => {
    if (currentSong?.id && currentSong.id !== id) {
      router.setParams({ id: currentSong.id });
    }
  }, [currentSong?.id, id]);

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
  const hasFullVideo = Boolean(
    activeSong?.fullVideoKey &&
    typeof activeSong.fullVideoKey === "string" &&
    activeSong.fullVideoKey.trim().length > 0 &&
    activeSong.fullVideoKey !== "null" &&
    activeSong.fullVideoKey !== "undefined"
  );

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
  // If the new track does not have canvas, immediately switch to artwork mode with full opacity!
  useEffect(() => {
    if (!hasCanvas) {
      setViewMode("artwork");
      modeFadeAnim.setValue(1);
    } else {
      setViewMode("canvas");
      modeFadeAnim.setValue(0);
    }
  }, [activeSong?.id, hasCanvas]);

  // Navigation & mode switching handlers
  const handleDismissPlayer = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(authenticated)/(tabs)/home");
    }
  };

  const handleSelectMode = (mode: "canvas" | "artwork" | "video") => {
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
          // Swiped Left-to-Right (user dragged right)
          const currentIndex = availableModes.findIndex((m) => m.key === effectiveViewMode);
          if (effectiveViewMode === "canvas" || currentIndex <= 0) {
            // In canvas mode (or leftmost mode): back/home
            handleDismissPlayer();
          } else {
            // Return to previous mode (e.g. from artwork back to canvas)
            handlePrevMode();
          }
        }
      }
    },
  });

  const topBarGesture = usePanGesture({
    runOnJS: true,
    activeOffsetX: [-20, 20],
    activeOffsetY: [0, 15],
    onDeactivate: (e) => {
      if (e.translationY > 35) {
        handleDismissPlayer();
      } else if (e.translationX > 40 && (effectiveViewMode === "canvas" || !hasCanvas)) {
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

  const bufferPercent =
    effectiveDuration > 0
      ? Math.min(100, Math.max(0, (bufferedTime / effectiveDuration) * 100))
      : 0;

  const calculateSecondsFromEvent = (e: GestureResponderEvent) => {
    const barWidth = progressBarWidth > 0 ? progressBarWidth : (SCREEN_WIDTH - SIDE * 2);
    const { locationX } = e.nativeEvent;
    const ratio = Math.max(0, Math.min(1, locationX / barWidth));
    return ratio * effectiveDuration;
  };

  const handleSeekStart = (e: GestureResponderEvent) => {
    const targetSeconds = calculateSecondsFromEvent(e);
    setIsScrubbing(true);
    setScrubTime(targetSeconds);
  };

  const handleSeekMove = (e: GestureResponderEvent) => {
    const targetSeconds = calculateSecondsFromEvent(e);
    setScrubTime(targetSeconds);
  };

  const handleSeekEnd = (e: GestureResponderEvent) => {
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
    audioPlayerService.togglePlay();
  };

  const handleNextTrack = () => {
    (dispatch as any)(nextTrack(true));
  };

  const handlePrevTrack = () => {
    (dispatch as any)(prevTrack());
  };

  const handleToggleShuffle = () => {
    dispatch(toggleShuffle());
  };

  const handleToggleRepeat = () => {
    dispatch(toggleRepeat());
  };

  const handleToggleLike = async () => {
    const nextLiked = !isLiked;
    setIsLiked(nextLiked);
    try {
      if (nextLiked) {
        await favouriteService.addFavourite(activeSong.id);
      } else {
        await favouriteService.removeFavourite(activeSong.id);
      }
      queryClient.invalidateQueries({ queryKey: ["favourites"] });
      queryClient.invalidateQueries({ queryKey: ["favourites-check"] });
    } catch {
      setIsLiked(!nextLiked);
    }
  };

  return (
    <View style={styles.root}>
      {/* 1A. Full-Screen Canvas Video Backdrop (Smooth Cross-fade) */}
      {hasCanvas && activeSong.videoKey ? (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              opacity: modeFadeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 0],
              }),
            },
          ]}
          pointerEvents="none"
        >
          <CanvasVideoPlayer
            videoUrl={(activeSong as any)?.canvasVideoUrl}
            videoKey={activeSong.videoKey}
            fallbackImageKey={activeSong.imageKey}
            isPlaying={isPlaying && effectiveViewMode === "canvas" && !isVideoModalOpen}
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
        </Animated.View>
      ) : null}

      {/* 1B. Ambient Blurred Backdrop & Majority Dominant Color Gradient for Artwork Mode */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            opacity: hasCanvas
              ? modeFadeAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 1],
                })
              : 1,
          },
        ]}
        pointerEvents="none"
      >
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
      </Animated.View>

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
          contentContainerStyle={styles.scrollContent}
        >
          {/* Main Full-Screen Player: exactly 100% viewport height */}
          <View style={[styles.playerScreenSection, { minHeight: safeAreaHeight }]}>
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

                <View style={styles.topBarTitleContainer}>
                  <Text style={styles.topBarSubtitle}>PLAYING FROM ONE MELODY</Text>
                  <Text style={styles.topBarTitle} numberOfLines={1}>
                    {activeSong.album || activeSong.genre || "Featured Collection"}
                  </Text>
                </View>

                <View style={styles.topBarRightActions}>
                  <TouchableOpacity
                    style={styles.topBarCircleBtn}
                    hitSlop={14}
                    onPress={() => setIsSettingsOpen(true)}
                    activeOpacity={0.75}
                  >
                    <Ionicons name="settings-outline" size={20} color="#FFFFFF" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.topBarCircleBtn}
                    hitSlop={14}
                    onPress={() => setIsQueueOpen(true)}
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

                {/* Mode Stage Display: Centered 1:1 image for artwork with subtle fade & scale */}
                <View style={styles.artworkStageBox}>
                  <Animated.View
                    style={[
                      styles.artworkWrapper,
                      {
                        opacity: hasCanvas
                          ? modeFadeAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0, 1],
                            })
                          : 1,
                        transform: [
                          {
                            scale: hasCanvas
                              ? modeFadeAnim.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: [0.93, 1],
                                })
                              : 1,
                          },
                        ],
                      },
                    ]}
                    pointerEvents={effectiveViewMode === "artwork" ? "auto" : "none"}
                  >
                    <Image
                      source={{ uri: posterUrl }}
                      style={styles.artworkImage}
                      contentFit="cover"
                      transition={200}
                      cachePolicy="memory"
                    />
                  </Animated.View>
                </View>
              </View>
            </GestureDetector>

        {/* 4. Song Metadata & Like Action */}
        <View style={styles.metaSection}>
          <View style={styles.titleContainer}>
            <Text style={styles.songTitle} numberOfLines={1}>
              {activeSong.title}
            </Text>
            <Text style={styles.artistName} numberOfLines={1}>
              {activeSong.artistName}
            </Text>
          </View>

          <TouchableOpacity
            hitSlop={14}
            onPress={handleToggleLike}
            style={styles.likeButton}
            activeOpacity={0.75}
          >
            <Ionicons
              name={isLiked ? "heart" : "heart-outline"}
              size={26}
              color="#FFFFFF"
            />
          </TouchableOpacity>
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
            <Text style={styles.timeText}>{formatDuration(displayTime)}</Text>
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
              style={styles.lyricsCard}
              activeOpacity={0.88}
              onPress={() => {
                if (activeSong?.id) {
                  router.push({
                    pathname: "/(authenticated)/lyrics/[id]",
                    params: { id: activeSong.id },
                  });
                }
              }}
            >
              <View style={styles.lyricsCardHeader}>
                <Text style={styles.lyricsCardTitle}>Lyrics</Text>
                <View style={styles.lyricsCardMorePill}>
                  <Text style={styles.lyricsCardMoreText}>MORE</Text>
                  <Ionicons name="expand-outline" size={13} color="#FFFFFF" />
                </View>
              </View>

              <View style={styles.lyricsCardContent}>
                {currentLine?.text ? (
                  <>
                    <Text style={styles.lyricsLinePrimary} numberOfLines={2}>
                      {currentLine.text}
                    </Text>
                    {nextLine?.text ? (
                      <Text style={styles.lyricsLineSecondary} numberOfLines={1}>
                        {nextLine.text}
                      </Text>
                    ) : null}
                  </>
                ) : transcriptions.length > 0 ? (
                  <>
                    <Text style={styles.lyricsLinePrimary} numberOfLines={2}>
                      {transcriptions[0].text}
                    </Text>
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
                    <View style={styles.aboutPill}>
                      <Ionicons name="disc-outline" size={11} color="#FFFFFF" style={{ marginRight: 4 }} />
                      <Text style={styles.aboutPillText} numberOfLines={1}>{activeSong.album}</Text>
                    </View>
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
                  source={{ uri: songInfo.artist.image }}
                  style={styles.artistHeroImage}
                  contentFit="cover"
                  contentPosition="top center"
                  cachePolicy="memory"
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

        {/* Full Video Modal: only mounted when explicitly opened by user */}
        {isVideoModalOpen && activeSong?.fullVideoKey ? (
          <FullVideoPlayerModal
            visible={isVideoModalOpen}
            videoStreamUrl={`${S3_BASE_URL}/${activeSong.fullVideoKey}/master.m3u8`}
            initialTime={currentTime}
            title={activeSong.title}
            artistName={activeSong.artistName}
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
                  source={{ uri: songInfo.artist.image }}
                  style={styles.fullImageModalImage}
                  contentFit="contain"
                  cachePolicy="memory"
                />
              ) : null}
            </View>
          </SafeAreaView>
        </Modal>
      </SafeAreaView>
    </View>
  );
}

