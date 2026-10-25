import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { Playlist } from "@/types";
import { getImageUrl } from "@/utils/imageUtils";

interface PlaylistCardProps {
  playlist: Playlist;
  onPress: () => void;
}

export function PlaylistCard({ playlist, onPress }: PlaylistCardProps) {
  const imageUrl = getImageUrl(playlist.coverImageKey, {
    width: 400,
    height: 400,
    focus: "auto",
    aspectRatio: "1-1",
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
            cachePolicy="memory"
          />
        ) : (
          <View style={styles.fallbackImage}>
            <Ionicons name="musical-notes-outline" size={36} color="#555555" />
          </View>
        )}
      </View>

      <Text style={styles.title} numberOfLines={1}>
        {playlist.name}
      </Text>
      <Text style={styles.subtitle} numberOfLines={1}>
        {playlist.totalSongs} {playlist.totalSongs === 1 ? "track" : "tracks"}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 140,
    marginRight: 14,
  },
  imageContainer: {
    width: 140,
    height: 140,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#1E1E1E",
    borderWidth: 1,
    borderColor: "#2A2A2A",
    marginBottom: 8,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  fallbackImage: {
    width: "100%",
    height: "100%",
    backgroundColor: "#222222",
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 2,
  },
  subtitle: {
    color: "#777777",
    fontSize: 12,
  },
});
