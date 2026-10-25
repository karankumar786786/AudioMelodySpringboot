import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  Dimensions,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useSelector, useDispatch } from "react-redux";
import { AppState } from "@/store/hook";
import { PlayerSong } from "@/types";
import { clearUpcomingQueue, removeSongFromQueue } from "@/store/queueSlice";
import { playSong } from "@/store/queueActions";
import { formatDuration } from "@/utils/formatUtils";

interface QueueModalProps {
  visible: boolean;
  onClose: () => void;
}

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

export function QueueModal({ visible, onClose }: QueueModalProps) {
  const dispatch = useDispatch();

  const currentSong = useSelector((state: AppState) => state.player.currentSong);
  const queue = useSelector((state: AppState) => state.queue.queue);
  const lastQueueIndex = useSelector((state: AppState) => state.queue.lastQueueIndex);

  // Split into currently playing and upcoming tracks
  const upcomingQueue =
    lastQueueIndex >= 0 ? queue.slice(lastQueueIndex + 1) : queue;

  const handlePlaySong = (song: PlayerSong) => {
    (dispatch as any)(playSong(song));
  };

  const handleRemove = (songId: string) => {
    dispatch(removeSongFromQueue(songId));
  };

  const handleClearUpcoming = () => {
    dispatch(clearUpcomingQueue());
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <TouchableOpacity
          style={styles.backdropDismiss}
          activeOpacity={1}
          onPress={onClose}
        />

        <View style={styles.sheetContainer}>
          {/* Handle */}
          <View style={styles.dragHandleBar} />

          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>Queue</Text>
              <Text style={styles.headerSubtitle}>
                {upcomingQueue.length} {upcomingQueue.length === 1 ? "track" : "tracks"} upcoming
              </Text>
            </View>

            {upcomingQueue.length > 0 ? (
              <TouchableOpacity
                style={styles.clearButton}
                onPress={handleClearUpcoming}
              >
                <Text style={styles.clearButtonText}>Clear Upcoming</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Now Playing Section */}
          {currentSong ? (
            <View style={styles.nowPlayingSection}>
              <Text style={styles.sectionHeading}>NOW PLAYING</Text>
              <View style={styles.songRowActive}>
                <Image
                  source={{ uri: currentSong.coverUrl }}
                  style={styles.songThumb}
                  contentFit="cover"
                />
                <View style={styles.songInfo}>
                  <Text style={styles.songTitleActive} numberOfLines={1}>
                    {currentSong.title}
                  </Text>
                  <Text style={styles.songArtist} numberOfLines={1}>
                    {currentSong.artistName}
                  </Text>
                </View>
                <View style={styles.playingBadge}>
                  <Ionicons name="volume-high" size={16} color="#1DB954" />
                </View>
              </View>
            </View>
          ) : null}

          {/* Upcoming Tracks List */}
          <View style={styles.upcomingSection}>
            <Text style={styles.sectionHeading}>UP NEXT</Text>

            {upcomingQueue.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="musical-notes-outline" size={36} color="#555555" />
                <Text style={styles.emptyText}>No tracks up next</Text>
                <Text style={styles.emptySubtext}>
                  Add songs or keep listening for automated recommendations
                </Text>
              </View>
            ) : (
              <FlatList
                data={upcomingQueue}
                keyExtractor={(item, idx) => item.queueId || `${item.id}-${idx}`}
                contentContainerStyle={styles.listContent}
                renderItem={({ item, index }) => (
                  <TouchableOpacity
                    style={styles.songRow}
                    activeOpacity={0.7}
                    onPress={() => handlePlaySong(item)}
                  >
                    <Text style={styles.queueIndex}>{index + 1}</Text>
                    <Image
                      source={{ uri: item.coverUrl }}
                      style={styles.songThumb}
                      contentFit="cover"
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
                    >
                      <Ionicons name="close" size={18} color="#777777" />
                    </TouchableOpacity>
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    justifyContent: "flex-end",
  },
  backdropDismiss: {
    flex: 1,
  },
  sheetContainer: {
    backgroundColor: "#1C1C1E",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: SCREEN_HEIGHT * 0.78,
    minHeight: SCREEN_HEIGHT * 0.45,
    paddingTop: 12,
    paddingBottom: 30,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.1)",
  },
  dragHandleBar: {
    width: 36,
    height: 4,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 12,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },
  headerSubtitle: {
    color: "#888888",
    fontSize: 12,
    marginTop: 2,
  },
  clearButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 14,
  },
  clearButtonText: {
    color: "#E0E0E0",
    fontSize: 12,
    fontWeight: "600",
  },
  nowPlayingSection: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.06)",
  },
  sectionHeading: {
    color: "#8E8E93",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  songRowActive: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(29, 185, 84, 0.08)",
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(29, 185, 84, 0.25)",
  },
  songThumb: {
    width: 42,
    height: 42,
    borderRadius: 6,
    backgroundColor: "#2C2C2E",
  },
  songInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  songTitleActive: {
    color: "#1DB954",
    fontSize: 14,
    fontWeight: "700",
  },
  songTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  songArtist: {
    color: "#8E8E93",
    fontSize: 12,
    marginTop: 2,
  },
  playingBadge: {
    paddingRight: 6,
  },
  upcomingSection: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  listContent: {
    paddingBottom: 20,
  },
  songRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },
  queueIndex: {
    width: 22,
    color: "#666666",
    fontSize: 12,
    fontWeight: "600",
  },
  songDuration: {
    color: "#777777",
    fontSize: 12,
    marginRight: 8,
  },
  removeBtn: {
    padding: 6,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  emptyText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
    marginTop: 10,
  },
  emptySubtext: {
    color: "#777777",
    fontSize: 12,
    textAlign: "center",
    marginTop: 4,
    paddingHorizontal: 30,
  },
});
