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

      </View>

      <Text style={styles.title} numberOfLines={1}>
        {song.title}
      </Text>
      <Text style={styles.artist} numberOfLines={1}>
        {song.artistName}
      </Text>

      {song.totalStreams ? (
        <View style={styles.streamsRow}>
          <Ionicons name="trending-up" size={12} color="#FFFFFF" />
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
    backgroundColor: "#181818",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
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
    backgroundColor: "#202020",
  },

  title: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  artist: {
    color: "#A7A7A7",
    fontSize: 12.5,
    fontWeight: "500",
  },
  streamsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 3,
  },
  streamsText: {
    color: "#888888",
    fontSize: 11,
    fontWeight: "500",
  },
});
