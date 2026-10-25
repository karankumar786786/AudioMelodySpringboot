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
  useWindowDimensions,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useDispatch, useSelector } from "react-redux";
import {
  useQuery,
  useInfiniteQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { playlistService } from "@/service";
import { Song } from "@/types";
import { AppDispatch, AppState } from "@/store";
import { playAll, playWithSimilarSongs } from "@/store/queueActions";
import { PlaylistTrackItem } from "@/components/playlist/PlaylistTrackItem";
import { UserPlaylistThumbnail } from "@/components/playlist/UserPlaylistThumbnail";

// Space reserved for the mini player so the last track is reachable.
// (No tab bar here: this is a stack screen.)
const MINI_PLAYER_HEIGHT = 72;
const EXTRA_BREATHING_ROOM = 32;

export default function UserPlaylistDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const coverSize = Math.min(width - 96, 260);
  const bottomSpace = MINI_PLAYER_HEIGHT + EXTRA_BREATHING_ROOM + insets.bottom;

  const currentUserId = useSelector(
    (state: AppState) => state.user.profile?.id,
  );

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

  const handleSongPress = (song: Song) => {
    dispatch(playWithSimilarSongs(song));
    router.push({
      pathname: "/(authenticated)/song/[id]",
      params: { id: song.id },
    });
  };

  const handlePlayAll = () => {
    if (songs.length > 0) {
      dispatch(playAll(songs));
      router.push({
        pathname: "/(authenticated)/song/[id]",
        params: { id: songs[0].id },
      });
    }
  };

  const handleRemoveTrack = async (songId: string) => {
    if (!id) return;

    // Optimistic UI update
    queryClient.setQueryData<any>(
      ["user-playlist-songs", id],
      (oldData: any) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          pages: oldData.pages.map((page: any) => ({
            ...page,
            content: (page.content || []).filter((s: Song) => s.id !== songId),
          })),
        };
      },
    );

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
      ],
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

  const topBar = (
    <View style={[styles.topBar, { paddingTop: insets.top + 6 }]}>
      <TouchableOpacity
        style={styles.iconButton}
        onPress={() => router.back()}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        activeOpacity={0.7}
        accessibilityLabel="Go back"
      >
        <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
      </TouchableOpacity>

      <View style={styles.topBarActions}>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={handleShare}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.7}
          accessibilityLabel="Share playlist"
        >
          <Ionicons name="share-outline" size={22} color="#FFFFFF" />
        </TouchableOpacity>

        {isOwner ? (
          <TouchableOpacity
            style={styles.iconButton}
            onPress={handleDeletePlaylist}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
            accessibilityLabel="Delete playlist"
          >
            <Ionicons name="trash-outline" size={21} color="#FFFFFF" />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.coverWrap}>
        <UserPlaylistThumbnail
          playlist={playlist ?? { id: id! }}
          songs={songs}
          size={coverSize}
          borderRadius={16}
        />
      </View>

      <View style={styles.titleRow}>
        <View style={styles.titleText}>
          <Text style={styles.title} numberOfLines={2}>
            {playlist?.name || "Playlist"}
          </Text>
          <View style={styles.metaRow}>
            {playlist?.privacy === "PRIVATE" ? (
              <Ionicons
                name="lock-closed"
                size={12}
                color="#8A8A8A"
                style={{ marginRight: 5 }}
              />
            ) : null}
            <Text style={styles.meta} numberOfLines={1}>
              By {playlist?.ownerName || (isOwner ? "You" : "Community")}
              {"  ·  "}
              {totalSongs} {totalSongs === 1 ? "song" : "songs"}
            </Text>
          </View>
        </View>

        {songs.length > 0 ? (
          <TouchableOpacity
            style={styles.playButton}
            onPress={handlePlayAll}
            activeOpacity={0.85}
            accessibilityLabel="Play all"
          >
            <Ionicons
              name="play"
              size={26}
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
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {topBar}

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
            <View style={styles.empty}>
              <Ionicons name="musical-notes-outline" size={40} color="#FFFFFF" />
              <Text style={styles.emptyTitle}>This playlist is empty</Text>
              <Text style={styles.emptyText}>
                Add songs from Home or Search to fill it up.
              </Text>
            </View>
          ) : (
            <View style={styles.songsLoading}>
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
            progressBackgroundColor="#1A1A1A"
          />
        }
        contentContainerStyle={{ paddingBottom: bottomSpace }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000000" },
  centerContainer: {
    flex: 1,
    backgroundColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
  },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingBottom: 6,
    backgroundColor: "#000000",
  },
  topBarActions: { flexDirection: "row", alignItems: "center" },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },

  header: { paddingTop: 8, paddingBottom: 18 },
  coverWrap: { alignItems: "center", marginBottom: 24 },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    gap: 16,
  },
  titleText: { flex: 1 },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.7,
    marginBottom: 5,
  },
  metaRow: { flexDirection: "row", alignItems: "center" },
  meta: { fontSize: 13, color: "#8A8A8A", flexShrink: 1 },
  playButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },

  empty: { alignItems: "center", paddingTop: 40, paddingHorizontal: 32 },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
    marginTop: 14,
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 14,
    color: "#8A8A8A",
    textAlign: "center",
    lineHeight: 20,
  },
  songsLoading: { paddingVertical: 32, alignItems: "center" },
  footerLoader: { paddingVertical: 20, alignItems: "center" },
});