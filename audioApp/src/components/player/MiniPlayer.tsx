import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSelector, useDispatch } from "react-redux";
import { AppState } from "@/store/hook";
import { audioPlayerService } from "@/service/audioPlayerService";
import { nextTrack } from "@/store/queueActions";

export function MiniPlayer() {
  const router = useRouter();
  const dispatch = useDispatch();

  const currentSong = useSelector((state: AppState) => state.player.currentSong);
  const isPlaying = useSelector((state: AppState) => state.player.isPlaying);
  const isLoading = useSelector((state: AppState) => state.player.isLoading);
  const currentTime = useSelector((state: AppState) => state.player.currentTime);
  const duration = useSelector((state: AppState) => state.player.duration);

  if (!currentSong) return null;

  const progressPercent =
    duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  const handlePressCard = () => {
    router.push(`/song/${currentSong.id}`);
  };

  const handleTogglePlay = (e: any) => {
    e.stopPropagation?.();
    audioPlayerService.togglePlay();
  };

  const handleNext = (e: any) => {
    e.stopPropagation?.();
    (dispatch as any)(nextTrack(true));
  };

  return (
    <View style={styles.container}>
      <View style={styles.contentRow}>
        {/* Left Track Info Area: Tappable to open full player screen */}
        <TouchableOpacity
          style={styles.trackInfoTouchArea}
          activeOpacity={0.8}
          onPress={handlePressCard}
        >
          {/* Cover Art */}
          <Image
            source={{ uri: currentSong.coverUrl }}
            style={styles.artwork}
            contentFit="cover"
            transition={150}
            cachePolicy="memory"
          />

          {/* Track Title and Artist */}
          <View style={styles.textContainer}>
            <Text style={styles.title} numberOfLines={1}>
              {currentSong.title}
            </Text>
            <Text style={styles.artist} numberOfLines={1}>
              {currentSong.artistName}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Play/Pause & Next Controls: Completely independent touch targets */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.actionButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 4 }}
            onPress={handleTogglePlay}
            activeOpacity={0.7}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons
                name={isPlaying ? "pause" : "play"}
                size={24}
                color="#FFFFFF"
              />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            hitSlop={{ top: 10, bottom: 10, left: 4, right: 10 }}
            onPress={handleNext}
            activeOpacity={0.7}
          >
            <Ionicons name="play-skip-forward" size={20} color="#CCCCCC" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Progress Track at Bottom Edge */}
      <View style={styles.progressBarBackground}>
        <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#1F1F1F",
    marginHorizontal: 8,
    marginBottom: 4,
    borderRadius: 10,
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  contentRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  trackInfoTouchArea: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  artwork: {
    width: 44,
    height: 44,
    borderRadius: 6,
    backgroundColor: "#2A2A2A",
  },
  textContainer: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
    justifyContent: "center",
  },
  title: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 2,
  },
  artist: {
    color: "#A0A0A0",
    fontSize: 12,
    fontWeight: "500",
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 4,
  },
  actionButton: {
    padding: 6,
    marginLeft: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  progressBarBackground: {
    height: 2.5,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    width: "100%",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#FFFFFF",
  },
});
