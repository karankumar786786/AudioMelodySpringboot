import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { Song } from "@/types";
import { getImageUrl } from "@/utils/imageUtils";
import { formatDuration, formatStreams, formatSongSubtitle } from "@/utils/formatUtils";

interface FavouriteSongItemProps {
  song: Song;
  index?: number;
  onPress: () => void;
  onRemove: () => void;
}

export function FavouriteSongItem({
  song,
  index,
  onPress,
  onRemove,
}: FavouriteSongItemProps) {
  const imageUrl = getImageUrl(song.imageKey, {
    width: 160,
    height: 160,
    focus: "auto",
    aspectRatio: "1-1",
  });

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.72}
    >
      <View style={styles.thumbnailContainer}>
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={styles.thumbnail}
            contentFit="cover"
            transition={150}
          />
        ) : (
          <View style={styles.fallbackThumbnail}>
            <Ionicons name="musical-note" size={20} color="#666666" />
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
        {song.totalStreams !== undefined && song.totalStreams !== null ? (
          <View style={styles.streamsRow}>
            <Ionicons name="play" size={10} color="#777777" style={{ marginRight: 3 }} />
            <Text style={styles.streamsText}>{formatStreams(song.totalStreams)}</Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.duration}>{formatDuration(song.duration)}</Text>

      {/* Unlike / Remove Heart Button */}
      <TouchableOpacity
        style={styles.heartButton}
        onPress={(e) => {
          e.stopPropagation?.();
          onRemove();
        }}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="heart" size={20} color="#E91E63" />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 9,
  },
  thumbnailContainer: {
    width: 48,
    height: 48,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#1E1E1E",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    marginRight: 12,
  },
  thumbnail: {
    width: "100%",
    height: "100%",
  },
  fallbackThumbnail: {
    width: "100%",
    height: "100%",
    backgroundColor: "#222222",
    justifyContent: "center",
    alignItems: "center",
  },
  info: {
    flex: 1,
    paddingRight: 10,
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 12.5,
    color: "#888888",
  },
  streamsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  streamsText: {
    fontSize: 11,
    color: "#777777",
    fontWeight: "500",
  },
  duration: {
    fontSize: 12,
    color: "#777777",
    marginRight: 12,
  },
  heartButton: {
    padding: 6,
  },
});
