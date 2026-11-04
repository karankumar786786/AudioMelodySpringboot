import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  Dimensions,
  Animated,
  ActivityIndicator,
} from "react-native";
import {
  GestureHandlerRootView,
  GestureDetector,
  usePanGesture,
} from "react-native-gesture-handler";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useSelector, useDispatch } from "react-redux";
import { AppState } from "@/store/hook";
import { Song, PlayerSong } from "@/types";
import { clearUpcomingQueue, removeSongFromQueue } from "@/store/queueSlice";
import { playSong, refillQueue } from "@/store/queueActions";
import { formatDuration } from "@/utils/formatUtils";
import { getImageUrl } from "@/utils/imageUtils";
import { hapticFeedback } from "@/utils/haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface QueueModalProps {
  visible: boolean;
  onClose: () => void;
}

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

// Shared with the home screen
const SIDE = 18;

// Sheet heights: opens collapsed, swipe up to expand
const COLLAPSED_H = SCREEN_HEIGHT * 0.6;
const EXPANDED_H = SCREEN_HEIGHT * 0.92;
const MIN_DRAG_H = SCREEN_HEIGHT * 0.4; // how far it can be dragged down before release
const CLOSE_THRESHOLD = 80; // px below collapsed height that dismisses on release
const FLING_VELOCITY = 500;

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

/**
 * Pulsing skeleton row matching Queue track item structure
 */
function QueueSkeletonRow({ opacityAnim }: { opacityAnim: Animated.Value }) {
  return (
    <Animated.View style={[styles.skeletonRow, { opacity: opacityAnim }]}>
      <View style={styles.skeletonIndex} />
      <View style={styles.skeletonThumb} />
      <View style={styles.skeletonInfo}>
        <View style={styles.skeletonTitle} />
        <View style={styles.skeletonArtist} />
      </View>
      <View style={styles.skeletonDuration} />
    </Animated.View>
  );
}

/**
 * Full skeleton state shown when the upcoming queue is empty and tracks are actively being curated
 */
function QueueSkeletonView() {
  const opacityAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacityAnim, {
          toValue: 0.75,
          duration: 750,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0.3,
          duration: 750,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacityAnim]);

  return (
    <View style={styles.skeletonContainer}>
      <View style={styles.skeletonBadge}>
        <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
        <Text style={styles.skeletonBadgeText}>Curating recommendations...</Text>
      </View>
      {[0, 1, 2, 3, 4].map((i) => (
        <QueueSkeletonRow key={i} opacityAnim={opacityAnim} />
      ))}
    </View>
  );
}

/**
 * Footer loader shown when more tracks are being appended to an existing queue
 */
function QueueFooterLoading() {
  const opacityAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacityAnim, {
          toValue: 0.75,
          duration: 750,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0.3,
          duration: 750,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacityAnim]);

  return (
    <View style={styles.footerLoadingWrapper}>
      <View style={styles.footerLoadingBadge}>
        <ActivityIndicator size="small" color="#8A8A8A" style={{ marginRight: 6 }} />
        <Text style={styles.footerLoadingText}>Finding more recommendations...</Text>
      </View>
      <QueueSkeletonRow opacityAnim={opacityAnim} />
      <QueueSkeletonRow opacityAnim={opacityAnim} />
    </View>
  );
}

export function QueueModal({ visible, onClose }: QueueModalProps) {
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();

  const currentSong = useSelector((state: AppState) => state.player.currentSong);
  const queue = useSelector((state: AppState) => state.queue.queue);
  const currentIndex = useSelector((state: AppState) => state.queue.currentIndex);
  const isRefilling = useSelector((state: AppState) => state.queue.isRefilling);
  const isQueueLoading = useSelector((state: AppState) => (state.queue as any).isLoading);
  const isPlayerLoading = useSelector((state: AppState) => state.player.isLoading);

  const upcomingQueue =
    currentIndex >= 0 ? queue.slice(currentIndex + 1) : queue;

  const isQueueBusy = isRefilling || Boolean(isQueueLoading);

  // ---- Expandable sheet ----
  const sheetHeight = useRef(new Animated.Value(COLLAPSED_H)).current;
  const settledHeight = useRef(COLLAPSED_H); // height the sheet last snapped to
  const [isExpanded, setIsExpanded] = useState(false);

  // Always reopen collapsed
  useEffect(() => {
    if (visible) {
      sheetHeight.setValue(COLLAPSED_H);
      settledHeight.current = COLLAPSED_H;
      setIsExpanded(false);
    }
  }, [visible, sheetHeight]);

  const snapTo = (expand: boolean) => {
    hapticFeedback.selection();
    const target = expand ? EXPANDED_H : COLLAPSED_H;
    settledHeight.current = target;
    setIsExpanded(expand);
    Animated.spring(sheetHeight, {
      toValue: target,
      useNativeDriver: false, // height is a layout prop
      bounciness: 0,
      speed: 16,
    }).start();
  };

  const panGesture = usePanGesture({
    runOnJS: true,
    activeOffsetY: [-10, 10],
    onUpdate: (e) => {
      // Dragging up (negative translationY) grows the sheet
      const next = clamp(settledHeight.current - e.translationY, MIN_DRAG_H, EXPANDED_H);
      sheetHeight.setValue(next);
    },
    onDeactivate: (e) => {
      const { translationY, velocityY } = e;
      const releasedAt = clamp(
        settledHeight.current - translationY,
        MIN_DRAG_H,
        EXPANDED_H
      );

      // Fast flick up: expand
      if (velocityY < -FLING_VELOCITY) {
        snapTo(true);
        return;
      }
      // Fast flick down: collapse if expanded, otherwise dismiss
      if (velocityY > FLING_VELOCITY) {
        if (settledHeight.current === EXPANDED_H) {
          snapTo(false);
        } else {
          onClose();
        }
        return;
      }
      // Slow release: decide by where it was let go
      if (releasedAt > (COLLAPSED_H + EXPANDED_H) / 2) {
        snapTo(true);
      } else if (releasedAt < COLLAPSED_H - CLOSE_THRESHOLD) {
        onClose();
      } else {
        snapTo(false);
      }
    },
  });

  const handlePlaySong = (song: Song | PlayerSong) => {
    hapticFeedback.light();
    (dispatch as any)(playSong(song, queue));
  };

  const handleRemove = (songId: string) => {
    hapticFeedback.light();
    dispatch(removeSongFromQueue(songId));
  };

  const handleClearUpcoming = () => {
    hapticFeedback.medium();
    dispatch(clearUpcomingQueue());
  };

  const handleAutoQueue = () => {
    hapticFeedback.medium();
    (dispatch as any)(refillQueue(true));
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      {/* Gestures inside a Modal need their own root view (required on Android) */}
      <GestureHandlerRootView style={styles.backdrop}>
        <TouchableOpacity
          style={styles.backdropDismiss}
          activeOpacity={1}
          onPress={onClose}
        />

        <Animated.View
          style={[
            styles.sheetContainer,
            {
              height: sheetHeight,
              paddingBottom: Math.max(24, insets.bottom),
            },
          ]}
        >
          {/* Swipe zone: handle, header and now playing. The list below keeps its own scrolling. */}
          <GestureDetector gesture={panGesture}>
            <View collapsable={false}>
              {/* Handle (tap to toggle) */}
              <TouchableOpacity
                style={styles.handleArea}
                activeOpacity={0.7}
                onPress={() => snapTo(!isExpanded)}
              >
                <View style={styles.dragHandleBar} />
              </TouchableOpacity>

              {/* Header */}
              <View style={styles.header}>
                <View style={styles.headerText}>
                  <Text style={styles.headerTitle}>Queue</Text>
                  <View style={styles.headerSubtitleRow}>
                    <Text style={styles.headerSubtitle}>
                      {upcomingQueue.length}{" "}
                      {upcomingQueue.length === 1 ? "track" : "tracks"} up next
                    </Text>
                    {isQueueBusy ? (
                      <ActivityIndicator
                        size="small"
                        color="#8A8A8A"
                        style={styles.headerSpinner}
                      />
                    ) : null}
                  </View>
                </View>

                {upcomingQueue.length > 0 ? (
                  <TouchableOpacity
                    style={styles.clearButton}
                    onPress={handleClearUpcoming}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.clearButtonText}>Clear</Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              {/* Now playing */}
              {currentSong ? (
                <View style={styles.nowPlayingSection}>
                  <Text style={styles.sectionHeading}>Now playing</Text>
                  <View style={styles.songRowActive}>
                    <Image
                      source={{ uri: currentSong.coverUrl }}
                      style={styles.songThumb}
                      contentFit="cover"
                      cachePolicy="memory"
                    />
                    <View style={styles.songInfo}>
                      <Text style={styles.songTitleActive} numberOfLines={1}>
                        {currentSong.title}
                      </Text>
                      <Text style={styles.songArtistActive} numberOfLines={1}>
                        {currentSong.artistName}
                      </Text>
                    </View>
                    {isPlayerLoading ? (
                      <ActivityIndicator size="small" color="#000000" />
                    ) : (
                      <Ionicons name="volume-high" size={18} color="#000000" />
                    )}
                  </View>
                </View>
              ) : null}
            </View>
          </GestureDetector>

          {/* Up next */}
          <View style={styles.upcomingSection}>
            <Text style={styles.sectionHeading}>Up next</Text>

            {upcomingQueue.length === 0 ? (
              isQueueBusy ? (
                <QueueSkeletonView />
              ) : (
                <View style={[styles.emptyContainer, { paddingBottom: 40 + insets.bottom }]}>
                  <Ionicons name="musical-notes-outline" size={36} color="#5A5A5A" />
                  <Text style={styles.emptyText}>Nothing up next</Text>
                  <Text style={styles.emptySubtext}>
                    Add songs, or keep listening and we’ll queue recommendations.
                  </Text>
                  <TouchableOpacity
                    style={styles.generateButton}
                    onPress={handleAutoQueue}
                    activeOpacity={0.75}
                  >
                    <Ionicons name="sparkles" size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.generateButtonText}>Auto-Queue Songs</Text>
                  </TouchableOpacity>
                </View>
              )
            ) : (
              <FlatList
                data={upcomingQueue}
                keyExtractor={(item, idx) => (item as any).queueId || `${item.id}-${idx}`}
                contentContainerStyle={[
                  styles.listContent,
                  { paddingBottom: Math.max(28, insets.bottom + 20) },
                ]}
                showsVerticalScrollIndicator={false}
                ListFooterComponent={isRefilling ? <QueueFooterLoading /> : undefined}
                renderItem={({ item, index }) => (
                  <TouchableOpacity
                    style={styles.songRow}
                    activeOpacity={0.7}
                    onPress={() => handlePlaySong(item)}
                  >
                    <Text style={styles.queueIndex}>{index + 1}</Text>
                    <Image
                      source={{
                        uri:
                          (item as any).coverUrl ||
                          getImageUrl(item.imageKey, {
                            width: 100,
                            height: 100,
                            aspectRatio: "1-1",
                          }) ||
                          "",
                      }}
                      style={styles.songThumb}
                      contentFit="cover"
                      cachePolicy="memory"
                    />
                    <View style={styles.songInfo}>
                      <Text style={styles.songTitle} numberOfLines={1}>
                        {item.title}
                      </Text>
                      <Text style={styles.songArtist} numberOfLines={1}>
                        {item.artistName}
                      </Text>
                    </View>
                    <Text style={styles.songDuration}>
                      {formatDuration(item.duration)}
                    </Text>
                    <TouchableOpacity
                      hitSlop={12}
                      onPress={() => handleRemove(item.id)}
                      style={styles.removeBtn}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="close" size={18} color="#8A8A8A" />
                    </TouchableOpacity>
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "flex-end",
  },
  backdropDismiss: { flex: 1 },
  sheetContainer: {
    backgroundColor: "#000000",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 30,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: "#262626",
    overflow: "hidden",
  },
  handleArea: {
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 14,
  },
  dragHandleBar: {
    width: 36,
    height: 4,
    backgroundColor: "#262626",
    borderRadius: 2,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SIDE,
    paddingBottom: 14,
  },
  headerText: { flex: 1 },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.6,
  },
  headerSubtitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  headerSubtitle: { color: "#8A8A8A", fontSize: 13 },
  headerSpinner: { marginLeft: 8, transform: [{ scale: 0.75 }] },
  clearButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#151515",
    borderWidth: 1,
    borderColor: "#262626",
  },
  clearButtonText: { color: "#FFFFFF", fontSize: 13, fontWeight: "600" },

  nowPlayingSection: { paddingHorizontal: SIDE, paddingBottom: 6 },
  sectionHeading: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.3,
    marginBottom: 10,
  },

  // The one inverted moment: white card, black text (like the active pill)
  songRowActive: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    padding: 8,
    paddingRight: 14,
    borderRadius: 14,
  },
  songThumb: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: "#151515",
  },
  songInfo: { flex: 1, marginLeft: 12, marginRight: 8 },
  songTitleActive: {
    color: "#000000",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  songArtistActive: { color: "#444444", fontSize: 12, marginTop: 2 },
  songTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  songArtist: { color: "#8A8A8A", fontSize: 12, marginTop: 2 },

  upcomingSection: { flex: 1, paddingHorizontal: SIDE, paddingTop: 18 },
  listContent: { paddingBottom: 20 },
  songRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8 },
  queueIndex: { width: 24, color: "#5A5A5A", fontSize: 12, fontWeight: "600" },
  songDuration: { color: "#5A5A5A", fontSize: 12, marginRight: 8 },
  removeBtn: { padding: 6 },

  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  emptyText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.3,
    marginTop: 12,
  },
  emptySubtext: {
    color: "#5A5A5A",
    fontSize: 13,
    textAlign: "center",
    marginTop: 4,
    marginBottom: 16,
    paddingHorizontal: 30,
  },
  generateButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#202020",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#333333",
  },
  generateButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },

  // Skeleton loading states
  skeletonContainer: {
    paddingTop: 4,
  },
  skeletonBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#161616",
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#262626",
  },
  skeletonBadgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  skeletonRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },
  skeletonIndex: {
    width: 24,
    height: 12,
    borderRadius: 4,
    backgroundColor: "#222222",
  },
  skeletonThumb: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: "#222222",
  },
  skeletonInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
    gap: 6,
  },
  skeletonTitle: {
    width: "60%",
    height: 14,
    borderRadius: 4,
    backgroundColor: "#262626",
  },
  skeletonArtist: {
    width: "35%",
    height: 11,
    borderRadius: 4,
    backgroundColor: "#1E1E1E",
  },
  skeletonDuration: {
    width: 32,
    height: 12,
    borderRadius: 4,
    backgroundColor: "#1E1E1E",
    marginRight: 8,
  },

  // Footer loading when appending tracks
  footerLoadingWrapper: {
    paddingTop: 12,
  },
  footerLoadingBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    marginBottom: 6,
  },
  footerLoadingText: {
    color: "#8A8A8A",
    fontSize: 12,
    fontWeight: "500",
  },
});
