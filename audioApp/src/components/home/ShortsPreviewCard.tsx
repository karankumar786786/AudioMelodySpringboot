import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Song } from "@/types";
import { getImageUrl } from "@/utils/imageUtils";
import { hapticFeedback } from "@/utils/haptics";
import { colors, radius, shadows, spacing } from "@/theme";

interface ShortsPreviewCardProps {
  song: Song;
  onPress: () => void;
}

export function ShortsPreviewCard({ song, onPress }: ShortsPreviewCardProps) {
  const imageUrl = getImageUrl(song.imageKey, {
    width: 360,
    height: 640,
    focus: "auto",
    aspectRatio: "9-16",
    crop: "at_least",
  });

  const handlePress = () => {
    hapticFeedback.light();
    onPress();
  };

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={handlePress}
      activeOpacity={0.85}
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
            <Ionicons name="film-outline" size={32} color={colors.textMuted} />
          </View>
        )}

        {/* Top-left Shorts Badge */}
        <View style={styles.badgeContainer}>
          <LinearGradient
            colors={["#FF2D55", "#9B51E0"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.badge}
          >
            <Ionicons name="flash" size={10} color="#FFFFFF" style={{ marginRight: 3 }} />
            <Text style={styles.badgeText}>SHORTS</Text>
          </LinearGradient>
        </View>

        {/* Subtle Dark Gradient Overlay at the bottom */}
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.5)", "rgba(0,0,0,0.92)"]}
          locations={[0.4, 0.7, 1.0]}
          style={styles.gradient}
        />

        {/* Bottom Metadata & Play Pill */}
        <View style={styles.infoOverlay}>
          <View style={styles.textContainer}>
            <Text style={styles.title} numberOfLines={1}>
              {song.title}
            </Text>
            <Text style={styles.artist} numberOfLines={1}>
              {song.artistName}
            </Text>
          </View>

          <View style={styles.playIconContainer}>
            <Ionicons name="play" size={12} color="#FFFFFF" style={{ marginLeft: 1 }} />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 140,
    marginRight: spacing.md,
    borderRadius: radius.lg,
    overflow: "hidden",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    ...shadows.md,
  },
  thumbnailContainer: {
    width: 140,
    height: 220,
    position: "relative",
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  thumbnail: {
    width: "100%",
    height: "100%",
  },
  fallback: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.surface,
  },
  badgeContainer: {
    position: "absolute",
    top: 8,
    left: 8,
    zIndex: 3,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  gradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  infoOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.sm,
    zIndex: 2,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  textContainer: {
    flex: 1,
    marginRight: 6,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 2,
  },
  artist: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "500",
  },
  playIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.25)",
    justifyContent: "center",
    alignItems: "center",
    backdropFilter: "blur(8px)",
  },
});
