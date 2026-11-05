import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useDispatch, useSelector } from "react-redux";
import { useQueryClient } from "@tanstack/react-query";

import { AppDispatch, AppState } from "@/store";
import {
  selectAllUserPlaylists,
  selectUserPlaylistsLoading,
  loadUserPlaylists,
  loadPlaylistSongs,
  createUserPlaylist,
  addSongToUserPlaylist,
  removeSongFromUserPlaylist,
  selectIsSongInPlaylist,
} from "@/store/userPlaylistSlice";
import { UserPlaylist, Song } from "@/types";
import { UserPlaylistThumbnail } from "./UserPlaylistThumbnail";
import { getImageUrl } from "@/utils/imageUtils";
import { hapticFeedback } from "@/utils/haptics";
import { colors, radii, spacing, typography } from "@/theme";

interface AddToPlaylistModalProps {
  visible: boolean;
  onClose: () => void;
  song: Song | { id: string; title: string; artistName?: string; imageKey?: string; coverUrl?: string };
}

export function AddToPlaylistModal({
  visible,
  onClose,
  song,
}: AddToPlaylistModalProps) {
  const dispatch = useDispatch<AppDispatch>();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

  const playlists = useSelector(selectAllUserPlaylists);
  const isLoading = useSelector(selectUserPlaylistsLoading);
  const playlistSongMap = useSelector(
    (state: AppState) => state.userPlaylists.playlistSongMap
  );

  const [isCreating, setIsCreating] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const songId = song?.id ? String(song.id) : "";

  // Load playlists and cache songs for each playlist when modal opens
  useEffect(() => {
    if (visible) {
      dispatch(loadUserPlaylists());
      setIsCreating(false);
      setNewPlaylistName("");
      setFeedbackMessage(null);
    }
  }, [visible, dispatch]);

  // Load songs for any playlist not yet in the map (skip empty playlists to prevent race conditions)
  useEffect(() => {
    if (visible && playlists.length > 0) {
      playlists.forEach((pl) => {
        if (!playlistSongMap[pl.id]) {
          if ((pl.totalSongs || 0) > 0) {
            dispatch(loadPlaylistSongs(pl.id));
          }
        }
      });
    }
  }, [visible, playlists, playlistSongMap, dispatch]);

  const showFeedback = (msg: string) => {
    setFeedbackMessage(msg);
    setTimeout(() => {
      setFeedbackMessage(null);
    }, 2400);
  };

  const handleTogglePlaylist = async (playlist: UserPlaylist) => {
    if (!songId) return;
    const isAlreadyIn = (playlistSongMap[playlist.id] || []).includes(songId);

    if (isAlreadyIn) {
      hapticFeedback.light();
      try {
        await dispatch(
          removeSongFromUserPlaylist({ playlistId: playlist.id, songId })
        ).unwrap();
        queryClient.invalidateQueries({ queryKey: ["user-playlists"] });
        queryClient.invalidateQueries({ queryKey: ["user-playlist-songs-thumb"] });
        queryClient.invalidateQueries({ queryKey: ["user-playlist-songs", playlist.id] });
        showFeedback(`Removed from "${playlist.name}"`);
      } catch (err: any) {
        showFeedback("Failed to update playlist");
      }
    } else {
      hapticFeedback.success();
      try {
        await dispatch(
          addSongToUserPlaylist({ playlistId: playlist.id, songId })
        ).unwrap();
        queryClient.invalidateQueries({ queryKey: ["user-playlists"] });
        queryClient.invalidateQueries({ queryKey: ["user-playlist-songs-thumb"] });
        queryClient.invalidateQueries({ queryKey: ["user-playlist-songs", playlist.id] });
        showFeedback(`Added to "${playlist.name}"`);
      } catch (err: any) {
        showFeedback("Failed to add to playlist");
      }
    }
  };

  const handleCreateAndAdd = async () => {
    const trimmed = newPlaylistName.trim();
    if (!trimmed || isSubmitting || !songId) return;

    try {
      setIsSubmitting(true);
      hapticFeedback.success();
      const newPlaylist = await dispatch(
        createUserPlaylist({ name: trimmed, privacy: "PUBLIC" })
      ).unwrap();

      await dispatch(
        addSongToUserPlaylist({ playlistId: newPlaylist.id, songId })
      ).unwrap();

      queryClient.invalidateQueries({ queryKey: ["user-playlists"] });
      queryClient.invalidateQueries({ queryKey: ["user-playlist-songs-thumb"] });
      queryClient.invalidateQueries({ queryKey: ["user-playlist-songs", newPlaylist.id] });

      setNewPlaylistName("");
      setIsCreating(false);
      showFeedback(`Created "${trimmed}" and added song`);
    } catch (err: any) {
      showFeedback("Failed to create playlist");
    } finally {
      setIsSubmitting(false);
    }
  };

  const songImageUrl =
    (song as any)?.posterUrl ||
    (song as any)?.coverUrl ||
    (song?.imageKey ? getImageUrl(song.imageKey, { width: 100, height: 100 }) : null);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.backdrop}
      >
        <Pressable style={styles.dismissArea} onPress={onClose} />

        <View
          style={[
            styles.sheetContainer,
            { paddingBottom: Math.max(insets.bottom, 16) },
          ]}
        >
          {/* Drag Handle Indicator */}
          <View style={styles.handleContainer}>
            <View style={styles.handleBar} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.songThumbContainer}>
                {songImageUrl ? (
                  <Image source={{ uri: songImageUrl }} style={styles.songThumb} />
                ) : (
                  <View style={styles.songThumbFallback}>
                    <Ionicons name="musical-note" size={16} color="#888" />
                  </View>
                )}
              </View>
              <View style={styles.headerTitleWrap}>
                <Text style={styles.headerTitle}>Add to Playlist</Text>
                <Text style={styles.songName} numberOfLines={1}>
                  {song?.title || "Song"} {song?.artistName ? `• ${song.artistName}` : ""}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Feedback Toast */}
          {feedbackMessage ? (
            <View style={styles.toastContainer}>
              <Text style={styles.toastText}>{feedbackMessage}</Text>
            </View>
          ) : null}

          {/* Create New Playlist Action */}
          {isCreating ? (
            <View style={styles.createBox}>
              <TextInput
                style={styles.createInput}
                placeholder="New playlist name"
                placeholderTextColor="#666"
                value={newPlaylistName}
                onChangeText={setNewPlaylistName}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleCreateAndAdd}
              />
              <View style={styles.createButtonsRow}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => {
                    setIsCreating(false);
                    setNewPlaylistName("");
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.submitButton,
                    (!newPlaylistName.trim() || isSubmitting) && styles.submitButtonDisabled,
                  ]}
                  onPress={handleCreateAndAdd}
                  disabled={!newPlaylistName.trim() || isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color="#000" />
                  ) : (
                    <Text style={styles.submitButtonText}>Create & Add</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.newPlaylistButton}
              onPress={() => {
                hapticFeedback.light();
                setIsCreating(true);
              }}
              activeOpacity={0.7}
            >
              <View style={styles.newPlaylistIconWrap}>
                <Ionicons name="add" size={22} color="#FFFFFF" />
              </View>
              <Text style={styles.newPlaylistText}>New playlist</Text>
            </TouchableOpacity>
          )}

          {/* Playlist List */}
          {isLoading && playlists.length === 0 ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#FFFFFF" />
            </View>
          ) : (
            <FlatList
              data={playlists}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Ionicons name="folder-open-outline" size={36} color="#555" />
                  <Text style={styles.emptyText}>No playlists yet</Text>
                  <Text style={styles.emptySubtext}>
                    Create your first playlist above.
                  </Text>
                </View>
              }
              renderItem={({ item }) => {
                const isInPlaylist = (playlistSongMap[item.id] || []).includes(songId);

                return (
                  <TouchableOpacity
                    style={styles.playlistItem}
                    onPress={() => handleTogglePlaylist(item)}
                    activeOpacity={0.7}
                  >
                    <UserPlaylistThumbnail
                      playlist={item}
                      size={48}
                      borderRadius={8}
                      style={styles.itemThumb}
                    />
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemTitle} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={styles.itemSubtitle}>
                        {item.totalSongs} {item.totalSongs === 1 ? "song" : "songs"}
                      </Text>
                    </View>

                    <View style={styles.checkIconWrap}>
                      {isInPlaylist ? (
                        <Ionicons
                          name="checkmark-circle"
                          size={24}
                          color="#FFFFFF"
                        />
                      ) : (
                        <Ionicons
                          name="add-circle-outline"
                          size={24}
                          color="rgba(255, 255, 255, 0.4)"
                        />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    justifyContent: "flex-end",
  },
  dismissArea: {
    flex: 1,
  },
  sheetContainer: {
    backgroundColor: "#161616",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    maxHeight: "75%",
    minHeight: 320,
    borderTopWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  handleContainer: {
    alignItems: "center",
    paddingVertical: 10,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255, 255, 255, 0.25)",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.07)",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    paddingRight: 12,
  },
  songThumbContainer: {
    width: 40,
    height: 40,
    borderRadius: 6,
    overflow: "hidden",
    backgroundColor: "#222",
    marginRight: 12,
  },
  songThumb: {
    width: "100%",
    height: "100%",
  },
  songThumbFallback: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  songName: {
    fontSize: 12.5,
    color: "#8E8E93",
    marginTop: 2,
  },
  closeButton: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  toastContainer: {
    backgroundColor: "#FFFFFF",
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginHorizontal: 20,
    marginTop: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  toastText: {
    color: "#000000",
    fontWeight: "700",
    fontSize: 13,
  },
  newPlaylistButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
  },
  newPlaylistIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  newPlaylistText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  createBox: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(255, 255, 255, 0.03)",
  },
  createInput: {
    height: 44,
    backgroundColor: "#202020",
    borderRadius: 8,
    paddingHorizontal: 12,
    color: "#FFFFFF",
    fontSize: 15,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  createButtonsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    marginTop: 10,
    gap: 10,
  },
  cancelButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  cancelButtonText: {
    color: "#8E8E93",
    fontSize: 14,
    fontWeight: "600",
  },
  submitButton: {
    backgroundColor: "#FFFFFF",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
  },
  submitButtonDisabled: {
    opacity: 0.45,
  },
  submitButtonText: {
    color: "#000000",
    fontSize: 13,
    fontWeight: "700",
  },
  listContent: {
    paddingTop: 4,
    paddingBottom: 20,
  },
  loadingContainer: {
    paddingVertical: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
    marginTop: 10,
  },
  emptySubtext: {
    color: "#8E8E93",
    fontSize: 12.5,
    marginTop: 4,
  },
  playlistItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  itemThumb: {
    marginRight: 14,
  },
  itemInfo: {
    flex: 1,
    justifyContent: "center",
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 3,
  },
  itemSubtitle: {
    fontSize: 12.5,
    color: "#8E8E93",
  },
  checkIconWrap: {
    paddingLeft: 12,
  },
});

