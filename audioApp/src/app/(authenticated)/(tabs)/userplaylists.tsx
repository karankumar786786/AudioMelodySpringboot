import React, { useState } from "react";
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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { playlistService } from "@/service";
import { UserPlaylist } from "@/types";

export default function UserPlaylistsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [newPlaylistPrivacy, setNewPlaylistPrivacy] = useState<"PUBLIC" | "PRIVATE">("PUBLIC");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 1. Fetch User's Playlists
  const {
    data: playlistsData,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["user-playlists"],
    queryFn: () => playlistService.getUserPlaylists(0, 100),
    staleTime: 60 * 1000,
  });

  const playlists: UserPlaylist[] = playlistsData?.content || [];

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim() || isSubmitting) return;

    try {
      setIsSubmitting(true);
      const created = await playlistService.createUserPlaylist(
        newPlaylistName.trim(),
        newPlaylistPrivacy
      );
      setIsCreateModalOpen(false);
      setNewPlaylistName("");
      setNewPlaylistPrivacy("PUBLIC");

      queryClient.invalidateQueries({ queryKey: ["user-playlists"] });

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
    <View style={styles.listHeader}>
      {/* Pinned Liked Songs Card */}
      <TouchableOpacity
        style={styles.likedSongsCard}
        onPress={() => router.push("/(authenticated)/(tabs)/favourites")}
        activeOpacity={0.8}
      >
        <View style={styles.likedSongsIconBox}>
          <Ionicons name="heart" size={26} color="#FFFFFF" />
        </View>
        <View style={styles.likedSongsInfo}>
          <Text style={styles.likedSongsTitle}>Liked Songs</Text>
          <Text style={styles.likedSongsSubtitle}>Auto-saved tracks</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#777777" />
      </TouchableOpacity>

      <View style={styles.sectionHeadingRow}>
        <Text style={styles.sectionHeading}>Your Library</Text>
        <Text style={styles.playlistCount}>
          {playlists.length} {playlists.length === 1 ? "playlist" : "playlists"}
        </Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      {/* Top Header */}
      <View style={styles.topHeader}>
        <Text style={styles.screenTitle}>Playlists</Text>
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => setIsCreateModalOpen(true)}
          activeOpacity={0.75}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="add" size={26} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Main Content */}
      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#208AEF" />
          <Text style={styles.loadingText}>Loading playlists...</Text>
        </View>
      ) : playlists.length === 0 ? (
        <View style={styles.emptyContainer}>
          {renderHeader()}
          <View style={styles.emptyContent}>
            <View style={styles.emptyIconBox}>
              <Ionicons name="musical-notes-outline" size={54} color="#444444" />
            </View>
            <Text style={styles.emptyTitle}>Create your first playlist</Text>
            <Text style={styles.emptySubtitle}>
              Organize your favourite tracks into custom playlists for any vibe.
            </Text>
            <TouchableOpacity
              style={styles.createFirstButton}
              onPress={() => setIsCreateModalOpen(true)}
              activeOpacity={0.82}
            >
              <Text style={styles.createFirstButtonText}>New Playlist</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <FlatList
          data={playlists}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={renderHeader}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.playlistRow}
              onPress={() =>
                router.push({
                  pathname: "/(authenticated)/userplaylist/[id]",
                  params: { id: item.id },
                })
              }
              activeOpacity={0.72}
            >
              <View style={styles.playlistIconBox}>
                <Ionicons name="musical-notes" size={22} color="#208AEF" />
              </View>

              <View style={styles.playlistInfo}>
                <Text style={styles.playlistName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.playlistSubtitle} numberOfLines={1}>
                  {item.totalSongs} {item.totalSongs === 1 ? "track" : "tracks"} •{" "}
                  {item.privacy === "PRIVATE" ? "Private" : "Public"}
                </Text>
              </View>

              <Ionicons name="chevron-forward" size={18} color="#666666" />
            </TouchableOpacity>
          )}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => {
                refetch();
              }}
              tintColor="#208AEF"
              colors={["#208AEF"]}
            />
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Create Playlist Modal */}
      <Modal
        visible={isCreateModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsCreateModalOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalBackdrop}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Give your playlist a name</Text>

            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Late Night Vibes"
              placeholderTextColor="#666666"
              value={newPlaylistName}
              onChangeText={setNewPlaylistName}
              autoFocus
              maxLength={60}
            />

            {/* Privacy Picker */}
            <View style={styles.privacyRow}>
              <TouchableOpacity
                style={[
                  styles.privacyPill,
                  newPlaylistPrivacy === "PUBLIC" && styles.activePrivacyPill,
                ]}
                onPress={() => setNewPlaylistPrivacy("PUBLIC")}
              >
                <Ionicons
                  name="globe-outline"
                  size={16}
                  color={newPlaylistPrivacy === "PUBLIC" ? "#FFFFFF" : "#888888"}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.privacyText,
                    newPlaylistPrivacy === "PUBLIC" && styles.activePrivacyText,
                  ]}
                >
                  Public
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.privacyPill,
                  newPlaylistPrivacy === "PRIVATE" && styles.activePrivacyPill,
                ]}
                onPress={() => setNewPlaylistPrivacy("PRIVATE")}
              >
                <Ionicons
                  name="lock-closed-outline"
                  size={16}
                  color={newPlaylistPrivacy === "PRIVATE" ? "#FFFFFF" : "#888888"}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.privacyText,
                    newPlaylistPrivacy === "PRIVATE" && styles.activePrivacyText,
                  ]}
                >
                  Private
                </Text>
              </TouchableOpacity>
            </View>

            {/* Modal Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setIsCreateModalOpen(false)}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.submitButton,
                  !newPlaylistName.trim() && styles.disabledSubmitButton,
                ]}
                onPress={handleCreatePlaylist}
                disabled={!newPlaylistName.trim() || isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitText}>Create</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#121212",
  },
  topHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 14,
    backgroundColor: "#121212",
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#FFFFFF",
    letterSpacing: -0.5,
  },
  createButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#208AEF",
    justifyContent: "center",
    alignItems: "center",
  },
  listContent: {
    paddingBottom: 40,
  },
  listHeader: {
    paddingHorizontal: 16,
    paddingTop: 4,
    marginBottom: 8,
  },
  likedSongsCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1C1428",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#2E1C44",
    marginBottom: 20,
  },
  likedSongsIconBox: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: "#E91E63",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
    shadowColor: "#E91E63",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  likedSongsInfo: {
    flex: 1,
  },
  likedSongsTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 2,
  },
  likedSongsSubtitle: {
    fontSize: 12,
    color: "#9A9A9A",
  },
  sectionHeadingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  sectionHeading: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: -0.2,
  },
  playlistCount: {
    fontSize: 13,
    color: "#888888",
  },
  playlistRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  playlistIconBox: {
    width: 50,
    height: 50,
    borderRadius: 10,
    backgroundColor: "rgba(32, 138, 239, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(32, 138, 239, 0.25)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  playlistInfo: {
    flex: 1,
    paddingRight: 10,
  },
  playlistName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 3,
  },
  playlistSubtitle: {
    fontSize: 12,
    color: "#888888",
  },
  centerContainer: {
    flex: 1,
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
    flex: 1,
  },
  emptyContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 36,
    paddingTop: 40,
  },
  emptyIconBox: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "#1A1A1A",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "#252525",
  },
  emptyTitle: {
    fontSize: 19,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 8,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#777777",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  createFirstButton: {
    backgroundColor: "#208AEF",
    paddingHorizontal: 26,
    paddingVertical: 12,
    borderRadius: 24,
  },
  createFirstButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  modalContent: {
    width: "100%",
    backgroundColor: "#1E1E1E",
    borderRadius: 18,
    padding: 22,
    borderWidth: 1,
    borderColor: "#2E2E2E",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 16,
    textAlign: "center",
  },
  modalInput: {
    backgroundColor: "#141414",
    borderWidth: 1,
    borderColor: "#2E2E2E",
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    color: "#FFFFFF",
    fontSize: 15,
    marginBottom: 16,
  },
  privacyRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
  },
  privacyPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#161616",
    borderWidth: 1,
    borderColor: "#2E2E2E",
  },
  activePrivacyPill: {
    backgroundColor: "rgba(32, 138, 239, 0.2)",
    borderColor: "#208AEF",
  },
  privacyText: {
    color: "#888888",
    fontSize: 13,
    fontWeight: "600",
  },
  activePrivacyText: {
    color: "#FFFFFF",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
  },
  cancelButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  cancelText: {
    color: "#888888",
    fontSize: 14,
    fontWeight: "600",
  },
  submitButton: {
    backgroundColor: "#208AEF",
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 10,
    minWidth: 84,
    alignItems: "center",
  },
  disabledSubmitButton: {
    opacity: 0.5,
  },
  submitText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
});
