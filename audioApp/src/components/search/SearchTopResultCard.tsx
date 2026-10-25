import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { Song, Artist, Playlist, UserPlaylist } from "@/types";
import { getImageUrl } from "@/utils/imageUtils";
import { formatStreams, formatSongSubtitle } from "@/utils/formatUtils";

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
  let badgeText = "";
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
    badgeText = topResult.item.totalStreams
      ? formatStreams(topResult.item.totalStreams).toUpperCase()
      : "SONG";
    imageKey = topResult.item.imageKey;
    isCircle = false;
    fallbackIcon = "musical-note";
  } else if (topResult.kind === "ARTIST") {
    title = topResult.item.name;
    const followers = topResult.item.followersCount;
    subtitle = followers ? `${followers.toLocaleString()} followers` : "Artist";
    badgeText = "ARTIST";
    imageKey = topResult.item.coverImageKey;
    isCircle = true;
    fallbackIcon = "person";
  } else if (topResult.kind === "PLAYLIST") {
    title = topResult.item.name;
    subtitle = `Playlist • ${topResult.item.totalSongs || 0} songs`;
    badgeText = "PLAYLIST";
    imageKey = topResult.item.coverImageKey;
    isCircle = false;
    fallbackIcon = "disc";
  } else if (topResult.kind === "USER_PLAYLIST") {
    title = topResult.item.name;
    subtitle = `Playlist • ${topResult.item.ownerName || "User"}`;
    badgeText = "PLAYLIST";
    isCircle = false;
    fallbackIcon = "musical-notes";
  }

  const imageUrl = getImageUrl(imageKey, {
    width: 200,
    height: 200,
    quality: 85,
  });

  return (
    <View style={styles.outerContainer}>
      <Text style={styles.sectionTitle}>Top Result</Text>
      <TouchableOpacity
        style={styles.card}
        onPress={onPress}
        activeOpacity={0.8}
      >
        <View style={[styles.imageContainer, isCircle && styles.circleImage]}>
          {imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              style={styles.image}
              contentFit="cover"
              transition={200}
            />
          ) : (
            <View style={styles.fallbackContainer}>
              <Ionicons name={fallbackIcon} size={36} color="#777777" />
            </View>
          )}
        </View>

        <View style={styles.detailsContainer}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>

          <View style={styles.badgeRow}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badgeText}</Text>
            </View>
          </View>
        </View>

        <View style={styles.playButton}>
          <Ionicons
            name={topResult.kind === "ARTIST" ? "chevron-forward" : "play"}
            size={topResult.kind === "ARTIST" ? 20 : 18}
            color="#000000"
            style={topResult.kind === "ARTIST" ? {} : { marginLeft: 2 }}
          />
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    marginHorizontal: 16,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 10,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#181818",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  imageContainer: {
    width: 74,
    height: 74,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#222222",
    marginRight: 14,
  },
  circleImage: {
    borderRadius: 37,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  fallbackContainer: {
    width: "100%",
    height: "100%",
    backgroundColor: "#252525",
    justifyContent: "center",
    alignItems: "center",
  },
  detailsContainer: {
    flex: 1,
    paddingRight: 10,
  },
  title: {
    fontSize: 17,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: "#999999",
    marginBottom: 8,
  },
  badgeRow: {
    flexDirection: "row",
  },
  badge: {
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  playButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
  },
});
