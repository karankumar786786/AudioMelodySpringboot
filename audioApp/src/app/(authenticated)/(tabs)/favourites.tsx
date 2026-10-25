import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";

import { favouriteService } from "@/service";
import { Song } from "@/types";
import { FavouriteSongItem } from "@/components/favourites/FavouriteSongItem";

export default function FavouritesScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [searchFilter, setSearchFilter] = useState("");

  // Infinite query for favourites
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
    queryFn: ({ pageParam = 0 }) =>
      favouriteService.getFavourites(pageParam, 20),
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

  // Flatten songs
  const allSongs: Song[] = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap((page) => page.content || []);
  }, [data]);

  const totalCount =
    data?.pages[0]?.paginationMetaData?.totalCount ??
    data?.pages[0]?.paginationMetaData?.activeCount ??
    allSongs.length;

  // Filter songs based on searchFilter
  const filteredSongs = useMemo(() => {
    const query = searchFilter.trim().toLowerCase();
    if (!query) return allSongs;
    return allSongs.filter(
      (s) =>
        s.title.toLowerCase().includes(query) ||
        (s.artistName && s.artistName.toLowerCase().includes(query))
    );
  }, [allSongs, searchFilter]);

  // Handlers
  const handleSongPress = (song: Song) => {
    router.push({
      pathname: "/(authenticated)/song/[id]",
      params: { id: song.id },
    });
  };

  const handlePlayAll = () => {
    if (filteredSongs.length > 0) {
      handleSongPress(filteredSongs[0]);
    }
  };

  const handleShuffle = () => {
    if (filteredSongs.length > 0) {
      const randomIndex = Math.floor(Math.random() * filteredSongs.length);
      handleSongPress(filteredSongs[randomIndex]);
    }
  };

  const handleRemoveFavourite = async (songId: string) => {
    // Optimistic UI update
    queryClient.setQueryData<any>(["favourites"], (oldData: any) => {
      if (!oldData) return oldData;
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
      // Re-fetch to synchronize state if API call failed
      queryClient.invalidateQueries({ queryKey: ["favourites"] });
    }
  };

  // Header component for FlatList
  const renderListHeader = () => (
    <View style={styles.headerContainer}>
      {/* Hero Liked Songs Card */}
      <View style={styles.heroCard}>
        <LinearGradient
          colors={["#450af5", "#8e8ee5"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heartGradientBox}
        >
          <Ionicons name="heart" size={38} color="#FFFFFF" />
        </LinearGradient>

        <View style={styles.heroDetails}>
          <Text style={styles.heroTitle}>Liked Songs</Text>
          <Text style={styles.heroSubtitle}>
            {totalCount} {totalCount === 1 ? "track" : "tracks"} • Auto-saved
          </Text>
        </View>
      </View>

      {/* Action Controls Row */}
      <View style={styles.controlsRow}>
        <View style={styles.filterBar}>
          <Ionicons
            name="search"
            size={16}
            color="#777777"
            style={styles.filterIcon}
          />
          <TextInput
            style={styles.filterInput}
            placeholder="Find in liked songs..."
            placeholderTextColor="#777777"
            value={searchFilter}
            onChangeText={setSearchFilter}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {searchFilter.length > 0 ? (
            <TouchableOpacity
              onPress={() => setSearchFilter("")}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-circle" size={16} color="#777777" />
            </TouchableOpacity>
          ) : null}
        </View>

        {filteredSongs.length > 0 ? (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.shuffleButton}
              onPress={handleShuffle}
              activeOpacity={0.7}
            >
              <Ionicons name="shuffle" size={22} color="#AAAAAA" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.playAllButton}
              onPress={handlePlayAll}
              activeOpacity={0.85}
            >
              <Ionicons
                name="play"
                size={22}
                color="#000000"
                style={{ marginLeft: 2 }}
              />
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={styles.loadingText}>Loading your favourites...</Text>
        </View>
      ) : allSongs.length === 0 ? (
        // Empty State: No liked songs yet
        <View style={styles.emptyContainer}>
          <View style={styles.emptyHeartBox}>
            <Ionicons name="heart-outline" size={56} color="#444444" />
          </View>
          <Text style={styles.emptyTitle}>No favourites yet</Text>
          <Text style={styles.emptySubtitle}>
            Songs you like by tapping the heart icon will appear here for easy
            access anytime.
          </Text>
          <TouchableOpacity
            style={styles.exploreButton}
            onPress={() => router.push("/(authenticated)/(tabs)/home")}
            activeOpacity={0.82}
          >
            <Text style={styles.exploreButtonText}>Explore Music</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredSongs}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={renderListHeader}
          renderItem={({ item }) => (
            <FavouriteSongItem
              song={item}
              onPress={() => handleSongPress(item)}
              onRemove={() => handleRemoveFavourite(item.id)}
            />
          )}
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
          ListEmptyComponent={
            searchFilter.length > 0 ? (
              <View style={styles.noMatchContainer}>
                <Text style={styles.noMatchText}>
                  No songs matching &quot;{searchFilter}&quot;
                </Text>
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
            />
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#121212",
  },
  listContent: {
    paddingBottom: 40,
  },
  headerContainer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
  },
  heroCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1C1428",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(142, 142, 229, 0.2)",
    marginBottom: 16,
  },
  heartGradientBox: {
    width: 68,
    height: 68,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
    shadowColor: "#450af5",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 6,
  },
  heroDetails: {
    flex: 1,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  heroSubtitle: {
    fontSize: 13,
    color: "#9A9A9A",
  },
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  filterBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1F1F1F",
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
    borderWidth: 1,
    borderColor: "#2A2A2A",
  },
  filterIcon: {
    marginRight: 8,
  },
  filterInput: {
    flex: 1,
    height: "100%",
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "500",
  },
  actionButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  shuffleButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#1F1F1F",
    borderWidth: 1,
    borderColor: "#2E2E2E",
    justifyContent: "center",
    alignItems: "center",
  },
  playAllButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#FFFFFF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.75,
    shadowRadius: 10,
    elevation: 6,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  loadingText: {
    color: "#888888",
    fontSize: 14,
    marginTop: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 36,
  },
  emptyHeartBox: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#1C1C1C",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#282828",
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 8,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#777777",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  exploreButton: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    shadowColor: "#FFFFFF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.65,
    shadowRadius: 8,
    elevation: 4,
  },
  exploreButtonText: {
    color: "#000000",
    fontSize: 14,
    fontWeight: "700",
  },
  footerLoader: {
    paddingVertical: 16,
    alignItems: "center",
  },
  noMatchContainer: {
    paddingVertical: 36,
    alignItems: "center",
  },
  noMatchText: {
    fontSize: 14,
    color: "#777777",
  },
});
