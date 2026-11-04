import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Share,
  Dimensions,
  Platform,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useDispatch, useSelector } from "react-redux";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppDispatch, AppState, enqueue, playAll, playAllFrom } from "@/store";
import { albumService, favouriteService } from "@/service";
import { audioPlayerService } from "@/service/audioPlayerService";
import { Song } from "@/types";
import { getImageUrl, formatDuration, useDominantColor } from "@/utils";
import { hapticFeedback } from "@/utils/haptics";
import { colors, radii, spacing, typography, shadows } from "@/theme";
import { Badge, IconButton } from "@/components";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const ARTWORK_SIZE = Math.min(SCREEN_WIDTH * 0.48, 200);

export default function AlbumDetailScreen() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const insets = useSafeAreaInsets();

  const albumName = name ? decodeURIComponent(name) : "Album";

  // Redux Player state
  const currentSong = useSelector((state: AppState) => state.player.currentSong);
  const isPlaying = useSelector((state: AppState) => state.player.isPlaying);

  // Local likes tracking
  const [favouritedIds, setFavouritedIds] = useState<Set<string>>(new Set());

  // Query songs for this album
  const {
    data: songs = [],
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ["album-songs", albumName],
    queryFn: () => albumService.getSongsByAlbum(albumName),
    enabled: Boolean(name),
    staleTime: 5 * 60 * 1000,
  });

  // Extract cover image
  const coverUrl = useMemo(() => {
    const songWithImage = songs.find((s) => s.imageKey || (s as any).coverUrl);
    if (!songWithImage) return null;
    return (
      (songWithImage as any).coverUrl ||
      (songWithImage.imageKey
        ? getImageUrl(songWithImage.imageKey, {
            width: 500,
            height: 500,
            aspectRatio: "1-1",
          })
        : null)
    );
  }, [songs]);

  // Extract dominant color for ambient backdrop
  const { dominantColor } = useDominantColor(coverUrl);
  const headerBgColor = dominantColor || "#1A1A1A";

  // Album metadata
  const totalDuration = useMemo(() => {
    return songs.reduce((acc, s) => acc + (Number(s.duration) || 0), 0);
  }, [songs]);

  const distinctGenres = useMemo(() => {
    const set = new Set<string>();
    songs.forEach((s) => {
      if (s.genre) {
        s.genre.split(/[,/]/).forEach((g) => {
          const t = g.trim();
          if (t) set.add(t);
        });
      }
    });
    return Array.from(set);
  }, [songs]);

  const distinctLanguages = useMemo(() => {
    const set = new Set<string>();
    songs.forEach((s) => {
      if (s.language && s.language.trim()) {
        set.add(s.language.trim());
      }
    });
    return Array.from(set);
  }, [songs]);

  const releaseYear = useMemo(() => {
    for (const song of songs) {
      if (song.createdAt) {
        const d = new Date(song.createdAt);
        const y = d.getFullYear();
        if (!isNaN(y) && y > 1900 && y <= new Date().getFullYear()) {
          return y;
        }
      }
    }
    return null;
  }, [songs]);

  const distinctArtists = useMemo(() => {
    const set = new Set<string>();
    songs.forEach((s) => {
      if (s.artistName) {
        s.artistName.split(/[,&]|feat\.|ft\./i).forEach((a) => {
          const t = a.trim();
          if (t) set.add(t);
        });
      }
    });
    return Array.from(set);
  }, [songs]);

  const isAlbumActive = useMemo(() => {
    return songs.length > 0 && songs.some((s) => s.id === currentSong?.id);
  }, [songs, currentSong]);

  const isAlbumPlaying = isAlbumActive && isPlaying;

  // Actions
  const handlePlayAlbum = () => {
    if (songs.length === 0) return;
    hapticFeedback.medium();
    if (isAlbumPlaying) {
      audioPlayerService.togglePlay();
    } else if (isAlbumActive) {
      audioPlayerService.togglePlay();
    } else {
      (dispatch as any)(playAll(songs));
    }
  };

  const handleShuffleAlbum = () => {
    if (songs.length === 0) return;
    hapticFeedback.light();
    const shuffled = [...songs].sort(() => Math.random() - 0.5);
    (dispatch as any)(playAll(shuffled));
  };

  const handleAddToQueue = () => {
    if (songs.length === 0) return;
    hapticFeedback.light();
    (dispatch as any)(enqueue(songs as any));
  };

  const handleShareAlbum = async () => {
    hapticFeedback.selection();
    try {
      await Share.share({
        title: `${albumName} - One Melody`,
        message: `Listen to "${albumName}" on One Melody: https://audiomelody.com/albums/${encodeURIComponent(
          albumName
        )}`,
      });
    } catch {}
  };

  const handlePlaySong = (index: number) => {
    hapticFeedback.light();
    (dispatch as any)(playAllFrom(songs, index));
  };

  const handleToggleFavourite = async (songId: string) => {
    hapticFeedback.success();
    const wasLiked = favouritedIds.has(songId);
    const next = new Set(favouritedIds);
    if (wasLiked) {
      next.delete(songId);
    } else {
      next.add(songId);
    }
    setFavouritedIds(next);

    try {
      await favouriteService.toggleFavourite(songId, wasLiked);
    } catch {
      setFavouritedIds(favouritedIds);
    }
  };

  // Header Component for FlatList
  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <LinearGradient
        colors={[headerBgColor, "rgba(0,0,0,0.85)", colors.background]}
        style={styles.gradientBackdrop}
      />

      {/* Top Navbar */}
      <View style={[styles.navBar, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.shareButton}
          onPress={handleShareAlbum}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="share-outline" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Artwork & Album Details */}
      <View style={styles.heroContent}>
        <View style={styles.artworkWrapper}>
          {coverUrl ? (
            <Image
              source={{ uri: coverUrl }}
              style={styles.artwork}
              contentFit="cover"
              transition={200}
            />
          ) : (
            <View style={styles.artworkFallback}>
              <Ionicons name="disc" size={64} color={colors.textMuted} />
            </View>
          )}
        </View>

        {/* Badges */}
        <View style={styles.badgesRow}>
          <Badge
            label="ALBUM"
            variant="primary"
            icon={<Ionicons name="disc" size={11} color={colors.primary} />}
          />
          {releaseYear && (
            <Badge
              label={String(releaseYear)}
              variant="surface"
              icon={
                <Ionicons
                  name="calendar-outline"
                  size={11}
                  color={colors.textSecondary}
                />
              }
            />
          )}
          {distinctLanguages.length > 0 && (
            <Badge
              label={distinctLanguages.join(", ")}
              variant="surface"
              icon={
                <Ionicons
                  name="globe-outline"
                  size={11}
                  color={colors.textSecondary}
                />
              }
            />
          )}
        </View>

        {/* Title */}
        <Text style={styles.albumTitle} numberOfLines={2}>
          {albumName}
        </Text>

        {/* Artists */}
        <View style={styles.artistsRow}>
          <Text style={styles.byText}>By </Text>
          {distinctArtists.length > 0 ? (
            distinctArtists.map((artist, idx) => (
              <TouchableOpacity
                key={artist}
                onPress={() =>
                  router.push(`/artist/${encodeURIComponent(artist)}`)
                }
              >
                <Text style={styles.artistLink}>
                  {artist}
                  {idx < distinctArtists.length - 1 ? ", " : ""}
                </Text>
              </TouchableOpacity>
            ))
          ) : (
            <Text style={styles.artistLink}>Various Artists</Text>
          )}
        </View>

        {/* Meta Stats */}
        <Text style={styles.metaStats}>
          {songs.length} {songs.length === 1 ? "track" : "tracks"}
          {totalDuration > 0 ? ` • ${formatDuration(totalDuration)}` : ""}
          {distinctGenres.length > 0 ? ` • ${distinctGenres.slice(0, 2).join(", ")}` : ""}
        </Text>

        {/* Action Controls */}
        <View style={styles.controlsRow}>
          <TouchableOpacity
            style={styles.playButton}
            onPress={handlePlayAlbum}
            activeOpacity={0.85}
          >
            <Ionicons
              name={isAlbumPlaying ? "pause" : "play"}
              size={24}
              color="#000000"
              style={isAlbumPlaying ? undefined : { marginLeft: 2 }}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleShuffleAlbum}
            activeOpacity={0.7}
          >
            <Ionicons name="shuffle" size={20} color={colors.textPrimary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleAddToQueue}
            activeOpacity={0.7}
          >
            <Ionicons
              name="list-outline"
              size={20}
              color={colors.textPrimary}
            />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {isLoading && songs.length === 0 ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading album...</Text>
        </View>
      ) : (
        <FlatList
          data={songs}
          keyExtractor={(item, index) => item.id || String(index)}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 90 },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => {
                refetch();
              }}
              tintColor={colors.primary}
            />
          }
          renderItem={({ item, index }) => {
            const isActive = currentSong?.id === item.id;
            const isSongPlaying = isActive && isPlaying;
            const isFavourited = favouritedIds.has(item.id);

            const itemImage =
              (item as any).coverUrl ||
              (item.imageKey
                ? getImageUrl(item.imageKey, {
                    width: 120,
                    height: 120,
                    aspectRatio: "1-1",
                  })
                : null);

            return (
              <TouchableOpacity
                style={[styles.trackRow, isActive && styles.trackRowActive]}
                onPress={() => handlePlaySong(index)}
                activeOpacity={0.7}
              >
                {/* Index / Active Icon */}
                <View style={styles.indexCol}>
                  {isActive ? (
                    <Ionicons
                      name={isSongPlaying ? "volume-high" : "pause"}
                      size={16}
                      color={colors.primary}
                    />
                  ) : (
                    <Text style={styles.indexText}>{index + 1}</Text>
                  )}
                </View>

                {/* Track Thumbnail */}
                <View style={styles.trackThumbnailWrapper}>
                  {itemImage ? (
                    <Image
                      source={{ uri: itemImage }}
                      style={styles.trackThumbnail}
                      contentFit="cover"
                      transition={150}
                    />
                  ) : (
                    <View style={styles.trackThumbnailFallback}>
                      <Ionicons
                        name="musical-note"
                        size={16}
                        color={colors.textMuted}
                      />
                    </View>
                  )}
                </View>

                {/* Track Info */}
                <View style={styles.trackInfoCol}>
                  <Text
                    style={[
                      styles.trackTitle,
                      isActive && styles.trackTitleActive,
                    ]}
                    numberOfLines={1}
                  >
                    {item.title}
                  </Text>
                  <Text style={styles.trackArtist} numberOfLines={1}>
                    {item.artistName || "Unknown Artist"}
                  </Text>
                </View>

                {/* Heart Button */}
                <TouchableOpacity
                  style={styles.trackActionBtn}
                  onPress={() => handleToggleFavourite(item.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons
                    name={isFavourited ? "heart" : "heart-outline"}
                    size={18}
                    color={isFavourited ? colors.like : colors.textMuted}
                  />
                </TouchableOpacity>

                {/* Duration */}
                <Text style={styles.trackDuration}>
                  {item.duration ? formatDuration(item.duration) : "--:--"}
                </Text>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="disc-outline" size={48} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>No tracks found</Text>
              <Text style={styles.emptySubtitle}>
                No songs were found matching album "{albumName}".
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  loadingText: {
    ...typography.body2,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  headerContainer: {
    position: "relative",
    paddingBottom: spacing.lg,
  },
  gradientBackdrop: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.side,
    marginBottom: spacing.md,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  shareButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: "auto",
  },
  heroContent: {
    alignItems: "center",
    paddingHorizontal: spacing.side,
  },
  artworkWrapper: {
    width: ARTWORK_SIZE,
    height: ARTWORK_SIZE,
    borderRadius: radii.xl,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.borderMedium,
    backgroundColor: colors.card,
    ...shadows.lg,
    marginBottom: spacing.md,
  },
  artwork: {
    width: "100%",
    height: "100%",
  },
  artworkFallback: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceElevated,
  },
  badgesRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: spacing.xs + 2,
    marginBottom: spacing.sm,
  },
  albumTitle: {
    ...typography.headline,
    color: colors.textPrimary,
    textAlign: "center",
    marginBottom: spacing.xs,
  },
  artistsRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    justifyContent: "center",
    marginBottom: spacing.xs,
  },
  byText: {
    ...typography.body2,
    color: colors.textSecondary,
  },
  artistLink: {
    ...typography.body1,
    color: colors.textPrimary,
    fontWeight: "700",
  },
  metaStats: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  playButton: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.primaryGlow,
  },
  secondaryButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: {
    flexGrow: 1,
  },
  trackRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.side,
    paddingVertical: spacing.sm + 2,
  },
  trackRowActive: {
    backgroundColor: "rgba(255, 255, 255, 0.06)",
  },
  indexCol: {
    width: 24,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.sm,
  },
  indexText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  trackThumbnailWrapper: {
    width: 42,
    height: 42,
    borderRadius: radii.sm,
    overflow: "hidden",
    backgroundColor: colors.card,
    marginRight: spacing.md,
  },
  trackThumbnail: {
    width: "100%",
    height: "100%",
  },
  trackThumbnailFallback: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  trackInfoCol: {
    flex: 1,
    minWidth: 0,
    marginRight: spacing.sm,
  },
  trackTitle: {
    ...typography.body1,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  trackTitleActive: {
    color: colors.primary,
  },
  trackArtist: {
    ...typography.body2,
    color: colors.textSecondary,
  },
  trackActionBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.xs,
  },
  trackDuration: {
    ...typography.caption,
    color: colors.textMuted,
    minWidth: 38,
    textAlign: "right",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    ...typography.title2,
    color: colors.textPrimary,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    ...typography.body2,
    color: colors.textSecondary,
    textAlign: "center",
  },
});
