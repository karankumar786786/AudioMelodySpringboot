import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { Song, Artist, Playlist, UserPlaylist, WordSuggestion } from "@/types";
import { getImageUrl } from "@/utils/imageUtils";
import { formatFollowerCount, formatStreams } from "@/utils/formatUtils";
import { hapticFeedback } from "@/utils/haptics";

export type AutocompleteItemData =
  | { kind: "word"; suggestion: WordSuggestion }
  | { kind: "song"; song: Song }
  | { kind: "artist"; artist: Artist }
  | { kind: "playlist"; playlist: Playlist }
  | { kind: "userPlaylist"; userPlaylist: UserPlaylist };

interface AutocompleteSuggestionItemProps {
  item: AutocompleteItemData;
  onPress: () => void;
  onFill?: (text: string) => void;
  onPlaySong?: (song: Song) => void;
}

export function AutocompleteSuggestionItem({
  item,
  onPress,
  onFill,
  onPlaySong,
}: AutocompleteSuggestionItemProps) {
  if (item.kind === "word") {
    const sug = item.suggestion;
    const badgeLabel =
      sug.type === "song" ? "Song" : sug.type === "artist" ? "Artist" : "Word";

    return (
      <TouchableOpacity
        style={styles.container}
        activeOpacity={0.7}
        onPress={() => {
          hapticFeedback.light();
          onPress();
        }}
      >
        <View style={styles.iconContainer}>
          <Ionicons name="search" size={17} color="#8A8A8E" />
        </View>

        <View style={styles.textContainer}>
          <Text style={styles.title} numberOfLines={1}>
            {sug.label}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {sug.type === "song"
              ? "Matching song"
              : sug.type === "artist"
              ? "Matching artist"
              : "Search completion"}
          </Text>
        </View>

        <View style={styles.rightAction}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badgeLabel}</Text>
          </View>
          {onFill && (
            <TouchableOpacity
              style={styles.fillButton}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              onPress={(e) => {
                e.stopPropagation?.();
                hapticFeedback.light();
                onFill(sug.label);
              }}
              accessibilityLabel={`Fill search with ${sug.label}`}
            >
              <Ionicons name="arrow-redo-outline" size={15} color="#8A8A8E" />
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  }

  if (item.kind === "song") {
    const song = item.song;
    const imageUrl = getImageUrl(song.imageKey, {
      width: 120,
      height: 120,
      focus: "auto",
      aspectRatio: "1-1",
    });

    return (
      <TouchableOpacity
        style={styles.container}
        activeOpacity={0.7}
        onPress={() => {
          hapticFeedback.light();
          onPress();
        }}
      >
        <View style={styles.avatarContainer}>
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
              <Ionicons name="musical-note" size={18} color="#666666" />
            </View>
          )}
        </View>

        <View style={styles.textContainer}>
          <Text style={styles.title} numberOfLines={1}>
            {song.title}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {[song.artistName, song.album].filter(Boolean).join(" • ")}
            {typeof song.totalStreams === "number" && song.totalStreams > 0
              ? ` • ${formatStreams(song.totalStreams)}`
              : ""}
          </Text>
        </View>

        <View style={styles.rightAction}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Song</Text>
          </View>
          {onPlaySong && (
            <TouchableOpacity
              style={styles.playIconButton}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              onPress={(e) => {
                e.stopPropagation?.();
                hapticFeedback.light();
                onPlaySong(song);
              }}
              accessibilityLabel={`Play ${song.title}`}
            >
              <Ionicons name="play" size={16} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  }

  if (item.kind === "artist") {
    const artist = item.artist;
    const imageUrl = getImageUrl(artist.coverImageKey, {
      width: 120,
      height: 120,
      focus: "face",
      aspectRatio: "1-1",
    });

    return (
      <TouchableOpacity
        style={styles.container}
        activeOpacity={0.7}
        onPress={() => {
          hapticFeedback.light();
          onPress();
        }}
      >
        <View style={[styles.avatarContainer, styles.circleAvatar]}>
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
              <Ionicons name="person" size={18} color="#666666" />
            </View>
          )}
        </View>

        <View style={styles.textContainer}>
          <Text style={styles.title} numberOfLines={1}>
            {artist.name}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {typeof artist.followersCount === "number"
              ? formatFollowerCount(artist.followersCount)
              : "Artist"}
          </Text>
        </View>

        <View style={styles.rightAction}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Artist</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  // Playlist / Community Playlist
  const isUserPlaylist = item.kind === "userPlaylist";
  const playlist = isUserPlaylist ? item.userPlaylist : item.playlist;
  const imageKey = isUserPlaylist ? undefined : (playlist as Playlist).coverImageKey;
  const imageUrl = getImageUrl(imageKey, {
    width: 120,
    height: 120,
    focus: "auto",
    aspectRatio: "1-1",
  });

  return (
    <TouchableOpacity
      style={styles.container}
      activeOpacity={0.7}
      onPress={() => {
        hapticFeedback.light();
        onPress();
      }}
    >
      <View style={styles.avatarContainer}>
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
            <Ionicons name="musical-notes" size={18} color="#666666" />
          </View>
        )}
      </View>

      <View style={styles.textContainer}>
        <Text style={styles.title} numberOfLines={1}>
          {playlist.name}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {isUserPlaylist
            ? `By ${(playlist as UserPlaylist).ownerName || "Community"} • ${
                playlist.totalSongs || 0
              } songs`
            : `${playlist.totalSongs || 0} tracks`}
        </Text>
      </View>

      <View style={styles.rightAction}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {isUserPlaylist ? "Community" : "Playlist"}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 9,
    paddingHorizontal: 18,
  },
  iconContainer: {
    width: 42,
    height: 42,
    borderRadius: 8,
    backgroundColor: "#161618",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  avatarContainer: {
    width: 42,
    height: 42,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#161618",
    marginRight: 12,
  },
  circleAvatar: {
    borderRadius: 21,
  },
  avatar: {
    width: "100%",
    height: "100%",
  },
  fallback: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  textContainer: {
    flex: 1,
    paddingRight: 8,
  },
  title: {
    fontSize: 14.5,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 12,
    color: "#8E8E93",
  },
  rightAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#8E8E93",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  fillButton: {
    padding: 4,
  },
  playIconButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
});
