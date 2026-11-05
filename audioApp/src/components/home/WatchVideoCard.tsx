import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { Song } from "@/types";
import { getImageUrl } from "@/utils/imageUtils";
import { formatDuration } from "@/utils/formatUtils";
import { hapticFeedback } from "@/utils/haptics";
import { colors, radius, shadows, spacing } from "@/theme";

interface WatchVideoCardProps {
  song: Song;
  onPress: () => void;
}

export function WatchVideoCard({ song, onPress }: WatchVideoCardProps) {
  const imageUrl = getImageUrl(song.imageKey, {
    width: 480,
    height: 270,
    focus: "auto",
    aspectRatio: "16-9",
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
          <View style={[styles.thumbnail, styles.fallback]}>
            <Ionicons name="videocam" size={32} color={colors.textMuted} />
          </View>
        )}

        {/* Center Semi-transparent Play Button */}
        <View style={styles.playButton}>
          <Ionicons
            name="play"
            size={18}
            color="#FFFFFF"
            style={{ marginLeft: 2 }}
          />
        </View>

        {/* Bottom Right Duration Badge */}
        {song.duration ? (
          <View style={styles.durationBadge}>
            <Text style={styles.durationText}>{formatDuration(song.duration)}</Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.title} numberOfLines={1}>
        {song.title}
      </Text>
      <Text style={styles.artist} numberOfLines={1}>
        {song.artistName}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 236,
    marginRight: 14,
  },
  thumbnailContainer: {
    width: 236,
    height: 132,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#1A1A1A",
    marginBottom: 8,
    position: "relative",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    ...shadows.sm,
  },
  thumbnail: {
    width: "100%",
    height: "100%",
  },
  fallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#202020",
  },
  playButton: {
    position: "absolute",
    alignSelf: "center",
    top: "50%",
    marginTop: -20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0, 0, 0, 0.52)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.18)",
  },
  durationBadge: {
    position: "absolute",
    right: 8,
    bottom: 8,
    backgroundColor: "rgba(0, 0, 0, 0.72)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  durationText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  title: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  artist: {
    color: "#8E8E93",
    fontSize: 12,
    fontWeight: "500",
  },
});

