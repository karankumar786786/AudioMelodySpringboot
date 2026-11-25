import React, { useEffect, useMemo, useRef } from "react";
import { StyleSheet } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEvent } from "expo";
import { Short, shortMediaUrl } from "@/service/shortsService";

interface Props {
  short: Short;
  /** This is the short on screen: it plays with sound. */
  active: boolean;
  /** The next short: buffered but paused, so swiping is instant. */
  preload: boolean;
  paused: boolean;
  onProgress?: (positionMs: number, durationMs: number) => void;
  /** Called with how long it was watched when it stops being active. */
  onWatched?: (watchedMs: number) => void;
}

/**
 * One short's video with its own audio (HLS). Unlike the canvas background loop it is
 * not muted; only the active item plays.
 */
export function ShortVideo({ short, active, preload, paused, onProgress, onWatched }: Props) {
  const source = useMemo(() => ({ uri: shortMediaUrl(short.hlsKey) }), [short.hlsKey]);
  const player = useVideoPlayer(source, (p) => {
    p.loop = true;
    p.muted = false;
    p.staysActiveInBackground = false;
    p.showNowPlayingNotification = false;
    p.timeUpdateEventInterval = 0.25;
  });
  const watchedSince = useRef<number | null>(null);
  const watchedMs = useRef(0);

  useEffect(() => {
    if (active && !paused) {
      player.play();
      watchedSince.current = Date.now();
    } else {
      player.pause();
      if (watchedSince.current != null) {
        watchedMs.current += Date.now() - watchedSince.current;
        watchedSince.current = null;
      }
    }
  }, [active, paused, player]);

  // Report the watch time once the short leaves the screen, then start again from 0.
  useEffect(() => {
    if (!active && watchedMs.current > 0) {
      onWatched?.(watchedMs.current);
      watchedMs.current = 0;
      try {
        player.currentTime = 0;
      } catch {}
    }
  }, [active, onWatched, player]);

  const time = useEvent(player, "timeUpdate");
  useEffect(() => {
    if (active && time && onProgress) {
      onProgress(time.currentTime * 1000, (player.duration || (short.durationMs ?? 0) / 1000) * 1000);
    }
  }, [active, time, onProgress, player, short.durationMs]);

  if (!active && !preload) return null;
  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      contentFit="cover"
      nativeControls={false}
      allowsPictureInPicture={false}
    />
  );
}
