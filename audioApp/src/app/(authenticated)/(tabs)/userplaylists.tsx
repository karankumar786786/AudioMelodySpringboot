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
import { SafeAreaView } from "react-native-safe-area-context";
import { useBottomBarSpacing } from "@/hooks";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
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
import { playlistService } from "@/service";
import { UserPlaylist } from "@/types";
import { UserPlaylistThumbnail } from "@/components";
import { hapticFeedback } from "@/utils/haptics";
import { colors, radii, spacing, typography, shadows } from "@/theme";
import { userPlaylistStyles as styles } from "@/styles";

type PrivacyFilter = "All" | "Private" | "Link" | "Public";

const PRIVACY_FILTERS: {
  key: PrivacyFilter;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { key: "All", label: "All", icon: "albums-outline" },
  { key: "Private", label: "Private", icon: "lock-closed" },
  { key: "Link", label: "Link", icon: "link-outline" },
  { key: "Public", label: "Public", icon: "globe-outline" },
];

export default function UserPlaylistsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { bottomSpace } = useBottomBarSpacing({ gap: 10 });

  const [selectedFilter, setSelectedFilter] = useState<PrivacyFilter>("All");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [newPlaylistPrivacy, setNewPlaylistPrivacy] = useState<
    "PUBLIC" | "PRIVATE" | "SHARE_BY_LINK"
  >("PRIVATE");
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

  const playlists: UserPlaylist[] =
    storePlaylists && storePlaylists.length > 0
      ? storePlaylists
      : playlistsData?.content || [];

  const filteredPlaylists = useMemo(() => {
    if (selectedFilter === "Private") {
      return playlists.filter((p) => !p.privacy || p.privacy === "PRIVATE");
    }
    if (selectedFilter === "Link") {
      return playlists.filter((p) => p.privacy === "SHARE_BY_LINK");
    }
    if (selectedFilter === "Public") {
      return playlists.filter((p) => p.privacy === "PUBLIC");
    }
    return playlists;
  }, [playlists, selectedFilter]);

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
            {filteredPlaylists.length}{" "}
            {filteredPlaylists.length === 1 ? "playlist" : "playlists"}
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

      {/* Filter Chips Bar (Private, Link, Public, All) */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={localStyles.filtersRow}
      >
        {PRIVACY_FILTERS.map((filter) => {
          const isActive = selectedFilter === filter.key;
          return (
            <TouchableOpacity
              key={filter.key}
              style={[
                localStyles.filterChip,
                isActive && localStyles.filterChipActive,
              ]}
              onPress={() => {
                hapticFeedback.selection();
                setSelectedFilter((prev) =>
                  prev === filter.key ? "All" : filter.key
                );
              }}
              activeOpacity={0.75}
            >
              <Ionicons
                name={filter.icon}
                size={12}
                color={isActive ? "#000000" : colors.textSecondary}
                style={{ marginRight: 5 }}
              />
              <Text
                style={[
                  localStyles.filterChipText,
                  isActive && localStyles.filterChipTextActive,
                ]}
              >
                {filter.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Pinned Liked Songs Card */}
      {(selectedFilter === "All" || selectedFilter === "Private") && (
        <TouchableOpacity
          style={localStyles.likedSongsCard}
          onPress={() => {
            hapticFeedback.light();
            router.push("/(authenticated)/favourites" as any);
          }}
          activeOpacity={0.75}
        >
          <View style={localStyles.likedSongsIconWrapper}>
            <LinearGradient
              colors={["#4F149B", "#7B2CBF"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={localStyles.likedSongsIconBox}
            >
              <Ionicons name="heart" size={26} color="#FFFFFF" />
            </LinearGradient>
          </View>

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
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      {isPlaylistsLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#FFFFFF" />
        </View>
      ) : (
        <FlatList
          data={filteredPlaylists}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={renderHeader}
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
                  {item.privacy === "PUBLIC" ? (
                    <Ionicons
                      name="globe-outline"
                      size={11}
                      color="#8A8A8A"
                      style={{ marginRight: 4 }}
                    />
                  ) : item.privacy === "SHARE_BY_LINK" ? (
                    <Ionicons
                      name="link-outline"
                      size={12}
                      color="#8A8A8A"
                      style={{ marginRight: 4 }}
                    />
                  ) : (
                    <Ionicons
                      name="lock-closed"
                      size={11}
                      color="#8A8A8A"
                      style={{ marginRight: 4 }}
                    />
                  )}
                  <Text style={styles.rowSubtitle} numberOfLines={1}>
                    {item.privacy === "PUBLIC"
                      ? "Public • "
                      : item.privacy === "SHARE_BY_LINK"
                      ? "Link only • "
                      : "Private • "}
                    {item.totalSongs} {item.totalSongs === 1 ? "song" : "songs"}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons
                name={
                  selectedFilter === "Link"
                    ? "link-outline"
                    : selectedFilter === "Public"
                    ? "globe-outline"
                    : "musical-notes-outline"
                }
                size={44}
                color="#FFFFFF"
              />
              <Text style={styles.emptyTitle}>
                {selectedFilter === "Private"
                  ? "No private playlists"
                  : selectedFilter === "Link"
                  ? "No link-shared playlists"
                  : selectedFilter === "Public"
                  ? "No public playlists"
                  : "No playlists yet"}
              </Text>
              <Text style={styles.emptyText}>
                {selectedFilter === "Link"
                  ? "Playlists shared via direct link will appear here."
                  : selectedFilter === "Public"
                  ? "Public playlists visible to everyone will appear here."
                  : "Group your favourite songs into playlists for any mood."}
              </Text>
              <TouchableOpacity
                style={styles.solidButton}
                onPress={() => setIsCreateModalOpen(true)}
                activeOpacity={0.85}
              >
                <Text style={styles.solidButtonText}>New playlist</Text>
              </TouchableOpacity>
            </View>
          }
          refreshControl={
            <RefreshControl
              refreshing={isPlaylistsRefetching}
              onRefresh={() => {
                dispatch(loadUserPlaylists());
                refetchPlaylists();
                queryClient.invalidateQueries({
                  queryKey: ["user-playlist-songs-thumb"],
                });
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
    flexDirection: "row",
    alignItems: "center",
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
  likedSongsIconWrapper: {
    width: 56,
    height: 56,
    borderRadius: radii.md,
    marginRight: spacing.md,
    backgroundColor: "#4F149B",
    ...shadows.sm,
  },
  likedSongsIconBox: {
    width: "100%",
    height: "100%",
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
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
});
