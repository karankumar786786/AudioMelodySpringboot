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
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useQuery, useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { artistService } from "@/service";
import { Song } from "@/types";
import { SongRowItem } from "@/components/home/SongRowItem";
import { getImageUrl } from "@/utils/imageUtils";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const HERO_HEIGHT = 480;

export default function ArtistDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

  const [isAboutExpanded, setIsAboutExpanded] = useState(false);
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
    width: 800,
    height: 800,
    quality: 90,
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
          <Text style={styles.artistName} numberOfLines={2}>
            {artist?.name || "Artist"}
          </Text>
          <Text style={styles.followersText}>
            {formatFollowers(followersCount)}
          </Text>
        </View>
      </View>

      {/* Action Row: Follow, Shuffle, Play Button */}
      <View style={styles.actionRow}>
        <View style={styles.leftActions}>
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

        </View>

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

      {/* Section Header: Popular Songs */}
      <View style={styles.sectionHeadingRow}>
        <Text style={styles.sectionHeading}>Popular Songs</Text>
      </View>
    </View>
  );

  // Render Footer: About Section
  const renderFooter = () => (
    <View style={styles.footerContainer}>
      {/* About Section */}
      {artist?.about ? (
        <View style={styles.aboutCard}>
          <Text style={styles.aboutTitle}>About</Text>
          <Text
            style={styles.aboutText}
            numberOfLines={isAboutExpanded ? undefined : 4}
          >
            {artist.about}
          </Text>
          {artist.about.length > 160 ? (
            <TouchableOpacity
              onPress={() => setIsAboutExpanded(!isAboutExpanded)}
              style={styles.expandButton}
            >
              <Text style={styles.expandButtonText}>
                {isAboutExpanded ? "Show less" : "Read more"}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

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
  artistName: {
    color: "#FFFFFF",
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 4,
    letterSpacing: -0.5,
    textShadowColor: "rgba(0, 0, 0, 0.9)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 5,
  },
  followersText: {
    color: "rgba(255, 255, 255, 0.85)",
    fontSize: 13,
    fontWeight: "500",
    textShadowColor: "rgba(0, 0, 0, 0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  leftActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  followButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
    backgroundColor: "transparent",
  },
  followingButton: {
    borderColor: "rgba(255, 255, 255, 0.35)",
    backgroundColor: "rgba(255, 255, 255, 0.12)",
  },
  followButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  followingButtonText: {
    color: "#DDDDDD",
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
  sectionHeadingRow: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 6,
  },
  sectionHeading: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "bold",
    letterSpacing: -0.3,
  },
  footerContainer: {
    marginTop: 20,
    paddingHorizontal: 18,
  },
  aboutCard: {
    backgroundColor: "#1A1A1A",
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: "#282828",
    marginBottom: 20,
  },
  aboutTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 8,
  },
  aboutText: {
    color: "#AAAAAA",
    fontSize: 14,
    lineHeight: 22,
  },
  expandButton: {
    marginTop: 8,
  },
  expandButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
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
