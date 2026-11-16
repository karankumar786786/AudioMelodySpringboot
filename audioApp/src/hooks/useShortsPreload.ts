import { useEffect } from "react";
import { Image } from "expo-image";
import { preload } from "expo-audio";
import { Song } from "@/types";
import { resolveStreamUrl } from "@/service";
import { getImageUrl, getVideoUrl } from "@/utils/imageUtils";

interface UseShortsPreloadOptions {
  songs: Song[];
  activeIndex: number;
  isScreenFocused: boolean;
}

/**
 * Eagerly preloads assets for the upcoming 3 shorts AND the previous 1 short
 * (for quick back-swipes).
 *
 * Per-short it preloads:
 *  1. Artwork image (expo-image cache)
 *  2. Audio stream — 15 s forward buffer via expo-audio `preload()` with
 *     the correct `{ uri }` AudioSource shape (Phase 2B fix)
 *  3. Canvas video — prefetch via expo-image (handles HTTP cache headers)
 *
 * Raw `fetch()` calls for HLS streams are intentionally removed (Phase 2C) —
 * they only download the M3U8 playlist manifest, not audio segments, and
 * offer zero real buffering benefit.
 */
export function useShortsPreload({
  songs,
  activeIndex,
  isScreenFocused,
}: UseShortsPreloadOptions) {
  useEffect(() => {
    if (!isScreenFocused || songs.length === 0) return;

    // Preload N-1 (back-swipe) through N+3 (look-ahead), excluding the active slide
    const preloadWindow = songs.slice(
      Math.max(0, activeIndex - 1),
      activeIndex + 4
    );

    for (const track of preloadWindow) {
      if (!track) continue;

      // 1. Artwork
      if (track.imageKey) {
        const imgUrl = getImageUrl(track.imageKey, { width: 800, height: 1400 });
        if (imgUrl) {
          Image.prefetch(imgUrl).catch(() => {});
        }
      }

      // 2. Audio stream — correct AudioSource object (Phase 2B)
      const streamUrl = resolveStreamUrl(track);
      if (streamUrl) {
        preload(
          { uri: streamUrl },
          { preferredForwardBufferDuration: 15 }
        ).catch(() => {});
        // Note: raw fetch(streamUrl) intentionally removed (Phase 2C) —
        // HLS fetch only downloads M3U8 manifest, not audio segments.
      }

      // 3. Canvas video — use expo-image prefetch (respects HTTP cache headers)
      const videoKey = track.videoKey || track.fullVideoKey;
      const canvasVideoUrl =
        (track as any)?.canvasVideoUrl ||
        (videoKey ? getVideoUrl(videoKey) : null);
      if (canvasVideoUrl) {
        Image.prefetch(canvasVideoUrl).catch(() => {});
      }
    }
  }, [activeIndex, songs, isScreenFocused]);
}
