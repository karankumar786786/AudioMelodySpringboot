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
import { SafeAreaView } from "react-native-safe-area-context";
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

export default function ProfileScreen() {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const deviceId = useSelector((state: AppState) => state.device.deviceId);
  const refreshToken = useSelector((state: AppState) => state.auth.refreshToken);
  const userState = useSelector((state: AppState) => state.user);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const data = userState.profile;
  const isLoading = userState.isLoading && !data;
  const error = userState.error;

  // Sync profile on mount if not loaded
  React.useEffect(() => {
    if (!data) {
      dispatch(loadUserProfile());
    } else {
      setNewUsername(data.userName || "");
    }
  }, [data, dispatch]);

  // 1. Fetch User Sessions (Active Devices)
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

  // 2. Fetch Liked Songs count
  const {
    data: favouritesData,
    refetch: refetchFavourites,
  } = useQuery({
    queryKey: ["profile-favourites-count"],
    queryFn: () => favouriteService.getFavourites(0, 1),
    staleTime: 2 * 60 * 1000,
  });

  // 3. Fetch User Playlists count
  const {
    data: playlistsData,
    refetch: refetchPlaylists,
  } = useQuery({
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
    await Promise.all([
      dispatch(loadUserProfile()).unwrap(),
      refetchSessions(),
      refetchFavourites(),
      refetchPlaylists(),
    ]);
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
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#208AEF" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </SafeAreaView>
    );
  }

  if (error || !data) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <Ionicons name="alert-circle-outline" size={56} color="#FF5252" />
        <Text style={styles.errorTitle}>Failed to load profile</Text>
        <Text style={styles.errorText}>{error || "Something went wrong"}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => dispatch(loadUserProfile())}
          activeOpacity={0.8}
        >
          <Ionicons name="refresh" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const initial = (data.userName || data.email || "U").charAt(0).toUpperCase();
  const formattedDate = data.createdAt
    ? new Date(data.createdAt).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "N/A";

  const otherSessions = sessions.filter((s) => !s.isCurrent);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={userState.isLoading}
            onRefresh={handleRefresh}
            tintColor="#208AEF"
            colors={["#208AEF"]}
          />
        }
      >
        {/* Top Header */}
        <View style={styles.topBar}>
          <Text style={styles.screenTitle}>My Profile</Text>
          <TouchableOpacity
            onPress={handleRefresh}
            style={styles.iconButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="refresh-outline" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Profile Card / Avatar */}
        <View style={styles.avatarCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <Text style={styles.nameText}>{data.userName || "No Username"}</Text>
          <Text style={styles.emailText}>{data.email}</Text>

          <View style={styles.badgeRow}>
            <View style={styles.activeBadge}>
              <View style={styles.activeDot} />
              <Text style={styles.activeBadgeText}>
                {data.status === "ACTIVE" ? "Active Account" : data.status || "Authenticated"}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.editProfileButton}
            onPress={() => {
              setNewUsername(data.userName || "");
              setIsEditModalOpen(true);
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="pencil" size={15} color="#208AEF" style={{ marginRight: 6 }} />
            <Text style={styles.editProfileButtonText}>Edit Username</Text>
          </TouchableOpacity>
        </View>

        {/* Quick Stats Grid */}
        <View style={styles.statsRow}>
          <TouchableOpacity
            style={styles.statBox}
            onPress={() => router.push("/(authenticated)/(tabs)/favourites")}
            activeOpacity={0.75}
          >
            <Ionicons name="heart" size={22} color="#E91E63" style={{ marginBottom: 4 }} />
            <Text style={styles.statNumber}>{totalLikedSongs}</Text>
            <Text style={styles.statLabel}>Liked Songs</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.statBox}
            onPress={() => router.push("/(authenticated)/(tabs)/userplaylists")}
            activeOpacity={0.75}
          >
            <Ionicons name="musical-notes" size={22} color="#208AEF" style={{ marginBottom: 4 }} />
            <Text style={styles.statNumber}>{totalPlaylists}</Text>
            <Text style={styles.statLabel}>Playlists</Text>
          </TouchableOpacity>

          <View style={styles.statBox}>
            <Ionicons name="calendar-outline" size={22} color="#10B981" style={{ marginBottom: 4 }} />
            <Text style={styles.statNumberDate}>{formattedDate}</Text>
            <Text style={styles.statLabel}>Joined</Text>
          </View>
        </View>

        {/* Account Information Card */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeader}>Account Information</Text>

          <View style={styles.infoRow}>
            <View style={styles.infoLabelGroup}>
              <Ionicons name="person-outline" size={18} color="#888888" />
              <Text style={styles.infoLabel}>Username</Text>
            </View>
            <Text style={styles.infoValue}>{data.userName || "N/A"}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <View style={styles.infoLabelGroup}>
              <Ionicons name="mail-outline" size={18} color="#888888" />
              <Text style={styles.infoLabel}>Email</Text>
            </View>
            <Text style={styles.infoValue}>{data.email}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <View style={styles.infoLabelGroup}>
              <Ionicons name="shield-checkmark-outline" size={18} color="#888888" />
              <Text style={styles.infoLabel}>Role</Text>
            </View>
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>{data.role || "USER"}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <View style={styles.infoLabelGroup}>
              <Ionicons name="finger-print-outline" size={18} color="#888888" />
              <Text style={styles.infoLabel}>User ID</Text>
            </View>
            <Text style={styles.infoValueMuted} numberOfLines={1}>
              {data.id}
            </Text>
          </View>
        </View>

        {/* Active Sessions & Security */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeader}>Active Sessions & Security</Text>
            {otherSessions.length > 0 ? (
              <TouchableOpacity onPress={handleRevokeOtherSessions}>
                <Text style={styles.revokeAllText}>Revoke Others</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {isSessionsLoading ? (
            <ActivityIndicator size="small" color="#208AEF" style={{ marginVertical: 10 }} />
          ) : sessions.length === 0 ? (
            <Text style={styles.emptySessionText}>No session information available</Text>
          ) : (
            sessions.map((s, idx) => (
              <React.Fragment key={s.id || idx}>
                {idx > 0 ? <View style={styles.divider} /> : null}
                <View style={styles.sessionRow}>
                  <View style={styles.sessionIconBox}>
                    <Ionicons
                      name={s.isCurrent ? "phone-portrait" : "desktop-outline"}
                      size={20}
                      color={s.isCurrent ? "#208AEF" : "#888888"}
                    />
                  </View>
                  <View style={styles.sessionDetails}>
                    <View style={styles.sessionTitleRow}>
                      <Text style={styles.deviceName} numberOfLines={1}>
                        {s.deviceName || "Melody Client"}
                      </Text>
                      {s.isCurrent ? (
                        <View style={styles.currentDevicePill}>
                          <Text style={styles.currentDevicePillText}>This Device</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.sessionMeta}>
                      {s.ipAddress || "Active"} •{" "}
                      {s.lastActiveAt
                        ? new Date(s.lastActiveAt).toLocaleDateString()
                        : "Current Session"}
                    </Text>
                  </View>

                  {!s.isCurrent ? (
                    <TouchableOpacity
                      style={styles.revokeSingleButton}
                      onPress={() => handleRevokeSession(s)}
                    >
                      <Ionicons name="close" size={18} color="#FF5252" />
                    </TouchableOpacity>
                  ) : null}
                </View>
              </React.Fragment>
            ))
          )}

          <View style={styles.divider} />

          {/* Secure Storage Info */}
          <View style={styles.infoRow}>
            <View style={styles.infoLabelGroup}>
              <Ionicons name="lock-closed-outline" size={18} color="#888888" />
              <Text style={styles.infoLabel}>Token Storage</Text>
            </View>
            <Text style={styles.secureStorageText}>Expo SecureStore</Text>
          </View>
        </View>

        {/* Log Out Action */}
        <TouchableOpacity
          style={[styles.logoutButton, isLoggingOut && styles.buttonDisabled]}
          onPress={handleLogout}
          disabled={isLoggingOut}
          activeOpacity={0.82}
        >
          {isLoggingOut ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Ionicons
                name="log-out-outline"
                size={20}
                color="#FFFFFF"
                style={{ marginRight: 8 }}
              />
              <Text style={styles.logoutText}>Log Out</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Edit Username Modal */}
      <Modal
        visible={isEditModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsEditModalOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalBackdrop}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Update Username</Text>

            <TextInput
              style={styles.modalInput}
              placeholder="Enter new username"
              placeholderTextColor="#666666"
              value={newUsername}
              onChangeText={setNewUsername}
              autoFocus
              autoCapitalize="none"
              maxLength={30}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setIsEditModalOpen(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalSubmitButton,
                  (!newUsername.trim() || newUsername.trim() === data.userName) &&
                    styles.buttonDisabled,
                ]}
                onPress={handleUpdateUsername}
                disabled={
                  !newUsername.trim() ||
                  newUsername.trim() === data.userName ||
                  isUpdatingProfile
                }
              >
                {isUpdatingProfile ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalSubmitText}>Save</Text>
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
  container: {
    padding: 16,
    paddingBottom: 40,
    backgroundColor: "#121212",
  },
  centerContainer: {
    flex: 1,
    backgroundColor: "#121212",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#FFFFFF",
    letterSpacing: -0.5,
  },
  iconButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: "#1F1F1F",
    borderWidth: 1,
    borderColor: "#2A2A2A",
  },
  avatarCard: {
    backgroundColor: "#1A1A1A",
    borderRadius: 16,
    padding: 22,
    alignItems: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#282828",
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: "#208AEF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
    shadowColor: "#208AEF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 34,
    fontWeight: "bold",
  },
  nameText: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 3,
  },
  emailText: {
    fontSize: 14,
    color: "#888888",
    marginBottom: 10,
  },
  badgeRow: {
    flexDirection: "row",
    marginBottom: 12,
  },
  activeBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    gap: 6,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10B981",
  },
  activeBadgeText: {
    color: "#10B981",
    fontSize: 12,
    fontWeight: "600",
  },
  editProfileButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(32, 138, 239, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(32, 138, 239, 0.3)",
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
  },
  editProfileButtonText: {
    color: "#208AEF",
    fontSize: 13,
    fontWeight: "600",
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
    backgroundColor: "#1A1A1A",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#262626",
  },
  statNumber: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 2,
  },
  statNumberDate: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    color: "#777777",
    fontWeight: "500",
  },
  sectionCard: {
    backgroundColor: "#1A1A1A",
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#262626",
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: "700",
    color: "#888888",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  revokeAllText: {
    color: "#FF5252",
    fontSize: 12,
    fontWeight: "600",
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
  },
  infoLabelGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: "#AAAAAA",
  },
  infoValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  infoValueMuted: {
    fontSize: 13,
    color: "#666666",
    maxWidth: "50%",
  },
  roleBadge: {
    backgroundColor: "rgba(32, 138, 239, 0.18)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  roleBadgeText: {
    color: "#208AEF",
    fontSize: 11,
    fontWeight: "700",
  },
  secureStorageText: {
    color: "#10B981",
    fontSize: 13,
    fontWeight: "600",
  },
  divider: {
    height: 1,
    backgroundColor: "#252525",
  },
  sessionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
  },
  sessionIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#222222",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  sessionDetails: {
    flex: 1,
  },
  sessionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 2,
  },
  deviceName: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  currentDevicePill: {
    backgroundColor: "rgba(32, 138, 239, 0.2)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  currentDevicePillText: {
    color: "#208AEF",
    fontSize: 10,
    fontWeight: "700",
  },
  sessionMeta: {
    color: "#777777",
    fontSize: 11,
  },
  revokeSingleButton: {
    padding: 6,
  },
  emptySessionText: {
    color: "#666666",
    fontSize: 13,
    paddingVertical: 8,
  },
  logoutButton: {
    flexDirection: "row",
    backgroundColor: "#E91E63",
    paddingVertical: 14,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 6,
    shadowColor: "#E91E63",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  logoutText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  loadingText: {
    marginTop: 12,
    color: "#888888",
    fontSize: 15,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#FFFFFF",
    marginTop: 12,
    marginBottom: 6,
  },
  errorText: {
    fontSize: 14,
    color: "#888888",
    textAlign: "center",
    marginBottom: 20,
  },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#208AEF",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  retryButtonText: {
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
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
  },
  modalCancelButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  modalCancelText: {
    color: "#888888",
    fontSize: 14,
    fontWeight: "600",
  },
  modalSubmitButton: {
    backgroundColor: "#208AEF",
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 10,
    minWidth: 80,
    alignItems: "center",
  },
  modalSubmitText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
});
