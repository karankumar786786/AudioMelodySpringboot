import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { Artist } from "@/types";
import { getImageUrl } from "@/utils/imageUtils";

interface ArtistCircleCardProps {
  artist: Artist;
  onPress: () => void;
}

export function ArtistCircleCard({ artist, onPress }: ArtistCircleCardProps) {
  const imageUrl = getImageUrl(artist.coverImageKey, {
    width: 180,
    height: 180,
    quality: 80,
  });

  const formatFollowers = (count?: number) => {
    if (count === undefined || count === null) return "Artist";
    if (count >= 1_000_000) {
      return `${(count / 1_000_000).toFixed(1)}M followers`;
    }
    if (count >= 1_000) {
      return `${(count / 1_000).toFixed(1)}k followers`;
    }
    return `${count} ${count === 1 ? "follower" : "followers"}`;
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={styles.avatarContainer}>
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={styles.avatar}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <View style={styles.fallbackAvatar}>
            <Ionicons name="person" size={32} color="#777777" />
          </View>
        )}
      </View>

      <Text style={styles.name} numberOfLines={1}>
        {artist.name}
      </Text>
      <Text style={styles.followers} numberOfLines={1}>
        {formatFollowers(artist.followersCount)}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 94,
    marginRight: 14,
    alignItems: "center",
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    overflow: "hidden",
    backgroundColor: "#1E1E1E",
    borderWidth: 1.5,
    borderColor: "#2A2A2A",
    marginBottom: 8,
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
  name: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 2,
    width: "100%",
  },
  followers: {
    color: "#888888",
    fontSize: 11,
    textAlign: "center",
    width: "100%",
  },
});
