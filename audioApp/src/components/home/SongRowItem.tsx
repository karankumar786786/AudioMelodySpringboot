import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { Song } from "@/types";
import { getImageUrl } from "@/utils/imageUtils";

interface SongRowItemProps {
  song: Song;
  index?: number;
  onPress: () => void;
}

export function SongRowItem({ song, index, onPress }: SongRowItemProps) {
  const imageUrl = getImageUrl(song.imageKey, {
    width: 100,
    height: 100,
    quality: 80,
  });

  const formatDuration = (sec?: number) => {
    if (!sec || sec <= 0) return "--:--";
    const mins = Math.floor(sec / 60);
    const secs = Math.floor(sec % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.72}
    >
      {index !== undefined ? (
        <Text style={styles.indexText}>{index + 1}</Text>
      ) : null}

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
        <Text style={styles.artist} numberOfLines={1}>
          {song.artistName}
        </Text>
      </View>

      <Text style={styles.duration}>{formatDuration(song.duration)}</Text>

      <TouchableOpacity style={styles.moreButton} hitSlop={12}>
        <Ionicons name="ellipsis-vertical" size={16} color="#777777" />
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
  indexText: {
    width: 22,
    fontSize: 14,
    fontWeight: "600",
    color: "#666666",
    textAlign: "center",
    marginRight: 10,
  },
  thumbnailContainer: {
    width: 50,
    height: 50,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#1E1E1E",
    borderWidth: 1,
    borderColor: "#2A2A2A",
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
    paddingRight: 12,
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 3,
  },
  artist: {
    fontSize: 13,
    color: "#888888",
  },
  duration: {
    fontSize: 12,
    color: "#777777",
    marginRight: 12,
  },
  moreButton: {
    padding: 4,
  },
});
