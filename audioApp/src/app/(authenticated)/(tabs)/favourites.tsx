import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { useSelector } from "react-redux";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";

import { AppState } from "@/store";
import { favouriteService } from "@/service";
import { Song } from "@/types";
import { getImageUrl } from "@/utils/imageUtils";
import { CanvasVideoPlayer } from "@/components/common/CanvasVideoPlayer";
import { FavouriteSongItem } from "@/components/favourites/FavouriteSongItem";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const HERO_HEIGHT = Math.min(SCREEN_WIDTH * 0.95, 360);

export default function FavouritesScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const profile = useSelector((state: AppState) => state.user.profile);

  // Infinite query for favourites
  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
    isRefetching,
  } = useInfiniteQuery({
    queryKey: ["favourites"],
    queryFn: ({ pageParam = 0 }) =>
      favouriteService.getFavourites(pageParam, 20),
    getNextPageParam: (lastPage) => {
      const total =
        lastPage.paginationMetaData?.totalCount ??
        lastPage.paginationMetaData?.activeCount ??
        0;
      const loaded = (lastPage.page + 1) * lastPage.size;
      return loaded < total ? lastPage.page + 1 : undefined;
    },
    initialPageParam: 0,
  });

  // Flatten songs
  const allSongs: Song[] = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap((page) => page.content || []);
  }, [data]);

  const totalCount =
    data?.pages[0]?.paginationMetaData?.totalCount ??
    data?.pages[0]?.paginationMetaData?.activeCount ??
    allSongs.length;

  // Handlers
  const handleSongPress = (song: Song) => {
    router.push({
      pathname: "/(authenticated)/song/[id]",
      params: { id: song.id },
    });
  };

  const handlePlayAll = () => {
    if (allSongs.length > 0) {
      handleSongPress(allSongs[0]);
    }
  };

  const handleRemoveFavourite = async (songId: string) => {
    // Optimistic UI update
    queryClient.setQueryData<any>(["favourites"], (oldData: any) => {
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
      await favouriteService.removeFavourite(songId);
    } catch {
      // Re-fetch to synchronize state if API call failed
      queryClient.invalidateQueries({ queryKey: ["favourites"] });
    }
  };

  // Hero visuals
  const heroSong = allSongs[0];
  const heroVideoKey = heroSong?.videoKey;
  const heroImageKey = heroSong?.imageKey;

  const firstSongImg = heroSong
    ? getImageUrl(heroSong.imageKey, {
        width: 800,
        height: 800,
        quality: 90,
      })
    : undefined;

  const mosaicImages = allSongs.slice(0, 4).map((s) =>
    getImageUrl(s.imageKey, {
      width: 400,
      height: 400,
      quality: 85,
    })
  );

  const showMosaic = !heroVideoKey && allSongs.length >= 4;

  // Render Header Component
  const renderHeader = () => (
    <View style={styles.headerContainer}>
      {/* Hero Banner with video/mosaic/image */}
      <View style={styles.heroBanner}>
        {heroVideoKey ? (
          <CanvasVideoPlayer
            videoKey={heroVideoKey}
            fallbackImageKey={heroImageKey}
            style={StyleSheet.absoluteFill}
            isPlaying={true}
            showLoaderWhenVideoAvailable={true}
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
            <LinearGradient
              colors={["#3b0f5e", "#1e1038", "#121212"]}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.emptyHeroHeartCircle}>
              <Ionicons name="heart" size={54} color="#E91E63" />
            </View>
          </View>
        )}

        {/* Global subtle dark wash */}
        <View style={styles.heroWash} />

        {/* Linear Gradient scrim blending into #121212 */}
        <LinearGradient
          colors={["transparent", "rgba(18, 18, 18, 0.45)", "#121212"]}
          locations={[0, 0.62, 1]}
          style={styles.heroGradient}
        />

        {/* Hero Content pinned to bottom */}
        <View style={styles.heroContent}>
          

          {/* Title & Action Buttons Row */}
          <View style={styles.titleRow}>
            <Text style={styles.heroTitle} numberOfLines={1}>
              Liked Songs
            </Text>

            <View style={styles.titleActions}>
              

              {allSongs.length > 0 ? (
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

          {/* Stats Row */}
          <View style={styles.statsRow}>
            <Text style={styles.curatorText}>
              By {profile?.userName || "You"}
            </Text>
            <Text style={styles.statDot}>•</Text>
            <Text style={styles.statText}>
              {totalCount} {totalCount === 1 ? "track" : "tracks"}
            </Text>
            <Text style={styles.statDot}>•</Text>
            <View style={styles.privacyBadge}>
              <Text style={styles.privacyBadgeText}>Auto-saved</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={styles.loadingText}>Loading your favourites...</Text>
        </View>
      ) : (
        <FlatList
          contentInsetAdjustmentBehavior="never"
          data={allSongs}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={renderHeader}
          renderItem={({ item, index }) => (
            <FavouriteSongItem
              song={item}
              index={index}
              onPress={() => handleSongPress(item)}
              onRemove={() => handleRemoveFavourite(item.id)}
            />
          )}
          ListEmptyComponent={
            allSongs.length === 0 ? (
              <View style={styles.emptyContainer}>
                <View style={styles.emptyHeartBox}>
                  <Ionicons name="heart-outline" size={48} color="#E91E63" />
                </View>
                <Text style={styles.emptyTitle}>No liked songs yet</Text>
                <Text style={styles.emptySubtitle}>
                  Songs you like by tapping the heart icon will appear here
                  automatically for quick access.
                </Text>
                <TouchableOpacity
                  style={styles.exploreButton}
                  onPress={() => router.push("/(authenticated)/(tabs)/home")}
                  activeOpacity={0.82}
                >
                  <Text style={styles.exploreButtonText}>Explore Music</Text>
                </TouchableOpacity>
              </View>
            ) : undefined
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
              onRefresh={() => {
                refetch();
              }}
              tintColor="#FFFFFF"
              colors={["#FFFFFF"]}
            />
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
  },
  listContent: {
    paddingBottom: 90,
  },
  headerContainer: {
    backgroundColor: "#121212",
    marginBottom: 8,
  },
  heroBanner: {
    width: "100%",
    height: HERO_HEIGHT,
    position: "relative",
    backgroundColor: "#161616",
    overflow: "hidden",
  },
  heroBannerImage: {
    width: "100%",
    height: "100%",
  },
  mosaicGrid: {
    width: "100%",
    height: "100%",
    backgroundColor: "#141416",
  },
  mosaicRow: {
    flex: 1,
    flexDirection: "row",
  },
  mosaicCell: {
    flex: 1,
    overflow: "hidden",
    backgroundColor: "#18181A",
  },
  imageFull: {
    width: "100%",
    height: "100%",
  },
  cellFallback: {
    flex: 1,
    backgroundColor: "#202024",
  },
  emptyHero: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1C1428",
  },
  emptyHeroHeartCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "rgba(233, 30, 99, 0.15)",
    borderWidth: 1.5,
    borderColor: "rgba(233, 30, 99, 0.35)",
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
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: "rgba(255, 255, 255, 0.14)",
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
    marginBottom: 6,
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
  titleActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexShrink: 0,
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
  playButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
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
  centerContainer: {
    flex: 1,
    backgroundColor: "#121212",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  loadingText: {
    color: "#888888",
    fontSize: 14,
    marginTop: 12,
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: "center",
    paddingHorizontal: 32,
  },
  emptyHeartBox: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "#1C1C1C",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "rgba(233, 30, 99, 0.3)",
  },
  emptyTitle: {
    fontSize: 19,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 6,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 13,
    color: "#777777",
    textAlign: "center",
    lineHeight: 19,
    marginBottom: 22,
  },
  exploreButton: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  exploreButtonText: {
    color: "#000000",
    fontSize: 14,
    fontWeight: "700",
  },
  footerLoader: {
    paddingVertical: 16,
    alignItems: "center",
  },
});
