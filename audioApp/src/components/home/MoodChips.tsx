import React, { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import { useDispatch } from "react-redux";
import { AppDispatch } from "@/store";
import { playAll } from "@/store/queueActions";
import { recombeeService, Mood } from "@/service/recombeeService";
import { hapticFeedback } from "@/utils/haptics";
import { configureAudioPriority } from "@/utils/audioConfig";
import { colors, spacing, radii } from "@/theme";

const MOODS: { mood: Mood; label: string }[] = [
  { mood: "chill", label: "Chill" },
  { mood: "workout", label: "Workout" },
  { mood: "focus", label: "Focus" },
  { mood: "happy", label: "Happy" },
  { mood: "sad", label: "Sad" },
];

/** Row of mood chips; tapping one fetches mood radio and replaces the queue with it. */
export function MoodChips() {
  const dispatch = useDispatch<AppDispatch>();
  const [loadingMood, setLoadingMood] = useState<Mood | null>(null);
  const [emptyMood, setEmptyMood] = useState<Mood | null>(null);

  const startMood = async (mood: Mood) => {
    if (loadingMood) return;
    hapticFeedback.light();
    setLoadingMood(mood);
    setEmptyMood(null);
    try {
      const songs = await recombeeService.getMoodRadio(mood);
      if (songs.length > 0) {
        configureAudioPriority().catch(() => {});
        await dispatch(playAll(songs));
      } else {
        setEmptyMood(mood);
      }
    } finally {
      setLoadingMood(null);
    }
  };

  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {MOODS.map(({ mood, label }) => {
          const loading = loadingMood === mood;
          return (
            <TouchableOpacity
              key={mood}
              style={[styles.chip, loading && styles.chipActive]}
              onPress={() => startMood(mood)}
              activeOpacity={0.8}
              disabled={loadingMood !== null}
              accessibilityRole="button"
              accessibilityLabel={`Play ${label} mood radio`}
            >
              {loading ? (
                <ActivityIndicator size="small" color={colors.textPrimary} />
              ) : (
                <Text style={styles.chipText}>{label}</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      {emptyMood ? (
        <Text style={styles.emptyText}>No songs match this mood yet.</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: spacing.side,
    gap: spacing.sm,
  },
  chip: {
    minWidth: 76,
    height: 36,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.full,
    backgroundColor: colors.cardHighlight,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "600",
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 13,
    paddingHorizontal: spacing.side,
    marginTop: spacing.sm,
  },
});
