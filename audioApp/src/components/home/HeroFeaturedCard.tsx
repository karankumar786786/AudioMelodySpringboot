import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { Song } from "@/types";
import { formatSongSubtitle } from "@/utils/formatUtils";
import { getImageUrl } from "@/utils/imageUtils";
import { hapticFeedback } from "@/utils/haptics";
import { shadows } from "@/theme";

interface HeroFeaturedCardProps {
  song: Song;
  onPress: () => void;
  onPlayPress?: () => void;
  onLikePress?: () => void;
  isLiked?: boolean;
  isPlaying?: boolean;
  isAudioPlaying?: boolean;
  isCurrentTrack?: boolean;
  isFocused?: boolean;
  cardWidth?: number;
  totalSlides?: number;
  activeIndex?: number;
}

export function HeroFeaturedCard({
  song,
  onPress,
  onPlayPress,
  onLikePress,
  isLiked = false,
  isPlaying,
  isAudioPlaying = false,
  isCurrentTrack = false,
  cardWidth,
  totalSlides = 1,
  activeIndex = 0,
}: HeroFeaturedCardProps) {
  const effectiveAudioPlaying =
    isAudioPlaying || (isCurrentTrack && Boolean(isPlaying));

  const imageUrl = getImageUrl(song.imageKey, {
    width: 880,
    height: 572,
    focus: "auto",
    aspectRatio: "16-9",
    crop: "at_least",
  });

  const handleLike = () => {
    hapticFeedback.light();
    onLikePress?.();
  };

  const handlePlay = () => {
    hapticFeedback.medium();
    onPlayPress?.();
  };

  return (
    <TouchableOpacity
      style={[
        styles.card,
        cardWidth ? { width: cardWidth, marginHorizontal: 0 } : null,
      ]}
      onPress={onPress}
      activeOpacity={0.95}
    >
      {/* 1. Top Image Preview Area: 260px rounded container */}
      <View style={styles.imageContainer}>
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={200}
            cachePolicy="memory"
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.fallbackContainer]}>
            <Ionicons
              name="musical-notes"
              size={48}
              color="rgba(255, 255, 255, 0.4)"
            />
          </View>
        )}

        {/* Pager Dots at bottom of the image container */}
        {totalSlides > 1 ? (
          <View style={styles.pagerContainer} pointerEvents="none">
            {Array.from({ length: totalSlides }).map((_, i) => {
              const isActive = i === activeIndex;
              return (
                <View
                  key={i}
                  style={[
                    styles.pagerDot,
                    isActive ? styles.pagerDotActive : styles.pagerDotInactive,
                  ]}
                />
              );
            })}
          </View>
        ) : null}
      </View>

      {/* 2. Bottom Metadata & Controls Area: Transparent like video / song cards */}
      <View style={styles.bottomBar}>
        <View style={styles.metaInfo}>
          <Text style={styles.title} numberOfLines={1}>
            {song.title}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {formatSongSubtitle(song.artistName, song.album)}
          </Text>
        </View>

        <View style={styles.actionsRow}>
          {/* Favourite / Heart Button */}
          <TouchableOpacity
            style={styles.heartButton}
            onPress={handleLike}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel="Favourite"
          >
            <Ionicons
              name={isLiked ? "heart" : "heart-outline"}
              size={24}
              color={isLiked ? "#E23D3D" : "#FFFFFF"}
            />
          </TouchableOpacity>

          {/* White Circular Play/Pause Button */}
          <TouchableOpacity
            style={styles.playButton}
            onPress={handlePlay}
            activeOpacity={0.85}
            accessibilityLabel={`Play ${song.title}`}
          >
            <Ionicons
              name={isCurrentTrack && effectiveAudioPlaying ? "pause" : "play"}
              size={22}
              color="#0B0B0C"
              style={
                isCurrentTrack && effectiveAudioPlaying
                  ? undefined
                  : { marginLeft: 2 }
              }
            />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    backgroundColor: "transparent",
    position: "relative",
  },
  imageContainer: {
    width: "100%",
    height: 260,
    borderRadius: 24,
    backgroundColor: "#161618",
    overflow: "hidden",
    position: "relative",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  fallbackContainer: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1E1E20",
  },
  pagerContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    zIndex: 10,
  },
  pagerDot: {
    height: 6,
    borderRadius: 3,
  },
  pagerDotActive: {
    width: 18,
    backgroundColor: "#FFFFFF",
  },
  pagerDotInactive: {
    width: 6,
    backgroundColor: "rgba(255, 255, 255, 0.45)",
  },
  bottomBar: {
    paddingTop: 14,
    paddingHorizontal: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    backgroundColor: "transparent",
  },
  metaInfo: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.3,
    color: "#FFFFFF",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: "#8E8E93",
    fontWeight: "500",
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexShrink: 0,
  },
  heartButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  playButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    ...shadows.sm,
  },
});
