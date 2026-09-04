"use client";

import { useEffect, useRef, useState } from "react";
import { playerStore } from "@/store/player.store";
import { useStore } from "@tanstack/react-store";
import { type PlayerSong } from "@/lib/player-utils";

export interface PreloadState {
  nextSong: PlayerSong | null;
  isPreloaded: boolean;
  standbyAudioElement: HTMLAudioElement | null;
}

export function useNextTrackPreloader(standbyAudioElement: HTMLAudioElement | null) {
  const queue = useStore(playerStore, (s) => s.queue);
  const lastQueueIndex = useStore(playerStore, (s) => s.lastQueueIndex);
  const repeatMode = useStore(playerStore, (s) => s.repeatMode);
  const currentSong = useStore(playerStore, (s) => s.currentSong);

  const standbyHlsRef = useRef<any>(null);
  const preloadedSongIdRef = useRef<string | null>(null);
  const [isPreloaded, setIsPreloaded] = useState(false);

  // Compute the upcoming track
  const nextSong: PlayerSong | null = (() => {
    if (!queue || queue.length === 0) return null;
    const nextIdx = lastQueueIndex + 1;
    if (nextIdx < queue.length) {
      return queue[nextIdx];
    }
    if (repeatMode === "all" && queue.length > 0) {
      return queue[0];
    }
    return null;
  })();

  useEffect(() => {
    // If no next song or no standby element, cleanup standby HLS
    if (!standbyAudioElement || !nextSong?.streamUrl || nextSong.id === currentSong?.id) {
      if (standbyHlsRef.current) {
        standbyHlsRef.current.destroy();
        standbyHlsRef.current = null;
      }
      preloadedSongIdRef.current = null;
      setIsPreloaded(false);
      return;
    }

    // If already preloaded this exact next song, avoid re-initialization
    if (preloadedSongIdRef.current === nextSong.id && standbyHlsRef.current) {
      return;
    }

    let isMounted = true;
    let hlsInstance: any = null;

    const preloadNextTrack = async () => {
      try {
        if (standbyHlsRef.current) {
          standbyHlsRef.current.destroy();
          standbyHlsRef.current = null;
        }

        console.log(`[Gapless Preloader] 🚀 Pre-buffering next track: "${nextSong.title}" (${nextSong.id})`);
        preloadedSongIdRef.current = nextSong.id;
        setIsPreloaded(false);

        const HlsModule = await import("hls.js");
        const Hls = HlsModule.default;

        if (Hls.isSupported()) {
          hlsInstance = new Hls({
            enableWorker: true,
            lowLatencyMode: false,
            // Pre-buffer initial 10-15 seconds of the upcoming track
            maxBufferLength: 15,
            maxMaxBufferLength: 20,
            backBufferLength: 0,
            autoStartLoad: true,
          });

          standbyHlsRef.current = hlsInstance;
          hlsInstance.attachMedia(standbyAudioElement);

          hlsInstance.on(Hls.Events.MEDIA_ATTACHED, () => {
            if (isMounted) {
              hlsInstance.loadSource(nextSong.streamUrl);
            }
          });

          hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
            if (!isMounted) return;
            console.log(`[Gapless Preloader] Manifest parsed for upcoming track: "${nextSong.title}"`);
          });

          hlsInstance.on(Hls.Events.FRAG_BUFFERED, () => {
            if (!isMounted) return;
            setIsPreloaded(true);
            console.log(`[Gapless Preloader] ✅ Initial audio segments buffered for: "${nextSong.title}"`);
          });

          hlsInstance.on(Hls.Events.ERROR, (_event: any, data: any) => {
            if (data.fatal) {
              console.warn("[Gapless Preloader] Standby HLS fatal error, releasing:", data.details);
              if (hlsInstance) {
                hlsInstance.destroy();
                standbyHlsRef.current = null;
              }
              preloadedSongIdRef.current = null;
              setIsPreloaded(false);
            }
          });
        } else if (standbyAudioElement.canPlayType("application/vnd.apple.mpegurl")) {
          // Native Safari HLS prefetch
          standbyAudioElement.src = nextSong.streamUrl;
          standbyAudioElement.preload = "auto";
          setIsPreloaded(true);
        }
      } catch (err) {
        console.warn("[Gapless Preloader] Failed to pre-buffer next track:", err);
      }
    };

    // Delay slightly (400ms) to ensure current song playback starts smoothly without resource contention
    const timer = setTimeout(() => {
      preloadNextTrack();
    }, 400);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      if (hlsInstance) {
        hlsInstance.destroy();
        standbyHlsRef.current = null;
      }
    };
  }, [nextSong?.id, nextSong?.streamUrl, standbyAudioElement, currentSong?.id]);

  return {
    nextSong,
    isPreloaded,
    standbyHls: standbyHlsRef.current,
  };
}
