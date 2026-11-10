import React, { useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useDispatch, useSelector } from "react-redux";
import { Ionicons } from "@expo/vector-icons";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";

import { AppDispatch, AppState, playAll, playWithSimilarSongs, toggleFavourite } from "@/store";
import { audioPlayerService, favouriteService } from "@/service";
import { Song } from "@/types";
import { FavouriteSongItem } from "@/components";
import { favouriteStyles as styles } from "@/styles";

// Space reserved for the tab bar + mini player so the last song is reachable.
const TAB_BAR_HEIGHT = 64;
const MINI_PLAYER_HEIGHT = 72;
const EXTRA_BREATHING_ROOM = 32;

export default function FavouritesScreen() {
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const canGoBack = router.canGoBack();

  const bottomSpace =
    TAB_BAR_HEIGHT + MINI_PLAYER_HEIGHT + EXTRA_BREATHING_ROOM + insets.bottom;

  const currentSong = useSelector((state: AppState) => state.player.currentSong);
  const isPlaying = useSelector((state: AppState) => state.player.isPlaying);
  const reduxFavouriteSongs = useSelector((state: AppState) => state.favourites.favouriteSongs);
  const reduxFavouriteIds = useSelector((state: AppState) => state.favourites.favouriteIds);

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
    isRefetching,
  } = useInfiniteQuery({
    queryKey: ["favourites"],
    queryFn: ({ pageParam = 0 }) => favouriteService.getFavourites(pageParam, 20),
    getNextPageParam: (lastPage) => {
      const total =
        lastPage.paginationMetaData?.totalCount ??
        lastPage.paginationMetaData?.activeCount ??
        0;
      const loaded = (lastPage.page + 1) * lastPage.size;
      return loaded < total ? lastPage.page + 1 : undefined;
    },
    initialPageParam: 0,
  });

  const allSongs: Song[] = useMemo(() => {
    const querySongs = data?.pages ? data.pages.flatMap((page) => page.content || []) : [];
    const seen = new Set<string>();
    const combined: Song[] = [];

    // Redux favourite songs (includes newly liked songs immediately)
    for (const song of reduxFavouriteSongs) {
      if (reduxFavouriteIds.includes(song.id) && !seen.has(song.id)) {
        seen.add(song.id);
        combined.push(song);
      }
    }

    // Add query songs that are still in Redux favouriteIds
    for (const song of querySongs) {
      if (!seen.has(song.id) && (reduxFavouriteIds.length === 0 || reduxFavouriteIds.includes(song.id))) {
        seen.add(song.id);
        combined.push(song);
      }
    }

    return combined;
  }, [data, reduxFavouriteSongs, reduxFavouriteIds]);

  const totalCount =
    data?.pages[0]?.paginationMetaData?.totalCount ??
    data?.pages[0]?.paginationMetaData?.activeCount ??
    allSongs.length;

  const handleSongPress = (song: Song) => {
    dispatch(playWithSimilarSongs(song, allSongs));
    router.push({
      pathname: "/(authenticated)/song/[id]",
      params: { id: song.id },
    });
  };

  const isCurrentPlaylistPlaying = useMemo(() => {
    if (!currentSong || !isPlaying || allSongs.length === 0) return false;
    return allSongs.some((s) => s.id === currentSong.id);
  }, [currentSong, isPlaying, allSongs]);

  const handlePlayAll = () => {
    if (allSongs.length === 0) return;

    if (isCurrentPlaylistPlaying) {
      audioPlayerService.pause();
      return;
    }

    if (currentSong && allSongs.some((s) => s.id === currentSong.id)) {
      audioPlayerService.resume();
      return;
    }

    dispatch(playAll(allSongs));
    router.push({
      pathname: "/(authenticated)/song/[id]",
      params: { id: allSongs[0].id },
    });
  };

  const handleRemoveFavourite = async (songId: string) => {
    const targetSong = allSongs.find((s) => s.id === songId) || ({ id: songId } as Song);
    (dispatch as any)(toggleFavourite(targetSong));

    // Optimistic UI update for query cache
    queryClient.setQueryData<any>(["favourites"], (oldData: any) => {
      if (!oldData || !Array.isArray(oldData.pages)) return oldData;
      return {
        ...oldData,
        pages: oldData.pages.map((page: any) => ({
          ...page,
          content: (page.content || []).filter((s: Song) => s.id !== songId),
        })),
      };
    });
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
        {canGoBack && (
          <TouchableOpacity
            style={{ marginRight: 10, padding: 4 }}
            onPress={() => router.back()}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
          </TouchableOpacity>
        )}
        <View style={styles.headerText}>
          <Text style={styles.title} numberOfLines={1}>
            Liked songs
          </Text>
          <Text style={styles.subtitle}>
            {totalCount} {totalCount === 1 ? "song" : "songs"}
          </Text>
        </View>
      </View>

      {allSongs.length > 0 ? (
        <TouchableOpacity
          style={styles.playButton}
          onPress={handlePlayAll}
          activeOpacity={0.85}
          accessibilityLabel={isCurrentPlaylistPlaying ? "Pause" : "Play all"}
        >
          <Ionicons
            name={isCurrentPlaylistPlaying ? "pause" : "play"}
            size={26}
            color="#000000"
            style={!isCurrentPlaylistPlaying ? { marginLeft: 3 } : undefined}
          />
        </TouchableOpacity>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#FFFFFF" />
        </View>
      ) : (
        <FlatList
          data={allSongs}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={renderHeader}
          renderItem={({ item, index }) => (
            <FavouriteSongItem
              song={item}
              index={index}
              isActive={currentSong?.id === item.id}
              isPlaying={currentSong?.id === item.id && isPlaying}
              onPress={() => handleSongPress(item)}
              onRemove={() => handleRemoveFavourite(item.id)}
            />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="heart-outline" size={44} color="#FFFFFF" />
              <Text style={styles.emptyTitle}>No liked songs yet</Text>
              <Text style={styles.emptyText}>
                Tap the heart on any song and it will show up here.
              </Text>
              <TouchableOpacity
                style={styles.exploreButton}
                onPress={() => router.push("/(authenticated)/(tabs)/home")}
                activeOpacity={0.85}
              >
                <Text style={styles.exploreButtonText}>Find music</Text>
              </TouchableOpacity>
            </View>
          }
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) {
              fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            isFetchingNextPage ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color="#FFFFFF" />
              </View>
            ) : undefined
          }
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => {
                refetch();
              }}
              tintColor="#FFFFFF"
              colors={["#FFFFFF"]}
              progressBackgroundColor="#1A1A1A"
            />
          }
          contentContainerStyle={{ paddingBottom: bottomSpace }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}
