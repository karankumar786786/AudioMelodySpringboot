import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { Song } from "@/types";
import { getImageUrl } from "@/utils/imageUtils";
import { formatStreams, formatSongSubtitle } from "@/utils/formatUtils";
import { hapticFeedback } from "@/utils/haptics";
import { colors, radius, shadows, spacing } from "@/theme";

interface TrendingSongCardProps {
  song: Song;
  rank?: number;
  onPress: () => void;
}

export function TrendingSongCard({ song, rank, onPress }: TrendingSongCardProps) {
  const imageUrl = getImageUrl(song.imageKey, {
    width: 400,
    height: 400,
    focus: "auto",
    aspectRatio: "1-1",
  });

  const handlePress = () => {
    hapticFeedback.light();
    onPress();
  };

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={handlePress}
      activeOpacity={0.82}
    >
      <View style={styles.imageContainer}>
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={styles.image}
            contentFit="cover"
            transition={200}
            cachePolicy="memory"
          />
        ) : (
          <View style={[styles.image, styles.fallback]}>
            <Ionicons name="musical-notes" size={32} color={colors.textMuted} />
          </View>
        )}

        {/* Rank Badge */}
        {rank !== undefined ? (
          <View style={styles.rankBadge}>
            <Text style={styles.rankText}>#{rank}</Text>
          </View>
        ) : null}

        {/* Floating White Play Button */}
        <View style={styles.playButtonOverlay}>
          <Ionicons name="play" size={15} color="#000000" style={{ marginLeft: 2 }} />
        </View>
      </View>

      <Text style={styles.title} numberOfLines={1}>
        {song.title}
      </Text>
      <Text style={styles.artist} numberOfLines={1}>
        {formatSongSubtitle(song.artistName, song.album)}
      </Text>

      {song.totalStreams !== undefined && song.totalStreams !== null ? (
        <View style={styles.streamsRow}>
          <Ionicons name="play" size={9} color={colors.textMuted} />
          <Text style={styles.streams}>{formatStreams(song.totalStreams)}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 152,
    marginRight: spacing.md,
  },
  imageContainer: {
    width: 152,
    height: 152,
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: colors.surfaceElevated,
    marginBottom: spacing.sm + 2,
    position: "relative",
    ...shadows.sm,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  fallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  rankBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "rgba(0, 0, 0, 0.72)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  rankText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  playButtonOverlay: {
    position: "absolute",
    bottom: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    ...shadows.md,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  artist: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "400",
  },
  streamsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  streams: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "500",
  },
});
