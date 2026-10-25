import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, AppState, clearAuthToken, loadUserProfile } from "@/store";
import { useQueryClient } from "@tanstack/react-query";
import { sessionService } from "@/service";
import { Ionicons } from "@expo/vector-icons";

export default function ProfileScreen() {
  const dispatch = useDispatch<AppDispatch>();
  const queryClient = useQueryClient();
  const deviceId = useSelector((state: AppState) => state.device.deviceId);
  const refreshToken = useSelector((state: AppState) => state.auth.refreshToken);
  const userState = useSelector((state: AppState) => state.user);

  const data = userState.profile;
  const isLoading = userState.isLoading && !data;
  const error = userState.error;

  React.useEffect(() => {
    if (!data) {
      dispatch(loadUserProfile());
    }
  }, [data, dispatch]);

  const handleLogout = async () => {
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
    }
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
        <Ionicons name="alert-circle-outline" size={48} color="#FF5252" />
        <Text style={styles.errorTitle}>Failed to load profile</Text>
        <Text style={styles.errorText}>{error || "Something went wrong"}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => dispatch(loadUserProfile())}
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.screenTitle}>Profile</Text>

        {/* Profile Avatar & Header */}
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <Text style={styles.userName}>{data.userName || "No Username"}</Text>
          <Text style={styles.userEmail}>{data.email}</Text>
        </View>

        {/* Profile Details Card */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Account Information</Text>

          <View style={styles.row}>
            <View style={styles.rowLabelContainer}>
              <Ionicons name="person-outline" size={18} color="#888888" />
              <Text style={styles.rowLabel}>Username</Text>
            </View>
            <Text style={styles.rowValue}>{data.userName || "N/A"}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.row}>
            <View style={styles.rowLabelContainer}>
              <Ionicons name="mail-outline" size={18} color="#888888" />
              <Text style={styles.rowLabel}>Email</Text>
            </View>
            <Text style={styles.rowValue}>{data.email}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.row}>
            <View style={styles.rowLabelContainer}>
              <Ionicons name="shield-checkmark-outline" size={18} color="#888888" />
              <Text style={styles.rowLabel}>Role</Text>
            </View>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{data.role || "USER"}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.row}>
            <View style={styles.rowLabelContainer}>
              <Ionicons name="checkmark-circle-outline" size={18} color="#888888" />
              <Text style={styles.rowLabel}>Status</Text>
            </View>
            <View style={[styles.badge, styles.statusBadge]}>
              <Text style={[styles.badgeText, styles.statusBadgeText]}>
                {data.status || "ACTIVE"}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.row}>
            <View style={styles.rowLabelContainer}>
              <Ionicons name="calendar-outline" size={18} color="#888888" />
              <Text style={styles.rowLabel}>Member Since</Text>
            </View>
            <Text style={styles.rowValue}>{formattedDate}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.row}>
            <View style={styles.rowLabelContainer}>
              <Ionicons name="finger-print-outline" size={18} color="#888888" />
              <Text style={styles.rowLabel}>User ID</Text>
            </View>
            <Text style={styles.rowValueMuted} numberOfLines={1}>
              {data.id}
            </Text>
          </View>
        </View>

        {/* Log Out Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#121212",
  },
  container: {
    padding: 20,
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
  screenTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 20,
  },
  header: {
    alignItems: "center",
    marginBottom: 24,
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: "#208AEF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 34,
    fontWeight: "bold",
  },
  userName: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: "#B3B3B3",
  },
  card: {
    backgroundColor: "#1E1E1E",
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: "#2A2A2A",
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 14,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
  },
  rowLabelContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  rowLabel: {
    fontSize: 14,
    color: "#B3B3B3",
  },
  rowValue: {
    fontSize: 14,
    fontWeight: "500",
    color: "#FFFFFF",
    maxWidth: "55%",
    textAlign: "right",
  },
  rowValueMuted: {
    fontSize: 13,
    color: "#777777",
    maxWidth: "55%",
    textAlign: "right",
  },
  badge: {
    backgroundColor: "#2A2A2A",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    color: "#208AEF",
    fontSize: 12,
    fontWeight: "600",
  },
  statusBadge: {
    backgroundColor: "rgba(29, 185, 84, 0.15)",
  },
  statusBadgeText: {
    color: "#1DB954",
  },
  divider: {
    height: 1,
    backgroundColor: "#2A2A2A",
  },
  logoutButton: {
    flexDirection: "row",
    backgroundColor: "#E91E63",
    paddingVertical: 14,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  logoutText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  loadingText: {
    marginTop: 12,
    color: "#B3B3B3",
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
    color: "#B3B3B3",
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
    fontSize: 15,
    fontWeight: "600",
  },
});
