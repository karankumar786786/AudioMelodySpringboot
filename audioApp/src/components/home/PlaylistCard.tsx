import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { Playlist } from "@/types";
import { getImageUrl } from "@/utils/imageUtils";
import { hapticFeedback } from "@/utils/haptics";
import { colors, radius, shadows, spacing } from "@/theme";

interface PlaylistCardProps {
  playlist: Playlist;
  onPress: () => void;
}

export function PlaylistCard({ playlist, onPress }: PlaylistCardProps) {
  const imageUrl = getImageUrl(playlist.coverImageKey, {
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
            <Ionicons name="musical-notes-outline" size={34} color={colors.textMuted} />
          </View>
        )}

        {/* Floating White Play Button */}
        <View style={styles.playButtonOverlay}>
          <Ionicons name="play" size={15} color="#000000" style={{ marginLeft: 2 }} />
        </View>
      </View>

      <Text style={styles.title} numberOfLines={1}>
        {playlist.name}
      </Text>
      <Text style={styles.subtitle} numberOfLines={1}>
        {playlist.totalSongs} {playlist.totalSongs === 1 ? "track" : "tracks"}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 148,
    marginRight: spacing.md,
    backgroundColor: "transparent", // strictly transparent, no white bg!
  },
  imageContainer: {
    width: 148,
    height: 148,
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
  subtitle: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "400",
  },
});
