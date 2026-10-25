import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Share,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";

import { playlistService } from "@/service";
import { Song } from "@/types";
import { PlaylistTrackItem } from "@/components/playlist/PlaylistTrackItem";
import { getImageUrl } from "@/utils/imageUtils";

export default function PlaylistDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  // 1. Fetch Playlist Details
  const {
    data: playlist,
    isLoading: isPlaylistLoading,
    refetch: refetchPlaylist,
  } = useQuery({
    queryKey: ["playlist", id],
    queryFn: () => playlistService.getPlaylistById(id!),
    enabled: Boolean(id),
    staleTime: 5 * 60 * 1000,
  });

  // 2. Fetch Playlist Songs (Infinite)
  const {
    data: songsData,
    isLoading: isSongsLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch: refetchSongs,
    isRefetching,
  } = useInfiniteQuery({
    queryKey: ["playlist-songs", id],
    queryFn: ({ pageParam = 0 }) =>
      playlistService.getPlaylistSongs(id!, pageParam, 20),
    getNextPageParam: (lastPage) => {
      const total =
        lastPage.paginationMetaData?.totalCount ??
        lastPage.paginationMetaData?.activeCount ??
        0;
      const loaded = (lastPage.page + 1) * lastPage.size;
      return loaded < total ? lastPage.page + 1 : undefined;
    },
    initialPageParam: 0,
    enabled: Boolean(id),
    staleTime: 3 * 60 * 1000,
  });

  const songs: Song[] = useMemo(() => {
    if (!songsData?.pages) return [];
    return songsData.pages.flatMap((page) => page.content || []);
  }, [songsData]);

  const totalSongs =
    playlist?.totalSongs ??
    songsData?.pages[0]?.paginationMetaData?.totalCount ??
    songs.length;

  const coverUrl = getImageUrl(playlist?.coverImageKey, {
    width: 400,
    height: 400,
    quality: 85,
  });

  // Handlers
  const handleSongPress = (song: Song) => {
    router.push({
      pathname: "/(authenticated)/song/[id]",
      params: { id: song.id },
    });
  };

  const handlePlayAll = () => {
    if (songs.length > 0) {
      handleSongPress(songs[0]);
    }
  };

  const handleShuffle = () => {
    if (songs.length > 0) {
      const randomIndex = Math.floor(Math.random() * songs.length);
      handleSongPress(songs[randomIndex]);
    }
  };

  const handleShare = async () => {
    if (!playlist) return;
    try {
      await Share.share({
        message: `Check out the "${playlist.name}" playlist on Melody!`,
      });
    } catch {
      // Ignore share cancellation
    }
  };

  const handleRefresh = () => {
    refetchPlaylist();
    refetchSongs();
  };

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      {/* Top Floating Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.circleIconButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.circleIconButton}
          onPress={handleShare}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="share-outline" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Playlist Hero Artwork */}
      <View style={styles.artworkContainer}>
        {coverUrl ? (
          <Image
            source={{ uri: coverUrl }}
            style={styles.artwork}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <View style={styles.fallbackArtwork}>
            <Ionicons name="disc" size={80} color="#444444" />
          </View>
        )}
      </View>

      {/* Title & Metadata */}
      <View style={styles.metaContainer}>
        <Text style={styles.playlistTitle} numberOfLines={2}>
          {playlist?.name || "Playlist"}
        </Text>

        {playlist?.description ? (
          <Text style={styles.playlistDescription} numberOfLines={2}>
            {playlist.description}
          </Text>
        ) : null}

        <Text style={styles.playlistStats}>
          Curated Playlist • {totalSongs} {totalSongs === 1 ? "track" : "tracks"}
        </Text>
      </View>

      {/* Action Controls */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={styles.shuffleButton}
          onPress={handleShuffle}
          activeOpacity={0.7}
        >
          <Ionicons name="shuffle" size={22} color="#AAAAAA" />
        </TouchableOpacity>

        {songs.length > 0 ? (
          <TouchableOpacity
            style={styles.playButton}
            onPress={handlePlayAll}
            activeOpacity={0.8}
          >
            <Ionicons
              name="play"
              size={24}
              color="#FFFFFF"
              style={{ marginLeft: 3 }}
            />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );

  if (isPlaylistLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#208AEF" />
        <Text style={styles.loadingText}>Loading playlist...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <FlatList
        data={songs}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        renderItem={({ item, index }) => (
          <PlaylistTrackItem
            song={item}
            index={index}
            onPress={() => handleSongPress(item)}
          />
        )}
        ListEmptyComponent={
          !isSongsLoading ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="musical-notes-outline" size={44} color="#444444" />
              <Text style={styles.emptyText}>No tracks in this playlist yet</Text>
            </View>
          ) : (
            <View style={styles.songsLoadingContainer}>
              <ActivityIndicator size="small" color="#208AEF" />
            </View>
          )
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
              <ActivityIndicator size="small" color="#208AEF" />
            </View>
          ) : undefined
        }
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={handleRefresh}
            tintColor="#208AEF"
            colors={["#208AEF"]}
          />
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
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
    paddingTop: 4,
    marginBottom: 10,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  circleIconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  artworkContainer: {
    alignSelf: "center",
    width: 200,
    height: 200,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#1C1C1C",
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 8,
  },
  artwork: {
    width: "100%",
    height: "100%",
  },
  fallbackArtwork: {
    width: "100%",
    height: "100%",
    backgroundColor: "#202020",
    justifyContent: "center",
    alignItems: "center",
  },
  metaContainer: {
    alignItems: "center",
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  playlistTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  playlistDescription: {
    fontSize: 13,
    color: "#888888",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 8,
  },
  playlistStats: {
    fontSize: 12,
    color: "#666666",
    fontWeight: "500",
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 8,
  },
  shuffleButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#1F1F1F",
    borderWidth: 1,
    borderColor: "#2E2E2E",
    justifyContent: "center",
    alignItems: "center",
  },
  playButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#208AEF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#208AEF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 5,
  },
  centerContainer: {
    flex: 1,
    backgroundColor: "#121212",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: "#888888",
    fontSize: 14,
    marginTop: 12,
  },
  emptyContainer: {
    paddingVertical: 48,
    alignItems: "center",
  },
  emptyText: {
    color: "#777777",
    fontSize: 14,
    marginTop: 10,
  },
  songsLoadingContainer: {
    paddingVertical: 32,
    alignItems: "center",
  },
  footerLoader: {
    paddingVertical: 16,
    alignItems: "center",
  },
});
