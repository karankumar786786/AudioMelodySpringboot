import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { Song } from "@/types";
import { getImageUrl } from "@/utils/imageUtils";

interface TrendingSongCardProps {
  song: Song;
  onPress: () => void;
}

export function TrendingSongCard({ song, onPress }: TrendingSongCardProps) {
  const imageUrl = getImageUrl(song.imageKey, {
    width: 280,
    height: 280,
    quality: 80,
  });

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.78}
    >
      <View style={styles.imageContainer}>
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={styles.image}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <View style={styles.fallbackImage}>
            <Ionicons name="musical-notes" size={32} color="#555555" />
          </View>
        )}

        <View style={styles.playOverlay}>
          <Ionicons name="play" size={16} color="#FFFFFF" style={{ marginLeft: 2 }} />
        </View>
      </View>

      <Text style={styles.title} numberOfLines={1}>
        {song.title}
      </Text>
      <Text style={styles.artist} numberOfLines={1}>
        {song.artistName}
      </Text>

      {song.totalStreams ? (
        <View style={styles.streamsRow}>
          <Ionicons name="trending-up" size={12} color="#1DB954" />
          <Text style={styles.streamsText}>
            {song.totalStreams > 1000
              ? `${(song.totalStreams / 1000).toFixed(1)}k plays`
              : `${song.totalStreams} plays`}
          </Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 146,
    marginRight: 14,
  },
  imageContainer: {
    width: 146,
    height: 146,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#1E1E1E",
    borderWidth: 1,
    borderColor: "#2A2A2A",
    marginBottom: 8,
    position: "relative",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  fallbackImage: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#222222",
  },
  playOverlay: {
    position: "absolute",
    right: 8,
    bottom: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#208AEF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 2,
  },
  artist: {
    color: "#888888",
    fontSize: 12,
  },
  streamsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 3,
  },
  streamsText: {
    color: "#1DB954",
    fontSize: 11,
    fontWeight: "500",
  },
});
