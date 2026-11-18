import { useEffect, useMemo, useRef, useState } from "react";
import { LayoutAnimation, Platform, UIManager } from "react-native";
import { audioPlayerService } from "@/service/audioPlayerService";
import { getVideoUrl, S3_BASE_URL } from "@/utils";
import { hapticFeedback } from "@/utils/haptics";
import { Song, PlayerSong } from "@/types";

export type ViewMode = "canvas" | "artwork";
export type StageMode = "canvas" | "artwork" | "video";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/** Pure: whether a song has a usable canvas (looping background video) key. */
export function songHasCanvas(song: Song | PlayerSong | null | undefined): boolean {
  return Boolean(
    song?.videoKey &&
      typeof song.videoKey === "string" &&
      song.videoKey.trim().length > 0 &&
      song.videoKey !== "null" &&
      song.videoKey !== "undefined"
  );
}

/**
 * Canvas / Artwork / Video stage switching for the song screen, including the
 * full-video modal open state and auto-opening it for `mode=video` deep links.
 */
export function usePlayerStageModes(
  activeSong: Song | PlayerSong | null | undefined,
  mode: string | undefined
) {
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(mode === "video");
  const [viewMode, setViewMode] = useState<ViewMode>(mode === "video" ? "artwork" : "canvas");
  const autoOpenedVideoIdRef = useRef<string | null>(null);

  const hasCanvas = songHasCanvas(activeSong);

  const effectiveVideoUrl = useMemo(() => {
    if (activeSong?.fullVideoKey) {
      return `${S3_BASE_URL}/${activeSong.fullVideoKey}/master.m3u8`;
    }
    if (activeSong?.videoKey) {
      return getVideoUrl(activeSong.videoKey);
    }
    return undefined;
  }, [activeSong?.fullVideoKey, activeSong?.videoKey]);

  const hasFullVideo = Boolean(effectiveVideoUrl);

  // Automatically open video section if pushed with mode="video"
  useEffect(() => {
    if (mode === "video") {
      audioPlayerService.pause();
      if (
        activeSong?.id &&
        effectiveVideoUrl &&
        autoOpenedVideoIdRef.current !== String(activeSong.id)
      ) {
        autoOpenedVideoIdRef.current = String(activeSong.id);
        setIsVideoModalOpen(true);
      }
    }
  }, [mode, activeSong?.id, effectiveVideoUrl]);

  const effectiveViewMode: ViewMode = hasCanvas ? viewMode : "artwork";

  const availableModes = useMemo(() => {
    const modes: Array<{ key: StageMode; label: string }> = [];
    if (hasCanvas) {
      modes.push({ key: "canvas", label: "Canvas" });
    }
    modes.push({ key: "artwork", label: "Artwork" });
    if (hasFullVideo) {
      modes.push({ key: "video", label: "Video" });
    }
    return modes;
  }, [hasCanvas, hasFullVideo]);

  const currentTrackId = activeSong?.id ? String(activeSong.id) : undefined;
  const lastTrackIdRef = useRef<string | undefined>(currentTrackId);
  useEffect(() => {
    if (currentTrackId && currentTrackId !== lastTrackIdRef.current) {
      lastTrackIdRef.current = currentTrackId;
      if (hasCanvas && mode !== "video") {
        setViewMode("canvas");
      } else {
        setViewMode("artwork");
      }
    } else if (!hasCanvas && viewMode === "canvas") {
      setViewMode("artwork");
    }
  }, [currentTrackId, hasCanvas, viewMode, mode]);

  const handleSelectMode = (targetMode: StageMode) => {
    hapticFeedback.selection();
    if (targetMode === "video") {
      audioPlayerService.pause();
      setIsVideoModalOpen(true);
      return;
    }
    if (targetMode !== viewMode) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setViewMode(targetMode);
    }
  };

  const handleNextMode = () => {
    if (availableModes.length <= 1) return;
    const modeIdx = availableModes.findIndex((m) => m.key === effectiveViewMode);
    if (modeIdx >= 0 && modeIdx < availableModes.length - 1) {
      handleSelectMode(availableModes[modeIdx + 1].key);
    }
  };

  const handlePrevMode = () => {
    if (availableModes.length <= 1) return;
    const modeIdx = availableModes.findIndex((m) => m.key === effectiveViewMode);
    if (modeIdx > 0) {
      handleSelectMode(availableModes[modeIdx - 1].key);
    }
  };

  return {
    hasCanvas,
    effectiveVideoUrl,
    effectiveViewMode,
    availableModes,
    isVideoModalOpen,
    setIsVideoModalOpen,
    setViewMode,
    handleSelectMode,
    handleNextMode,
    handlePrevMode,
  };
}
