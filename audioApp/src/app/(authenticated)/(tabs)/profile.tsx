import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";
import { useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";

import {
  AppDispatch,
  AppState,
  clearAuthToken,
  loadUserProfile,
} from "@/store";
import {
  sessionService,
  userService,
  favouriteService,
  playlistService,
} from "@/service";
import { UserSession } from "@/types";

// Space reserved at the bottom for the tab bar + mini player so the
// last item (Log out) can scroll fully into view. Adjust if needed.
const TAB_BAR_HEIGHT = 64;
const MINI_PLAYER_HEIGHT = 72;
const EXTRA_BREATHING_ROOM = 32;

const C = {
  black: "#000000",
  white: "#FFFFFF",
  line: "#1F1F1F",
  muted: "#8A8A8A",
  dim: "#5A5A5A",
  field: "#141414",
};

export default function ProfileScreen() {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const bottomSpace =
    TAB_BAR_HEIGHT + MINI_PLAYER_HEIGHT + EXTRA_BREATHING_ROOM + insets.bottom;

  const deviceId = useSelector((state: AppState) => state.device.deviceId);
  const refreshToken = useSelector((state: AppState) => state.auth.refreshToken);
  const userState = useSelector((state: AppState) => state.user);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const data = userState.profile;
  const isLoading = userState.isLoading && !data;
  const error = userState.error;

  React.useEffect(() => {
    if (!data) {
      dispatch(loadUserProfile());
    } else {
      setNewUsername(data.userName || "");
    }
  }, [data, dispatch]);

  const {
    data: sessions = [],
    isLoading: isSessionsLoading,
    refetch: refetchSessions,
  } = useQuery<UserSession[]>({
    queryKey: ["user-sessions", deviceId],
    queryFn: () => (deviceId ? sessionService.getSessions(deviceId) : []),
    enabled: Boolean(deviceId),
    staleTime: 60 * 1000,
  });

  const { data: favouritesData, refetch: refetchFavourites } = useQuery({
    queryKey: ["profile-favourites-count"],
    queryFn: () => favouriteService.getFavourites(0, 1),
    staleTime: 2 * 60 * 1000,
  });

  const { data: playlistsData, refetch: refetchPlaylists } = useQuery({
    queryKey: ["profile-playlists-count"],
    queryFn: () => playlistService.getUserPlaylists(0, 1),
    staleTime: 2 * 60 * 1000,
  });

  const totalLikedSongs =
    favouritesData?.paginationMetaData?.totalCount ??
    favouritesData?.paginationMetaData?.activeCount ??
    0;

  const totalPlaylists =
    playlistsData?.paginationMetaData?.totalCount ??
    playlistsData?.paginationMetaData?.activeCount ??
    0;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        dispatch(loadUserProfile()).unwrap(),
        refetchSessions(),
        refetchFavourites(),
        refetchPlaylists(),
      ]);
    } catch (e) {
      console.warn("Refresh error:", e);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleUpdateUsername = async () => {
    if (!newUsername.trim() || isUpdatingProfile) return;
    try {
      setIsUpdatingProfile(true);
      await userService.updateProfile({ userName: newUsername.trim() });
      await dispatch(loadUserProfile()).unwrap();
      setIsEditModalOpen(false);
    } catch (err: any) {
      Alert.alert(
        "Update Failed",
        err?.response?.data?.message || err.message || "Failed to update username"
      );
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleRevokeSession = (session: UserSession) => {
    Alert.alert(
      "Revoke Device",
      `Log out ${session.deviceName || "this device"}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Revoke",
          style: "destructive",
          onPress: async () => {
            try {
              await sessionService.revokeSession(session.id);
              refetchSessions();
            } catch (err) {
              console.error("Failed to revoke session:", err);
            }
          },
        },
      ]
    );
  };

  const handleRevokeOtherSessions = () => {
    if (!deviceId) return;
    Alert.alert(
      "Revoke All Other Devices",
      "Are you sure you want to log out of all other active sessions?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Revoke All Others",
          style: "destructive",
          onPress: async () => {
            try {
              await sessionService.revokeOtherSessions(deviceId);
              refetchSessions();
            } catch (err) {
              console.error("Failed to revoke other sessions:", err);
            }
          },
        },
      ]
    );
  };

  const handleLogout = () => {
    Alert.alert("Log Out", "Are you sure you want to log out of this device?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log Out",
        style: "destructive",
        onPress: async () => {
          setIsLoggingOut(true);
          try {
            if (deviceId) {
              await sessionService.logout({
                deviceId,
                allDevices: false,
                refreshToken: refreshToken || undefined,
              });
            }
          } catch (e) {
            console.warn("Logout error:", e);
          } finally {
            queryClient.clear();
            dispatch(clearAuthToken());
            setIsLoggingOut(false);
            router.replace("/login" as any);
          }
        },
      },
    ]);
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={C.white} />
      </SafeAreaView>
    );
  }

  if (error || !data) {
    return (
      <SafeAreaView style={styles.center}>
        <Ionicons name="alert-circle-outline" size={48} color={C.white} />
        <Text style={styles.errorTitle}>Couldn’t load your profile</Text>
        <Text style={styles.errorText}>{error || "Check your connection and try again."}</Text>
        <TouchableOpacity
          style={styles.solidButton}
          onPress={() => dispatch(loadUserProfile())}
          activeOpacity={0.85}
        >
          <Text style={styles.solidButtonText}>Try again</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const initial = (data.userName || data.email || "U").charAt(0).toUpperCase();
  const joined = data.createdAt
    ? new Date(data.createdAt).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "—";
  const otherSessions = sessions.filter((s) => !s.isCurrent);
  const saveDisabled =
    !newUsername.trim() || newUsername.trim() === data.userName || isUpdatingProfile;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView
        contentContainerStyle={[styles.container, { paddingBottom: bottomSpace }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={C.white}
            colors={[C.white]}
            progressBackgroundColor="#1A1A1A"
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <Text style={styles.name}>{data.userName || "No username"}</Text>
          <Text style={styles.email}>{data.email}</Text>

          <TouchableOpacity
            style={styles.outlineButton}
            onPress={() => {
              setNewUsername(data.userName || "");
              setIsEditModalOpen(true);
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.outlineButtonText}>Edit profile</Text>
          </TouchableOpacity>
        </View>

        {/* Stats */}
        <View style={styles.stats}>
          <TouchableOpacity
            style={styles.stat}
            onPress={() => router.push("/(authenticated)/(tabs)/favourites")}
            activeOpacity={0.7}
          >
            <Text style={styles.statNumber}>{totalLikedSongs}</Text>
            <Text style={styles.statLabel}>Liked songs</Text>
          </TouchableOpacity>

          <View style={styles.statDivider} />

          <TouchableOpacity
            style={styles.stat}
            onPress={() => router.push("/(authenticated)/(tabs)/userplaylists")}
            activeOpacity={0.7}
          >
            <Text style={styles.statNumber}>{totalPlaylists}</Text>
            <Text style={styles.statLabel}>Playlists</Text>
          </TouchableOpacity>
        </View>

        {/* Account */}
        <Text style={styles.sectionTitle}>Account</Text>
        <Row label="Username" value={data.userName || "—"} />
        <Row label="Email" value={data.email} />
        <Row label="Member since" value={joined} />
        <Row label="Role" value={data.role || "USER"} />
        <Row label="Status" value={data.status || "ACTIVE"} last />

        {/* Devices */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Devices</Text>
          {otherSessions.length > 0 ? (
            <TouchableOpacity onPress={handleRevokeOtherSessions} activeOpacity={0.7}>
              <Text style={styles.link}>Log out others</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {isSessionsLoading ? (
          <ActivityIndicator size="small" color={C.white} style={{ marginVertical: 16 }} />
        ) : sessions.length === 0 ? (
          <Text style={styles.empty}>No devices to show</Text>
        ) : (
          sessions.map((s, idx) => (
            <View
              key={s.id || idx}
              style={[styles.deviceRow, idx === sessions.length - 1 && styles.noBorder]}
            >
              <Ionicons
                name={s.isCurrent ? "phone-portrait-outline" : "desktop-outline"}
                size={22}
                color={C.white}
              />
              <View style={styles.deviceInfo}>
                <Text style={styles.deviceName} numberOfLines={1}>
                  {s.deviceName || "Melody Client"}
                  {s.isCurrent ? "  (this device)" : ""}
                </Text>
                <Text style={styles.deviceMeta} numberOfLines={1}>
                  {s.lastActiveAt
                    ? `Last active ${new Date(s.lastActiveAt).toLocaleDateString()}`
                    : "Active now"}
                </Text>
              </View>
              {!s.isCurrent ? (
                <TouchableOpacity
                  onPress={() => handleRevokeSession(s)}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  accessibilityLabel="Log out this device"
                >
                  <Ionicons name="close" size={20} color={C.muted} />
                </TouchableOpacity>
              ) : null}
            </View>
          ))
        )}

        {/* Log out */}
        <TouchableOpacity
          style={[styles.solidButton, styles.logout, isLoggingOut && styles.disabled]}
          onPress={handleLogout}
          disabled={isLoggingOut}
          activeOpacity={0.85}
        >
          {isLoggingOut ? (
            <ActivityIndicator size="small" color={C.black} />
          ) : (
            <Text style={styles.solidButtonText}>Log out</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Edit username */}
      <Modal
        visible={isEditModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsEditModalOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.backdrop}
        >
          <TouchableOpacity
            style={styles.backdropTouch}
            activeOpacity={1}
            onPress={() => setIsEditModalOpen(false)}
          />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Edit username</Text>
            <TextInput
              style={styles.input}
              placeholder="Username"
              placeholderTextColor={C.dim}
              value={newUsername}
              onChangeText={setNewUsername}
              autoFocus
              autoCapitalize="none"
              maxLength={30}
              selectionColor={C.white}
            />
            <TouchableOpacity
              style={[styles.solidButton, saveDisabled && styles.disabled]}
              onPress={handleUpdateUsername}
              disabled={saveDisabled}
              activeOpacity={0.85}
            >
              {isUpdatingProfile ? (
                <ActivityIndicator size="small" color={C.black} />
              ) : (
                <Text style={styles.solidButtonText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.row, last && styles.noBorder]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: C.black },
  container: { paddingHorizontal: 20, backgroundColor: C.black },
  center: {
    flex: 1,
    backgroundColor: C.black,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },

  /* Header */
  header: { alignItems: "center", paddingTop: 28, paddingBottom: 24 },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: C.white,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  avatarText: { fontSize: 40, fontWeight: "700", color: C.black },
  name: { fontSize: 24, fontWeight: "700", color: C.white, marginBottom: 4 },
  email: { fontSize: 14, color: C.muted, marginBottom: 18 },

  /* Buttons */
  outlineButton: {
    paddingHorizontal: 22,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.white,
  },
  outlineButtonText: { color: C.white, fontSize: 14, fontWeight: "600" },
  solidButton: {
    height: 52,
    borderRadius: 26,
    backgroundColor: C.white,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  solidButtonText: { color: C.black, fontSize: 16, fontWeight: "700" },
  disabled: { opacity: 0.4 },

  /* Stats */
  stats: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 18,
    marginBottom: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: C.line,
  },
  stat: { flex: 1, alignItems: "center" },
  statNumber: { fontSize: 22, fontWeight: "700", color: C.white, marginBottom: 2 },
  statLabel: { fontSize: 13, color: C.muted },
  statDivider: { width: 1, height: 32, backgroundColor: C.line },

  /* Sections */
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: C.white,
    marginTop: 24,
    marginBottom: 6,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  link: { color: C.white, fontSize: 13, fontWeight: "600", marginBottom: 6 },

  /* Rows */
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
    gap: 16,
  },
  noBorder: { borderBottomWidth: 0 },
  rowLabel: { fontSize: 15, color: C.muted },
  rowValue: { flex: 1, textAlign: "right", fontSize: 15, color: C.white, fontWeight: "500" },

  /* Devices */
  deviceRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
    gap: 14,
  },
  deviceInfo: { flex: 1 },
  deviceName: { fontSize: 15, color: C.white, fontWeight: "600", marginBottom: 2 },
  deviceMeta: { fontSize: 12, color: C.muted },
  empty: { color: C.dim, fontSize: 14, paddingVertical: 16 },

  logout: { marginTop: 36 },

  /* Error */
  errorTitle: { fontSize: 18, fontWeight: "700", color: C.white, marginTop: 14, marginBottom: 6 },
  errorText: { fontSize: 14, color: C.muted, textAlign: "center", marginBottom: 24 },

  /* Bottom sheet */
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.7)" },
  backdropTouch: { flex: 1 },
  sheet: {
    backgroundColor: "#0D0D0D",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: "#262626",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 32,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#333333",
    marginBottom: 18,
  },
  sheetTitle: { fontSize: 20, fontWeight: "700", color: C.white, marginBottom: 16 },
  input: {
    height: 52,
    borderRadius: 14,
    backgroundColor: C.field,
    paddingHorizontal: 16,
    color: C.white,
    fontSize: 16,
    marginBottom: 16,
  },
});