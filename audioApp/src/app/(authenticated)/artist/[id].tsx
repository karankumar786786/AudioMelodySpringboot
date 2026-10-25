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
import { playAll, playWithSimilarSongs } from "@/store/queueActions";
import { artistService } from "@/service";
import { Song } from "@/types";
import { SongRowItem } from "@/components/home/SongRowItem";
import { getImageUrl } from "@/utils/imageUtils";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const HERO_HEIGHT = 480;

// Shared with the home screen
const SIDE = 18;

export default function ArtistDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const [isFollowMutating, setIsFollowMutating] = useState(false);

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

  const { data: followStatus, refetch: refetchFollowStatus } = useQuery({
    queryKey: ["artist-follow-status", id],
    queryFn: () => artistService.getFollowStatus(id!),
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

  const handleToggleFollow = async () => {
    if (!id || isFollowMutating) return;
    setIsFollowMutating(true);

    const prevStatus = followStatus;
    const nextFollowing = !isFollowing;
    const nextCount = nextFollowing
      ? followersCount + 1
      : Math.max(0, followersCount - 1);

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

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(authenticated)/(tabs)/home");
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

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <View style={styles.heroImageWrapper}>
        {coverUrl ? (
          <Image
            source={{ uri: coverUrl }}
            style={styles.heroImage}
            contentFit="cover"
            contentPosition="top center"
            transition={200}
            cachePolicy="memory"
          />
        ) : (
          <View style={styles.fallbackHero}>
            <Ionicons name="person" size={80} color="#5A5A5A" />
          </View>
        )}

        {/* Bottom scrim fades the photo into pure black; it replaces the old text shadows */}
        <LinearGradient
          colors={["transparent", "rgba(0, 0, 0, 0.55)", "#000000"]}
          locations={[0, 0.6, 1]}
          style={StyleSheet.absoluteFill}
        />

        <View style={styles.heroTextContainer}>
          <View style={styles.verifiedRow}>
            <Ionicons name="checkmark-circle" size={15} color="#FFFFFF" />
            <Text style={styles.verifiedText}>Verified artist</Text>
          </View>

          <Text style={styles.artistName} numberOfLines={2}>
            {artist?.name || "Artist"}
          </Text>

          <Text style={styles.followersText}>{formatFollowers(followersCount)}</Text>

          <View style={styles.heroActions}>
            {/* White = primary, dark pill = secondary, same as the filter pills */}
            <TouchableOpacity
              style={[styles.followButton, isFollowing && styles.followingButton]}
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
      </View>

      <View style={styles.sectionHeadingRow}>
        <Text style={styles.sectionHeading}>Popular songs</Text>
      </View>
    </View>
  );

  const renderFooter = () => (
    <View style={styles.footerContainer}>
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
        <Text style={styles.loadingText}>Loading artist…</Text>
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
          <SongRowItem song={item} onPress={() => handleSongPress(item)} />
        )}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={
          !isSongsLoading ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="musical-notes-outline" size={44} color="#5A5A5A" />
              <Text style={styles.emptyText}>No songs yet</Text>
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
            progressBackgroundColor="#1A1A1A"
          />
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />

      {/* Floating back / share (the styles and handler already existed, but nothing rendered them) */}
      <View style={[styles.floatingNav, { top: insets.top + 8 }]} pointerEvents="box-none">
        <TouchableOpacity
          style={styles.floatingButton}
          onPress={handleBack}
          hitSlop={12}
          activeOpacity={0.8}
        >
          <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.floatingButton}
          onPress={handleShare}
          hitSlop={12}
          activeOpacity={0.8}
        >
          <Ionicons name="share-outline" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000000" },
  floatingNav: {
    position: "absolute",
    left: SIDE,
    right: SIDE,
    zIndex: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  floatingButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.14)",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#000000",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: { color: "#8A8A8A", fontSize: 14, marginTop: 12 },
  listContent: { paddingTop: 0, paddingBottom: 40 },
  headerContainer: { marginBottom: 8 },
  heroImageWrapper: {
    width: SCREEN_WIDTH,
    height: HERO_HEIGHT,
    position: "relative",
    backgroundColor: "#151515",
  },
  heroImage: { width: "100%", height: "100%" },
  fallbackHero: {
    width: "100%",
    height: "100%",
    backgroundColor: "#151515",
    justifyContent: "center",
    alignItems: "center",
  },

  heroTextContainer: {
    position: "absolute",
    bottom: 18,
    left: SIDE,
    right: SIDE,
  },
  verifiedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  verifiedText: { color: "#FFFFFF", fontSize: 12, fontWeight: "600" },
  artistName: {
    color: "#FFFFFF",
    fontSize: 38,
    fontWeight: "800",
    letterSpacing: -1,
    lineHeight: 42,
  },
  followersText: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 13,
    fontWeight: "500",
    marginTop: 6,
  },
  heroActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 16,
  },
  followButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#FFFFFF",
    backgroundColor: "#FFFFFF",
  },
  followingButton: {
    borderColor: "#262626",
    backgroundColor: "#151515",
  },
  followButtonText: { color: "#000000", fontSize: 13, fontWeight: "700" },
  followingButtonText: { color: "#FFFFFF" },
  playButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: "auto",
  },

  sectionHeadingRow: {
    paddingHorizontal: SIDE,
    paddingTop: 16,
    paddingBottom: 6,
  },
  sectionHeading: {
    color: "#FFFFFF",
    fontSize: 21,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  footerContainer: { paddingVertical: 16, paddingHorizontal: SIDE },
  footerLoader: { paddingVertical: 16, alignItems: "center" },
  emptyContainer: { paddingVertical: 40, alignItems: "center" },
  emptyText: { color: "#5A5A5A", fontSize: 14, marginTop: 10 },
  songsLoadingContainer: { paddingVertical: 32, alignItems: "center" },
});