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
    width: 300,
    height: 300,
    focus: "auto",
    aspectRatio: "1-1",
  });

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.75}>
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={styles.avatar}
          contentFit="cover"
          transition={200}
          cachePolicy="memory"
        />
      ) : (
        <View style={[styles.avatar, styles.fallback]}>
          <Ionicons name="person" size={44} color="#5A5A5A" />
        </View>
      )}
      <Text style={styles.name} numberOfLines={1}>
        {artist.name}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { width: 108, marginRight: 14, alignItems: "center" },
  avatar: {
    width: 108,
    height: 108,
    borderRadius: 54,
    backgroundColor: "#151515",
    borderWidth: 1,
    borderColor: "#262626",
    marginBottom: 10,
  },
  fallback: { alignItems: "center", justifyContent: "center" },
  name: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: -0.2,
    textAlign: "center",
    width: "100%",
  },
});