"use client";

import { useEffect, useRef, useState } from "react";

interface HlsVideoPlayerProps {
  src: string | undefined; // ABR HLS m3u8 URL
  fallbackSrc?: string | undefined; // Direct MP4 / ?tr=orig URL
  className?: string;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  playsInline?: boolean;
}

/**
 * HlsVideoPlayer — plays ImageKit ABR HLS (ik-master.m3u8) streams.
 * If ABR HLS transcoding is in progress or unavailable on ImageKit,
 * automatically and instantly falls back to direct MP4 streaming so
 * video canvas always plays seamlessly without interruption.
 */
export function HlsVideoPlayer({
  src,
  fallbackSrc,
  className,
  autoPlay = true,
  loop = true,
  muted = true,
  playsInline = true,
}: HlsVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [useFallback, setUseFallback] = useState(false);

  // Reset fallback state when src changes
  useEffect(() => {
    setUseFallback(false);
  }, [src, fallbackSrc]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Ensure browser autoplay policy is satisfied
    video.muted = true;

    // If fallback is triggered or no HLS src is provided
    if (useFallback || !src) {
      if (fallbackSrc) {
        video.src = fallbackSrc;
        if (autoPlay) {
          video.play().catch(() => {});
        }
      }
      return;
    }

    let hlsInstance: any = null;
    let isCancelled = false;

    // 1. Safari native HLS support
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      if (autoPlay) {
        video.play().catch(() => {
          // Native HLS play error -> fallback to MP4
          if (!isCancelled && fallbackSrc) {
            setUseFallback(true);
          }
        });
      }

      const errorHandler = () => {
        if (!isCancelled && fallbackSrc) {
          setUseFallback(true);
        }
      };
      video.addEventListener("error", errorHandler);

      return () => {
        video.removeEventListener("error", errorHandler);
        video.removeAttribute("src");
        video.load();
      };
    }

    // 2. Chromium / Firefox / Edge via hls.js
    import("hls.js")
      .then(({ default: Hls }) => {
        if (isCancelled || !videoRef.current) return;

        if (!Hls.isSupported()) {
          if (fallbackSrc) setUseFallback(true);
          return;
        }

        hlsInstance = new Hls({
          maxBufferLength: 30,
          maxMaxBufferLength: 60,
          startLevel: -1, // Auto ABR selection
          abrEwmaDefaultEstimate: 1_000_000,
          enableWorker: true,
        });

        hlsInstance.loadSource(src);
        hlsInstance.attachMedia(video);

        hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
          if (autoPlay && videoRef.current) {
            videoRef.current.play().catch(() => {});
          }
        });

        hlsInstance.on(Hls.Events.ERROR, (_event: any, data: any) => {
          if (data.fatal) {
            console.warn("[HlsVideoPlayer] HLS error encountered, falling back to direct MP4:", data.type);
            if (hlsInstance) {
              hlsInstance.destroy();
              hlsInstance = null;
            }
            if (!isCancelled && fallbackSrc) {
              setUseFallback(true);
            }
          }
        });
      })
      .catch(() => {
        if (fallbackSrc && !isCancelled) {
          setUseFallback(true);
        }
      });

    return () => {
      isCancelled = true;
      if (hlsInstance) {
        hlsInstance.destroy();
      }
      if (video) {
        video.removeAttribute("src");
        video.load();
      }
    };
  }, [src, fallbackSrc, autoPlay, useFallback]);

  return (
    <video
      ref={videoRef}
      className={className}
      autoPlay={autoPlay}
      loop={loop}
      muted={muted}
      playsInline={playsInline}
    />
  );
}
