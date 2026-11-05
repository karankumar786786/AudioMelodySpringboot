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
import { useSelector, useDispatch } from "react-redux";
import { Song } from "@/types";
import { AppState, AppDispatch, toggleFavourite } from "@/store";
import { HeroFeaturedCard } from "./HeroFeaturedCard";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = SCREEN_WIDTH - 40;
const CARD_GAP = 12;
const ITEM_INTERVAL = CARD_WIDTH + CARD_GAP;

interface FeaturedSongsCarouselProps {
  songs: Song[];
  onSongPress: (song: Song) => void;
  onPlayPress?: (song: Song) => void;
}

export function FeaturedSongsCarousel({
  songs,
  onSongPress,
  onPlayPress,
}: FeaturedSongsCarouselProps) {
  const dispatch = useDispatch<AppDispatch>();
  const isScreenFocused = useIsFocused();
  const [activeIndex, setActiveIndex] = useState(0);

  const currentSong = useSelector((state: AppState) => state.player.currentSong);
  const isPlayerPlaying = useSelector((state: AppState) => state.player.isPlaying);
  const favouriteIds = useSelector((state: AppState) => state.favourites.favouriteIds);

  if (!songs || songs.length === 0) return null;

  const handleLike = (song: Song) => {
    dispatch(toggleFavourite(song));
  };

  if (songs.length === 1) {
    const song = songs[0];
    const isFav = favouriteIds.some((id) => String(id) === String(song.id));
    const isCurrent = currentSong?.id === song.id;

    return (
      <View style={styles.singleContainer}>
        <HeroFeaturedCard
          song={song}
          onPress={() => onSongPress(song)}
          onPlayPress={() => onPlayPress?.(song)}
          onLikePress={() => handleLike(song)}
          isLiked={isFav}
          isCurrentTrack={isCurrent}
          isPlaying={isCurrent && isPlayerPlaying}
          cardWidth={CARD_WIDTH}
          totalSlides={1}
          activeIndex={0}
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
        scrollEventThrottle={16}
        contentContainerStyle={styles.listContent}
        renderItem={({ item, index }) => {
          const isFav = favouriteIds.some((id) => String(id) === String(item.id));
          const isCurrent = currentSong?.id === item.id;

          return (
            <HeroFeaturedCard
              song={item}
              onPress={() => onSongPress(item)}
              onPlayPress={() => onPlayPress?.(item)}
              onLikePress={() => handleLike(item)}
              isLiked={isFav}
              isCurrentTrack={isCurrent}
              isPlaying={isCurrent && isPlayerPlaying}
              cardWidth={CARD_WIDTH}
              totalSlides={songs.length}
              activeIndex={activeIndex}
            />
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  singleContainer: {
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  carouselContainer: {
    marginBottom: 8,
  },
  listContent: {
    paddingHorizontal: 20,
    gap: CARD_GAP,
  },
});
