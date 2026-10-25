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
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.78}>
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={styles.image}
          contentFit="cover"
          transition={200}
          cachePolicy="memory"
        />
      ) : (
        <View style={[styles.image, styles.fallback]}>
          <Ionicons name="musical-notes-outline" size={34} color="#5A5A5A" />
        </View>
      )}
      <Text style={styles.title} numberOfLines={1}>
        {playlist.name}
      </Text>
      <Text style={styles.subtitle} numberOfLines={1}>
        {playlist.totalSongs} {playlist.totalSongs === 1 ? "song" : "songs"}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { width: 140, marginRight: 14 },
  image: {
    width: 140,
    height: 140,
    borderRadius: 14,
    backgroundColor: "#1A1A1A",
    marginBottom: 10,
  },
  fallback: { alignItems: "center", justifyContent: "center" },
  title: { color: "#FFFFFF", fontSize: 14, fontWeight: "700", marginBottom: 2 },
  subtitle: { color: "#8A8A8A", fontSize: 12 },
});