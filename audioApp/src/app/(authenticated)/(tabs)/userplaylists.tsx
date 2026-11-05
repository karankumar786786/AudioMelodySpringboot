import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useDispatch, useSelector } from "react-redux";

import {
  AppDispatch,
  AppState,
  selectAllUserPlaylists,
  selectUserPlaylistsLoading,
  loadUserPlaylists,
  createUserPlaylist,
} from "@/store";
import { playlistService, albumService } from "@/service";
import { UserPlaylist } from "@/types";
import { UserPlaylistThumbnail } from "@/components";
import { getImageUrl } from "@/utils";
import { hapticFeedback } from "@/utils/haptics";
import { colors, radii, spacing, typography, shadows } from "@/theme";
import { userPlaylistStyles as styles } from "@/styles";

// Space reserved for the tab bar + mini player
const TAB_BAR_HEIGHT = 64;
const MINI_PLAYER_HEIGHT = 72;
const EXTRA_BREATHING_ROOM = 32;

type LibraryFilter = "All" | "Playlists" | "Albums";

export default function UserPlaylistsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

  const bottomSpace =
    TAB_BAR_HEIGHT + MINI_PLAYER_HEIGHT + EXTRA_BREATHING_ROOM + insets.bottom;

  const [selectedFilter, setSelectedFilter] = useState<LibraryFilter>("All");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [newPlaylistPrivacy, setNewPlaylistPrivacy] = useState<"PUBLIC" | "PRIVATE" | "SHARE_BY_LINK">("PRIVATE");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const dispatch = useDispatch<AppDispatch>();
  const storePlaylists = useSelector(selectAllUserPlaylists);
  const isStoreLoading = useSelector(selectUserPlaylistsLoading);

  // Playlists query
  const {
    data: playlistsData,
    isLoading: isPlaylistsLoading,
    refetch: refetchPlaylists,
    isRefetching: isPlaylistsRefetching,
  } = useQuery({
    queryKey: ["user-playlists"],
    queryFn: () => playlistService.getUserPlaylists(0, 100),
    staleTime: 60 * 1000,
  });

  // Albums query
  const {
    data: albums = [],
    isLoading: isAlbumsLoading,
    refetch: refetchAlbums,
  } = useQuery({
    queryKey: ["all-albums"],
    queryFn: () => albumService.getAllAlbums(),
    enabled: selectedFilter === "Albums" || selectedFilter === "All",
    staleTime: 5 * 60 * 1000,
  });

  const playlists: UserPlaylist[] =
    storePlaylists && storePlaylists.length > 0
      ? storePlaylists
      : (playlistsData?.content || []);

  const closeModal = () => {
    setIsCreateModalOpen(false);
  };

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim() || isSubmitting) return;

    try {
      setIsSubmitting(true);
      hapticFeedback.light();
      const created = await dispatch(
        createUserPlaylist({
          name: newPlaylistName.trim(),
          privacy: newPlaylistPrivacy,
        })
      ).unwrap();
      setIsCreateModalOpen(false);
      setNewPlaylistName("");
      setNewPlaylistPrivacy("PRIVATE");

      queryClient.invalidateQueries({ queryKey: ["user-playlists"] });
      queryClient.invalidateQueries({ queryKey: ["user-playlist-songs-thumb"] });

      router.push({
        pathname: "/(authenticated)/userplaylist/[id]",
        params: { id: created.id },
      });
    } catch (err) {
      console.error("Failed to create playlist:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderHeader = () => (
    <View style={localStyles.headerWrapper}>
      {/* Top Title & Add Button */}
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Your Library</Text>
          <Text style={styles.subtitle}>
            {playlists.length} {playlists.length === 1 ? "playlist" : "playlists"}
            {albums.length > 0 ? ` • ${albums.length} albums` : ""}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.addButton}
          onPress={() => {
            hapticFeedback.light();
            setIsCreateModalOpen(true);
          }}
          activeOpacity={0.85}
          accessibilityLabel="New playlist"
        >
          <Ionicons name="add" size={26} color="#000000" />
        </TouchableOpacity>
      </View>

      {/* Filter Chips Bar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={localStyles.filtersRow}
      >
        {(["All", "Playlists", "Albums"] as const).map((filter) => {
          const isActive = selectedFilter === filter;
          return (
            <TouchableOpacity
              key={filter}
              style={[
                localStyles.filterChip,
                isActive && localStyles.filterChipActive,
              ]}
              onPress={() => {
                hapticFeedback.selection();
                setSelectedFilter(filter);
              }}
              activeOpacity={0.75}
            >
              <Text
                style={[
                  localStyles.filterChipText,
                  isActive && localStyles.filterChipTextActive,
                ]}
              >
                {filter}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Pinned Liked Songs Card */}
      {(selectedFilter === "All" || selectedFilter === "Playlists") && (
        <TouchableOpacity
          style={localStyles.likedSongsCard}
          onPress={() => {
            hapticFeedback.light();
            router.push("/(authenticated)/(tabs)/favourites" as any);
          }}
          activeOpacity={0.75}
        >
          <LinearGradient
            colors={["#4F149B", "#7B2CBF"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={localStyles.likedSongsIconBox}
          >
            <Ionicons name="heart" size={26} color="#FFFFFF" />
          </LinearGradient>

          <View style={localStyles.likedSongsInfo}>
            <Text style={localStyles.likedSongsTitle}>Liked Songs</Text>
            <Text style={localStyles.likedSongsSubtitle}>
              Playlist • Auto-saved favourites
            </Text>
          </View>

          <Ionicons
            name="chevron-forward"
            size={18}
            color={colors.textSecondary}
          />
        </TouchableOpacity>
      )}

      {/* Section Subheading if Albums filter is selected */}
      {selectedFilter === "Albums" && (
        <View style={localStyles.sectionSubheader}>
          <Text style={localStyles.sectionSubheaderTitle}>Albums</Text>
        </View>
      )}
    </View>
  );

  const uniqueAlbums = useMemo(() => {
    const map = new Map<string, any>();
    for (const alb of albums) {
      const name = (alb?.name || alb?.album || "").trim();
      if (name && !map.has(name.toLowerCase())) {
        map.set(name.toLowerCase(), alb);
      }
    }
    return Array.from(map.values());
  }, [albums]);

  const renderAlbumRow = (album: any, index: number) => {
    const albumTitle = album.album || album.name || "Album";
    const albumArtist = album.artistName || "Various Artists";
    const albumSongsCount = album.totalSongs || album.count || 0;
    const albumImg = album.imageKey
      ? getImageUrl(album.imageKey, {
          width: 140,
          height: 140,
          aspectRatio: "1-1",
        })
      : null;

    return (
      <TouchableOpacity
        key={`${albumTitle}-${index}`}
        style={styles.row}
        onPress={() => {
          hapticFeedback.light();
          router.push(`/album/${encodeURIComponent(albumTitle)}` as any);
        }}
        activeOpacity={0.72}
      >
        <View style={localStyles.albumThumbnailWrapper}>
          {albumImg ? (
            <Image
              source={{ uri: albumImg }}
              style={localStyles.albumThumbnail}
              contentFit="cover"
              transition={150}
            />
          ) : (
            <View style={localStyles.albumThumbnailFallback}>
              <Ionicons name="disc" size={26} color={colors.textMuted} />
            </View>
          )}
        </View>

        <View style={styles.rowInfo}>
          <Text style={styles.rowName} numberOfLines={1}>
            {albumTitle}
          </Text>
          <View style={styles.rowMeta}>
            <Text style={styles.rowSubtitle} numberOfLines={1}>
              Album • {albumArtist}
              {albumSongsCount > 0 ? ` • ${albumSongsCount} songs` : ""}
            </Text>
          </View>
        </View>

        <Ionicons
          name="chevron-forward"
          size={16}
          color={colors.textMuted}
          style={{ marginRight: 8 }}
        />
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      {isPlaylistsLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#FFFFFF" />
        </View>
      ) : (
        <FlatList
          data={selectedFilter === "Albums" ? [] : playlists}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={renderHeader}
          ListFooterComponent={
            selectedFilter === "Albums" ? (
              <View>
                {isAlbumsLoading ? (
                  <View style={{ paddingVertical: 30, alignItems: "center" }}>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  </View>
                ) : (
                  uniqueAlbums.map(renderAlbumRow)
                )}
              </View>
            ) : undefined
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.row}
              onPress={() => {
                hapticFeedback.light();
                router.push({
                  pathname: "/(authenticated)/userplaylist/[id]",
                  params: { id: item.id },
                });
              }}
              activeOpacity={0.72}
            >
              <UserPlaylistThumbnail
                playlist={item}
                size={56}
                borderRadius={10}
                style={styles.thumbnail}
              />
              <View style={styles.rowInfo}>
                <Text style={styles.rowName} numberOfLines={1}>
                  {item.name}
                </Text>
                <View style={styles.rowMeta}>
                  {item.privacy === "PRIVATE" ? (
                    <Ionicons
                      name="lock-closed"
                      size={11}
                      color="#8A8A8A"
                      style={{ marginRight: 4 }}
                    />
                  ) : null}
                  <Text style={styles.rowSubtitle} numberOfLines={1}>
                    {item.totalSongs} {item.totalSongs === 1 ? "song" : "songs"}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            selectedFilter === "Albums" ? (
              albums.length === 0 && !isAlbumsLoading ? (
                <View style={styles.empty}>
                  <Ionicons name="disc-outline" size={44} color="#FFFFFF" />
                  <Text style={styles.emptyTitle}>No albums found</Text>
                </View>
              ) : undefined
            ) : (
              <View style={styles.empty}>
                <Ionicons
                  name="musical-notes-outline"
                  size={44}
                  color="#FFFFFF"
                />
                <Text style={styles.emptyTitle}>No playlists yet</Text>
                <Text style={styles.emptyText}>
                  Group your favourite songs into playlists for any mood.
                </Text>
                <TouchableOpacity
                  style={styles.solidButton}
                  onPress={() => setIsCreateModalOpen(true)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.solidButtonText}>New playlist</Text>
                </TouchableOpacity>
              </View>
            )
          }
          refreshControl={
            <RefreshControl
              refreshing={isPlaylistsRefetching}
              onRefresh={() => {
                dispatch(loadUserPlaylists());
                refetchPlaylists();
                refetchAlbums();
                queryClient.invalidateQueries({ queryKey: ["user-playlist-songs-thumb"] });
              }}
              tintColor="#FFFFFF"
              colors={["#FFFFFF"]}
              progressBackgroundColor="#1A1A1A"
            />
          }
          contentContainerStyle={{ paddingBottom: bottomSpace }}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* New playlist sheet */}
      <Modal
        visible={isCreateModalOpen}
        transparent
        animationType="slide"
        onRequestClose={closeModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.backdrop}
        >
          <TouchableOpacity
            style={styles.backdropTouch}
            activeOpacity={1}
            onPress={closeModal}
          />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>New playlist</Text>

            <TextInput
              style={styles.input}
              placeholder="Playlist name"
              placeholderTextColor="#5A5A5A"
              value={newPlaylistName}
              onChangeText={setNewPlaylistName}
              autoFocus
              maxLength={60}
              selectionColor="#FFFFFF"
            />

            <View style={styles.privacyRow}>
              {(["PRIVATE", "SHARE_BY_LINK", "PUBLIC"] as const).map((value) => {
                const active = newPlaylistPrivacy === value;
                return (
                  <TouchableOpacity
                    key={value}
                    style={[styles.privacyPill, active && styles.privacyPillActive]}
                    onPress={() => setNewPlaylistPrivacy(value)}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name={
                        value === "PUBLIC"
                          ? "globe-outline"
                          : value === "SHARE_BY_LINK"
                          ? "link-outline"
                          : "lock-closed-outline"
                      }
                      size={15}
                      color={active ? "#000000" : "#FFFFFF"}
                      style={{ marginRight: 5 }}
                    />
                    <Text
                      style={[
                        styles.privacyText,
                        active && styles.privacyTextActive,
                      ]}
                    >
                      {value === "PUBLIC"
                        ? "Public"
                        : value === "SHARE_BY_LINK"
                        ? "Link Only"
                        : "Private"}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={[
                styles.solidButton,
                (!newPlaylistName.trim() || isSubmitting) && styles.disabled,
              ]}
              onPress={handleCreatePlaylist}
              disabled={!newPlaylistName.trim() || isSubmitting}
              activeOpacity={0.85}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#000000" />
              ) : (
                <Text style={styles.solidButtonText}>Create</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const localStyles = StyleSheet.create({
  headerWrapper: {
    paddingBottom: spacing.sm,
  },
  filtersRow: {
    flexDirection: "row",
    paddingHorizontal: spacing.side,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  filterChip: {
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.xs + 2,
    borderRadius: radii.full,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  filterChipActive: {
    backgroundColor: colors.textPrimary,
    borderColor: colors.textPrimary,
  },
  filterChipText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: "600",
  },
  filterChipTextActive: {
    color: "#000000",
    fontWeight: "700",
  },
  likedSongsCard: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: spacing.side,
    marginBottom: spacing.md,
    padding: spacing.sm + 2,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  likedSongsIconBox: {
    width: 56,
    height: 56,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
    ...shadows.sm,
  },
  likedSongsInfo: {
    flex: 1,
    justifyContent: "center",
  },
  likedSongsTitle: {
    ...typography.body1,
    color: colors.textPrimary,
    fontWeight: "700",
    marginBottom: 2,
  },
  likedSongsSubtitle: {
    ...typography.body2,
    color: colors.textSecondary,
    fontSize: 12,
  },
  sectionSubheader: {
    paddingHorizontal: spacing.side,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  sectionSubheaderTitle: {
    ...typography.title1,
    color: colors.textPrimary,
  },
  albumThumbnailWrapper: {
    width: 56,
    height: 56,
    borderRadius: radii.md,
    overflow: "hidden",
    backgroundColor: colors.card,
    marginRight: spacing.md,
  },
  albumThumbnail: {
    width: "100%",
    height: "100%",
  },
  albumThumbnailFallback: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceElevated,
  },
});
