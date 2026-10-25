import React from "react";
import { Text, StyleSheet, TouchableOpacity, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = (SCREEN_WIDTH - 44) / 2;

export interface GenreCategory {
  id: string;
  name: string;
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
}

export const POPULAR_GENRES: GenreCategory[] = [
  { id: "pop", name: "Pop", color: "#E91E63", icon: "sparkles" },
  { id: "hip-hop", name: "Hip-Hop", color: "#FF6F00", icon: "mic" },
  { id: "rock", name: "Rock", color: "#D32F2F", icon: "flash" },
  { id: "electronic", name: "Electronic", color: "#7B1FA2", icon: "pulse" },
  { id: "r-and-b", name: "R&B", color: "#303F9F", icon: "heart" },
  { id: "lo-fi", name: "Lo-Fi", color: "#512DA8", icon: "headset" },
  { id: "acoustic", name: "Acoustic", color: "#388E3C", icon: "musical-note" },
  { id: "indie", name: "Indie", color: "#00796B", icon: "planet" },
  { id: "jazz", name: "Jazz", color: "#5D4037", icon: "wine" },
  { id: "classical", name: "Classical", color: "#455A64", icon: "library" },
];

interface CategoryGenreCardProps {
  category: GenreCategory;
  onPress: () => void;
}

export function CategoryGenreCard({ category, onPress }: CategoryGenreCardProps) {
  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: category.color }]}
      onPress={onPress}
      activeOpacity={0.82}
    >
      <Text style={styles.name}>{category.name}</Text>
      <Ionicons
        name={category.icon}
        size={42}
        color="rgba(255, 255, 255, 0.32)"
        style={styles.icon}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: 94,
    borderRadius: 12,
    padding: 14,
    justifyContent: "space-between",
    position: "relative",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
  },
  name: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
    maxWidth: "75%",
  },
  icon: {
    position: "absolute",
    right: 8,
    bottom: 6,
    transform: [{ rotate: "15deg" }],
  },
});
