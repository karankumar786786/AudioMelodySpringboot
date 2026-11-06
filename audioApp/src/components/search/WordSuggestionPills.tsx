import React from "react";
import {
  ScrollView,
  TouchableOpacity,
  Text,
  StyleSheet,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { WordSuggestion } from "@/types";
import { hapticFeedback } from "@/utils/haptics";

interface WordSuggestionPillsProps {
  suggestions: WordSuggestion[];
  onSelectWord: (word: string) => void;
  onFillWord: (word: string) => void;
}

export function WordSuggestionPills({
  suggestions,
  onSelectWord,
  onFillWord,
}: WordSuggestionPillsProps) {
  if (!suggestions || suggestions.length === 0) return null;

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
      >
        {suggestions.map((item, index) => (
          <TouchableOpacity
            key={`${item.label}-${index}`}
            style={styles.pill}
            activeOpacity={0.7}
            onPress={() => {
              hapticFeedback.light();
              onSelectWord(item.label);
            }}
          >
            <Ionicons
              name="search"
              size={13}
              color="#9E9EA4"
              style={styles.searchIcon}
            />
            <Text style={styles.pillText} numberOfLines={1}>
              {item.label}
            </Text>
            <TouchableOpacity
              style={styles.fillButton}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              onPress={(e) => {
                e.stopPropagation?.();
                hapticFeedback.light();
                onFillWord(item.label);
              }}
              accessibilityLabel={`Fill search with ${item.label}`}
            >
              <Ionicons
                name="arrow-redo-outline"
                size={13}
                color="#8A8A8E"
              />
            </TouchableOpacity>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 6,
  },
  scrollContent: {
    paddingHorizontal: 18,
    gap: 8,
    alignItems: "center",
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#161618",
    paddingVertical: 7,
    paddingLeft: 12,
    paddingRight: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  searchIcon: {
    marginRight: 6,
  },
  pillText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "500",
    marginRight: 4,
    maxWidth: 180,
  },
  fillButton: {
    padding: 3,
    marginLeft: 2,
    borderRadius: 10,
  },
});
