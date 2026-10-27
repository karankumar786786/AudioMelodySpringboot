import { useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { playlistService } from "@/service";
import { UserPlaylist } from "@/types";
import { UserPlaylistThumbnail } from "@/components";
import { userPlaylistStyles as styles } from "@/styles";

// Space reserved for the tab bar + mini player so the last playlist is reachable.
const TAB_BAR_HEIGHT = 64;
const MINI_PLAYER_HEIGHT = 72;
const EXTRA_BREATHING_ROOM = 32;

export default function UserPlaylistsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

  const bottomSpace =
    TAB_BAR_HEIGHT + MINI_PLAYER_HEIGHT + EXTRA_BREATHING_ROOM + insets.bottom;

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [newPlaylistPrivacy, setNewPlaylistPrivacy] = useState<"PUBLIC" | "PRIVATE">("PUBLIC");
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const closeModal = () => {
    setIsCreateModalOpen(false);
  };

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
    <View style={styles.header}>
      <View style={styles.headerText}>
        <Text style={styles.title}>Playlists</Text>
        {!isLoading ? (
          <Text style={styles.subtitle}>
            {playlists.length} {playlists.length === 1 ? "playlist" : "playlists"}
          </Text>
        ) : null}
      </View>
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => setIsCreateModalOpen(true)}
        activeOpacity={0.85}
        accessibilityLabel="New playlist"
      >
        <Ionicons name="add" size={28} color="#000000" />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#FFFFFF" />
        </View>
      ) : (
        <FlatList
          data={playlists}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={renderHeader}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.row}
              onPress={() =>
                router.push({
                  pathname: "/(authenticated)/userplaylist/[id]",
                  params: { id: item.id },
                })
              }
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
            <View style={styles.empty}>
              <Ionicons name="musical-notes-outline" size={44} color="#FFFFFF" />
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
          }
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => {
                refetch();
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
              {(["PUBLIC", "PRIVATE"] as const).map((value) => {
                const active = newPlaylistPrivacy === value;
                return (
                  <TouchableOpacity
                    key={value}
                    style={[styles.privacyPill, active && styles.privacyPillActive]}
                    onPress={() => setNewPlaylistPrivacy(value)}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name={value === "PUBLIC" ? "globe-outline" : "lock-closed-outline"}
                      size={16}
                      color={active ? "#000000" : "#FFFFFF"}
                      style={{ marginRight: 6 }}
                    />
                    <Text style={[styles.privacyText, active && styles.privacyTextActive]}>
                      {value === "PUBLIC" ? "Public" : "Private"}
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

