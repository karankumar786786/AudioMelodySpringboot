import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { Song } from "@/types";
import { getImageUrl } from "@/utils/imageUtils";
import { formatDuration, formatSongSubtitle } from "@/utils/formatUtils";

interface SongRowItemProps {
  song: Song;
  index?: number;
  isActive?: boolean;
  isPlaying?: boolean;
  onPress: () => void;
}

export function SongRowItem({
  song,
  isActive = false,
  isPlaying = false,
  onPress,
}: SongRowItemProps) {
  const imageUrl = getImageUrl(song.imageKey, {
    width: 160,
    height: 160,
    focus: "auto",
    aspectRatio: "1-1",
  });

  return (
    <TouchableOpacity
      style={[styles.container, isActive && styles.containerActive]}
      onPress={onPress}
      activeOpacity={0.72}
    >
      <View style={styles.thumbnailContainer}>
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={styles.thumbnail}
            contentFit="cover"
            transition={150}
            cachePolicy="memory"
          />
        ) : (
          <View style={styles.fallback}>
            <Ionicons name="musical-note" size={20} color="#5A5A5A" />
          </View>
        )}
        {isActive ? (
          <View style={styles.activeOverlay}>
            <Ionicons name={isPlaying ? "volume-high" : "pause"} size={18} color="#FFFFFF" />
          </View>
        ) : null}
      </View>

      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>
          {song.title}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {formatSongSubtitle(song.artistName, song.album, song.genre)}
        </Text>
      </View>

      <Text style={styles.duration}>{formatDuration(song.duration)}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  containerActive: { backgroundColor: "#151515" },
  thumbnailContainer: {
    width: 52,
    height: 52,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#151515",
    borderWidth: 1,
    borderColor: "#262626",
    marginRight: 12,
  },
  thumbnail: { width: "100%", height: "100%" },
  fallback: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  activeOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  info: { flex: 1, paddingRight: 12 },
  title: {
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: -0.2,
    color: "#FFFFFF",
    marginBottom: 3,
  },
  subtitle: { fontSize: 12.5, color: "#8A8A8A" },
  duration: {
    fontSize: 12,
    color: "#5A5A5A",
    fontVariant: ["tabular-nums"],
  },
});