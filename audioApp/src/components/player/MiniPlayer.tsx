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
        <TouchableOpacity
          style={styles.trackInfoTouchArea}
          activeOpacity={0.8}
          onPress={handlePressCard}
        >
          <Image
            source={{ uri: currentSong.coverUrl }}
            style={styles.artwork}
            contentFit="cover"
            transition={150}
            cachePolicy="memory"
          />

          <View style={styles.textContainer}>
            <Text style={styles.title} numberOfLines={1}>
              {currentSong.title}
            </Text>
            <Text style={styles.artist} numberOfLines={1}>
              {currentSong.artistName}
            </Text>
          </View>
        </TouchableOpacity>

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.nextButton}
            hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
            onPress={handleNext}
            activeOpacity={0.7}
          >
            <Ionicons name="play-skip-forward" size={20} color="#FFFFFF" />
          </TouchableOpacity>

          {/* Inverted play button: white fill, black glyph (same as the active filter pill) */}
          <TouchableOpacity
            style={styles.playButton}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
            onPress={handleTogglePlay}
            activeOpacity={0.85}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#000000" />
            ) : (
              <Ionicons
                name={isPlaying ? "pause" : "play"}
                size={20}
                color="#000000"
                style={isPlaying ? undefined : { marginLeft: 2 }}
              />
            )}
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.progressBarBackground}>
        <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#151515",
    marginHorizontal: 10,
    marginBottom: 4,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#262626",
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
    borderRadius: 8,
    backgroundColor: "#000000",
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
    fontWeight: "800",
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  artist: {
    color: "#8A8A8A",
    fontSize: 12,
    fontWeight: "500",
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  nextButton: {
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  playButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
  },
  progressBarBackground: {
    height: 2,
    backgroundColor: "#262626",
    width: "100%",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#FFFFFF",
  },
});