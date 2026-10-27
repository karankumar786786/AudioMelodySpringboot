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
import { useDispatch } from "react-redux";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { AppDispatch } from "@/store";
import { playAll, playWithSimilarSongs } from "@/store/queueActions";
import { playlistService } from "@/service";
import { Song } from "@/types";
import { PlaylistTrackItem } from "@/components/playlist/PlaylistTrackItem";
import { CanvasVideoPlayer } from "@/components/common/CanvasVideoPlayer";
import { playlistDetailStyles as styles } from "@/styles";


// Space reserved for the mini player so the last track is reachable.
// (No tab bar here: this is a stack screen.)
const MINI_PLAYER_HEIGHT = 72;
const EXTRA_BREATHING_ROOM = 32;

export default function PlaylistDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const insets = useSafeAreaInsets();

  const bottomSpace = MINI_PLAYER_HEIGHT + EXTRA_BREATHING_ROOM + insets.bottom;

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

  const totalDuration = useMemo(
    () => songs.reduce((acc, song) => acc + (song.duration || 0), 0),
    [songs],
  );

  const totalStreams = useMemo(
    () => songs.reduce((acc, song) => acc + (song.totalStreams || 0), 0),
    [songs],
  );

  const formatPlaylistDuration = (seconds: number) => {
    if (!seconds || seconds <= 0) return "";
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours} hr ${mins} min`;
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

  const metaParts = [
    `${totalSongs} ${totalSongs === 1 ? "song" : "songs"}`,
    formatPlaylistDuration(totalDuration),
    totalStreams > 0 ? `${formatStreamCount(totalStreams)} plays` : "",
  ].filter(Boolean);

  // Handlers
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
    <View style={styles.hero}>
      {/* Background video (falls back to the cover image) */}
      <CanvasVideoPlayer
        videoKey={heroVideoKey}
        fallbackImageKey={heroImageKey}
        style={StyleSheet.absoluteFill}
        isPlaying={true}
        showLoaderWhenVideoAvailable={true}
      />

      {/* Fade into the black page background */}
      <LinearGradient
        colors={["rgba(0,0,0,0.25)", "rgba(0,0,0,0)", "rgba(0,0,0,0.65)", "#000000"]}
        locations={[0, 0.3, 0.72, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* Title, details and play button pinned to the bottom */}
      <View style={styles.heroContent} pointerEvents="box-none">
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={2}>
            {playlist?.name || "Playlist"}
          </Text>

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

        {playlist?.description ? (
          <Text style={styles.description} numberOfLines={2}>
            {playlist.description}
          </Text>
        ) : null}

        <Text style={styles.meta} numberOfLines={1}>
          {metaParts.join("  ·  ")}
        </Text>
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

      <FlatList
        contentInsetAdjustmentBehavior="never"
        data={songs}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        renderItem={({ item }) => (
          <PlaylistTrackItem song={item} onPress={() => handleSongPress(item)} />
        )}
        ListEmptyComponent={
          !isSongsLoading ? (
            <View style={styles.empty}>
              <Ionicons name="musical-notes-outline" size={40} color="#FFFFFF" />
              <Text style={styles.emptyText}>No songs in this playlist yet</Text>
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

      {/* Back + share float over the video */}
      <View style={[styles.floatingNav, { top: insets.top + 6 }]} pointerEvents="box-none">
        <TouchableOpacity
          style={styles.floatingButton}
          onPress={() => router.back()}
          activeOpacity={0.75}
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.floatingButton}
          onPress={handleShare}
          activeOpacity={0.75}
          accessibilityLabel="Share playlist"
        >
          <Ionicons name="share-outline" size={21} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

