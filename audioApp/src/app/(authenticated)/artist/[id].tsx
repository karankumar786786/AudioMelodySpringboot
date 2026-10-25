import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Share,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useDispatch } from "react-redux";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useQuery, useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppDispatch } from "@/store";
import { playAll, playAllFrom } from "@/store/queueActions";
import { artistService } from "@/service";
import { Song } from "@/types";
import { SongRowItem } from "@/components/home/SongRowItem";
import { getImageUrl } from "@/utils/imageUtils";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const HERO_HEIGHT = 480;

export default function ArtistDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const [isFollowMutating, setIsFollowMutating] = useState(false);

  // 1. Fetch Artist Details
  const {
    data: artist,
    isLoading: isArtistLoading,
    refetch: refetchArtist,
  } = useQuery({
    queryKey: ["artist", id],
    queryFn: () => artistService.getArtistById(id!),
    enabled: Boolean(id),
    staleTime: 5 * 60 * 1000,
  });

  // 2. Fetch Follow Status
  const {
    data: followStatus,
    refetch: refetchFollowStatus,
  } = useQuery({
    queryKey: ["artist-follow-status", id],
    queryFn: () => artistService.getFollowStatus(id!),
    enabled: Boolean(id),
    staleTime: 60 * 1000,
  });

  // 3. Fetch Artist's Songs (Infinite Query)
  const {
    data: songsData,
    isLoading: isSongsLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch: refetchSongs,
    isRefetching,
  } = useInfiniteQuery({
    queryKey: ["artist-songs", id, artist?.name],
    queryFn: ({ pageParam = 0 }) =>
      artistService.getArtistSongs(id!, pageParam, 20, artist?.name),
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

  // Flatten songs
  const songs: Song[] = useMemo(() => {
    if (!songsData?.pages) return [];
    return songsData.pages.flatMap((page) => page.content || []);
  }, [songsData]);

  const isFollowing = followStatus?.isFollowing ?? false;
  const followersCount =
    followStatus?.followersCount ?? artist?.followersCount ?? 0;

  const formatFollowers = (count: number) => {
    if (count >= 1_000_000) {
      return `${(count / 1_000_000).toFixed(1)}M monthly listeners`;
    }
    if (count >= 1_000) {
      return `${(count / 1_000).toFixed(1)}K followers`;
    }
    return `${count} ${count === 1 ? "follower" : "followers"}`;
  };

  // Handlers
  const handleSongPress = (song: Song) => {
    const idx = songs.findIndex((s) => s.id === song.id);
    dispatch(playAllFrom(songs, idx !== -1 ? idx : 0));
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

  const handleToggleFollow = async () => {
    if (!id || isFollowMutating) return;
    setIsFollowMutating(true);

    const prevStatus = followStatus;
    const nextFollowing = !isFollowing;
    const nextCount = nextFollowing
      ? followersCount + 1
      : Math.max(0, followersCount - 1);

    // Optimistic update
    queryClient.setQueryData(["artist-follow-status", id], {
      artistId: id,
      artistName: artist?.name || "",
      followersCount: nextCount,
      isFollowing: nextFollowing,
    });

    try {
      if (nextFollowing) {
        await artistService.followArtist(id);
      } else {
        await artistService.unfollowArtist(id);
      }
    } catch {
      // Revert if API failed
      queryClient.setQueryData(["artist-follow-status", id], prevStatus);
    } finally {
      setIsFollowMutating(false);
    }
  };

  const handleShare = async () => {
    if (!artist) return;
    try {
      await Share.share({
        message: `Listen to ${artist.name} on Melody!`,
      });
    } catch {
      // Ignore share cancellation
    }
  };

  const handleRefresh = () => {
    refetchArtist();
    refetchFollowStatus();
    refetchSongs();
  };

  const coverUrl = getImageUrl(artist?.coverImageKey, {
    width: 600,
    height: 600,
    focus: "auto",
    aspectRatio: "1-1",
  });

  // Render Header
  const renderHeader = () => (
    <View style={styles.headerContainer}>
      {/* Hero Banner Image */}
      <View style={styles.heroImageWrapper}>
        {coverUrl ? (
          <Image
            source={{ uri: coverUrl }}
            style={styles.heroImage}
            contentFit="cover"
            contentPosition="top center"
            transition={200}
          />
        ) : (
          <View style={styles.fallbackHero}>
            <Ionicons name="person" size={80} color="#444444" />
          </View>
        )}
        {/* Multi-stop Linear Gradient scrim for smooth contrast blending into #121212 */}
        <LinearGradient
          colors={["transparent", "rgba(18, 18, 18, 0.4)", "#121212"]}
          locations={[0, 0.65, 1]}
          style={StyleSheet.absoluteFill}
        />

        {/* Artist Title on Cover */}
        <View style={styles.heroTextContainer}>
          <View style={styles.verifiedRow}>
            <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" />
            <Text style={styles.verifiedText}>Verified Artist</Text>
          </View>
          <View style={styles.nameActionsRow}>
            <Text style={styles.artistName} numberOfLines={2}>
              {artist?.name || "Artist"}
            </Text>

            <View style={styles.heroActions}>
              <TouchableOpacity
                style={[
                  styles.followButton,
                  isFollowing && styles.followingButton,
                ]}
                onPress={handleToggleFollow}
                activeOpacity={0.8}
                disabled={isFollowMutating}
              >
                <Text
                  style={[
                    styles.followButtonText,
                    isFollowing && styles.followingButtonText,
                  ]}
                >
                  {isFollowing ? "Following" : "Follow"}
                </Text>
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

          <Text style={styles.followersText}>
            {formatFollowers(followersCount)}
          </Text>
        </View>
      </View>

      {/* Section Header: Popular Songs */}
      <View style={styles.sectionHeadingRow}>
        <Text style={styles.sectionHeading}>Popular Songs</Text>
      </View>
    </View>
  );

  // Render Footer
  const renderFooter = () => (
    <View style={styles.footerContainer}>

      {/* Pagination loader */}
      {isFetchingNextPage ? (
        <View style={styles.footerLoader}>
          <ActivityIndicator size="small" color="#FFFFFF" />
        </View>
      ) : null}
    </View>
  );

  if (isArtistLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFFFFF" />
        <Text style={styles.loadingText}>Loading artist...</Text>
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
          <SongRowItem
            song={item}
            onPress={() => handleSongPress(item)}
          />
        )}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={
          !isSongsLoading ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="musical-notes-outline" size={44} color="#555555" />
              <Text style={styles.emptyText}>No songs available yet</Text>
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
    justifyContent: "space-between",
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
  loadingContainer: {
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
  listContent: {
    paddingTop: 0,
    paddingBottom: 40,
  },
  headerContainer: {
    marginTop: 0,
    paddingTop: 0,
    marginBottom: 8,
  },
  heroImageWrapper: {
    width: SCREEN_WIDTH,
    height: HERO_HEIGHT,
    position: "relative",
    backgroundColor: "#1A1A1A",
    marginTop: 0,
    paddingTop: 0,
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  fallbackHero: {
    width: "100%",
    height: "100%",
    backgroundColor: "#1C1C1C",
    justifyContent: "center",
    alignItems: "center",
  },
  heroOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
  },

  heroTextContainer: {
    position: "absolute",
    bottom: 18,
    left: 18,
    right: 18,
  },
  verifiedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  verifiedText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  nameActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 4,
  },
  artistName: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "bold",
    letterSpacing: -0.5,
    textShadowColor: "rgba(0, 0, 0, 0.9)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 5,
  },
  heroActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexShrink: 0,
  },
  followersText: {
    color: "rgba(255, 255, 255, 0.85)",
    fontSize: 13,
    fontWeight: "500",
    textShadowColor: "rgba(0, 0, 0, 0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  followButton: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
    backgroundColor: "#FFFFFF",
  },
  followingButton: {
    borderColor: "rgba(255, 255, 255, 0.5)",
    backgroundColor: "transparent",
  },
  followButtonText: {
    color: "#000000",
    fontSize: 13,
    fontWeight: "700",
  },
  followingButtonText: {
    color: "#FFFFFF",
  },
  playButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
  },
  sectionHeadingRow: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 6,
  },
  sectionHeading: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "bold",
    letterSpacing: -0.3,
  },
  footerContainer: {
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  footerLoader: {
    paddingVertical: 16,
    alignItems: "center",
  },
  emptyContainer: {
    paddingVertical: 40,
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
});
