import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { Song } from "@/types";
import { getImageUrl } from "@/utils/imageUtils";
import { formatDuration, formatSongSubtitle } from "@/utils/formatUtils";
import { hapticFeedback } from "@/utils/haptics";
import { colors, radius, spacing } from "@/theme";

interface SongRowItemProps {
  song: Song;
  index?: number;
  isActive?: boolean;
  isPlaying?: boolean;
  onPress: () => void;
}

export function SongRowItem({
  song,
  index,
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

  const handlePress = () => {
    hapticFeedback.light();
    onPress();
  };

  return (
    <TouchableOpacity
      style={[styles.container, isActive && styles.containerActive]}
      onPress={handlePress}
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
            <Ionicons name="musical-note" size={18} color={colors.textMuted} />
          </View>
        )}
        {isActive ? (
          <View style={styles.activeOverlay}>
            <Ionicons
              name={isPlaying ? "volume-high" : "pause"}
              size={18}
              color="#FFFFFF"
            />
          </View>
        ) : null}
      </View>

      <View style={styles.info}>
        <Text
          style={[styles.title, isActive && styles.titleActive]}
          numberOfLines={1}
        >
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
    paddingHorizontal: spacing.side,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  containerActive: {
    backgroundColor: colors.surfaceElevated,
  },
  thumbnailContainer: {
    width: 50,
    height: 50,
    borderRadius: radius.sm + 2,
    overflow: "hidden",
    backgroundColor: colors.surfaceElevated,
    marginRight: spacing.md - 2,
    position: "relative",
  },
  thumbnail: {
    width: "100%",
    height: "100%",
  },
  fallback: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  activeOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  info: {
    flex: 1,
    paddingRight: spacing.sm,
    justifyContent: "center",
  },
  title: {
    fontSize: 14.5,
    fontWeight: "600",
    letterSpacing: -0.2,
    color: colors.textPrimary,
    marginBottom: 3,
  },
  titleActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  duration: {
    fontSize: 12,
    color: colors.textMuted,
    fontVariant: ["tabular-nums"],
  },
});
