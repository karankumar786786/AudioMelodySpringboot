import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Song } from "@/types";
import { getImageUrl } from "@/utils/imageUtils";
import { hapticFeedback } from "@/utils/haptics";
import { colors, radius, shadows, spacing } from "@/theme";

export interface QuickPickCardProps {
  song?: Song | null;
  width: number;
  isActive?: boolean;
  isPlaying?: boolean;
  isLikedSongs?: boolean;
  likedCount?: number;
  onPress: () => void;
}

export function QuickPickCard({
  song,
  width,
  isActive = false,
  isPlaying = false,
  isLikedSongs = false,
  likedCount = 0,
  onPress,
}: QuickPickCardProps) {
  const imageUrl = song?.imageKey
    ? getImageUrl(song.imageKey, {
        width: 160,
        height: 160,
        focus: "auto",
        aspectRatio: "1-1",
      })
    : null;

  const handlePress = () => {
    hapticFeedback.light();
    onPress();
  };

  // Special "Liked Songs" Tile (Spotify signature gradient heart)
  if (isLikedSongs) {
    return (
      <TouchableOpacity
        style={[styles.card, { width }, isActive && styles.cardActive]}
        onPress={handlePress}
        activeOpacity={0.75}
      >
        <LinearGradient
          colors={["#450af5", "#8e8ee5"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.image}
        >
          <Ionicons name="heart" size={24} color="#FFFFFF" />
        </LinearGradient>

        <View style={styles.textContainer}>
          <Text style={styles.title} numberOfLines={1}>
            Liked Songs
          </Text>
          <Text style={styles.artist} numberOfLines={1}>
            {likedCount > 0 ? `${likedCount} songs` : "Playlist"}
          </Text>
        </View>

        <View style={styles.actionCol}>
          {isActive ? (
            <View style={styles.activeIconCircle}>
              <Ionicons
                name={isPlaying ? "pause" : "play"}
                size={11}
                color="#000000"
                style={isPlaying ? undefined : { marginLeft: 1 }}
              />
            </View>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  }

  if (!song) return null;

  return (
    <TouchableOpacity
      style={[styles.card, { width }, isActive && styles.cardActive]}
      onPress={handlePress}
      activeOpacity={0.75}
    >
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
          <Ionicons name="musical-note" size={20} color={colors.textMuted} />
        </View>
      )}

      <View style={styles.textContainer}>
        <Text style={styles.title} numberOfLines={1}>
          {song.title}
        </Text>
        <View style={styles.metaRow}>
          {isActive ? (
            <Ionicons
              name={isPlaying ? "volume-high" : "pause"}
              size={11}
              color="#FFFFFF"
              style={{ marginRight: 4 }}
            />
          ) : null}
          <Text style={styles.artist} numberOfLines={1}>
            {song.artistName}
          </Text>
        </View>
      </View>

      {/* Mini Play / Active Indicator */}
      <View style={styles.actionCol}>
        {isActive ? (
          <View style={styles.activeIconCircle}>
            <Ionicons
              name={isPlaying ? "pause" : "play"}
              size={11}
              color="#000000"
              style={isPlaying ? undefined : { marginLeft: 1 }}
            />
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    height: 56,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.07)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
    overflow: "hidden",
  },
  cardActive: {
    borderColor: "rgba(255, 255, 255, 0.35)",
    backgroundColor: "rgba(255, 255, 255, 0.12)",
  },
  image: {
    width: 56,
    height: 56,
    backgroundColor: "#1E1E1E",
    alignItems: "center",
    justifyContent: "center",
  },
  fallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  textContainer: {
    flex: 1,
    paddingHorizontal: 10,
    justifyContent: "center",
  },
  title: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  artist: {
    color: "#8E8E93",
    fontSize: 11,
    fontWeight: "500",
    flexShrink: 1,
  },
  actionCol: {
    paddingRight: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  activeIconCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
});
