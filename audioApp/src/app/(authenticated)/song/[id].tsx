import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Modal,
  Animated,
  Easing,
  LayoutAnimation,
  Platform,
  UIManager,
  Share,
  Dimensions,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import * as ScreenOrientation from "expo-screen-orientation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSelector, useDispatch } from "react-redux";
import { AppState, store } from "@/store/hook";
import {
  homeService,
  favouriteService,
  artistService,
  interactionService,
} from "@/service";
import { audioPlayerService } from "@/service/audioPlayerService";
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
import {
  CanvasVideoPlayer,
  QueueModal,
  FullVideoPlayerModal,
  PlayerSettingsModal,
  AddToPlaylistModal,
  DEFAULT_AUDIO_QUALITIES,
  PlayerTopBar,
  PlayerMetaRow,
  PlayerScrubber,
  PlayerControlsRow,
  PlayerLyricsPreviewCard,
  PlayerTrackAbout,
  PlayerArtistAbout,
} from "@/components";
import {
  getImageUrl,
  getVideoUrl,
  useDominantColor,
  configureAudioPriority,
  S3_BASE_URL,
} from "@/utils";
import { hapticFeedback } from "@/utils/haptics";
import { usePanGesture, GestureDetector } from "react-native-gesture-handler";
import { songStyles as styles } from "@/styles";

type ViewMode = "canvas" | "artwork";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const WIKI_IMAGE_HEADERS = {
  "User-Agent":
    "OneMelodyAudioApp/1.0 (https://onemelody.com; support@onemelody.com)",
};

export default function SongDetailScreen() {
  const { id, mode } = useLocalSearchParams<{ id: string; mode?: string }>();
  const router = useRouter();
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const safeAreaHeight = Math.max(560, (windowHeight || Dimensions.get("window").height) - insets.top);

  // Modal and view states
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(mode === "video");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAddToPlaylistOpen, setIsAddToPlaylistOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(mode === "video" ? "artwork" : "canvas");
  const autoOpenedVideoIdRef = useRef<string | null>(null);
  const [isArtistImageModalOpen, setIsArtistImageModalOpen] = useState(false);

  // Tactile pulse animation for heart/like toggle
  const heartScaleAnim = useRef(new Animated.Value(1)).current;

  // Redux Player & Queue State (NOTE: currentTime is isolated in PlayerScrubber to prevent 250ms re-renders)
  const currentSong = useSelector((state: AppState) => state.player.currentSong);
  const isPlaying = useSelector((state: AppState) => state.player.isPlaying);
  const isLoading = useSelector((state: AppState) => state.player.isLoading);
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
  const isDisliked = useSelector((state: AppState) =>
    targetSongId ? state.queue.dislikedSongIds?.includes(targetSongId) : false
  );
  const isSongInAnyPlaylist = useSelector((state: AppState) =>
    selectIsSongInAnyPlaylist(state, targetSongId)
  );

  // Song description and biography from Wikipedia
  const { data: songInfo, isLoading: isSongInfoLoading } = useSongInfo(
    activeSong?.title,
    activeSong?.artistName
  );

  // Natural aspect ratio for the artist Wikipedia photo
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

  const handleOpenAlbum = () => {
    if (activeSong?.album) {
      router.push(`/album/${encodeURIComponent(activeSong.album)}` as any);
    }
  };

  // Synchronize route param id with currentSong when track advances
  useEffect(() => {
    if (currentSong?.id && currentSong.id !== id) {
      router.setParams({ id: currentSong.id });
    }
  }, [currentSong?.id, id]);

  // Screen focus hook: ensure lock screen controls and audio priority remain solid
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

  // Deep-link auto play if cold-opened with no song currently playing
  const hasAutoPlayedRef = useRef(false);
  useEffect(() => {
    if (!currentSong && fetchedSong && !hasAutoPlayedRef.current) {
      hasAutoPlayedRef.current = true;
      (dispatch as any)(playSong(fetchedSong));
    }
  }, [currentSong, fetchedSong, dispatch]);

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

  const effectiveViewMode: ViewMode = hasCanvas ? viewMode : "artwork";

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

  const handleSelectMode = (targetMode: "canvas" | "artwork" | "video") => {
    hapticFeedback.selection();
    if (targetMode === "video") {
      audioPlayerService.pause();
      setIsVideoModalOpen(true);
      return;
    }
    if (targetMode !== viewMode) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setViewMode(targetMode);
    }
  };

  const handleNextMode = () => {
    if (availableModes.length <= 1) return;
    const modeIdx = availableModes.findIndex((m) => m.key === effectiveViewMode);
    if (modeIdx >= 0 && modeIdx < availableModes.length - 1) {
      handleSelectMode(availableModes[modeIdx + 1].key);
    }
  };

  const handlePrevMode = () => {
    if (availableModes.length <= 1) return;
    const modeIdx = availableModes.findIndex((m) => m.key === effectiveViewMode);
    if (modeIdx > 0) {
      handleSelectMode(availableModes[modeIdx - 1].key);
    }
  };

  const handleVideoModalClose = (finalTimestamp: number) => {
    setIsVideoModalOpen(false);
    setViewMode("artwork");
    router.setParams({ mode: "" });
    if (typeof finalTimestamp === "number" && finalTimestamp >= 0) {
      audioPlayerService.seek(finalTimestamp);
      audioPlayerService.resume();
    }
  };

  const handleVideoTrackEnd = async () => {
    const nextIndex = currentIndex + 1;
    let nextSong: any = undefined;

    if (nextIndex < queue.length) {
      nextSong = queue[nextIndex];
    } else if (repeatMode === "all" && queue.length > 0) {
      nextSong = queue[0];
    }

    const nextHasVideo = Boolean(nextSong?.fullVideoKey || nextSong?.videoStreamUrl);

    if (nextSong && nextHasVideo) {
      await (dispatch as any)(nextTrack(false));
      audioPlayerService.pause();
    } else {
      setIsVideoModalOpen(false);
      setViewMode("artwork");
      router.setParams({ mode: "" });
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
      await (dispatch as any)(nextTrack(false));
    }
  };

  const handleVideoNextTrack = async () => {
    hapticFeedback.light();
    const nextIndex = currentIndex + 1;
    let nextSong: any = undefined;

    if (nextIndex < queue.length) {
      nextSong = queue[nextIndex];
    } else if (repeatMode === "all" && queue.length > 0) {
      nextSong = queue[0];
    }

    const nextHasVideo = Boolean(nextSong?.fullVideoKey || nextSong?.videoStreamUrl);

    if (nextSong && nextHasVideo) {
      await (dispatch as any)(nextTrack(true));
      audioPlayerService.pause();
    } else {
      setIsVideoModalOpen(false);
      setViewMode("artwork");
      router.setParams({ mode: "" });
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
      await (dispatch as any)(nextTrack(true));
    }
  };

  const handleVideoPrevTrack = async () => {
    hapticFeedback.light();
    const prevIndex = currentIndex - 1;
    let prevSong: any = undefined;

    if (prevIndex >= 0) {
      prevSong = queue[prevIndex];
    } else if (repeatMode === "all" && queue.length > 0) {
      prevSong = queue[queue.length - 1];
    }

    const prevHasVideo = Boolean(prevSong?.fullVideoKey || prevSong?.videoStreamUrl);

    if (prevSong && prevHasVideo) {
      await (dispatch as any)(prevTrack(true));
      audioPlayerService.pause();
    } else {
      setIsVideoModalOpen(false);
      setViewMode("artwork");
      router.setParams({ mode: "" });
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
      await (dispatch as any)(prevTrack(true));
    }
  };

  // Horizontal slide between Canvas, Artwork, Video
  const stagePanGesture = usePanGesture({
    runOnJS: true,
    activeOffsetX: [-20, 20],
    onDeactivate: (e) => {
      const { translationX, translationY, velocityX } = e;
      if (
        Math.abs(translationX) > 35 &&
        Math.abs(translationX) > Math.abs(translationY) * 1.05
      ) {
        if (translationX < -35 || velocityX < -250) {
          handleNextMode();
        } else if (translationX > 35 || velocityX > 250) {
          const modeIdx = availableModes.findIndex((m) => m.key === effectiveViewMode);
          if (modeIdx > 0 && effectiveViewMode !== "canvas") {
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
    const songToToggle =
      activeSong || (targetSongId ? ({ id: targetSongId, title: "Song" } as any) : null);
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
      await (dispatch as any)(toggleFavourite(songToToggle)).unwrap();
      queryClient.invalidateQueries({ queryKey: ["favourites"] });
      queryClient.invalidateQueries({ queryKey: ["favourites-check"] });
    } catch (e) {
      console.warn("[SongDetail] Toggle favourite error:", e);
    }
  };

  const handleDislikeSong = async () => {
    hapticFeedback.medium();
    await (dispatch as any)(dislikeCurrentSong(targetSongId));
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
        edges={["top", "left", "right"]}
        style={[styles.container, styles.containerTransparent]}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          bounces={true}
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
            {/* Top Navigation Bar with Down-Swipe Gesture */}
            <PlayerTopBar
              album={activeSong.album}
              genre={activeSong.genre}
              upcomingCount={upcomingCount}
              gesture={topBarGesture}
              onDismiss={handleDismissPlayer}
              onOpenAlbum={handleOpenAlbum}
              onOpenSettings={() => {
                hapticFeedback.light();
                setIsSettingsOpen(true);
              }}
              onOpenQueue={() => {
                hapticFeedback.light();
                setIsQueueOpen(true);
              }}
            />

            {/* Center Stage: Canvas / Artwork with Slide Gestures between Modes */}
            <GestureDetector gesture={stagePanGesture}>
              <View style={styles.centerStage}>
                {/* Unified Mode Switcher Pill (Canvas, Artwork, Video) */}
                {availableModes.length > 1 ? (
                  <View style={styles.modeSwitcherContainer}>
                    <View style={styles.modeSwitcherPill}>
                      {availableModes.map((m) => {
                        const isActive = effectiveViewMode === m.key;
                        return (
                          <TouchableOpacity
                            key={m.key}
                            style={[
                              styles.modeOptionBtn,
                              isActive && styles.modeOptionBtnActive,
                            ]}
                            onPress={() => handleSelectMode(m.key)}
                            activeOpacity={0.8}
                          >
                            <View style={styles.modeOptionContent}>
                              {m.key === "video" ? (
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
                                {m.label}
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

            {/* Song Metadata & Primary Actions (Add to Playlist, Like) */}
            <PlayerMetaRow
              title={activeSong.title}
              artistName={activeSong.artistName}
              isLiked={isLiked}
              isSongInAnyPlaylist={isSongInAnyPlaylist}
              heartScaleAnim={heartScaleAnim}
              onOpenArtist={handleOpenArtist}
              onOpenAddToPlaylist={() => {
                hapticFeedback.light();
                setIsAddToPlaylistOpen(true);
              }}
              onToggleLike={handleToggleLike}
            />

            {/* Interactive Timeline / Scrubber (Isolated component, 0 re-renders on parent) */}
            <PlayerScrubber
              duration={effectiveDuration}
              bufferedTime={bufferedTime}
              onSeek={(targetSeconds) => audioPlayerService.seek(targetSeconds)}
            />

            {/* Main Playback Controls (Shuffle, Previous, Play/Pause, Next, Repeat) */}
            <PlayerControlsRow
              isPlaying={isPlaying}
              isLoading={isLoading}
              repeatMode={repeatMode}
              isShuffle={isShuffle}
              onTogglePlay={handleTogglePlay}
              onNextTrack={handleNextTrack}
              onPrevTrack={handlePrevTrack}
              onToggleShuffle={handleToggleShuffle}
              onToggleRepeat={handleToggleRepeat}
            />
          </View>

          {/* Synchronized Lyrics Preview Card (Spotify-Style, isolated re-renders) */}
          <PlayerLyricsPreviewCard
            song={activeSong}
            dominantColor={dominantTheme?.dominantColor}
            onOpenFullLyrics={() => {
              hapticFeedback.light();
              if (activeSong?.id) {
                router.push({
                  pathname: "/(authenticated)/lyrics/[id]",
                  params: { id: activeSong.id },
                });
              }
            }}
          />

          {/* About the Track Section (Plays count, album/genre pills, story) */}
          <PlayerTrackAbout
            song={activeSong}
            songInfo={songInfo}
            isLoadingInfo={isSongInfoLoading}
            onOpenAlbum={handleOpenAlbum}
          />

          {/* About the Artist Section (Hero banner, Wikipedia bio, expand image) */}
          <PlayerArtistAbout
            artistName={activeSong.artistName}
            songInfo={songInfo}
            isLoadingInfo={isSongInfoLoading}
            artistFollowData={artistFollowData}
            artistImgAspectRatio={artistImgAspectRatio}
            onOpenArtist={handleOpenArtist}
            onOpenImageModal={() => setIsArtistImageModalOpen(true)}
          />
        </ScrollView>

        {/* Queue Modal */}
        <QueueModal
          visible={isQueueOpen}
          onClose={() => setIsQueueOpen(false)}
        />

        {/* Playback Settings & Secondary Options Modal (Quality, Speed, Timer, Share, Dislike) */}
        <PlayerSettingsModal
          visible={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          mode="audio"
          audioQualities={DEFAULT_AUDIO_QUALITIES}
          isDisliked={Boolean(isDisliked)}
          onDislike={handleDislikeSong}
          onShare={handleShareSong}
          onSpeedChange={(rate) => audioPlayerService.setPlaybackRate(rate)}
          onAudioQualityChange={(quality) => audioPlayerService.setAudioQuality(quality)}
        />

        {/* Full Video Modal */}
        {isVideoModalOpen && effectiveVideoUrl ? (
          <FullVideoPlayerModal
            visible={isVideoModalOpen}
            videoStreamUrl={effectiveVideoUrl}
            initialTime={store.getState().player.currentTime || 0}
            title={activeSong?.title || ""}
            artistName={activeSong?.artistName || ""}
            artworkUrl={posterUrl}
            onClose={handleVideoModalClose}
            onTrackEnd={handleVideoTrackEnd}
            onNextTrack={handleVideoNextTrack}
            onPrevTrack={handleVideoPrevTrack}
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

        {/* Add To Playlist Modal */}
        <AddToPlaylistModal
          visible={isAddToPlaylistOpen}
          onClose={() => setIsAddToPlaylistOpen(false)}
          song={activeSong || { id: targetSongId || id, title: "Song" }}
        />
      </SafeAreaView>
    </View>
  );
}
