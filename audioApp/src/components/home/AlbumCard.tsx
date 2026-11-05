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

  const subtitle = album.artistName
    ? `${album.artistName}${
        album.trackCount
          ? ` · ${album.trackCount} ${album.trackCount === 1 ? "song" : "songs"}`
          : ""
      }`
    : album.trackCount
    ? `${album.trackCount} ${album.trackCount === 1 ? "song" : "songs"}`
    : "Various Artists";

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
            transition={150}
            cachePolicy="memory"
          />
        ) : (
          <View style={[styles.image, styles.fallback]}>
            <Ionicons name="disc" size={36} color={colors.textMuted} />
          </View>
        )}
      </View>

      <Text style={styles.title} numberOfLines={1}>
        {album.name}
      </Text>
      <Text style={styles.artist} numberOfLines={1}>
        {subtitle}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 140,
    marginRight: 14,
    backgroundColor: "transparent",
  },
  imageContainer: {
    width: 140,
    height: 140,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#1A1A1A",
    marginBottom: 8,
    position: "relative",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    ...shadows.sm,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  fallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#202020",
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
