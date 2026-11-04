import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { Song } from "@/types";
import { getImageUrl } from "@/utils/imageUtils";
import { formatStreams } from "@/utils/formatUtils";
import { hapticFeedback } from "@/utils/haptics";
import { colors, radius, shadows, spacing, typography } from "@/theme";

interface QuickPickCardProps {
  song: Song;
  width: number;
  isActive?: boolean;
  isPlaying?: boolean;
  onPress: () => void;
}

export function QuickPickCard({
  song,
  width,
  isActive = false,
  isPlaying = false,
  onPress,
}: QuickPickCardProps) {
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
        {song.totalStreams !== undefined && song.totalStreams !== null ? (
          <Text style={styles.plays} numberOfLines={1}>
            {formatStreams(song.totalStreams)}
          </Text>
        ) : null}
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
    height: 60,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    overflow: "hidden",
  },
  cardActive: {
    borderColor: "#FFFFFF",
    backgroundColor: colors.cardHover,
  },
  image: {
    width: 60,
    height: 60,
    backgroundColor: colors.surface,
  },
  fallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  textContainer: {
    flex: 1,
    paddingHorizontal: spacing.sm + 2,
    justifyContent: "center",
  },
  title: {
    color: colors.textPrimary,
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
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "500",
    flexShrink: 1,
  },
  plays: {
    color: colors.textMuted,
    fontSize: 10,
    marginTop: 1,
  },
  actionCol: {
    paddingRight: spacing.sm,
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
