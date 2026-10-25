import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { homeService } from "@/service";
import { CanvasVideoPlayer } from "@/components/common/CanvasVideoPlayer";

import { formatStreams } from "@/utils/formatUtils";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

export default function SongDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const { data: song, isLoading, isError, error } = useQuery({
    queryKey: ["song", id],
    queryFn: () => homeService.getSongById(id!),
    enabled: Boolean(id),
  });

  const formatDuration = (sec?: number) => {
    if (!sec || sec <= 0) return "--:--";
    const mins = Math.floor(sec / 60);
    const secs = Math.floor(sec % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#FFFFFF" />
        <Text style={styles.loadingText}>Loading track...</Text>
      </SafeAreaView>
    );
  }

  if (isError || !song) {
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

  const canvasHeight = Math.min(SCREEN_HEIGHT * 0.44, 380);

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Navigation Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => router.back()}
          hitSlop={12}
        >
          <Ionicons name="chevron-down" size={28} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={styles.topBarTitleContainer}>
          <Text style={styles.topBarSubtitle}>PLAYING FROM MELODY</Text>
          <Text style={styles.topBarTitle} numberOfLines={1}>
            {song.album || song.genre || "Featured"}
          </Text>
        </View>

        <TouchableOpacity style={styles.iconButton} hitSlop={12}>
          <Ionicons name="ellipsis-horizontal" size={22} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Canvas Video / Artwork Stage */}
      <View style={styles.canvasWrapper}>
        <CanvasVideoPlayer
          videoKey={song.videoKey}
          fallbackImageKey={song.imageKey}
          style={[styles.canvas, { height: canvasHeight }]}
        />

        {song.videoKey ? (
          <View style={styles.canvasIndicator}>
            <Ionicons name="videocam" size={12} color="#FFFFFF" style={{ marginRight: 4 }} />
            <Text style={styles.canvasIndicatorText}>CANVAS VIDEO</Text>
          </View>
        ) : null}
      </View>

      {/* Song Metadata */}
      <View style={styles.metaSection}>
        <View style={styles.titleContainer}>
          <Text style={styles.songTitle} numberOfLines={1}>
            {song.title}
          </Text>
          <Text style={styles.artistName} numberOfLines={1}>
            {song.artistName}
          </Text>

          {/* Album, Genre, and Total Streams */}
          <View style={styles.tagsRow}>
            {song.album ? (
              <View style={styles.tagBadge}>
                <Ionicons
                  name="disc-outline"
                  size={12}
                  color="#AAAAAA"
                  style={{ marginRight: 4 }}
                />
                <Text style={styles.tagText} numberOfLines={1}>
                  {song.album}
                </Text>
              </View>
            ) : null}

            {song.genre ? (
              <View style={styles.tagBadge}>
                <Ionicons
                  name="musical-notes-outline"
                  size={12}
                  color="#AAAAAA"
                  style={{ marginRight: 4 }}
                />
                <Text style={styles.tagText} numberOfLines={1}>
                  {song.genre}
                </Text>
              </View>
            ) : null}

            {song.totalStreams !== undefined && song.totalStreams !== null ? (
              <View style={styles.tagBadge}>
                <Ionicons
                  name="trending-up"
                  size={12}
                  color="#AAAAAA"
                  style={{ marginRight: 4 }}
                />
                <Text style={styles.tagText}>
                  {formatStreams(song.totalStreams)}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        <TouchableOpacity hitSlop={12}>
          <Ionicons name="heart-outline" size={26} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Progress Bar (Visual Mock) */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBarBackground}>
          <View style={[styles.progressBarFill, { width: "35%" }]} />
        </View>
        <View style={styles.timeRow}>
          <Text style={styles.timeText}>0:45</Text>
          <Text style={styles.timeText}>{formatDuration(song.duration)}</Text>
        </View>
      </View>

      {/* Playback Controls */}
      <View style={styles.controlsRow}>
        <TouchableOpacity hitSlop={12}>
          <Ionicons name="shuffle" size={22} color="#888888" />
        </TouchableOpacity>

        <TouchableOpacity hitSlop={12}>
          <Ionicons name="play-skip-back" size={28} color="#FFFFFF" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.mainPlayButton} activeOpacity={0.85}>
          <Ionicons name="pause" size={30} color="#000000" />
        </TouchableOpacity>

        <TouchableOpacity hitSlop={12}>
          <Ionicons name="play-skip-forward" size={28} color="#FFFFFF" />
        </TouchableOpacity>

        <TouchableOpacity hitSlop={12}>
          <Ionicons name="repeat" size={22} color="#888888" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
    justifyContent: "space-between",
    paddingBottom: 30,
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
    shadowColor: "#FFFFFF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 10,
    elevation: 6,
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
    padding: 4,
  },
  canvasWrapper: {
    paddingHorizontal: 24,
    alignItems: "center",
    position: "relative",
  },
  canvas: {
    width: SCREEN_WIDTH - 48,
    borderRadius: 16,
    backgroundColor: "#1E1E1E",
    borderWidth: 1,
    borderColor: "#2A2A2A",
  },
  canvasIndicator: {
    position: "absolute",
    top: 14,
    right: 36,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  canvasIndicatorText: {
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
  progressBarBackground: {
    height: 4,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderRadius: 2,
    overflow: "hidden",
    marginBottom: 8,
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 2,
    shadowColor: "#FFFFFF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  timeText: {
    fontSize: 12,
    color: "#888888",
  },
  controlsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 30,
  },
  mainPlayButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
  },
});
