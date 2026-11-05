import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { Song } from "@/types";
import { getImageUrl } from "@/utils/imageUtils";
import { hapticFeedback } from "@/utils/haptics";
import { colors, radius, shadows, spacing } from "@/theme";

interface JumpBackInCardProps {
  song: Song;
  isActive?: boolean;
  isPlaying?: boolean;
  onPress: () => void;
}

export function JumpBackInCard({
  song,
  isActive = false,
  isPlaying = false,
  onPress,
}: JumpBackInCardProps) {
  const imageUrl = getImageUrl(song.imageKey, {
    width: 320,
    height: 320,
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
      activeOpacity={0.8}
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
            <Ionicons name="musical-note" size={32} color={colors.textMuted} />
          </View>
        )}

        {isActive ? (
          <View style={styles.activeOverlay}>
            <Ionicons
              name={isPlaying ? "volume-high" : "pause"}
              size={20}
              color="#FFFFFF"
            />
          </View>
        ) : null}
      </View>

      <Text style={[styles.title, isActive && styles.titleActive]} numberOfLines={1}>
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
    width: 140,
    marginRight: 14,
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
  activeOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  titleActive: {
    color: "#1DB954",
  },
  artist: {
    color: "#8E8E93",
    fontSize: 12,
    fontWeight: "500",
  },
});
