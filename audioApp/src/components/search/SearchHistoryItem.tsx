import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { UserSearchHistoryItem, RecentSearchItem } from "@/types";
import { getImageUrl } from "@/utils/imageUtils";

interface SearchHistoryItemProps {
  item: UserSearchHistoryItem | RecentSearchItem;
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

  if (item.type === "word") {
    const recent = item as RecentSearchItem;
    title = recent.label;
    subtitle = recent.subtitle || "Recent search";
    fallbackIcon = "time-outline";
  } else if (item.type === "SONG" || item.type === "song") {
    const rawSong = (item as any).song || (item as any).data;
    title = rawSong?.title || (item as any).label || "Song";
    subtitle = `Song  ·  ${rawSong?.artistName || "Artist"}`;
    imageKey = rawSong?.imageKey || (item as any).imageKey;
  } else if (item.type === "ARTIST" || item.type === "artist") {
    const rawArtist = (item as any).artist || (item as any).data;
    title = rawArtist?.name || (item as any).label || "Artist";
    subtitle = "Artist";
    imageKey = rawArtist?.coverImageKey || (item as any).imageKey;
    isCircle = true;
    fallbackIcon = "person";
  } else if (item.type === "PLAYLIST" || item.type === "playlist") {
    const rawPlaylist = (item as any).playlist || (item as any).data;
    title = rawPlaylist?.name || (item as any).label || "Playlist";
    subtitle = `Playlist  ·  ${rawPlaylist?.totalSongs || 0} songs`;
    imageKey = rawPlaylist?.coverImageKey || (item as any).imageKey;
    fallbackIcon = "musical-notes";
  } else if (item.type === "USER_PLAYLIST" || item.type === "userPlaylist") {
    const rawUPlaylist = (item as any).userPlaylist || (item as any).data;
    title = rawUPlaylist?.name || (item as any).label || "Community Playlist";
    subtitle = `Community  ·  ${rawUPlaylist?.ownerName || "Custom"}`;
    imageKey = rawUPlaylist?.coverImageKey || (item as any).imageKey;
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