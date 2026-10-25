import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
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

import { AppDispatch, AppState } from "@/store";
import { playAll, playWithSimilarSongs } from "@/store/queueActions";
import { audioPlayerService } from "@/service/audioPlayerService";
import { favouriteService } from "@/service";
import { Song } from "@/types";
import { FavouriteSongItem } from "@/components/favourites/FavouriteSongItem";

// Space reserved for the tab bar + mini player so the last song is reachable.
const TAB_BAR_HEIGHT = 64;
const MINI_PLAYER_HEIGHT = 72;
const EXTRA_BREATHING_ROOM = 32;

export default function FavouritesScreen() {
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

  const bottomSpace =
    TAB_BAR_HEIGHT + MINI_PLAYER_HEIGHT + EXTRA_BREATHING_ROOM + insets.bottom;

  const currentSong = useSelector((state: AppState) => state.player.currentSong);
  const isPlaying = useSelector((state: AppState) => state.player.isPlaying);

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
    if (!data?.pages) return [];
    return data.pages.flatMap((page) => page.content || []);
  }, [data]);

  const totalCount =
    data?.pages[0]?.paginationMetaData?.totalCount ??
    data?.pages[0]?.paginationMetaData?.activeCount ??
    allSongs.length;

  const handleSongPress = (song: Song) => {
    dispatch(playWithSimilarSongs(song));
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
    // Optimistic UI update
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

    try {
      await favouriteService.removeFavourite(songId);
    } catch {
      queryClient.invalidateQueries({ queryKey: ["favourites"] });
    }
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerText}>
        <Text style={styles.title} numberOfLines={1}>
          Liked songs
        </Text>
        <Text style={styles.subtitle}>
          {totalCount} {totalCount === 1 ? "song" : "songs"}
        </Text>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 20,
    gap: 16,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.8,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: "#8A8A8A",
  },
  playButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },

  empty: {
    alignItems: "center",
    paddingTop: 72,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#FFFFFF",
    marginTop: 16,
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 14,
    color: "#8A8A8A",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  exploreButton: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 28,
    paddingVertical: 13,
    borderRadius: 999,
  },
  exploreButtonText: {
    color: "#000000",
    fontSize: 15,
    fontWeight: "700",
  },

  footerLoader: {
    paddingVertical: 20,
    alignItems: "center",
  },
});