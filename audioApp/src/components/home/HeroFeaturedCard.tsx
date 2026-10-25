import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Song } from "@/types";
import { CanvasVideoPlayer } from "@/components/common/CanvasVideoPlayer";

interface HeroFeaturedCardProps {
  song: Song;
  onPress: () => void;
  cardWidth?: number;
}

export function HeroFeaturedCard({
  song,
  onPress,
  cardWidth,
}: HeroFeaturedCardProps) {
  return (
    <TouchableOpacity
      style={[
        styles.card,
        cardWidth ? { width: cardWidth, marginHorizontal: 0 } : null,
      ]}
      onPress={onPress}
      activeOpacity={0.88}
    >
      <CanvasVideoPlayer
        videoKey={song.videoKey}
        fallbackImageKey={song.imageKey}
        style={StyleSheet.absoluteFill}
      />

      {/* Dark overlay for text readability */}
      <View style={styles.overlay} />

      {/* Title only */}
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={2}>
          {song.title}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 18,
    height: 190,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#1E1E1E",
    borderWidth: 1,
    borderColor: "#2A2A2A",
    position: "relative",
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0, 0, 0, 0)",
  },
  content: {
    flex: 1,
    padding: 16,
    justifyContent: "flex-end",
  },
  title: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "bold",
    textShadowColor: "rgba(0, 0, 0, 0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
});

