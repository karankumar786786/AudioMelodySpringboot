import React, { useEffect, useState, useMemo } from "react";
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
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
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
} from "@/store/queueActions";
import { toggleShuffle, toggleRepeat } from "@/store/queueSlice";
import { CanvasVideoPlayer } from "@/components/common/CanvasVideoPlayer";
import { QueueModal } from "@/components/player/QueueModal";
import { FullVideoPlayerModal } from "@/components/player/FullVideoPlayerModal";
import { PlayerSettingsModal } from "@/components/player/PlayerSettingsModal";
import { formatDuration, formatStreams } from "@/utils/formatUtils";
import { getImageUrl } from "@/utils/imageUtils";
import { S3_BASE_URL } from "@/utils/playerUtils";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

type ViewMode = "canvas" | "artwork";

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

  // Redux Player & Queue State
  const currentSong = useSelector((state: AppState) => state.player.currentSong);
  const isPlaying = useSelector((state: AppState) => state.player.isPlaying);
  const isLoading = useSelector((state: AppState) => state.player.isLoading);
  const currentTime = useSelector((state: AppState) => state.player.currentTime);
  const duration = useSelector((state: AppState) => state.player.duration);
  const repeatMode = useSelector((state: AppState) => state.queue.repeatMode);
  const isShuffle = useSelector((state: AppState) => state.queue.isShuffle);
  const queue = useSelector((state: AppState) => state.queue.queue);
  const lastQueueIndex = useSelector((state: AppState) => state.queue.lastQueueIndex);

  const upcomingCount = useMemo(() => {
    if (!queue || queue.length === 0) return 0;
    return Math.max(0, queue.length - (lastQueueIndex + 1));
  }, [queue, lastQueueIndex]);

  // Load song metadata from backend if needed
  const { data: fetchedSong, isLoading: isFetching, isError, error } = useQuery({
    queryKey: ["song", id],
    queryFn: () => homeService.getSongById(id!),
    enabled: Boolean(id),
  });

  // Effective song to display: prefer currentSong from player state, fallback to fetchedSong
  const activeSong = currentSong || fetchedSong;

  // Synced lyrics hook (only queried if lrclibId is present and valid)
  const hasLrclib = useMemo(() => {
    if (!activeSong?.lrclibId) return false;
    const str = String(activeSong.lrclibId).trim();
    return str !== "" && str !== "0" && str !== "null" && str !== "undefined";
  }, [activeSong?.lrclibId]);

  const {
    currentLine,
    nextLine,
    transcriptions,
    plainLyrics,
    hasLyrics,
  } = useLyrics(hasLrclib ? activeSong?.lrclibId : undefined, currentTime);

  const canShowLyrics = Boolean(hasLrclib && hasLyrics);

  // Song description and biography from Wikipedia (like audioFrontend)
  const { data: songInfo, isLoading: isSongInfoLoading } = useSongInfo(
    activeSong?.title,
    activeSong?.artistName
  );

  // Check favourites status from query cache
  const { data: favouritesData } = useQuery({
    queryKey: ["favourites"],
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

  // If page is loaded for a song that isn't currently playing, initiate playback
  useEffect(() => {
    if (fetchedSong && (!currentSong || currentSong.id !== fetchedSong.id)) {
      (dispatch as any)(playSong(fetchedSong));
    }
  }, [fetchedSong?.id]);

  const hasCanvas = Boolean(activeSong?.videoKey);
  const hasFullVideo = Boolean(activeSong?.fullVideoKey);

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

  // Fallback viewMode if canvas is unavailable
  useEffect(() => {
    if (viewMode === "canvas" && !hasCanvas) {
      setViewMode("artwork");
    }
  }, [hasCanvas, viewMode]);

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
  const progressPercent =
    effectiveDuration > 0
      ? Math.min(100, Math.max(0, (currentTime / effectiveDuration) * 100))
      : 0;

  const handleProgressBarPress = (e: GestureResponderEvent) => {
    const { locationX } = e.nativeEvent;
    const barWidth = SCREEN_WIDTH - 52;
    const ratio = Math.max(0, Math.min(1, locationX / barWidth));
    const targetSeconds = ratio * effectiveDuration;
    audioPlayerService.seek(targetSeconds);
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
    } catch {
      setIsLiked(!nextLiked);
    }
  };

  const handleSelectMode = (mode: "canvas" | "artwork" | "video") => {
    if (mode === "video") {
      // Direct full screen mode: pause audio and launch FullVideoPlayerModal
      audioPlayerService.pause();
      setIsVideoModalOpen(true);
      return;
    }
    setViewMode(mode);
  };

  const handleVideoModalClose = (finalTimestamp: number) => {
    setIsVideoModalOpen(false);
    if (typeof finalTimestamp === "number" && finalTimestamp >= 0) {
      audioPlayerService.seek(finalTimestamp);
      audioPlayerService.resume();
    }
  };

  const posterUrl = getImageUrl(activeSong.imageKey, {
    width: 720,
    height: 720,
    focus: "auto",
    aspectRatio: "1-1",
    quality: 90,
  });

  const showCanvasBackground = viewMode === "canvas" && hasCanvas;

  return (
    <View style={styles.root}>
      {/* 1. Full-Screen Ambient Video or Cinematic Blurred Backdrop */}
      {showCanvasBackground && activeSong.videoKey ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <CanvasVideoPlayer
            videoUrl={(activeSong as any)?.canvasVideoUrl}
            videoKey={activeSong.videoKey}
            fallbackImageKey={activeSong.imageKey}
            isPlaying={isPlaying}
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
      ) : (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {/* Ambient blurred backdrop for artwork mode */}
          <Image
            source={{ uri: posterUrl }}
            style={styles.ambientBlurImage}
            contentFit="cover"
            blurRadius={45}
            cachePolicy="memory"
          />
          <LinearGradient
            colors={[
              "rgba(18, 18, 18, 0.8)",
              "rgba(18, 18, 18, 0.7)",
              "rgba(18, 18, 18, 0.95)",
              "#121212",
            ]}
            locations={[0, 0.4, 0.8, 1]}
            style={StyleSheet.absoluteFill}
          />
        </View>
      )}

      <SafeAreaView
        style={[
          styles.container,
          showCanvasBackground && styles.containerTransparent,
        ]}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          bounces={true}
          scrollEnabled={true}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Main Full-Screen Player: exactly 100% viewport height */}
          <View style={[styles.playerScreenSection, { minHeight: safeAreaHeight }]}>
            {/* 2. Top Navigation Bar */}
            <View style={styles.topBar}>
              <TouchableOpacity
                style={styles.topBarCircleBtn}
                onPress={() => router.back()}
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

            {/* 3. Center Stage: Canvas / Artwork */}
            <View style={styles.centerStage}>
          {/* Unified Mode Switcher Pill (Canvas, Artwork, Video) */}
          {availableModes.length > 1 ? (
            <View style={styles.modeSwitcherContainer}>
              <View style={styles.modeSwitcherPill}>
                {availableModes.map((mode) => {
                  const isActive = viewMode === mode.key;
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

          {/* Mode Stage Display: spacious ambient view for canvas, centered 1:1 image for artwork */}
          {viewMode === "canvas" ? (
            <View style={styles.canvasSpacer} />
          ) : (
            <View style={styles.artworkWrapper}>
              <Image
                source={{ uri: posterUrl }}
                style={styles.artworkImage}
                contentFit="cover"
                transition={200}
                cachePolicy="memory"
              />
            </View>
          )}
        </View>

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
          <TouchableOpacity
            activeOpacity={1}
            style={styles.progressBarTouchArea}
            onPress={handleProgressBarPress}
          >
            <View style={styles.progressBarBackground}>
              <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]}>
                <View style={styles.progressThumb} />
              </View>
            </View>
          </TouchableOpacity>

          <View style={styles.timeRow}>
            <Text style={styles.timeText}>{formatDuration(currentTime)}</Text>
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
              {artistFollowData?.artistId ? (
                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={handleOpenArtist}
                  style={styles.viewArtistPill}
                >
                  <Text style={styles.viewArtistPillText}>VIEW PROFILE</Text>
                  <Ionicons name="chevron-forward" size={12} color="#FFFFFF" />
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Artist Hero Banner */}
            <TouchableOpacity
              activeOpacity={artistFollowData?.artistId ? 0.9 : 1}
              onPress={handleOpenArtist}
              style={styles.artistHeroWrapper}
            >
              {songInfo?.artist?.image ? (
                <Image
                  source={{ uri: songInfo.artist.image }}
                  style={styles.artistHeroImage}
                  contentFit="cover"
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
                colors={["transparent", "rgba(0,0,0,0.4)", "rgba(0,0,0,0.92)"]}
                locations={[0, 0.45, 1]}
                style={StyleSheet.absoluteFill}
              />

              {/* Bottom Info on Hero */}
              <View style={styles.artistHeroBottomBar}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.artistHeroName} numberOfLines={1}>
                    {songInfo?.artist?.name || activeSong.artistName}
                  </Text>
                  <View style={styles.artistHeroMetaRow}>
                    <Text style={styles.artistHeroRole}>Artist</Text>
                  </View>
                </View>
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
          onSpeedChange={(rate) => audioPlayerService.setPlaybackRate(rate)}
        />

        {/* Full Video Modal: only mounted when explicitly opened by user */}
        {isVideoModalOpen && activeSong.fullVideoKey ? (
          <FullVideoPlayerModal
            visible={isVideoModalOpen}
            videoStreamUrl={`${S3_BASE_URL}/${activeSong.fullVideoKey}/master.m3u8`}
            initialTime={currentTime}
            title={activeSong.title}
            artistName={activeSong.artistName}
            onClose={handleVideoModalClose}
          />
        ) : null}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#121212",
  },
  ambientBlurImage: {
    ...StyleSheet.absoluteFill,
    opacity: 0.22,
  },
  container: {
    flex: 1,
    backgroundColor: "#121212",
  },
  containerTransparent: {
    backgroundColor: "transparent",
  },
  scrollContent: {
    flexGrow: 1,
  },
  playerScreenSection: {
    flex: 1,
    justifyContent: "space-between",
    paddingBottom: 28,
  },
  centerContainer: {
    flex: 1,
    backgroundColor: "#121212",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    color: "#888888",
    fontSize: 14,
    fontWeight: "500",
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginTop: 14,
    marginBottom: 6,
  },
  errorText: {
    color: "#888888",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: "#FFFFFF",
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: 20,
  },
  backButtonText: {
    color: "#000000",
    fontSize: 14,
    fontWeight: "700",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 8,
  },
  topBarTitleContainer: {
    alignItems: "center",
    flex: 1,
    marginHorizontal: 14,
  },
  topBarSubtitle: {
    fontSize: 9.5,
    fontWeight: "800",
    color: "rgba(255, 255, 255, 0.45)",
    letterSpacing: 1.5,
  },
  topBarTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
    marginTop: 2,
  },
  topBarCircleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  topBarRightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  queueCounterBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  queueCounterText: {
    color: "#000000",
    fontSize: 9,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
  },
  centerStage: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    marginVertical: 4,
  },
  modeSwitcherContainer: {
    position: "absolute",
    top: 6,
    zIndex: 10,
  },
  modeSwitcherPill: {
    flexDirection: "row",
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    borderRadius: 22,
    padding: 3,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.18)",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  modeOptionBtn: {
    paddingHorizontal: 15,
    paddingVertical: 5.5,
    borderRadius: 18,
  },
  modeOptionBtnActive: {
    backgroundColor: "#FFFFFF",
  },
  modeOptionContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  modeOptionText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "rgba(255, 255, 255, 0.65)",
  },
  modeOptionTextActive: {
    color: "#000000",
    fontWeight: "800",
  },
  artworkWrapper: {
    width: "100%",
    maxWidth: 340,
    aspectRatio: 1,
    borderRadius: 22,
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.75,
    shadowRadius: 26,
    elevation: 18,
    backgroundColor: "#1E1E1E",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  artworkImage: {
    width: "100%",
    height: "100%",
  },
  canvasSpacer: {
    flex: 1,
    minHeight: Math.min(SCREEN_WIDTH - 48, 340),
  },
  metaSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 26,
    marginBottom: 6,
  },
  titleContainer: {
    flex: 1,
    paddingRight: 16,
  },
  songTitle: {
    fontSize: 23,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.3,
    marginBottom: 3,
  },
  artistName: {
    fontSize: 15.5,
    color: "rgba(255, 255, 255, 0.65)",
    fontWeight: "600",
  },
  tagsRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
  },
  tagBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  tagText: {
    color: "rgba(255, 255, 255, 0.85)",
    fontSize: 11,
    fontWeight: "600",
  },
  likeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  progressContainer: {
    paddingHorizontal: 26,
    marginBottom: 10,
  },
  progressBarTouchArea: {
    paddingVertical: 8,
  },
  progressBarBackground: {
    height: 4.5,
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    borderRadius: 3,
    position: "relative",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 3,
    position: "relative",
  },
  progressThumb: {
    position: "absolute",
    right: -6,
    top: -4.5,
    width: 13.5,
    height: 13.5,
    borderRadius: 7,
    backgroundColor: "#FFFFFF",
    shadowColor: "#FFFFFF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 5,
    elevation: 3,
  },
  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },
  timeText: {
    fontSize: 11.5,
    fontWeight: "500",
    color: "rgba(255, 255, 255, 0.5)",
    fontVariant: ["tabular-nums"],
  },
  controlsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 26,
    paddingTop: 2,
    marginBottom: 4,
  },
  controlIconBtn: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#FFFFFF",
    marginTop: 3,
  },
  inactiveDot: {
    width: 4,
    height: 4,
    marginTop: 3,
  },
  repeatBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "#FFFFFF",
    borderRadius: 5,
    width: 13,
    height: 13,
    justifyContent: "center",
    alignItems: "center",
  },
  repeatBadgeText: {
    color: "#000000",
    fontSize: 8.5,
    fontWeight: "900",
    lineHeight: 10,
  },
  mainPlayButton: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#FFFFFF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },
  lyricsSection: {
    paddingHorizontal: 22,
    paddingTop: 16,
    paddingBottom: 16,
  },
  lyricsCard: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 22,
    padding: 22,
    minHeight: 220,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 6,
    justifyContent: "space-between",
  },
  lyricsCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  lyricsCardTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },
  lyricsCardMorePill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.14)",
    paddingVertical: 5,
    paddingHorizontal: 11,
    borderRadius: 14,
    gap: 4,
  },
  lyricsCardMoreText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.8,
  },
  lyricsCardContent: {
    gap: 8,
    flex: 1,
    justifyContent: "center",
  },
  lyricsLinePrimary: {
    fontSize: 20,
    fontWeight: "800",
    color: "#FFFFFF",
    lineHeight: 28,
    letterSpacing: -0.3,
  },
  lyricsLineSecondary: {
    fontSize: 15,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.45)",
    lineHeight: 22,
  },
  aboutSection: {
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 16,
  },
  aboutCard: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 22,
    padding: 22,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 6,
  },
  aboutHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  aboutTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  aboutCardTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },
  streamsBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.14)",
    paddingVertical: 4.5,
    paddingHorizontal: 10,
    borderRadius: 14,
  },
  streamsBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.4,
    fontVariant: ["tabular-nums"],
  },
  aboutIdentityContainer: {
    marginBottom: 14,
  },
  aboutSongTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  aboutArtistName: {
    fontSize: 15,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.65)",
    marginBottom: 12,
  },
  aboutPillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  aboutPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    paddingVertical: 4.5,
    paddingHorizontal: 9,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  aboutPillText: {
    fontSize: 11,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.9)",
  },
  aboutBioContainer: {
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.1)",
  },
  aboutBioText: {
    fontSize: 13.5,
    lineHeight: 21,
    color: "rgba(255, 255, 255, 0.78)",
    fontWeight: "400",
  },
  aboutLoadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
  },
  aboutLoadingText: {
    fontSize: 12.5,
    color: "rgba(255, 255, 255, 0.5)",
    fontWeight: "500",
  },
  wikiLinkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 12,
    alignSelf: "flex-start",
  },
  wikiLinkText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
    textDecorationLine: "underline",
  },
  artistSection: {
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: 48,
  },
  artistCard: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 22,
    padding: 22,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 6,
  },
  artistCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  artistCardHeaderTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },
  viewArtistPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    paddingVertical: 4.5,
    paddingHorizontal: 9,
    borderRadius: 12,
    gap: 3,
  },
  viewArtistPillText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.6,
  },
  artistHeroWrapper: {
    width: "100%",
    height: 165,
    borderRadius: 18,
    overflow: "hidden",
    position: "relative",
    backgroundColor: "#1E1E1E",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  artistHeroImage: {
    width: "100%",
    height: "100%",
  },
  artistHeroFallback: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#242424",
    justifyContent: "center",
    alignItems: "center",
  },
  artistHeroFallbackInitial: {
    fontSize: 54,
    fontWeight: "900",
    color: "rgba(255, 255, 255, 0.3)",
  },
  artistHeroBottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 14,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  artistHeroName: {
    fontSize: 17,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.2,
  },
  artistHeroMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 3,
  },
  artistHeroRole: {
    fontSize: 11,
    fontWeight: "700",
    color: "rgba(255, 255, 255, 0.7)",
  },

  artistBioContainer: {
    marginTop: 14,
  },
  artistBioText: {
    fontSize: 13.5,
    lineHeight: 21,
    color: "rgba(255, 255, 255, 0.78)",
    fontWeight: "400",
  },
});
