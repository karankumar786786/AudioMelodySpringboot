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
    subtitle = `Song • ${item.song.artistName || "Artist"}`;
    imageKey = item.song.imageKey;
    fallbackIcon = "musical-note";
  } else if (item.type === "ARTIST" && item.artist) {
    title = item.artist.name;
    subtitle = "Artist";
    imageKey = item.artist.coverImageKey;
    isCircle = true;
    fallbackIcon = "person";
  } else if (item.type === "PLAYLIST" && item.playlist) {
    title = item.playlist.name;
    subtitle = `Playlist • ${item.playlist.totalSongs || 0} songs`;
    imageKey = item.playlist.coverImageKey;
    fallbackIcon = "disc";
  } else if (item.type === "USER_PLAYLIST" && item.userPlaylist) {
    title = item.userPlaylist.name;
    subtitle = `Playlist • ${item.userPlaylist.ownerName || "Custom"}`;
    fallbackIcon = "musical-notes";
  }

  const imageUrl = getImageUrl(imageKey, {
    width: 100,
    height: 100,
    quality: 80,
  });

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.avatarContainer, isCircle && styles.circleAvatar]}>
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={styles.avatar}
            contentFit="cover"
            transition={150}
          />
        ) : (
          <View style={styles.fallbackAvatar}>
            <Ionicons name={fallbackIcon} size={20} color="#777777" />
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
      >
        <Ionicons name="close" size={18} color="#777777" />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  avatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#1E1E1E",
    borderWidth: 1,
    borderColor: "#2A2A2A",
    marginRight: 14,
  },
  circleAvatar: {
    borderRadius: 24,
  },
  avatar: {
    width: "100%",
    height: "100%",
  },
  fallbackAvatar: {
    width: "100%",
    height: "100%",
    backgroundColor: "#222222",
    justifyContent: "center",
    alignItems: "center",
  },
  textContainer: {
    flex: 1,
    paddingRight: 10,
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 3,
  },
  subtitle: {
    fontSize: 13,
    color: "#888888",
  },
  deleteButton: {
    padding: 6,
    borderRadius: 14,
  },
});
