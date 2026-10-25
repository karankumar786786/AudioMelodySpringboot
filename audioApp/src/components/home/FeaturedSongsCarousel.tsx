import React from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Dimensions,
} from "react-native";
import { Song } from "@/types";
import { HeroFeaturedCard } from "./HeroFeaturedCard";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = SCREEN_WIDTH - 36;
const CARD_GAP = 12;

interface FeaturedSongsCarouselProps {
  songs: Song[];
  onSongPress: (song: Song) => void;
}

export function FeaturedSongsCarousel({
  songs,
  onSongPress,
}: FeaturedSongsCarouselProps) {
  if (!songs || songs.length === 0) return null;

  if (songs.length === 1) {
    return (
      <View style={styles.singleContainer}>
        <HeroFeaturedCard
          song={songs[0]}
          onPress={() => onSongPress(songs[0])}
          cardWidth={CARD_WIDTH}
        />
      </View>
    );
  }

  return (
    <View style={styles.carouselContainer}>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={songs}
        keyExtractor={(item) => item.id}
        snapToInterval={CARD_WIDTH + CARD_GAP}
        snapToAlignment="start"
        decelerationRate="fast"
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <HeroFeaturedCard
            song={item}
            onPress={() => onSongPress(item)}
            cardWidth={CARD_WIDTH}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  singleContainer: {
    paddingHorizontal: 18,
  },
  carouselContainer: {
    marginBottom: 8,
  },
  listContent: {
    paddingHorizontal: 18,
    gap: CARD_GAP,
  },
});

