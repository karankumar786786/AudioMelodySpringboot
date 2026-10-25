import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { Song, Artist, Playlist, UserPlaylist } from "@/types";
import { getImageUrl } from "@/utils/imageUtils";
import { formatSongSubtitle } from "@/utils/formatUtils";

type TopResultItem =
  | { kind: "SONG"; item: Song }
  | { kind: "ARTIST"; item: Artist }
  | { kind: "PLAYLIST"; item: Playlist }
  | { kind: "USER_PLAYLIST"; item: UserPlaylist };

interface SearchTopResultCardProps {
  topResult: TopResultItem;
  onPress: () => void;
}

export function SearchTopResultCard({
  topResult,
  onPress,
}: SearchTopResultCardProps) {
  let title = "";
  let subtitle = "";
  let imageKey: string | undefined = undefined;
  let isCircle = false;
  let fallbackIcon: keyof typeof Ionicons.glyphMap = "musical-note";

  if (topResult.kind === "SONG") {
    title = topResult.item.title;
    subtitle = formatSongSubtitle(
      topResult.item.artistName,
      topResult.item.album,
      topResult.item.genre
    );
    imageKey = topResult.item.imageKey;
  } else if (topResult.kind === "ARTIST") {
    title = topResult.item.name;
    const followers = topResult.item.followersCount;
    subtitle = followers ? `Artist  ·  ${followers.toLocaleString()} followers` : "Artist";
    imageKey = topResult.item.coverImageKey;
    isCircle = true;
    fallbackIcon = "person";
  } else if (topResult.kind === "PLAYLIST") {
    title = topResult.item.name;
    subtitle = `Playlist  ·  ${topResult.item.totalSongs || 0} songs`;
    imageKey = topResult.item.coverImageKey;
    fallbackIcon = "musical-notes";
  } else if (topResult.kind === "USER_PLAYLIST") {
    title = topResult.item.name;
    subtitle = `Playlist  ·  ${topResult.item.ownerName || "User"}`;
    fallbackIcon = "musical-notes";
  }

  const imageUrl = getImageUrl(imageKey, {
    width: 400,
    height: 400,
    focus: "auto",
    aspectRatio: "1-1",
  });

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.imageContainer, isCircle && styles.circleImage]}>
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={styles.image}
            contentFit="cover"
            transition={200}
            cachePolicy="memory"
          />
        ) : (
          <View style={styles.fallback}>
            <Ionicons name={fallbackIcon} size={32} color="#5A5A5A" />
          </View>
        )}
      </View>

      <View style={styles.details}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>

      <View style={styles.actionButton}>
        <Ionicons
          name={topResult.kind === "ARTIST" ? "chevron-forward" : "play"}
          size={topResult.kind === "ARTIST" ? 20 : 18}
          color="#000000"
          style={topResult.kind === "ARTIST" ? undefined : { marginLeft: 2 }}
        />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#121212",
    borderRadius: 18,
    padding: 12,
    marginHorizontal: 18,
  },
  imageContainer: {
    width: 76,
    height: 76,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#1A1A1A",
    marginRight: 14,
  },
  circleImage: { borderRadius: 38 },
  image: { width: "100%", height: "100%" },
  fallback: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  details: { flex: 1, paddingRight: 10 },
  title: { fontSize: 17, fontWeight: "700", color: "#FFFFFF", marginBottom: 4 },
  subtitle: { fontSize: 13, color: "#8A8A8A" },
  actionButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
});