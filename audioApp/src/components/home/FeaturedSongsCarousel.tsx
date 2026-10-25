import React, { useState } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { useIsFocused } from "expo-router";
import { Song } from "@/types";
import { HeroFeaturedCard } from "./HeroFeaturedCard";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = SCREEN_WIDTH - 36;
const CARD_GAP = 12;
const ITEM_INTERVAL = CARD_WIDTH + CARD_GAP;

interface FeaturedSongsCarouselProps {
  songs: Song[];
  onSongPress: (song: Song) => void;
}

export function FeaturedSongsCarousel({
  songs,
  onSongPress,
}: FeaturedSongsCarouselProps) {
  const isScreenFocused = useIsFocused();
  const [activeIndex, setActiveIndex] = useState(0);

  if (!songs || songs.length === 0) return null;

  if (songs.length === 1) {
    return (
      <View style={styles.singleContainer}>
        <HeroFeaturedCard
          song={songs[0]}
          onPress={() => onSongPress(songs[0])}
          cardWidth={CARD_WIDTH}
          isPlaying={isScreenFocused}
        />
      </View>
    );
  }

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const nextIndex = Math.round(offsetX / ITEM_INTERVAL);
    if (nextIndex >= 0 && nextIndex < songs.length && nextIndex !== activeIndex) {
      setActiveIndex(nextIndex);
    }
  };

  const handleMomentumScrollEnd = (
    event: NativeSyntheticEvent<NativeScrollEvent>
  ) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const nextIndex = Math.round(offsetX / ITEM_INTERVAL);
    if (nextIndex >= 0 && nextIndex < songs.length) {
      setActiveIndex(nextIndex);
    }
  };

  return (
    <View style={styles.carouselContainer}>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={songs}
        keyExtractor={(item) => item.id}
        snapToInterval={ITEM_INTERVAL}
        snapToAlignment="start"
        decelerationRate="fast"
        onScroll={handleScroll}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        scrollEventThrottle={32}
        contentContainerStyle={styles.listContent}
        renderItem={({ item, index }) => (
          <HeroFeaturedCard
            song={item}
            onPress={() => onSongPress(item)}
            cardWidth={CARD_WIDTH}
            isPlaying={isScreenFocused && index === activeIndex}
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

