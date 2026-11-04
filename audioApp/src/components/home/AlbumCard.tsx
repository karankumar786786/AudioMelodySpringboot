import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { getImageUrl } from "@/utils/imageUtils";
import { hapticFeedback } from "@/utils/haptics";
import { colors, radius, shadows, spacing } from "@/theme";

export interface AlbumItem {
  name: string;
  artistName?: string;
  trackCount?: number;
  imageKey?: string;
  genre?: string;
}

interface AlbumCardProps {
  album: AlbumItem;
  onPress: () => void;
}

export function AlbumCard({ album, onPress }: AlbumCardProps) {
  const imageUrl = getImageUrl(album.imageKey, {
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
            <Ionicons name="disc" size={36} color={colors.textMuted} />
          </View>
        )}

        {/* Album Tag */}
        <View style={styles.albumTag}>
          <Text style={styles.albumTagText}>ALBUM</Text>
        </View>

        {/* Floating Play Button */}
        <View style={styles.playButtonOverlay}>
          <Ionicons name="play" size={15} color="#000000" style={{ marginLeft: 2 }} />
        </View>
      </View>

      <Text style={styles.title} numberOfLines={1}>
        {album.name}
      </Text>
      <Text style={styles.artist} numberOfLines={1}>
        {album.artistName || "Various Artists"}
      </Text>
      {album.trackCount ? (
        <Text style={styles.meta} numberOfLines={1}>
          {album.trackCount} {album.trackCount === 1 ? "song" : "songs"}
          {album.genre ? ` • ${album.genre}` : ""}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 148,
    marginRight: spacing.md,
    backgroundColor: "transparent",
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
  albumTag: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  albumTagText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.5,
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
    marginBottom: 1,
  },
  meta: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "400",
  },
});
