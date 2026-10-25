import React, { useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  GestureResponderEvent,
  Share,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSelector, useDispatch } from "react-redux";
import { AppState } from "@/store/hook";
import { homeService, favouriteService } from "@/service";
import { audioPlayerService } from "@/service/audioPlayerService";
import {
  playSong,
  nextTrack,
  prevTrack,
} from "@/store/queueActions";
import { toggleShuffle, toggleRepeat } from "@/store/queueSlice";
import { CanvasVideoPlayer } from "@/components/common/CanvasVideoPlayer";
import { QueueModal } from "@/components/player/QueueModal";
import { FullVideoPlayerModal } from "@/components/player/FullVideoPlayerModal";
import { formatDuration, formatStreams } from "@/utils/formatUtils";
import { getImageUrl } from "@/utils/imageUtils";
import { S3_BASE_URL } from "@/utils/playerUtils";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

export default function SongDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const dispatch = useDispatch();
  const queryClient = useQueryClient();

  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"canvas" | "cover">("canvas");
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

  // Check favourites status from query cache
  const { data: favouritesData } = useQuery({
    queryKey: ["favourites"],
    queryFn: () => favouriteService.getFavourites(0, 50),
  });

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
    const barWidth = SCREEN_WIDTH - 56;
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

  const handleShare = async () => {
    try {
      await Share.share({
        title: activeSong.title,
        message: `Listen to "${activeSong.title}" by ${activeSong.artistName} on OneMelody`,
      });
    } catch {
      // dismissed
    }
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

  const hasCanvasVideo = Boolean(activeSong.videoKey);
  const showCanvasBackground = hasCanvasVideo && viewMode === "canvas";

  return (
    <View style={styles.root}>
      {/* 1. Full-Screen Ambient Video or Cinematic Blurred Backdrop */}
      {showCanvasBackground && activeSong.videoKey ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <CanvasVideoPlayer
            videoKey={activeSong.videoKey}
            fallbackImageKey={activeSong.imageKey}
            isPlaying={isPlaying}
            style={StyleSheet.absoluteFill}
          />
          {/* Multi-layered cinematic gradient wash for pristine contrast */}
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
                  {upcomingCount > 9 ? "9+" : upcomingCount}
                </Text>
              </View>
            ) : null}
          </TouchableOpacity>
        </View>

        {/* 3. Center Stage: Artwork / Media Experience */}
        <View style={styles.centerStage}>
          {/* Mode Switcher Pill (Only if song has canvas video available) */}
          {hasCanvasVideo ? (
            <View style={styles.modeSwitcherContainer}>
              <View style={styles.modeSwitcherPill}>
                <TouchableOpacity
                  style={[
                    styles.modeOptionBtn,
                    viewMode === "canvas" && styles.modeOptionBtnActive,
                  ]}
                  onPress={() => setViewMode("canvas")}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.modeOptionText,
                      viewMode === "canvas" && styles.modeOptionTextActive,
                    ]}
                  >
                    Video
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.modeOptionBtn,
                    viewMode === "cover" && styles.modeOptionBtnActive,
                  ]}
                  onPress={() => setViewMode("cover")}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.modeOptionText,
                      viewMode === "cover" && styles.modeOptionTextActive,
                    ]}
                  >
                    Artwork
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          {/* Centered Artwork Display (Visible in cover mode or when no canvas video) */}
          {!showCanvasBackground ? (
            <View style={styles.artworkWrapper}>
              <Image
                source={{ uri: posterUrl }}
                style={styles.artworkImage}
                contentFit="cover"
                transition={200}
              />
            </View>
          ) : (
            <View style={styles.canvasSpacer} />
          )}

          {/* Watch Full Video Action Pill */}
          {activeSong.fullVideoKey ? (
            <View style={styles.stageOverlayRow}>
              <TouchableOpacity
                style={styles.fullVideoPill}
                activeOpacity={0.85}
                onPress={() => setIsVideoModalOpen(true)}
              >
                <Ionicons
                  name="play"
                  size={14}
                  color="#000000"
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.fullVideoText}>WATCH MUSIC VIDEO</Text>
              </TouchableOpacity>
            </View>
          ) : null}
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

            {/* Monochrome Glass Metadata Badges */}
            <View style={styles.tagsRow}>
              {activeSong.album ? (
                <View style={styles.tagBadge}>
                  <Ionicons
                    name="disc-outline"
                    size={12}
                    color="#FFFFFF"
                    style={{ marginRight: 4 }}
                  />
                  <Text style={styles.tagText} numberOfLines={1}>
                    {activeSong.album}
                  </Text>
                </View>
              ) : null}

              {activeSong.genre ? (
                <View style={styles.tagBadge}>
                  <Ionicons
                    name="musical-notes-outline"
                    size={12}
                    color="#FFFFFF"
                    style={{ marginRight: 4 }}
                  />
                  <Text style={styles.tagText} numberOfLines={1}>
                    {activeSong.genre}
                  </Text>
                </View>
              ) : null}

              {activeSong.totalStreams !== undefined && activeSong.totalStreams !== null ? (
                <View style={styles.tagBadge}>
                  <Ionicons
                    name="trending-up"
                    size={12}
                    color="#FFFFFF"
                    style={{ marginRight: 4 }}
                  />
                  <Text style={styles.tagText}>
                    {formatStreams(activeSong.totalStreams)}
                  </Text>
                </View>
              ) : null}
            </View>
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


        {/* Up Next Queue Bottom Sheet */}
        <QueueModal
          visible={isQueueOpen}
          onClose={() => setIsQueueOpen(false)}
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
    justifyContent: "space-between",
    paddingBottom: 16,
  },
  containerTransparent: {
    backgroundColor: "transparent",
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
  queueCounterBadge: {
    position: "absolute",
    top: -3,
    right: -3,
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    justifyContent: "center",
    alignItems: "center",
  },
  queueCounterText: {
    color: "#000000",
    fontSize: 9,
    fontWeight: "900",
  },
  centerStage: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 28,
    marginVertical: 4,
  },
  modeSwitcherContainer: {
    position: "absolute",
    top: 6,
    zIndex: 10,
  },
  modeSwitcherPill: {
    flexDirection: "row",
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    borderRadius: 20,
    padding: 3,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.18)",
  },
  modeOptionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 16,
  },
  modeOptionBtnActive: {
    backgroundColor: "#FFFFFF",
  },
  modeOptionText: {
    fontSize: 11,
    fontWeight: "700",
    color: "rgba(255, 255, 255, 0.6)",
  },
  modeOptionTextActive: {
    color: "#000000",
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
  },
  stageOverlayRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
  },
  fullVideoPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 24,
    shadowColor: "#FFFFFF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  fullVideoText: {
    color: "#000000",
    fontSize: 11.5,
    fontWeight: "800",
    letterSpacing: 0.8,
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
  bottomUtilityBar: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingHorizontal: 26,
    paddingTop: 8,
  },
  utilityActionBtn: {
    padding: 6,
  },
});
