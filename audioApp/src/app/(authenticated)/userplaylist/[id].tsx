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
  Dimensions,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSelector } from "react-redux";
import { useQuery, useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { playlistService } from "@/service";
import { Song } from "@/types";
import { AppState } from "@/store";
import { PlaylistTrackItem } from "@/components/playlist/PlaylistTrackItem";
import { CanvasVideoPlayer } from "@/components/common/CanvasVideoPlayer";
import { getImageUrl } from "@/utils/imageUtils";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const HERO_HEIGHT = 440;

export default function UserPlaylistDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

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

  const heroSong = songs[0];
  const heroVideoKey = heroSong?.videoKey;
  const heroImageKey = playlist?.coverImageKey || heroSong?.imageKey;

  const coverUrl = getImageUrl(playlist?.coverImageKey, {
    width: 800,
    height: 800,
    quality: 90,
  });

  const firstSongImg = heroSong
    ? getImageUrl(heroSong.imageKey, {
        width: 800,
        height: 800,
        quality: 90,
      })
    : undefined;

  const mosaicImages = songs.slice(0, 4).map((s) =>
    getImageUrl(s.imageKey, {
      width: 400,
      height: 400,
      quality: 85,
    })
  );

  const showMosaic = !coverUrl && !heroVideoKey && songs.length >= 4;

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      {/* Hero Banner */}
      <View style={styles.heroBanner}>
        {heroVideoKey ? (
          <CanvasVideoPlayer
            videoKey={heroVideoKey}
            fallbackImageKey={heroImageKey}
            style={StyleSheet.absoluteFill}
            isPlaying={true}
          />
        ) : coverUrl ? (
          <Image
            source={{ uri: coverUrl }}
            style={styles.heroBannerImage}
            contentFit="cover"
            contentPosition="top center"
            transition={200}
          />
        ) : showMosaic ? (
          <View style={styles.mosaicGrid}>
            <View style={styles.mosaicRow}>
              <View style={styles.mosaicCell}>
                {mosaicImages[0] ? (
                  <Image
                    source={{ uri: mosaicImages[0] }}
                    style={styles.imageFull}
                    contentFit="cover"
                    contentPosition="top center"
                  />
                ) : (
                  <View style={styles.cellFallback} />
                )}
              </View>
              <View style={styles.mosaicCell}>
                {mosaicImages[1] ? (
                  <Image
                    source={{ uri: mosaicImages[1] }}
                    style={styles.imageFull}
                    contentFit="cover"
                    contentPosition="top center"
                  />
                ) : (
                  <View style={styles.cellFallback} />
                )}
              </View>
            </View>
            <View style={styles.mosaicRow}>
              <View style={styles.mosaicCell}>
                {mosaicImages[2] ? (
                  <Image
                    source={{ uri: mosaicImages[2] }}
                    style={styles.imageFull}
                    contentFit="cover"
                    contentPosition="top center"
                  />
                ) : (
                  <View style={styles.cellFallback} />
                )}
              </View>
              <View style={styles.mosaicCell}>
                {mosaicImages[3] ? (
                  <Image
                    source={{ uri: mosaicImages[3] }}
                    style={styles.imageFull}
                    contentFit="cover"
                    contentPosition="top center"
                  />
                ) : (
                  <View style={styles.cellFallback} />
                )}
              </View>
            </View>
          </View>
        ) : firstSongImg ? (
          <Image
            source={{ uri: firstSongImg }}
            style={styles.heroBannerImage}
            contentFit="cover"
            contentPosition="top center"
            transition={200}
          />
        ) : (
          <View style={styles.emptyHero}>
            <Ionicons name="musical-notes" size={80} color="#444444" />
          </View>
        )}

        {/* Global subtle dark wash */}
        <View style={styles.heroWash} />

        {/* Linear Gradient scrim covering bottom blending into page background */}
        <LinearGradient
          colors={["transparent", "rgba(18, 18, 18, 0.45)", "#121212"]}
          locations={[0, 0.62, 1]}
          style={styles.heroGradient}
        />

        {/* Content pinned to bottom */}
        <View style={styles.heroContent}>
          <View style={styles.titleRow}>
            <Text style={styles.heroTitle} numberOfLines={2}>
              {playlist?.name || "Playlist"}
            </Text>

            <View style={styles.titleActions}>
              <TouchableOpacity
                style={styles.actionIconButton}
                onPress={handleShare}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="share-outline" size={19} color="#FFFFFF" />
              </TouchableOpacity>

              {isOwner ? (
                <TouchableOpacity
                  style={[styles.actionIconButton, styles.deleteButton]}
                  onPress={handleDeletePlaylist}
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="trash-outline" size={18} color="#FF5252" />
                </TouchableOpacity>
              ) : null}

              {songs.length > 0 ? (
                <TouchableOpacity
                  style={styles.playButton}
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
              ) : null}
            </View>
          </View>

          <View style={styles.statsRow}>
            <Text style={styles.curatorText}>
              By {playlist?.ownerName || (isOwner ? "You" : "Community")}
            </Text>
            <Text style={styles.statDot}>•</Text>
            <Text style={styles.statText}>
              {totalSongs} {totalSongs === 1 ? "track" : "tracks"}
            </Text>
            <Text style={styles.statDot}>•</Text>
            <View style={styles.privacyBadge}>
              <Text style={styles.privacyBadgeText}>
                {playlist?.privacy === "PRIVATE" ? "Private" : "Public"}
              </Text>
            </View>
          </View>
        </View>
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
          headerShown: false,
        }}
      />

      <FlatList
        contentInsetAdjustmentBehavior="never"
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
    marginTop: 0,
    paddingTop: 0,
  },
  listContent: {
    paddingTop: 0,
    paddingBottom: 40,
  },
  headerContainer: {
    marginTop: 0,
    paddingTop: 0,
    marginBottom: 6,
  },
  heroBanner: {
    width: "100%",
    height: HERO_HEIGHT,
    position: "relative",
    backgroundColor: "#181818",
    overflow: "hidden",
    marginTop: 0,
    paddingTop: 0,
  },
  heroBannerImage: {
    width: "100%",
    height: "100%",
  },
  imageFull: {
    width: "100%",
    height: "100%",
  },
  mosaicGrid: {
    width: "100%",
    height: "100%",
    flexDirection: "column",
  },
  mosaicRow: {
    flex: 1,
    flexDirection: "row",
    width: "100%",
  },
  mosaicCell: {
    flex: 1,
    height: "100%",
    overflow: "hidden",
    backgroundColor: "#18181A",
  },
  cellFallback: {
    flex: 1,
    backgroundColor: "#202024",
  },
  emptyHero: {
    width: "100%",
    height: "100%",
    backgroundColor: "#1A1A1A",
    justifyContent: "center",
    alignItems: "center",
  },
  heroWash: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0, 0, 0, 0.15)",
  },
  heroGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: HERO_HEIGHT * 0.78,
  },
  heroContent: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 18,
    paddingBottom: 16,
  },
  badgeRow: {
    marginBottom: 6,
  },
  typeBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.8,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 4,
  },
  titleActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexShrink: 0,
  },
  heroTitle: {
    flex: 1,
    fontSize: 26,
    fontWeight: "bold",
    color: "#FFFFFF",
    letterSpacing: -0.5,
    textShadowColor: "rgba(0, 0, 0, 0.85)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  curatorText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  statDot: {
    fontSize: 12,
    color: "#888888",
  },
  statText: {
    fontSize: 13,
    color: "#BBBBBB",
  },
  privacyBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  privacyBadgeText: {
    fontSize: 11,
    color: "#FFFFFF",
    fontWeight: "700",
  },
  actionIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(30, 30, 30, 0.85)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.18)",
    justifyContent: "center",
    alignItems: "center",
  },
  deleteButton: {
    backgroundColor: "rgba(255, 82, 82, 0.15)",
    borderColor: "rgba(255, 82, 82, 0.35)",
  },
  playButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#FFFFFF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
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
