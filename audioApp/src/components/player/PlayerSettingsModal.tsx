import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSelector, useDispatch } from "react-redux";
import { AppState } from "@/store/hook";
import {
  setPlaybackRate,
  setSelectedQuality,
  setAudioQuality,
  setSleepTimer,
} from "@/store/playerSlice";
import { audioPlayerService } from "@/service/audioPlayerService";
import { VideoQuality, AudioQuality } from "@/types";

export interface QualityChoice<T extends string> {
  id: T;
  label: string;
}

export interface PlayerSettingsModalProps {
  visible: boolean;
  onClose: () => void;
  mode?: "audio" | "video";
  useNativeModal?: boolean;
  /**
   * Qualities that actually exist for the current media. "Auto" is always added.
   * If a mode has no real choices, its Quality row is hidden.
   */
  videoQualities?: QualityChoice<VideoQuality>[];
  audioQualities?: QualityChoice<AudioQuality>[];
  onSpeedChange?: (speed: number) => void;
  onQualityChange?: (quality: VideoQuality) => void;
  onAudioQualityChange?: (quality: AudioQuality) => void;
}

type SettingsSubView = "main" | "quality" | "speed" | "timer";

const SPEED_OPTIONS = [
  { rate: 0.25, label: "0.25x" },
  { rate: 0.5, label: "0.5x" },
  { rate: 0.75, label: "0.75x" },
  { rate: 1.0, label: "Normal", isDefault: true },
  { rate: 1.25, label: "1.25x" },
  { rate: 1.5, label: "1.5x" },
  { rate: 1.75, label: "1.75x" },
  { rate: 2.0, label: "2.0x" },
];

const SLEEP_TIMER_OPTIONS: Array<{ value: number | null; label: string; isDefault?: boolean }> = [
  { value: null, label: "Off", isDefault: true },
  { value: 10, label: "10 minutes" },
  { value: 15, label: "15 minutes" },
  { value: 30, label: "30 minutes" },
  { value: 45, label: "45 minutes" },
  { value: 60, label: "60 minutes" },
  { value: -1, label: "End of track" },
];

function OptionRow({
  label,
  selected,
  isDefault,
  onPress,
}: {
  label: string;
  selected: boolean;
  isDefault?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.optionRow, selected && styles.optionRowActive]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={styles.checkSlot}>
        {selected ? <Ionicons name="checkmark" size={18} color="#FFFFFF" /> : null}
      </View>
      <Text style={[styles.optionText, selected && styles.optionTextActive]}>
        {label}
      </Text>
      {isDefault ? (
        <View style={styles.defaultBadge}>
          <Text style={styles.defaultBadgeText}>Default</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

export function PlayerSettingsModal({
  visible,
  onClose,
  mode = "audio",
  useNativeModal = true,
  videoQualities,
  audioQualities,
  onSpeedChange,
  onQualityChange,
  onAudioQualityChange,
}: PlayerSettingsModalProps) {
  const dispatch = useDispatch();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isLandscape = windowWidth > windowHeight;

  const [activeView, setActiveView] = useState<SettingsSubView>("main");

  useEffect(() => {
    if (visible) setActiveView("main");
  }, [visible]);

  const currentRate = useSelector((state: AppState) => state.player.playbackRate ?? 1.0);
  const selectedQuality = useSelector((state: AppState) => state.player.selectedQuality ?? "auto");
  const audioQuality = useSelector((state: AppState) => state.player.audioQuality ?? "auto");
  const sleepTimer = useSelector((state: AppState) => state.player.sleepTimer);

  // Only offer what the current media really has, plus Auto
  const qualityOptions: QualityChoice<string>[] = [
    { id: "auto", label: "Auto" },
    ...((mode === "audio" ? audioQualities : videoQualities) ?? []).filter(
      (q) => q.id !== "auto"
    ),
  ];
  const hasQualityChoices = qualityOptions.length > 1;

  const storedQuality = mode === "audio" ? audioQuality : selectedQuality;
  // If the stored choice isn't available for this media, we're effectively on Auto
  const effectiveQuality = qualityOptions.some((o) => o.id === storedQuality)
    ? storedQuality
    : "auto";
  const qualityDisplayValue =
    qualityOptions.find((o) => o.id === effectiveQuality)?.label ?? "Auto";
  const qualityTitle = mode === "audio" ? "Audio quality" : "Quality";

  const speedLabel = currentRate === 1.0 ? "Normal" : `${currentRate}x`;
  const sleepLabel =
    sleepTimer === null ? "Off" : sleepTimer === -1 ? "End of track" : `${sleepTimer}m`;

  const handleSelectSpeed = (rate: number) => {
    dispatch(setPlaybackRate(rate));
    audioPlayerService.setPlaybackRate(rate);
    onSpeedChange?.(rate);
    onClose();
  };

  const handleSelectQuality = (id: string) => {
    if (mode === "audio") {
      dispatch(setAudioQuality(id as AudioQuality));
      onAudioQualityChange?.(id as AudioQuality);
    } else {
      dispatch(setSelectedQuality(id as VideoQuality));
      onQualityChange?.(id as VideoQuality);
    }
    onClose();
  };

  const handleSelectSleepTimer = (val: number | null) => {
    dispatch(setSleepTimer(val));
    audioPlayerService.setSleepTimer(val);
    onClose();
  };

  if (!visible) return null;

  const menuRows: Array<{
    key: SettingsSubView;
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    value: string;
    show: boolean;
  }> = [
    {
      key: "quality",
      icon: mode === "audio" ? "musical-notes-outline" : "options-outline",
      title: qualityTitle,
      value: qualityDisplayValue,
      show: hasQualityChoices,
    },
    { key: "speed", icon: "speedometer-outline", title: "Playback speed", value: speedLabel, show: true },
    { key: "timer", icon: "moon-outline", title: "Sleep timer", value: sleepLabel, show: true },
  ];

  const content = (
    <View style={styles.backdrop}>
      <TouchableOpacity
        style={styles.backdropDismiss}
        activeOpacity={1}
        onPress={onClose}
      />

      <View
        style={[
          styles.popupCard,
          {
            width: isLandscape
              ? Math.min(windowWidth - 96, 360)
              : Math.min(windowWidth - 36, 350),
            maxHeight: isLandscape
              ? Math.min(windowHeight - 32, 300)
              : Math.min(windowHeight * 0.72, 440),
          },
        ]}
      >
        <View style={styles.header}>
          {activeView === "main" ? (
            <Text style={styles.headerTitle}>Settings</Text>
          ) : (
            <TouchableOpacity
              style={styles.backButtonRow}
              onPress={() => setActiveView("main")}
              activeOpacity={0.7}
              hitSlop={12}
            >
              <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
              <Text style={styles.headerTitle}>
                {activeView === "quality"
                  ? qualityTitle
                  : activeView === "speed"
                  ? "Playback speed"
                  : "Sleep timer"}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            hitSlop={12}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          bounces={false}
          contentContainerStyle={styles.scrollContent}
        >
          {activeView === "main" ? (
            <View style={styles.menuList}>
              {menuRows
                .filter((r) => r.show)
                .map((row) => (
                  <TouchableOpacity
                    key={row.key}
                    style={styles.menuRow}
                    onPress={() => setActiveView(row.key)}
                    activeOpacity={0.75}
                  >
                    <View style={styles.menuRowLeft}>
                      <Ionicons name={row.icon} size={20} color="#FFFFFF" style={styles.menuIcon} />
                      <Text style={styles.menuRowTitle}>{row.title}</Text>
                    </View>
                    <View style={styles.menuRowRight}>
                      <Text style={styles.menuRowValue}>{row.value}</Text>
                      <Ionicons name="chevron-forward" size={15} color="#5A5A5A" />
                    </View>
                  </TouchableOpacity>
                ))}
            </View>
          ) : null}

          {activeView === "quality" ? (
            <View style={styles.optionsList}>
              {qualityOptions.map((opt) => (
                <OptionRow
                  key={opt.id}
                  label={opt.label}
                  selected={effectiveQuality === opt.id}
                  isDefault={opt.id === "auto"}
                  onPress={() => handleSelectQuality(opt.id)}
                />
              ))}
            </View>
          ) : null}

          {activeView === "speed" ? (
            <View style={styles.optionsList}>
              {SPEED_OPTIONS.map((opt) => (
                <OptionRow
                  key={opt.rate}
                  label={opt.label}
                  selected={currentRate === opt.rate}
                  isDefault={opt.isDefault}
                  onPress={() => handleSelectSpeed(opt.rate)}
                />
              ))}
            </View>
          ) : null}

          {activeView === "timer" ? (
            <View style={styles.optionsList}>
              {SLEEP_TIMER_OPTIONS.map((opt) => (
                <OptionRow
                  key={String(opt.value)}
                  label={opt.label}
                  selected={sleepTimer === opt.value}
                  isDefault={opt.isDefault}
                  onPress={() => handleSelectSleepTimer(opt.value)}
                />
              ))}
            </View>
          ) : null}
        </ScrollView>
      </View>
    </View>
  );

  if (useNativeModal) {
    return (
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={onClose}
        supportedOrientations={["portrait", "landscape-left", "landscape-right"]}
      >
        {content}
      </Modal>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0, 0, 0, 0.72)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 999999,
    elevation: 999999,
  },
  backdropDismiss: { ...StyleSheet.absoluteFill },
  popupCard: {
    alignSelf: "center",
    backgroundColor: "#000000",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#262626",
    overflow: "hidden",
    paddingTop: 16,
    paddingBottom: 10,
    paddingHorizontal: 18,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 12,
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  backButtonRow: { flexDirection: "row", alignItems: "center", gap: 2, marginLeft: -4 },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#151515",
    borderWidth: 1,
    borderColor: "#262626",
    justifyContent: "center",
    alignItems: "center",
  },
  scrollContent: { paddingVertical: 2 },
  menuList: { paddingVertical: 2 },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 2,
  },
  menuRowLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  menuIcon: { width: 22, textAlign: "center" },
  menuRowTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  menuRowRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  menuRowValue: { color: "#8A8A8A", fontSize: 13.5 },
  optionsList: { paddingVertical: 2 },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 11,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  optionRowActive: { backgroundColor: "#151515" },
  checkSlot: { width: 26, alignItems: "flex-start" },
  optionText: { color: "#8A8A8A", fontSize: 15, fontWeight: "500", flex: 1 },
  optionTextActive: { color: "#FFFFFF", fontWeight: "800", letterSpacing: -0.2 },
  defaultBadge: {
    backgroundColor: "#151515",
    borderWidth: 1,
    borderColor: "#262626",
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
  },
  defaultBadgeText: { color: "#8A8A8A", fontSize: 11, fontWeight: "600" },
});