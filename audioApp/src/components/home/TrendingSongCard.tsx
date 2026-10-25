import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { Song } from "@/types";
import { getImageUrl } from "@/utils/imageUtils";
import { formatStreams, formatSongSubtitle } from "@/utils/formatUtils";

interface TrendingSongCardProps {
  song: Song;
  onPress: () => void;
}

export function TrendingSongCard({ song, onPress }: TrendingSongCardProps) {
  const imageUrl = getImageUrl(song.imageKey, {
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
          <Ionicons name="musical-notes" size={32} color="#555555" />
        </View>
      )}

      <Text style={styles.title} numberOfLines={1}>
        {song.title}
      </Text>
      <Text style={styles.artist} numberOfLines={1}>
        {formatSongSubtitle(song.artistName, song.album)}
      </Text>

      {song.totalStreams !== undefined && song.totalStreams !== null ? (
        <View style={styles.streamsRow}>
          <Ionicons name="play" size={9} color="#8A8A8A" />
          <Text style={styles.streams}>{formatStreams(song.totalStreams)}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { width: 146, marginRight: 14 },
  image: {
    width: 146,
    height: 146,
    borderRadius: 14,
    backgroundColor: "#181818",
    marginBottom: 10,
  },
  fallback: { alignItems: "center", justifyContent: "center" },
  title: { color: "#FFFFFF", fontSize: 14, fontWeight: "700", marginBottom: 2 },
  artist: { color: "#8A8A8A", fontSize: 12 },
  streamsRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  streams: { color: "#8A8A8A", fontSize: 11, fontWeight: "500" },
});