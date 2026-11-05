import React, { useState } from "react";
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  Share,
  Platform,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useDispatch } from "react-redux";
import { useQueryClient } from "@tanstack/react-query";

import { AppDispatch } from "@/store";
import { updateUserPlaylistPrivacy } from "@/store/userPlaylistSlice";
import { UserPlaylist } from "@/types";
import { hapticFeedback } from "@/utils/haptics";

interface PlaylistAccessModalProps {
  visible: boolean;
  onClose: () => void;
  playlist?: UserPlaylist | null;
  isOwner?: boolean;
}

type PrivacyOptionKey = "PUBLIC" | "SHARE_BY_LINK" | "PRIVATE";

const PRIVACY_OPTIONS: {
  key: PrivacyOptionKey;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  badgeBg: string;
  badgeBorder: string;
}[] = [
  {
    key: "PUBLIC",
    label: "Public",
    description: "Anyone can discover, search, and listen to this playlist.",
    icon: "globe-outline",
    color: "#10B981", // Emerald
    badgeBg: "rgba(16, 185, 129, 0.15)",
    badgeBorder: "rgba(16, 185, 129, 0.4)",
  },
  {
    key: "SHARE_BY_LINK",
    label: "Share by link",
    description: "Unlisted. Only people with the direct share link can listen.",
    icon: "link-outline",
    color: "#3B82F6", // Blue
    badgeBg: "rgba(59, 130, 246, 0.15)",
    badgeBorder: "rgba(59, 130, 246, 0.4)",
  },
  {
    key: "PRIVATE",
    label: "Private",
    description: "Only you can see and listen to this playlist.",
    icon: "lock-closed-outline",
    color: "#F59E0B", // Amber
    badgeBg: "rgba(245, 158, 11, 0.15)",
    badgeBorder: "rgba(245, 158, 11, 0.4)",
  },
];

export function PlaylistAccessModal({
  visible,
  onClose,
  playlist,
  isOwner = false,
}: PlaylistAccessModalProps) {
  const dispatch = useDispatch<AppDispatch>();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

  const [isUpdating, setIsUpdating] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  if (!playlist) return null;

  const currentPrivacy: PrivacyOptionKey =
    (playlist.privacy as PrivacyOptionKey) || "PRIVATE";
  const isCurrentlyPrivate = currentPrivacy === "PRIVATE";

  const shareTokenOrId = playlist.shareToken || playlist.id;
  const shareUrl = `https://audiomelody.com/playlists/shared/${shareTokenOrId}`;

  const showFeedback = (msg: string) => {
    setFeedbackMessage(msg);
    setTimeout(() => {
      setFeedbackMessage(null);
    }, 2500);
  };

  const handleSelectPrivacy = async (newPrivacy: PrivacyOptionKey) => {
    if (!isOwner || isUpdating || newPrivacy === currentPrivacy) return;

    try {
      setIsUpdating(true);
      hapticFeedback.selection();

      await dispatch(
        updateUserPlaylistPrivacy({ playlistId: playlist.id, privacy: newPrivacy })
      ).unwrap();

      queryClient.invalidateQueries({ queryKey: ["user-playlist", playlist.id] });
      queryClient.invalidateQueries({ queryKey: ["user-playlists"] });
      queryClient.invalidateQueries({ queryKey: ["shared-playlist", shareTokenOrId] });

      const label =
        newPrivacy === "PUBLIC"
          ? "Public (Discoverable by everyone)"
          : newPrivacy === "SHARE_BY_LINK"
          ? "Share by link (Unlisted)"
          : "Private (Only you)";

      showFeedback(`Updated to ${label}`);
    } catch (err: any) {
      showFeedback(err?.message || "Failed to update privacy");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleShare = async () => {
    if (isCurrentlyPrivate) {
      showFeedback("Change privacy before sharing");
      hapticFeedback.warning();
      return;
    }

    try {
      hapticFeedback.light();
      await Share.share({
        title: `${playlist.name} - AudioMelody`,
        message: `🎵 Listen to my playlist "${playlist.name}" on AudioMelody:\n${shareUrl}`,
        url: shareUrl,
      });
    } catch {
      // Ignored if user dismissed share dialog
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable style={styles.dismissArea} onPress={onClose} />

        <View
          style={[
            styles.sheetContainer,
            { paddingBottom: Math.max(insets.bottom, 20) },
          ]}
        >
          {/* Drag Handle Bar */}
          <View style={styles.handleContainer}>
            <View style={styles.handleBar} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleWrap}>
              <Text style={styles.headerTitle}>Playlist Access & Sharing</Text>
              <Text style={styles.playlistName} numberOfLines={1}>
                {playlist.name}
              </Text>
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

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Private Warning Banner */}
            {isCurrentlyPrivate && isOwner ? (
              <View style={styles.warningCard}>
                <View style={styles.warningLeft}>
                  <Ionicons name="lock-closed" size={18} color="#F59E0B" />
                  <View style={styles.warningTextWrap}>
                    <Text style={styles.warningTitle}>Playlist is Private</Text>
                    <Text style={styles.warningSubtitle}>
                      Others cannot stream tracks until you enable sharing.
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.warningButton}
                  onPress={() => handleSelectPrivacy("SHARE_BY_LINK")}
                  disabled={isUpdating}
                  activeOpacity={0.8}
                >
                  <Text style={styles.warningButtonText}>Make Shareable</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {/* Privacy Options (Owner Controls) */}
            {isOwner ? (
              <View style={styles.section}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionLabel}>PRIVACY & ACCESS</Text>
                  <Text style={styles.sectionSublabel}>Select who can listen</Text>
                </View>

                <View style={styles.optionsList}>
                  {PRIVACY_OPTIONS.map((opt) => {
                    const isSelected = currentPrivacy === opt.key;

                    return (
                      <TouchableOpacity
                        key={opt.key}
                        style={[
                          styles.optionCard,
                          isSelected && {
                            borderColor: opt.badgeBorder,
                            backgroundColor: opt.badgeBg,
                          },
                        ]}
                        onPress={() => handleSelectPrivacy(opt.key)}
                        disabled={isUpdating}
                        activeOpacity={0.7}
                      >
                        <View
                          style={[
                            styles.optionIconBox,
                            { backgroundColor: `${opt.color}22` },
                          ]}
                        >
                          <Ionicons name={opt.icon} size={20} color={opt.color} />
                        </View>

                        <View style={styles.optionInfo}>
                          <View style={styles.optionTitleRow}>
                            <Text style={styles.optionTitle}>{opt.label}</Text>
                            {isSelected ? (
                              <View
                                style={[
                                  styles.activeBadge,
                                  {
                                    backgroundColor: opt.badgeBg,
                                    borderColor: opt.badgeBorder,
                                  },
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.activeBadgeText,
                                    { color: opt.color },
                                  ]}
                                >
                                  ACTIVE
                                </Text>
                              </View>
                            ) : null}
                          </View>
                          <Text style={styles.optionDesc}>{opt.description}</Text>
                        </View>

                        {isUpdating && isSelected ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ) : null}

            {/* Shareable Link Box */}
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionLabel}>SHAREABLE LINK</Text>
                {isCurrentlyPrivate ? (
                  <Text style={[styles.linkStatusText, { color: "#F59E0B" }]}>
                    Link Disabled (Private)
                  </Text>
                ) : currentPrivacy === "SHARE_BY_LINK" ? (
                  <Text style={[styles.linkStatusText, { color: "#3B82F6" }]}>
                    Unlisted Link Active
                  </Text>
                ) : (
                  <Text style={[styles.linkStatusText, { color: "#10B981" }]}>
                    Public Link Active
                  </Text>
                )}
              </View>

              <View
                style={[
                  styles.linkContainer,
                  isCurrentlyPrivate && styles.linkContainerDisabled,
                ]}
              >
                <Ionicons
                  name="link"
                  size={18}
                  color={isCurrentlyPrivate ? "#555" : "#888"}
                  style={{ marginRight: 8 }}
                />
                <Text
                  style={[
                    styles.linkText,
                    isCurrentlyPrivate && styles.linkTextDisabled,
                  ]}
                  numberOfLines={1}
                >
                  {isCurrentlyPrivate
                    ? "https://audiomelody.com/playlists/shared/••••••••"
                    : shareUrl}
                </Text>
              </View>

              {/* Share Button */}
              <TouchableOpacity
                style={[
                  styles.shareButton,
                  isCurrentlyPrivate && styles.shareButtonDisabled,
                ]}
                onPress={handleShare}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="share-social-outline"
                  size={18}
                  color={isCurrentlyPrivate ? "#666" : "#000000"}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.shareButtonText,
                    isCurrentlyPrivate && styles.shareButtonTextDisabled,
                  ]}
                >
                  {isCurrentlyPrivate ? "Sharing Disabled" : "Share Playlist"}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.72)",
    justifyContent: "flex-end",
  },
  dismissArea: {
    flex: 1,
  },
  sheetContainer: {
    backgroundColor: "#161616",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "85%",
    borderTopWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  handleContainer: {
    alignItems: "center",
    paddingVertical: 10,
  },
  handleBar: {
    width: 38,
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
  headerTitleWrap: {
    flex: 1,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: -0.3,
  },
  playlistName: {
    fontSize: 12,
    color: "#888888",
    marginTop: 2,
  },
  closeButton: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  toastContainer: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 20,
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: "center",
  },
  toastText: {
    color: "#000000",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  scrollContent: {
    padding: 20,
    paddingTop: 14,
    gap: 20,
  },
  warningCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(245, 158, 11, 0.12)",
    borderColor: "rgba(245, 158, 11, 0.35)",
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 12,
  },
  warningLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  warningTextWrap: {
    flex: 1,
  },
  warningTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#F59E0B",
  },
  warningSubtitle: {
    fontSize: 11,
    color: "rgba(245, 158, 11, 0.85)",
    marginTop: 2,
    lineHeight: 15,
  },
  warningButton: {
    backgroundColor: "#F59E0B",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  warningButtonText: {
    color: "#000000",
    fontSize: 11,
    fontWeight: "800",
  },
  section: {
    gap: 10,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#888888",
    letterSpacing: 0.8,
  },
  sectionSublabel: {
    fontSize: 11,
    color: "#666666",
  },
  optionsList: {
    gap: 8,
  },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#1E1E1E",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    gap: 12,
  },
  optionIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  optionInfo: {
    flex: 1,
  },
  optionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  optionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  activeBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  activeBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  optionDesc: {
    fontSize: 11,
    color: "#888888",
    marginTop: 2,
    lineHeight: 15,
  },
  linkStatusText: {
    fontSize: 11,
    fontWeight: "600",
  },
  linkContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1A1A1A",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  linkContainerDisabled: {
    backgroundColor: "#141414",
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  linkText: {
    flex: 1,
    fontSize: 12,
    color: "#CCCCCC",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  linkTextDisabled: {
    color: "#666666",
    fontStyle: "italic",
  },
  shareButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 4,
  },
  shareButtonDisabled: {
    backgroundColor: "#222222",
  },
  shareButtonText: {
    color: "#000000",
    fontSize: 13,
    fontWeight: "700",
  },
  shareButtonTextDisabled: {
    color: "#555555",
  },
});

