import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { Artist } from "@/types";
import { getImageUrl } from "@/utils/imageUtils";
import { hapticFeedback } from "@/utils/haptics";
import { colors, radius, shadows, spacing } from "@/theme";

interface ArtistCircleCardProps {
  artist: Artist;
  onPress: () => void;
}

export function ArtistCircleCard({ artist, onPress }: ArtistCircleCardProps) {
  const imageUrl = getImageUrl(artist.coverImageKey, {
    width: 300,
    height: 300,
    focus: "auto",
    aspectRatio: "1-1",
  });

  const handlePress = () => {
    hapticFeedback.light();
    onPress();
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={handlePress}
      activeOpacity={0.78}
    >
      <View style={styles.avatarWrapper}>
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={styles.avatar}
            contentFit="cover"
            transition={200}
            cachePolicy="memory"
          />
        ) : (
          <View style={[styles.avatar, styles.fallback]}>
            <Ionicons name="person" size={40} color={colors.textMuted} />
          </View>
        )}
      </View>
      <Text style={styles.name} numberOfLines={1}>
        {artist.name}
      </Text>
      <Text style={styles.badge} numberOfLines={1}>
        Artist
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 104,
    marginRight: spacing.md,
    alignItems: "center",
  },
  avatarWrapper: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: colors.surfaceElevated,
    overflow: "hidden",
    marginBottom: spacing.sm,
    // Zero harsh border, smooth clean elevation
    borderWidth: 0,
    ...shadows.sm,
  },
  avatar: {
    width: "100%",
    height: "100%",
  },
  fallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  name: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: -0.2,
    textAlign: "center",
    width: "100%",
    marginBottom: 2,
  },
  badge: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "500",
    textAlign: "center",
  },
});
