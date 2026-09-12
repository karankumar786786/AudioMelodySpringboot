"use client";

import { useEffect, useState } from "react";
import { useStore } from "@tanstack/react-store";
import { playerStore } from "@/store/player.store";
import { getImageUrl } from "./image-utils";

export interface ExtractedColorPalette {
  primary: string; // e.g. "rgb(120, 60, 200)"
  hex: string; // e.g. "#783cc8"
  glow: string; // e.g. "rgba(120, 60, 200, 0.4)"
  dark: string; // e.g. "rgb(30, 15, 50)"
  accent: string; // e.g. "rgb(160, 90, 240)"
  gradient: string;
  r: number;
  g: number;
  b: number;
}

const DEFAULT_PALETTE: ExtractedColorPalette = {
  primary: "rgb(29, 185, 84)",
  hex: "#1db954",
  glow: "rgba(29, 185, 84, 0.35)",
  dark: "rgb(12, 45, 22)",
  accent: "rgb(40, 210, 100)",
  gradient:
    "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(29, 185, 84, 0.25), rgba(0, 0, 0, 0))",
  r: 29,
  g: 185,
  b: 84,
};

// In-memory cache for fast reuse without re-rendering or re-downloading
const colorCache = new Map<string, ExtractedColorPalette>();

/**
 * Extracts dominant vibrant color from an image URL using in-browser canvas.
 */
export async function extractDominantColor(
  imageUrl: string,
): Promise<ExtractedColorPalette> {
  if (!imageUrl || typeof window === "undefined") {
    return DEFAULT_PALETTE;
  }

  if (colorCache.has(imageUrl)) {
    return colorCache.get(imageUrl)!;
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) {
          resolve(DEFAULT_PALETTE);
          return;
        }

        // Downscale to 32x32 for ultra-fast processing
        const size = 32;
        canvas.width = size;
        canvas.height = size;
        ctx.drawImage(img, 0, 0, size, size);

        const imgData = ctx.getImageData(0, 0, size, size).data;
        let maxScore = -1;
        let bestR = 29;
        let bestG = 185;
        let bestB = 84;

        for (let i = 0; i < imgData.length; i += 4) {
          const r = imgData[i];
          const g = imgData[i + 1];
          const b = imgData[i + 2];
          const a = imgData[i + 3];

          if (a < 128) continue; // Skip transparent pixels

          const brightness = (r * 299 + g * 587 + b * 114) / 1000;
          // Filter out near-black and near-white pixels
          if (brightness < 25 || brightness > 235) continue;

          // Compute saturation / colorfulness score
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const delta = max - min;
          const saturation = max === 0 ? 0 : delta / max;

          // Favor vibrant, richly saturated colors
          const score = saturation * 2 + (brightness > 40 && brightness < 200 ? 1 : 0);

          if (score > maxScore) {
            maxScore = score;
            bestR = r;
            bestG = g;
            bestB = b;
          }
        }

        const hex = `#${((1 << 24) + (bestR << 16) + (bestG << 8) + bestB).toString(16).slice(1)}`;
        const darkR = Math.round(bestR * 0.2);
        const darkG = Math.round(bestG * 0.2);
        const darkB = Math.round(bestB * 0.2);

        const accentR = Math.min(255, Math.round(bestR * 1.25));
        const accentG = Math.min(255, Math.round(bestG * 1.25));
        const accentB = Math.min(255, Math.round(bestB * 1.25));

        const palette: ExtractedColorPalette = {
          primary: `rgb(${bestR}, ${bestG}, ${bestB})`,
          hex,
          glow: `rgba(${bestR}, ${bestG}, ${bestB}, 0.35)`,
          dark: `rgb(${darkR}, ${darkG}, ${darkB})`,
          accent: `rgb(${accentR}, ${accentG}, ${accentB})`,
          gradient: `radial-gradient(ellipse 80% 50% at 50% -10%, rgba(${bestR}, ${bestG}, ${bestB}, 0.28), rgba(0, 0, 0, 0))`,
          r: bestR,
          g: bestG,
          b: bestB,
        };

        colorCache.set(imageUrl, palette);
        resolve(palette);
      } catch (err) {
        // Fallback for CORS or canvas errors
        resolve(DEFAULT_PALETTE);
      }
    };

    img.onerror = () => {
      resolve(DEFAULT_PALETTE);
    };

    img.src = imageUrl;
  });
}

/**
 * Hook to get extracted color palette for an arbitrary image URL
 */
export function useAlbumColor(imageUrl?: string | null): ExtractedColorPalette {
  const [palette, setPalette] = useState<ExtractedColorPalette>(DEFAULT_PALETTE);

  useEffect(() => {
    if (!imageUrl) {
      setPalette(DEFAULT_PALETTE);
      return;
    }

    let isMounted = true;
    extractDominantColor(imageUrl).then((result) => {
      if (isMounted) setPalette(result);
    });

    return () => {
      isMounted = false;
    };
  }, [imageUrl]);

  return palette;
}

/**
 * Hook to automatically track the currently playing track and its vibrant ambient aura
 */
export function useCurrentTrackColor(): ExtractedColorPalette {
  const currentSong = useStore(playerStore, (s) => s.currentSong);

  const imageUrl = currentSong?.imageKey
    ? getImageUrl(currentSong.imageKey, {
        width: 100,
        height: 100,
        aspectRatio: "1-1",
      })
    : currentSong?.posterUrl || null;

  return useAlbumColor(imageUrl);
}
