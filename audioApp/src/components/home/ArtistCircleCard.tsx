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
    width: 280,
    height: 280,
    quality: 85,
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
            <Ionicons name="person" size={46} color="#777777" />
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
    width: 126,
    marginRight: 16,
    alignItems: "center",
  },
  avatarContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: "hidden",
    backgroundColor: "#1E1E1E",
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.12)",
    marginBottom: 10,
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
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: -0.2,
    marginBottom: 3,
    width: "100%",
  },
  followers: {
    color: "#8E8E93",
    fontSize: 12,
    fontWeight: "500",
    textAlign: "center",
    width: "100%",
  },
});
