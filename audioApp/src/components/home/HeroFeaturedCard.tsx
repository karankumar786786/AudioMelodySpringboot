import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Song } from "@/types";
import { CanvasVideoPlayer } from "@/components/common/CanvasVideoPlayer";
import { formatSongSubtitle } from "@/utils/formatUtils";
import { hapticFeedback } from "@/utils/haptics";

interface HeroFeaturedCardProps {
  song: Song;
  onPress: () => void;
  onPlayPress?: () => void;
  onLikePress?: () => void;
  isLiked?: boolean;
  isPlaying?: boolean;
  isCurrentTrack?: boolean;
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
  isPlaying = false,
  isCurrentTrack = false,
  cardWidth,
  totalSlides = 1,
  activeIndex = 0,
}: HeroFeaturedCardProps) {
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
      {/* 1. Top Video/Canvas Preview Area: 260px */}
      <View style={styles.videoContainer}>
        {/* Decorative background shapes for fallback when canvas video is loading */}
        <View style={styles.decorativeCircleOne} />
        <View style={styles.decorativeCircleTwo} />

        {/* Looping Canvas Video / Artwork */}
        <CanvasVideoPlayer
          videoKey={song.videoKey}
          fallbackImageKey={song.imageKey}
          style={StyleSheet.absoluteFill}
          isPlaying={isPlaying || isCurrentTrack}
        />

        {/* Pager Dots at bottom of the video container */}
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

      {/* 2. Bottom Metadata & Controls Area: 140px */}
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
              size={22}
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
              name={isCurrentTrack && isPlaying ? "pause" : "play"}
              size={22}
              color="#0B0B0C"
              style={isCurrentTrack && isPlaying ? undefined : { marginLeft: 2 }}
            />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    height: 400,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "#161618",
    marginHorizontal: 20,
    position: "relative",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  videoContainer: {
    width: "100%",
    height: 260,
    backgroundColor: "#2A2A2D",
    overflow: "hidden",
    position: "relative",
  },
  decorativeCircleOne: {
    position: "absolute",
    right: -90,
    top: -60,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: "#3F3F43",
  },
  decorativeCircleTwo: {
    position: "absolute",
    left: -50,
    bottom: -40,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "#161618",
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
    height: 140,
    paddingLeft: 20,
    paddingRight: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    backgroundColor: "#161618",
  },
  metaInfo: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.24,
    color: "#FFFFFF",
    marginTop: 4,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: "#B4B4BA",
    fontWeight: "500",
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
  },
  heartButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
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
  },
});
