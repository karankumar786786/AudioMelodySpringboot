import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { Song } from "@/types";
import { getImageUrl } from "@/utils/imageUtils";
import { formatDuration, formatSongSubtitle } from "@/utils/formatUtils";

interface PlaylistTrackItemProps {
  song: Song;
  index?: number;
  onPress: () => void;
  onRemove?: () => void;
}

export function PlaylistTrackItem({ song, onPress, onRemove }: PlaylistTrackItemProps) {
  const imageUrl = getImageUrl(song.imageKey, {
    width: 160,
    height: 160,
    focus: "auto",
    aspectRatio: "1-1",
  });

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.72}>
      <View style={styles.thumbnailContainer}>
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={styles.thumbnail}
            contentFit="cover"
            transition={150}
            cachePolicy="memory"
          />
        ) : (
          <View style={styles.fallback}>
            <Ionicons name="musical-note" size={20} color="#5A5A5A" />
          </View>
        )}
      </View>

      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>
          {song.title}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {formatSongSubtitle(song.artistName, song.album, song.genre)}
        </Text>
      </View>

      <Text style={styles.duration}>{formatDuration(song.duration)}</Text>

      {onRemove ? (
        <TouchableOpacity
          style={styles.removeButton}
          onPress={(e) => {
            e.stopPropagation?.();
            onRemove();
          }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel="Remove from playlist"
        >
          <Ionicons name="close" size={20} color="#8A8A8A" />
        </TouchableOpacity>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  thumbnailContainer: {
    width: 52,
    height: 52,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#1A1A1A",
    marginRight: 12,
  },
  thumbnail: { width: "100%", height: "100%" },
  fallback: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  info: { flex: 1, paddingRight: 10 },
  title: { fontSize: 15, fontWeight: "600", color: "#FFFFFF", marginBottom: 3 },
  subtitle: { fontSize: 12.5, color: "#8A8A8A" },
  duration: { fontSize: 12, color: "#8A8A8A", marginRight: 8 },
  removeButton: { padding: 6 },
});