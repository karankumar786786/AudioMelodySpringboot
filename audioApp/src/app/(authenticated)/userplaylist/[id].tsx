import { useState, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Share,
  Alert,
  useWindowDimensions,
  StyleSheet,
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
import { AppDispatch, AppState, playAll, playWithSimilarSongs, deleteUserPlaylist, removeSongFromUserPlaylist } from "@/store";
import { PlaylistTrackItem, UserPlaylistThumbnail, PlaylistAccessModal } from "@/components";
import { userPlaylistDetailStyles as styles } from "@/styles";


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

  const [isAccessModalOpen, setIsAccessModalOpen] = useState(false);

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
    dispatch(playWithSimilarSongs(song, songs));
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
      await dispatch(removeSongFromUserPlaylist({ playlistId: id, songId })).unwrap();
      queryClient.invalidateQueries({ queryKey: ["user-playlists"] });
      queryClient.invalidateQueries({ queryKey: ["user-playlist", id] });
      queryClient.invalidateQueries({ queryKey: ["user-playlist-songs-thumb"] });
    } catch {
      queryClient.invalidateQueries({ queryKey: ["user-playlist-songs", id] });
      queryClient.invalidateQueries({ queryKey: ["user-playlist-songs-thumb"] });
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
              await dispatch(deleteUserPlaylist(id)).unwrap();
              queryClient.invalidateQueries({ queryKey: ["user-playlists"] });
              queryClient.invalidateQueries({ queryKey: ["user-playlist-songs-thumb"] });
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
          onPress={() => setIsAccessModalOpen(true)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.7}
          accessibilityLabel="Manage access and share"
        >
          <Ionicons
            name={isOwner ? "options-outline" : "share-social-outline"}
            size={22}
            color="#FFFFFF"
          />
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
          {/* Access / Privacy Pill and Category */}
          <View style={localStyles.badgeRow}>
            <Text style={localStyles.categoryLabel}>
              {isOwner ? "YOUR PLAYLIST" : "COMMUNITY PLAYLIST"}
            </Text>
            <Text style={localStyles.bullet}>•</Text>
            <TouchableOpacity
              style={[
                localStyles.privacyPill,
                playlist?.privacy === "PUBLIC"
                  ? localStyles.privacyPillPublic
                  : playlist?.privacy === "SHARE_BY_LINK"
                  ? localStyles.privacyPillShare
                  : localStyles.privacyPillPrivate,
              ]}
              onPress={() => isOwner && setIsAccessModalOpen(true)}
              activeOpacity={isOwner ? 0.75 : 1}
              disabled={!isOwner}
            >
              <Ionicons
                name={
                  playlist?.privacy === "PUBLIC"
                    ? "globe-outline"
                    : playlist?.privacy === "SHARE_BY_LINK"
                    ? "link-outline"
                    : "lock-closed-outline"
                }
                size={12}
                color={
                  playlist?.privacy === "PUBLIC"
                    ? "#10B981"
                    : playlist?.privacy === "SHARE_BY_LINK"
                    ? "#3B82F6"
                    : "#F59E0B"
                }
                style={{ marginRight: 4 }}
              />
              <Text
                style={[
                  localStyles.privacyPillText,
                  playlist?.privacy === "PUBLIC"
                    ? { color: "#10B981" }
                    : playlist?.privacy === "SHARE_BY_LINK"
                    ? { color: "#3B82F6" }
                    : { color: "#F59E0B" },
                ]}
              >
                {playlist?.privacy === "PUBLIC"
                  ? "Public"
                  : playlist?.privacy === "SHARE_BY_LINK"
                  ? "Share by link"
                  : "Private"}
              </Text>
              {isOwner ? (
                <Ionicons
                  name="chevron-down"
                  size={10}
                  color={
                    playlist?.privacy === "PUBLIC"
                      ? "rgba(16, 185, 129, 0.8)"
                      : playlist?.privacy === "SHARE_BY_LINK"
                      ? "rgba(59, 130, 246, 0.8)"
                      : "rgba(245, 158, 11, 0.8)"
                  }
                  style={{ marginLeft: 3 }}
                />
              ) : null}
            </TouchableOpacity>
          </View>

          <Text style={styles.title} numberOfLines={2}>
            {playlist?.name || "Playlist"}
          </Text>
          <View style={styles.metaRow}>
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

      {/* Playlist Access & Sharing Modal */}
      <PlaylistAccessModal
        visible={isAccessModalOpen}
        onClose={() => setIsAccessModalOpen(false)}
        playlist={playlist}
        isOwner={isOwner}
      />
    </View>
  );
}

const localStyles = StyleSheet.create({
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    flexWrap: "wrap",
    gap: 8,
  },
  categoryLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "rgba(255, 255, 255, 0.65)",
    letterSpacing: 0.8,
  },
  bullet: {
    fontSize: 10,
    color: "rgba(255, 255, 255, 0.4)",
  },
  privacyPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: 12,
    borderWidth: 1,
  },
  privacyPillPublic: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderColor: "rgba(16, 185, 129, 0.4)",
  },
  privacyPillShare: {
    backgroundColor: "rgba(59, 130, 246, 0.15)",
    borderColor: "rgba(59, 130, 246, 0.4)",
  },
  privacyPillPrivate: {
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    borderColor: "rgba(245, 158, 11, 0.4)",
  },
  privacyPillText: {
    fontSize: 11,
    fontWeight: "700",
  },
});

