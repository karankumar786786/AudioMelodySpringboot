import  { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  GestureResponderEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSelector, useDispatch } from "react-redux";
import { AppState } from "@/store/hook";
import { homeService } from "@/service";
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

  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);

  // Redux Player & Queue State
  const currentSong = useSelector((state: AppState) => state.player.currentSong);
  const isPlaying = useSelector((state: AppState) => state.player.isPlaying);
  const isLoading = useSelector((state: AppState) => state.player.isLoading);
  const currentTime = useSelector((state: AppState) => state.player.currentTime);
  const duration = useSelector((state: AppState) => state.player.duration);
  const repeatMode = useSelector((state: AppState) => state.queue.repeatMode);
  const isShuffle = useSelector((state: AppState) => state.queue.isShuffle);

  // Load song metadata from backend if needed
  const { data: fetchedSong, isLoading: isFetching, isError, error } = useQuery({
    queryKey: ["song", id],
    queryFn: () => homeService.getSongById(id!),
    enabled: Boolean(id),
  });

  // Effective song to display: prefer currentSong from player state, fallback to fetchedSong
  const activeSong = currentSong || fetchedSong;

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
        <Ionicons name="alert-circle-outline" size={48} color="#FF5252" />
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

  const handleVideoModalClose = (finalTimestamp: number) => {
    setIsVideoModalOpen(false);
    if (typeof finalTimestamp === "number" && finalTimestamp >= 0) {
      audioPlayerService.seek(finalTimestamp);
      audioPlayerService.resume();
    }
  };

  const canvasHeight = Math.min(SCREEN_HEIGHT * 0.44, 380);
  const posterUrl = getImageUrl(activeSong.imageKey, {
    width: 720,
    height: 720,
    focus: "auto",
    aspectRatio: "1-1",
    quality: 90,
  });

  const isCanvasActive = Boolean(activeSong.videoKey);

  return (
    <View style={styles.root}>
      {/* Full-Screen Looping Ambient Canvas Video Background */}
      {isCanvasActive && activeSong.videoKey ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <CanvasVideoPlayer
            videoKey={activeSong.videoKey}
            fallbackImageKey={activeSong.imageKey}
            isPlaying={isPlaying}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={[
              "rgba(0, 0, 0, 0.65)",
              "rgba(0, 0, 0, 0.2)",
              "rgba(0, 0, 0, 0.55)",
              "rgba(18, 18, 18, 0.96)",
            ]}
            locations={[0, 0.35, 0.7, 1]}
            style={StyleSheet.absoluteFill}
          />
        </View>
      ) : null}

      <SafeAreaView
        style={[
          styles.container,
          isCanvasActive && styles.containerTransparent,
        ]}
      >
        {/* Top Navigation Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => router.back()}
            hitSlop={14}
          >
            <Ionicons name="chevron-down" size={28} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.topBarTitleContainer}>
            <Text style={styles.topBarSubtitle}>PLAYING FROM MELODY</Text>
            <Text style={styles.topBarTitle} numberOfLines={1}>
              {activeSong.album || activeSong.genre || "Featured"}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.iconButton}
            hitSlop={14}
            onPress={() => setIsQueueOpen(true)}
          >
            <Ionicons name="list" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Center Stage: Artwork (if artwork mode) or Open Ambient View (if canvas mode) */}
        <View style={styles.centerStage}>
          {!isCanvasActive ? (
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

          {/* Full Video Stream Switcher if fullVideoKey exists */}
          {activeSong.fullVideoKey ? (
            <View style={styles.stageOverlayRow}>
              <TouchableOpacity
                style={styles.fullVideoPill}
                activeOpacity={0.85}
                onPress={() => setIsVideoModalOpen(true)}
              >
                <Ionicons name="play-circle" size={14} color="#1DB954" style={{ marginRight: 4 }} />
                <Text style={styles.fullVideoText}>WATCH VIDEO</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

      {/* Song Metadata */}
      <View style={styles.metaSection}>
        <View style={styles.titleContainer}>
          <Text style={styles.songTitle} numberOfLines={1}>
            {activeSong.title}
          </Text>
          <Text style={styles.artistName} numberOfLines={1}>
            {activeSong.artistName}
          </Text>

          {/* Tags */}
          <View style={styles.tagsRow}>
            {activeSong.album ? (
              <View style={styles.tagBadge}>
                <Ionicons
                  name="disc-outline"
                  size={12}
                  color="#AAAAAA"
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
                  color="#AAAAAA"
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
                  color="#AAAAAA"
                  style={{ marginRight: 4 }}
                />
                <Text style={styles.tagText}>
                  {formatStreams(activeSong.totalStreams)}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        <TouchableOpacity hitSlop={12}>
          <Ionicons name="heart-outline" size={26} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Interactive Progress Bar */}
      <View style={styles.progressContainer}>
        <TouchableOpacity
          activeOpacity={1}
          style={styles.progressBarTouchArea}
          onPress={handleProgressBarPress}
        >
          <View style={styles.progressBarBackground}>
            <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
          </View>
        </TouchableOpacity>

        <View style={styles.timeRow}>
          <Text style={styles.timeText}>{formatDuration(currentTime)}</Text>
          <Text style={styles.timeText}>{formatDuration(effectiveDuration)}</Text>
        </View>
      </View>

      {/* Playback Controls */}
      <View style={styles.controlsRow}>
        {/* Shuffle */}
        <TouchableOpacity
          hitSlop={14}
          onPress={handleToggleShuffle}
          style={styles.controlIconBtn}
        >
          <Ionicons
            name="shuffle"
            size={24}
            color={isShuffle ? "#1DB954" : "#777777"}
          />
        </TouchableOpacity>

        {/* Skip Back / Prev */}
        <TouchableOpacity
          hitSlop={14}
          onPress={handlePrevTrack}
          style={styles.controlIconBtn}
        >
          <Ionicons name="play-skip-back" size={28} color="#FFFFFF" />
        </TouchableOpacity>

        {/* Play / Pause Primary Button */}
        <TouchableOpacity
          style={styles.mainPlayButton}
          activeOpacity={0.85}
          onPress={handleTogglePlay}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#000000" />
          ) : (
            <Ionicons
              name={isPlaying ? "pause" : "play"}
              size={30}
              color="#000000"
            />
          )}
        </TouchableOpacity>

        {/* Skip Forward / Next */}
        <TouchableOpacity
          hitSlop={14}
          onPress={handleNextTrack}
          style={styles.controlIconBtn}
        >
          <Ionicons name="play-skip-forward" size={28} color="#FFFFFF" />
        </TouchableOpacity>

        {/* Repeat */}
        <TouchableOpacity
          hitSlop={14}
          onPress={handleToggleRepeat}
          style={styles.controlIconBtn}
        >
          <Ionicons
            name={repeatMode === "one" ? "repeat" : "repeat"}
            size={24}
            color={repeatMode !== "none" ? "#1DB954" : "#777777"}
          />
          {repeatMode === "one" ? (
            <Text style={styles.repeatBadge}>1</Text>
          ) : null}
        </TouchableOpacity>
      </View>

      {/* Up Next Queue BottomSheet */}
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
  container: {
    flex: 1,
    backgroundColor: "#121212",
    justifyContent: "space-between",
    paddingBottom: 28,
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
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginTop: 12,
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
    fontSize: 15,
    fontWeight: "700",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  topBarTitleContainer: {
    alignItems: "center",
  },
  topBarSubtitle: {
    fontSize: 10,
    fontWeight: "700",
    color: "#888888",
    letterSpacing: 1,
  },
  topBarTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFFFFF",
    marginTop: 2,
  },
  iconButton: {
    padding: 6,
  },
  centerStage: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    marginVertical: 4,
  },
  artworkWrapper: {
    width: "100%",
    maxWidth: 360,
    aspectRatio: 1,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 12,
    backgroundColor: "#1E1E1E",
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
    gap: 10,
    marginTop: 14,
  },
  fullVideoPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(29, 185, 84, 0.5)",
  },
  fullVideoText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  metaSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 28,
  },
  titleContainer: {
    flex: 1,
    paddingRight: 16,
  },
  songTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  artistName: {
    fontSize: 16,
    color: "#A7A7A7",
    fontWeight: "500",
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
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 6,
    backgroundColor: "#1F1F1F",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  tagText: {
    color: "#CCCCCC",
    fontSize: 11.5,
    fontWeight: "600",
  },
  progressContainer: {
    paddingHorizontal: 28,
  },
  progressBarTouchArea: {
    paddingVertical: 8,
  },
  progressBarBackground: {
    height: 4,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 2,
  },
  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  timeText: {
    fontSize: 12,
    color: "#888888",
  },
  controlsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 28,
  },
  controlIconBtn: {
    padding: 8,
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
  },
  repeatBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    color: "#1DB954",
    fontSize: 9,
    fontWeight: "900",
  },
  mainPlayButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#FFFFFF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
});
