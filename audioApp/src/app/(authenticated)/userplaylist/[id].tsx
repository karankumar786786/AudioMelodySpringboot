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
  Alert,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSelector } from "react-redux";
import { useQuery, useInfiniteQuery, useQueryClient } from "@tanstack/react-query";

import { playlistService } from "@/service";
import { Song } from "@/types";
import { AppState } from "@/store";
import { PlaylistTrackItem } from "@/components/playlist/PlaylistTrackItem";

export default function UserPlaylistDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const currentUserId = useSelector(
    (state: AppState) => state.user.profile?.id
  );

  // 1. Fetch User Playlist Details
  const {
    data: playlist,
    isLoading: isPlaylistLoading,
    refetch: refetchPlaylist,
  } = useQuery({
    queryKey: ["user-playlist", id],
    queryFn: () => playlistService.getUserPlaylistById(id!),
    enabled: Boolean(id),
    staleTime: 60 * 1000,
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
    queryKey: ["user-playlist-songs", id],
    queryFn: ({ pageParam = 0 }) =>
      playlistService.getUserPlaylistSongs(id!, pageParam, 20),
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
    staleTime: 60 * 1000,
  });

  const songs: Song[] = useMemo(() => {
    if (!songsData?.pages) return [];
    return songsData.pages.flatMap((page) => page.content || []);
  }, [songsData]);

  const isOwner =
    Boolean(currentUserId) &&
    (playlist?.ownerId === currentUserId || playlist?.userId === currentUserId);

  const totalSongs =
    playlist?.totalSongs ??
    songsData?.pages[0]?.paginationMetaData?.totalCount ??
    songs.length;

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

  const handleRemoveTrack = async (songId: string) => {
    if (!id) return;

    // Optimistic UI update
    queryClient.setQueryData<any>(["user-playlist-songs", id], (oldData: any) => {
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
      await playlistService.removeSongFromUserPlaylist(id, songId);
      queryClient.invalidateQueries({ queryKey: ["user-playlists"] });
      queryClient.invalidateQueries({ queryKey: ["user-playlist", id] });
    } catch {
      queryClient.invalidateQueries({ queryKey: ["user-playlist-songs", id] });
    }
  };

  const handleDeletePlaylist = () => {
    if (!id) return;
    Alert.alert(
      "Delete Playlist",
      `Are you sure you want to delete "${playlist?.name}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await playlistService.deleteUserPlaylist(id);
              queryClient.invalidateQueries({ queryKey: ["user-playlists"] });
              router.back();
            } catch (err) {
              console.error("Failed to delete playlist:", err);
            }
          },
        },
      ]
    );
  };

  const handleShare = async () => {
    if (!playlist) return;
    try {
      await Share.share({
        message: `Listen to "${playlist.name}" on Melody!`,
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
      {/* Hero Icon Artwork */}
      <View style={styles.artworkContainer}>
        <LinearGradient
          colors={["#262626", "#161616", "#121212"]}
          style={styles.iconBox}
        >
          <Ionicons name="musical-notes" size={68} color="#FFFFFF" />
        </LinearGradient>
      </View>

      {/* Title & Metadata */}
      <View style={styles.metaContainer}>
        <Text style={styles.playlistTitle} numberOfLines={2}>
          {playlist?.name || "Playlist"}
        </Text>

        <View style={styles.subtitleRow}>
          <Text style={styles.playlistOwner}>
            By {playlist?.ownerName || (isOwner ? "You" : "Community")}
          </Text>
          <View style={styles.dotSeparator} />
          <Text style={styles.playlistStats}>
            {totalSongs} {totalSongs === 1 ? "track" : "tracks"}
          </Text>
          <View style={styles.dotSeparator} />
          <View style={styles.privacyBadge}>
            <Text style={styles.privacyBadgeText}>
              {playlist?.privacy === "PRIVATE" ? "Private" : "Public"}
            </Text>
          </View>
        </View>
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
            activeOpacity={0.85}
          >
            <Ionicons
              name="play"
              size={24}
              color="#000000"
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
        <ActivityIndicator size="large" color="#FFFFFF" />
        <Text style={styles.loadingText}>Loading playlist...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: playlist?.name || "My Playlist",
          headerRight: () => (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
              <TouchableOpacity
                onPress={handleShare}
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="share-outline" size={22} color="#FFFFFF" />
              </TouchableOpacity>
              {isOwner ? (
                <TouchableOpacity
                  onPress={handleDeletePlaylist}
                  activeOpacity={0.7}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="trash-outline" size={20} color="#FF5252" />
                </TouchableOpacity>
              ) : null}
            </View>
          ),
        }}
      />
      <FlatList
        data={songs}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        renderItem={({ item }) => (
          <PlaylistTrackItem
            song={item}
            onPress={() => handleSongPress(item)}
            onRemove={isOwner ? () => handleRemoveTrack(item.id) : undefined}
          />
        )}
        ListEmptyComponent={
          !isSongsLoading ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="musical-notes-outline" size={44} color="#444444" />
              <Text style={styles.emptyTitle}>This playlist is empty</Text>
              <Text style={styles.emptySubtitle}>
                Add tracks from Home or Search to build this playlist.
              </Text>
            </View>
          ) : (
            <View style={styles.songsLoadingContainer}>
              <ActivityIndicator size="small" color="#FFFFFF" />
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
              <ActivityIndicator size="small" color="#FFFFFF" />
            </View>
          ) : undefined
        }
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={handleRefresh}
            tintColor="#FFFFFF"
            colors={["#FFFFFF"]}
          />
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
  },
  listContent: {
    paddingBottom: 40,
  },
  headerContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    marginBottom: 10,
  },
  artworkContainer: {
    alignSelf: "center",
    marginBottom: 20,
  },
  iconBox: {
    width: 170,
    height: 170,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.25)",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#FFFFFF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
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
  subtitleRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 6,
  },
  playlistOwner: {
    fontSize: 13,
    color: "#AAAAAA",
    fontWeight: "500",
  },
  dotSeparator: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: "#666666",
  },
  playlistStats: {
    fontSize: 13,
    color: "#AAAAAA",
  },
  privacyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  privacyBadgeText: {
    fontSize: 11,
    color: "#FFFFFF",
    fontWeight: "700",
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
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#FFFFFF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.75,
    shadowRadius: 12,
    elevation: 8,
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
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginTop: 12,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: "#777777",
    textAlign: "center",
    lineHeight: 18,
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
