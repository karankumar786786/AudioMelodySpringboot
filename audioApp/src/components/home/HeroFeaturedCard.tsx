import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Song } from "@/types";
import { CanvasVideoPlayer } from "@/components/common/CanvasVideoPlayer";
import { formatSongSubtitle } from "@/utils/formatUtils";
import { getImageUrl } from "@/utils/imageUtils";
import { useDominantColor } from "@/utils/colorUtils";
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
  isFocused = true,
  cardWidth,
  totalSlides = 1,
  activeIndex = 0,
}: HeroFeaturedCardProps) {
  const shouldPlayCanvas = isFocused ?? isPlaying ?? true;
  const effectiveAudioPlaying = isAudioPlaying || (isCurrentTrack && Boolean(isPlaying));

  const coverUrl = getImageUrl(song.imageKey, {
    width: 400,
    height: 400,
    focus: "auto",
    aspectRatio: "1-1",
  });

  const { dominantColor } = useDominantColor(
    coverUrl,
    song.title || song.artistName || String(song.id),
  );

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
        {
          backgroundColor: dominantColor,
          borderColor: `${dominantColor}66`,
        },
        cardWidth ? { width: cardWidth, marginHorizontal: 0 } : null,
      ]}
      onPress={onPress}
      activeOpacity={0.95}
    >
      {/* 1. Top Video/Canvas Preview Area: 260px */}
      <View
        style={[
          styles.videoContainer,
          { backgroundColor: `${dominantColor}33` },
        ]}
      >
        {/* Decorative background shapes for fallback when canvas video is loading */}
        <View
          style={[
            styles.decorativeCircleOne,
            { backgroundColor: `${dominantColor}66` },
          ]}
        />
        <View
          style={[
            styles.decorativeCircleTwo,
            { backgroundColor: `${dominantColor}22` },
          ]}
        />

        {/* Focused card plays the silent looping canvas video */}
        <CanvasVideoPlayer
          videoKey={song.videoKey || (song as any).canvasKey}
          fallbackImageKey={song.imageKey}
          style={StyleSheet.absoluteFill}
          isPlaying={shouldPlayCanvas}
          showFallbackImage={true}
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
      <View
        style={[
          styles.bottomBar,
          { backgroundColor: dominantColor },
        ]}
      >
        <LinearGradient
          colors={[
            `${dominantColor}FA`,
            `${dominantColor}D4`,
            "#121214",
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

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
              name={isCurrentTrack && effectiveAudioPlaying ? "pause" : "play"}
              size={22}
              color="#0B0B0C"
              style={isCurrentTrack && effectiveAudioPlaying ? undefined : { marginLeft: 2 }}
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
    marginHorizontal: 20,
    position: "relative",
    borderWidth: 1,
    ...shadows.md,
  },
  videoContainer: {
    width: "100%",
    height: 260,
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
  },
  decorativeCircleTwo: {
    position: "absolute",
    left: -50,
    bottom: -40,
    width: 180,
    height: 180,
    borderRadius: 90,
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
    position: "relative",
  },
  metaInfo: {
    flex: 1,
    minWidth: 0,
    zIndex: 2,
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
    color: "rgba(255, 255, 255, 0.78)",
    fontWeight: "500",
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
    zIndex: 2,
  },
  heartButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.18)",
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
