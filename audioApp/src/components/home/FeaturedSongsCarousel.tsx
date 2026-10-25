import React, { useState } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
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
  const [activeIndex, setActiveIndex] = useState(0);

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

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / (CARD_WIDTH + CARD_GAP));
    if (index >= 0 && index < songs.length && index !== activeIndex) {
      setActiveIndex(index);
    }
  };

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
        onScroll={handleScroll}
        scrollEventThrottle={16}
        renderItem={({ item }) => (
          <HeroFeaturedCard
            song={item}
            onPress={() => onSongPress(item)}
            cardWidth={CARD_WIDTH}
          />
        )}
      />

      {/* Pagination Indicator Dots */}
      <View style={styles.dotsContainer}>
        {songs.map((_, i) => (
          <View
            key={i}
            style={[styles.dot, i === activeIndex && styles.activeDot]}
          />
        ))}
      </View>
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
  dotsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255, 255, 255, 0.25)",
  },
  activeDot: {
    width: 18,
    backgroundColor: "#208AEF",
  },
});
