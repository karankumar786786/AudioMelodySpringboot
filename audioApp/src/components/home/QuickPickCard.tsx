import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { Song } from "@/types";
import { getImageUrl } from "@/utils/imageUtils";
import { formatStreams } from "@/utils/formatUtils";

interface QuickPickCardProps {
  song: Song;
  width: number;
  isActive?: boolean;
  isPlaying?: boolean;
  onPress: () => void;
}

export function QuickPickCard({
  song,
  width,
  isActive = false,
  isPlaying = false,
  onPress,
}: QuickPickCardProps) {
  const imageUrl = getImageUrl(song.imageKey, {
    width: 160,
    height: 160,
    focus: "auto",
    aspectRatio: "1-1",
  });

  return (
    <TouchableOpacity
      style={[styles.card, { width }, isActive && styles.cardActive]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={styles.image}
          contentFit="cover"
          transition={150}
          cachePolicy="memory"
        />
      ) : (
        <View style={[styles.image, styles.fallback]}>
          <Ionicons name="musical-note" size={20} color="#5A5A5A" />
        </View>
      )}

      <View style={styles.text}>
        <Text style={styles.title} numberOfLines={1}>
          {song.title}
        </Text>
        <View style={styles.metaRow}>
          {isActive ? (
            <Ionicons
              name={isPlaying ? "volume-high" : "pause"}
              size={11}
              color="#FFFFFF"
              style={{ marginRight: 4 }}
            />
          ) : null}
          <Text style={styles.meta} numberOfLines={1}>
            {song.artistName}
          </Text>
        </View>
        {song.totalStreams !== undefined && song.totalStreams !== null ? (
          <Text style={styles.plays} numberOfLines={1}>
            {formatStreams(song.totalStreams)}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    height: 60,
    borderRadius: 10,
    backgroundColor: "#121212",
    overflow: "hidden",
  },
  cardActive: {
    backgroundColor: "#1C1C1C",
  },
  image: { width: 60, height: 60, backgroundColor: "#1E1E1E" },
  fallback: { alignItems: "center", justifyContent: "center" },
  text: { flex: 1, paddingHorizontal: 10, justifyContent: "center" },
  title: { color: "#FFFFFF", fontSize: 13, fontWeight: "700", marginBottom: 2 },
  metaRow: { flexDirection: "row", alignItems: "center" },
  meta: { color: "#8A8A8A", fontSize: 11, flexShrink: 1 },
  plays: { color: "#5A5A5A", fontSize: 10, marginTop: 1 },
});