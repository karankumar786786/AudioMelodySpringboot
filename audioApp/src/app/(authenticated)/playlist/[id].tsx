import { useMemo } from "react";
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
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { playlistService } from "@/service";
import { Song } from "@/types";
import { PlaylistTrackItem } from "@/components/playlist/PlaylistTrackItem";
import { CanvasVideoPlayer } from "@/components/common/CanvasVideoPlayer";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

// const { width: SCREEN_WIDTH } = Dimensions.get("window");
const HERO_HEIGHT = 440;

export default function PlaylistDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

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

  const totalDuration = useMemo(() => {
    return songs.reduce((acc, song) => acc + (song.duration || 0), 0);
  }, [songs]);

  const totalStreams = useMemo(() => {
    return songs.reduce((acc, song) => acc + (song.totalStreams || 0), 0);
  }, [songs]);

  const formatPlaylistDuration = (seconds: number) => {
    if (!seconds || seconds <= 0) return "";
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours} hr ${mins} min`;
    }
    return `${mins} min`;
  };

  const formatStreamCount = (count: number) => {
    if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
    if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
    return `${count}`;
  };

  // Video Key & Image Key (falls back to 1st song with video/image if playlist doesn't have its own)
  const heroVideoKey =
    playlist?.videoKey ||
    (songs.length > 0 ? songs.find((s) => Boolean(s.videoKey))?.videoKey : undefined);
  const heroImageKey =
    playlist?.coverImageKey ||
    (songs.length > 0 ? songs[0]?.imageKey : undefined);

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
      {/* Playlist Hero Banner with Canva Video Player */}
      <View style={styles.heroBanner}>
        <CanvasVideoPlayer
          videoKey={heroVideoKey}
          fallbackImageKey={heroImageKey}
          style={StyleSheet.absoluteFill}
          isPlaying={true}
          showLoaderWhenVideoAvailable={true}
        />

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
                style={styles.iconCircleButton}
                onPress={handleShare}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="share-outline" size={19} color="#FFFFFF" />
              </TouchableOpacity>

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

          {playlist?.description ? (
            <Text style={styles.heroDescription} numberOfLines={2}>
              {playlist.description}
            </Text>
          ) : null}

          <View style={styles.statsRow}>
            <Text style={styles.curatorText}>OneMelody</Text>
            <Text style={styles.statDot}>•</Text>
            <Text style={styles.statText}>
              {totalSongs} {totalSongs === 1 ? "track" : "tracks"}
            </Text>
            {totalStreams > 0 ? (
              <>
                <Text style={styles.statDot}>•</Text>
                <View style={styles.streamStat}>
                  <Ionicons
                    name="headset-outline"
                    size={12}
                    color="#FFFFFF"
                    style={{ marginRight: 3 }}
                  />
                  <Text style={styles.streamCountText}>
                    {formatStreamCount(totalStreams)}
                  </Text>
                </View>
              </>
            ) : null}
            {totalDuration > 0 ? (
              <>
                <Text style={styles.statDot}>•</Text>
                <Text style={styles.statText}>
                  {formatPlaylistDuration(totalDuration)}
                </Text>
              </>
            ) : null}
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
  floatingNav: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 20,
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  floatingButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
    justifyContent: "center",
    alignItems: "center",
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
    paddingBottom: 14,
  },
  badgeRow: {
    flexDirection: "row",
    marginBottom: 6,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: "rgba(255, 255, 255, 0.16)",
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 1.1,
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
    fontSize: 24,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: -0.4,
    textShadowColor: "rgba(0, 0, 0, 0.85)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  heroDescription: {
    fontSize: 13,
    color: "rgba(255, 255, 255, 0.78)",
    lineHeight: 18,
    marginBottom: 8,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },
  curatorText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  statDot: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.45)",
    marginHorizontal: 6,
  },
  statText: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.72)",
    fontWeight: "500",
  },
  streamStat: {
    flexDirection: "row",
    alignItems: "center",
  },
  streamCountText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  iconCircleButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(30, 30, 30, 0.85)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.18)",
    justifyContent: "center",
    alignItems: "center",
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