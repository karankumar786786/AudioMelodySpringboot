import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { genrePreferenceService } from "@/service";

const { width } = Dimensions.get("window");
const COLUMN_COUNT = 3;
const CHIP_MARGIN = 6;
const CHIP_WIDTH = (width - 40 - CHIP_MARGIN * 2 * COLUMN_COUNT) / COLUMN_COUNT;
const MIN_SELECTION = 3;
// Must match UserGenrePreferenceService.MAX_GENRES on the backend
const MAX_SELECTION = 10;

const GENRES = [
  "Pop",
  "Hip-Hop",
  "R&B",
  "Rock",
  "Electronic",
  "Jazz",
  "Classical",
  "Country",
  "Latin",
  "Indie",
  "Metal",
  "Folk",
  "Reggae",
  "Blues",
  "Punk",
  "Soul",
  "Afrobeats",
  "K-Pop",
  "Bollywood",
  "Lo-Fi",
  "Ambient",
  "Dance",
  "Trap",
  "Drill",
];

export default function OnboardingGenreScreen() {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const saveMutation = useMutation({
    mutationKey: ["saveGenrePrefs"],
    mutationFn: (genres: string[]) => genrePreferenceService.saveGenres(genres),
    onSuccess: () => {
      router.replace("/(authenticated)/(tabs)/home");
    },
    onError: () => {
      // Still navigate — preferences are nice-to-have, not blocking
      router.replace("/(authenticated)/(tabs)/home");
    },
  });

  const toggleGenre = useCallback((genre: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(genre)) {
        next.delete(genre);
      } else if (next.size < MAX_SELECTION) {
        next.add(genre);
      }
      return next;
    });
  }, []);

  const handleContinue = () => {
    if (selected.size < MIN_SELECTION) return;
    saveMutation.mutate(Array.from(selected));
  };

  const renderGenre = ({ item }: { item: string }) => {
    const isSelected = selected.has(item);
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => toggleGenre(item)}
        style={[styles.chip, isSelected && styles.chipSelected]}
      >
        {isSelected && (
          <Ionicons
            name="checkmark-circle"
            size={16}
            color="#1DB954"
            style={styles.chipCheck}
          />
        )}
        <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
          {item}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={["#1a1a2e", "#0f0f0f"]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.header}>
        <Text style={styles.title}>What do you listen to?</Text>
        <Text style={styles.subtitle}>
          Pick {MIN_SELECTION} to {MAX_SELECTION} genres so we can personalize your feed.
        </Text>
      </View>

      <FlatList
        data={GENRES}
        keyExtractor={(item) => item}
        renderItem={renderGenre}
        numColumns={COLUMN_COUNT}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />

      <View style={styles.footer}>
        <TouchableOpacity
          activeOpacity={0.8}
          disabled={selected.size < MIN_SELECTION || saveMutation.isPending}
          onPress={handleContinue}
          style={[
            styles.continueBtn,
            selected.size < MIN_SELECTION && styles.continueBtnDisabled,
          ]}
        >
          {saveMutation.isPending ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.continueText}>
              Continue ({selected.size}/{MIN_SELECTION}+)
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.replace("/(authenticated)/(tabs)/home")}
          style={styles.skipBtn}
        >
          <Text style={styles.skipText}>Skip for now</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f0f0f",
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: "#aaa",
    lineHeight: 22,
  },
  list: {
    paddingHorizontal: 14,
    paddingBottom: 20,
  },
  chip: {
    flex: 1,
    margin: CHIP_MARGIN,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: "#1e1e1e",
    borderWidth: 1.5,
    borderColor: "#333",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    minHeight: 50,
  },
  chipSelected: {
    backgroundColor: "#1DB95420",
    borderColor: "#1DB954",
  },
  chipCheck: {
    marginRight: 4,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#ccc",
    textAlign: "center",
  },
  chipTextSelected: {
    color: "#1DB954",
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 12,
  },
  continueBtn: {
    backgroundColor: "#1DB954",
    borderRadius: 30,
    paddingVertical: 16,
    alignItems: "center",
  },
  continueBtnDisabled: {
    backgroundColor: "#333",
  },
  continueText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#000",
  },
  skipBtn: {
    alignItems: "center",
    paddingVertical: 8,
  },
  skipText: {
    fontSize: 14,
    color: "#888",
  },
});
