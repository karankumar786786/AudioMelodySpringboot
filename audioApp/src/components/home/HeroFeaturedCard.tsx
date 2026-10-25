import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Song } from "@/types";
import { CanvasVideoPlayer } from "@/components/common/CanvasVideoPlayer";

interface HeroFeaturedCardProps {
  song: Song;
  onPress: () => void;
  cardWidth?: number;
  isPlaying?: boolean;
}

export function HeroFeaturedCard({
  song,
  onPress,
  cardWidth,
  isPlaying = false,
}: HeroFeaturedCardProps) {
  return (
    <TouchableOpacity
      style={[
        styles.card,
        cardWidth ? { width: cardWidth, marginHorizontal: 0 } : null,
      ]}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <CanvasVideoPlayer
        videoKey={song.videoKey}
        fallbackImageKey={song.imageKey}
        style={StyleSheet.absoluteFill}
        isPlaying={isPlaying}
      />

      {/* Subtle top wash */}
      <View style={styles.topWash} />

      {/* Multi-stop linear gradient for vibrant contrast */}
      <LinearGradient
        colors={["transparent", "rgba(0, 0, 0, 0.45)", "rgba(0, 0, 0, 0.95)"]}
        locations={[0, 0.4, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Badges pinned to top */}
      <View style={styles.topBadgesRow}>
        <View style={styles.featuredBadge}>
          <Text style={styles.featuredBadgeText}>FEATURED</Text>
        </View>
        {song.videoKey ? (
          <View style={styles.canvasBadge}>
            <Ionicons
              name="videocam"
              size={11}
              color="#FFFFFF"
              style={{ marginRight: 3 }}
            />
            <Text style={styles.canvasBadgeText}>CANVAS</Text>
          </View>
        ) : null}
      </View>

      {/* Bottom Content: Title, Artist and Spotify Green Play Button */}
      <View style={styles.content}>
        <View style={styles.metaInfo}>
          <Text style={styles.title} numberOfLines={1}>
            {song.title}
          </Text>
          <Text style={styles.artist} numberOfLines={1}>
            {song.artistName}
          </Text>
        </View>

        <View style={styles.playButtonContainer}>
          <View style={styles.playButton}>
            <Ionicons
              name="play"
              size={20}
              color="#000000"
              style={{ marginLeft: 2 }}
            />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 18,
    height: 200,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#161616",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    position: "relative",
  },
  topWash: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0, 0, 0, 0.12)",
  },
  topBadgesRow: {
    position: "absolute",
    top: 14,
    left: 14,
    right: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    zIndex: 5,
  },
  featuredBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 4,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.18)",
  },
  featuredBadgeText: {
    color: "#FFFFFF",
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 1.1,
  },
  canvasBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 7,
    paddingVertical: 3.5,
    borderRadius: 4,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  canvasBadgeText: {
    color: "#FFFFFF",
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 1,
  },
  content: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingBottom: 16,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    zIndex: 5,
  },
  metaInfo: {
    flex: 1,
    paddingRight: 14,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 19,
    fontWeight: "900",
    letterSpacing: -0.3,
    marginBottom: 4,
    textShadowColor: "rgba(0, 0, 0, 0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  artist: {
    color: "rgba(255, 255, 255, 0.82)",
    fontSize: 13.5,
    fontWeight: "600",
  },
  playButtonContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  playButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#FFFFFF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.75,
    shadowRadius: 10,
    elevation: 6,
  },
});


