import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { UserSearchHistoryItem } from "@/types";
import { getImageUrl } from "@/utils/imageUtils";

interface SearchHistoryItemProps {
  item: UserSearchHistoryItem;
  onPress: () => void;
  onDelete: () => void;
}

export function SearchHistoryItem({
  item,
  onPress,
  onDelete,
}: SearchHistoryItemProps) {
  let title = "Unknown";
  let subtitle = "";
  let imageKey: string | undefined = undefined;
  let isCircle = false;
  let fallbackIcon: keyof typeof Ionicons.glyphMap = "musical-note";

  if (item.type === "SONG" && item.song) {
    title = item.song.title;
    subtitle = `Song  ·  ${item.song.artistName || "Artist"}`;
    imageKey = item.song.imageKey;
  } else if (item.type === "ARTIST" && item.artist) {
    title = item.artist.name;
    subtitle = "Artist";
    imageKey = item.artist.coverImageKey;
    isCircle = true;
    fallbackIcon = "person";
  } else if (item.type === "PLAYLIST" && item.playlist) {
    title = item.playlist.name;
    subtitle = `Playlist  ·  ${item.playlist.totalSongs || 0} songs`;
    imageKey = item.playlist.coverImageKey;
    fallbackIcon = "musical-notes";
  } else if (item.type === "USER_PLAYLIST" && item.userPlaylist) {
    title = item.userPlaylist.name;
    subtitle = `Playlist  ·  ${item.userPlaylist.ownerName || "Custom"}`;
    fallbackIcon = "musical-notes";
  }

  const imageUrl = getImageUrl(imageKey, {
    width: 160,
    height: 160,
    focus: "auto",
    aspectRatio: "1-1",
  });

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.72}>
      <View style={[styles.avatarContainer, isCircle && styles.circleAvatar]}>
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={styles.avatar}
            contentFit="cover"
            transition={150}
            cachePolicy="memory"
          />
        ) : (
          <View style={styles.fallback}>
            <Ionicons name={fallbackIcon} size={20} color="#5A5A5A" />
          </View>
        )}
      </View>

      <View style={styles.textContainer}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>

      <TouchableOpacity
        style={styles.deleteButton}
        onPress={(e) => {
          e.stopPropagation?.();
          onDelete();
        }}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityLabel="Remove from recent searches"
      >
        <Ionicons name="close" size={20} color="#8A8A8A" />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 18,
  },
  avatarContainer: {
    width: 52,
    height: 52,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#1A1A1A",
    marginRight: 12,
  },
  circleAvatar: { borderRadius: 26 },
  avatar: { width: "100%", height: "100%" },
  fallback: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  textContainer: { flex: 1, paddingRight: 10 },
  title: { fontSize: 15, fontWeight: "600", color: "#FFFFFF", marginBottom: 3 },
  subtitle: { fontSize: 12.5, color: "#8A8A8A" },
  deleteButton: { padding: 6 },
});