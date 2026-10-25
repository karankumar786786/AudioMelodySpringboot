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

export interface PlayerSettingsModalProps {
  visible: boolean;
  onClose: () => void;
  mode?: "audio" | "video";
  useNativeModal?: boolean;
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

const VIDEO_QUALITY_OPTIONS: Array<{ id: VideoQuality; label: string; isDefault?: boolean }> = [
  { id: "auto", label: "Auto", isDefault: true },
  { id: "1080p", label: "1080p (Full HD)" },
  { id: "720p", label: "720p (HD)" },
  { id: "480p", label: "480p" },
  { id: "360p", label: "360p" },
];

const AUDIO_QUALITY_OPTIONS: Array<{ id: AudioQuality; label: string; isDefault?: boolean }> = [
  { id: "auto", label: "Auto", isDefault: true },
  { id: "lossless", label: "Lossless (Hi-Fi 24-bit)" },
  { id: "high", label: "High (320 kbps)" },
  { id: "standard", label: "Standard (160 kbps)" },
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

export function PlayerSettingsModal({
  visible,
  onClose,
  mode = "audio",
  useNativeModal = true,
  onSpeedChange,
  onQualityChange,
  onAudioQualityChange,
}: PlayerSettingsModalProps) {
  const dispatch = useDispatch();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isLandscape = windowWidth > windowHeight;

  const [activeView, setActiveView] = useState<SettingsSubView>("main");

  // Reset to root view whenever modal opens
  useEffect(() => {
    if (visible) {
      setActiveView("main");
    }
  }, [visible]);

  const currentRate = useSelector((state: AppState) => state.player.playbackRate ?? 1.0);
  const selectedQuality = useSelector((state: AppState) => state.player.selectedQuality ?? "auto");
  const audioQuality = useSelector((state: AppState) => state.player.audioQuality ?? "auto");
  const sleepTimer = useSelector((state: AppState) => state.player.sleepTimer);

  const speedLabel = currentRate === 1.0 ? "Normal" : `${currentRate}x`;
  const videoQualityLabel = selectedQuality === "auto" ? "Auto" : selectedQuality;
  const audioQualityLabel =
    audioQuality === "auto"
      ? "Auto"
      : audioQuality === "lossless"
      ? "Lossless"
      : audioQuality === "high"
      ? "High"
      : "Standard";

  const sleepLabel =
    sleepTimer === null
      ? "Off"
      : sleepTimer === -1
      ? "End of track"
      : `${sleepTimer}m`;

  const qualityTitle = mode === "audio" ? "Audio quality" : "Quality";
  const qualityDisplayValue = mode === "audio" ? audioQualityLabel : videoQualityLabel;

  const handleSelectSpeed = (rate: number) => {
    dispatch(setPlaybackRate(rate));
    audioPlayerService.setPlaybackRate(rate);
    onSpeedChange?.(rate);
    onClose();
  };

  const handleSelectVideoQuality = (q: VideoQuality) => {
    dispatch(setSelectedQuality(q));
    onQualityChange?.(q);
    onClose();
  };

  const handleSelectAudioQuality = (q: AudioQuality) => {
    dispatch(setAudioQuality(q));
    onAudioQualityChange?.(q);
    onClose();
  };

  const handleSelectSleepTimer = (val: number | null) => {
    dispatch(setSleepTimer(val));
    audioPlayerService.setSleepTimer(val);
    onClose();
  };

  if (!visible) return null;

  const content = (
    <View style={[styles.backdrop, isLandscape && styles.backdropLandscape]}>
      {/* Tap backdrop to dismiss */}
      <TouchableOpacity
        style={styles.backdropDismiss}
        activeOpacity={1}
        onPress={onClose}
      />

      {/* Floating Small Popup Card */}
      <View
        style={[
          styles.popupCard,
          isLandscape ? styles.popupCardLandscape : styles.popupCardPortrait,
          {
            width: isLandscape
              ? Math.min(windowWidth - 96, 360)
              : Math.min(windowWidth - 40, 350),
            maxHeight: isLandscape
              ? Math.min(windowHeight - 32, 300)
              : Math.min(windowHeight * 0.72, 400),
          },
        ]}
      >
        {/* Header */}
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
              <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
              <Text style={styles.subHeaderTitle}>
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
            <Ionicons name="close" size={18} color="rgba(255, 255, 255, 0.75)" />
          </TouchableOpacity>
        </View>

        {/* Scrollable Content */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          bounces={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* MAIN MENU */}
          {activeView === "main" ? (
            <View style={styles.menuList}>
              {/* 1. Quality (Audio quality in canvas/artwork mode, Video quality in video mode) */}
              <TouchableOpacity
                style={styles.menuRow}
                onPress={() => setActiveView("quality")}
                activeOpacity={0.75}
              >
                <View style={styles.menuRowLeft}>
                  <Ionicons
                    name={mode === "audio" ? "musical-notes-outline" : "options-outline"}
                    size={20}
                    color="#FFFFFF"
                    style={styles.menuIcon}
                  />
                  <Text style={styles.menuRowTitle}>{qualityTitle}</Text>
                </View>

                <View style={styles.menuRowRight}>
                  <Text style={styles.menuRowValue}>{qualityDisplayValue}</Text>
                  <Ionicons
                    name="chevron-forward"
                    size={15}
                    color="rgba(255, 255, 255, 0.35)"
                  />
                </View>
              </TouchableOpacity>

              {/* 2. Playback speed */}
              <TouchableOpacity
                style={styles.menuRow}
                onPress={() => setActiveView("speed")}
                activeOpacity={0.75}
              >
                <View style={styles.menuRowLeft}>
                  <Ionicons
                    name="speedometer-outline"
                    size={20}
                    color="#FFFFFF"
                    style={styles.menuIcon}
                  />
                  <Text style={styles.menuRowTitle}>Playback speed</Text>
                </View>

                <View style={styles.menuRowRight}>
                  <Text style={styles.menuRowValue}>{speedLabel}</Text>
                  <Ionicons
                    name="chevron-forward"
                    size={15}
                    color="rgba(255, 255, 255, 0.35)"
                  />
                </View>
              </TouchableOpacity>

              {/* 3. Sleep timer */}
              <TouchableOpacity
                style={styles.menuRow}
                onPress={() => setActiveView("timer")}
                activeOpacity={0.75}
              >
                <View style={styles.menuRowLeft}>
                  <Ionicons
                    name="moon-outline"
                    size={20}
                    color="#FFFFFF"
                    style={styles.menuIcon}
                  />
                  <Text style={styles.menuRowTitle}>Sleep timer</Text>
                </View>

                <View style={styles.menuRowRight}>
                  <Text style={styles.menuRowValue}>{sleepLabel}</Text>
                  <Ionicons
                    name="chevron-forward"
                    size={15}
                    color="rgba(255, 255, 255, 0.35)"
                  />
                </View>
              </TouchableOpacity>
            </View>
          ) : null}

          {/* SUBVIEW: QUALITY (AUDIO OR VIDEO) */}
          {activeView === "quality" ? (
            <View style={styles.optionsList}>
              {mode === "audio"
                ? AUDIO_QUALITY_OPTIONS.map((opt) => {
                    const isSelected = audioQuality === opt.id;
                    return (
                      <TouchableOpacity
                        key={opt.id}
                        style={styles.optionRow}
                        onPress={() => handleSelectAudioQuality(opt.id)}
                        activeOpacity={0.75}
                      >
                        <View style={styles.checkSlot}>
                          {isSelected ? (
                            <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                          ) : null}
                        </View>
                        <Text
                          style={[
                            styles.optionText,
                            isSelected && styles.optionTextActive,
                          ]}
                        >
                          {opt.label}
                        </Text>
                        {opt.isDefault ? (
                          <View style={styles.defaultBadge}>
                            <Text style={styles.defaultBadgeText}>Default</Text>
                          </View>
                        ) : null}
                      </TouchableOpacity>
                    );
                  })
                : VIDEO_QUALITY_OPTIONS.map((opt) => {
                    const isSelected = selectedQuality === opt.id;
                    return (
                      <TouchableOpacity
                        key={opt.id}
                        style={styles.optionRow}
                        onPress={() => handleSelectVideoQuality(opt.id)}
                        activeOpacity={0.75}
                      >
                        <View style={styles.checkSlot}>
                          {isSelected ? (
                            <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                          ) : null}
                        </View>
                        <Text
                          style={[
                            styles.optionText,
                            isSelected && styles.optionTextActive,
                          ]}
                        >
                          {opt.label}
                        </Text>
                        {opt.isDefault ? (
                          <View style={styles.defaultBadge}>
                            <Text style={styles.defaultBadgeText}>Default</Text>
                          </View>
                        ) : null}
                      </TouchableOpacity>
                    );
                  })}
            </View>
          ) : null}

          {/* SUBVIEW: PLAYBACK SPEED */}
          {activeView === "speed" ? (
            <View style={styles.optionsList}>
              {SPEED_OPTIONS.map((opt) => {
                const isSelected = currentRate === opt.rate;
                return (
                  <TouchableOpacity
                    key={opt.rate}
                    style={styles.optionRow}
                    onPress={() => handleSelectSpeed(opt.rate)}
                    activeOpacity={0.75}
                  >
                    <View style={styles.checkSlot}>
                      {isSelected ? (
                        <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                      ) : null}
                    </View>
                    <Text
                      style={[
                        styles.optionText,
                        isSelected && styles.optionTextActive,
                      ]}
                    >
                      {opt.label}
                    </Text>
                    {opt.isDefault ? (
                      <View style={styles.defaultBadge}>
                        <Text style={styles.defaultBadgeText}>Default</Text>
                      </View>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : null}

          {/* SUBVIEW: SLEEP TIMER */}
          {activeView === "timer" ? (
            <View style={styles.optionsList}>
              {SLEEP_TIMER_OPTIONS.map((opt) => {
                const isSelected = sleepTimer === opt.value;
                return (
                  <TouchableOpacity
                    key={String(opt.value)}
                    style={styles.optionRow}
                    onPress={() => handleSelectSleepTimer(opt.value)}
                    activeOpacity={0.75}
                  >
                    <View style={styles.checkSlot}>
                      {isSelected ? (
                        <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                      ) : null}
                    </View>
                    <Text
                      style={[
                        styles.optionText,
                        isSelected && styles.optionTextActive,
                      ]}
                    >
                      {opt.label}
                    </Text>
                    {opt.isDefault ? (
                      <View style={styles.defaultBadge}>
                        <Text style={styles.defaultBadgeText}>Default</Text>
                      </View>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
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
  backdropLandscape: {
    justifyContent: "center",
    alignItems: "center",
  },
  backdropDismiss: {
    ...StyleSheet.absoluteFill,
  },
  popupCard: {
    backgroundColor: "#1E1E1E",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.14)",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 18,
    elevation: 18,
    overflow: "hidden",
    paddingTop: 12,
    paddingBottom: 10,
    paddingHorizontal: 16,
  },
  popupCardPortrait: {
    alignSelf: "center",
  },
  popupCardLandscape: {
    alignSelf: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  backButtonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  subHeaderTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
  closeBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    justifyContent: "center",
    alignItems: "center",
  },
  scrollContent: {
    paddingVertical: 2,
  },
  menuList: {
    paddingVertical: 2,
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 13,
    paddingHorizontal: 2,
  },
  menuRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  menuIcon: {
    width: 22,
    textAlign: "center",
  },
  menuRowTitle: {
    color: "#FFFFFF",
    fontSize: 14.5,
    fontWeight: "500",
  },
  menuRowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  menuRowValue: {
    color: "rgba(255, 255, 255, 0.45)",
    fontSize: 13.5,
    fontWeight: "400",
  },
  optionsList: {
    paddingVertical: 4,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 11,
    paddingHorizontal: 2,
  },
  checkSlot: {
    width: 26,
    alignItems: "flex-start",
  },
  optionText: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 14.5,
    fontWeight: "400",
    flex: 1,
  },
  optionTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  defaultBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.09)",
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 5,
  },
  defaultBadgeText: {
    color: "rgba(255, 255, 255, 0.55)",
    fontSize: 10.5,
    fontWeight: "500",
  },
});
