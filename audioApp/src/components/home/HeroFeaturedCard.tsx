import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
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

      {/* Content overlay */}
      <View style={styles.content}>
        <View style={styles.badgeRow}>
          {song.genre ? (
            <View style={styles.genreBadge}>
              <Text style={styles.genreBadgeText}>{song.genre}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.metaRow}>
          <View style={styles.textContainer}>
            <Text style={styles.title} numberOfLines={1}>
              {song.title}
            </Text>
            <Text style={styles.artist} numberOfLines={1}>
              {song.artistName}
            </Text>
          </View>

          <View style={styles.playButton}>
            <Ionicons name="play" size={22} color="#FFFFFF" style={{ marginLeft: 2 }} />
          </View>
        </View>
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
    backgroundColor: "rgba(0, 0, 0, 0.45)",
  },
  content: {
    flex: 1,
    padding: 16,
    justifyContent: "space-between",
  },
  badgeRow: {
    flexDirection: "row",
    gap: 8,
  },
  featuredBadge: {
    backgroundColor: "#208AEF",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  featuredBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  canvasBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(32, 138, 239, 0.5)",
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 8,
  },
  canvasBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  genreBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  genreBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "600",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  textContainer: {
    flex: 1,
    paddingRight: 14,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 4,
    textShadowColor: "rgba(0, 0, 0, 0.7)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  artist: {
    color: "#E0E0E0",
    fontSize: 14,
    fontWeight: "500",
  },
  playButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#208AEF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 6,
  },
});
