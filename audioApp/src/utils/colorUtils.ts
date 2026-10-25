import { useEffect, useState } from "react";
import { Platform } from "react-native";

/**
 * Color extraction utilities matching audioFrontend/src/lib/color-utils.ts and color-extract.ts.
 * Generates or extracts a solid, dark, contrasty dominant background color based on
 * the song's artwork image — matching Spotify's "Now Playing" backdrop.
 */

/**
 * Converts HSL color values to a standard 6-character hex color (#rrggbb).
 */
export function hslToHex(h: number, s: number, l: number): string {
  l /= 100;
  const a = (s * Math.min(l, 1 - l)) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/**
 * Deterministic hash to rich, vibrant HEX color fallback (never muddy pitch black).
 * Used when image data is loading or when canvas is unavailable.
 */
export function stringToSolidDarkColor(str: string): string {
  if (!str) return "#1e3a8a";
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return hslToHex(hue, 75, 26);
}

/**
 * Converts RGB color values to HSL
 */
export function rgbToHsl(r: number, g: number, b: number) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

type Bucket = { count: number; r: number; g: number; b: number };

function vibrancyScore(bucket: Bucket): number {
  const { r, g, b } = bucket;
  const maxChannel = Math.max(r, g, b);
  const minChannel = Math.min(r, g, b);
  const saturation = maxChannel > 0 ? (maxChannel - minChannel) / maxChannel : 0;
  const lightness = (maxChannel + minChannel) / 2 / 255; // 0..1

  const saturationWeight = 1 + saturation * 3.0;

  let darknessWeight: number;
  if (lightness <= 0.4) {
    darknessWeight = 1.0;
  } else {
    const overshoot = (lightness - 0.4) / 0.6;
    darknessWeight = Math.max(0.2, 1 - overshoot * overshoot);
  }

  return saturationWeight * darknessWeight;
}

function pickMajorityColor(buckets: Record<string, Bucket>): Bucket | null {
  const all = Object.values(buckets);
  if (all.length === 0) return null;

  all.sort((a, b) => b.count - a.count);

  const topCount = all[0].count;
  const shortlist = all.filter((bucket) => bucket.count >= topCount * 0.6).slice(0, 6);

  let best = shortlist[0];
  let bestScore = -Infinity;
  shortlist.forEach((bucket) => {
    const score = vibrancyScore(bucket);
    if (score > bestScore) {
      bestScore = score;
      best = bucket;
    }
  });

  return best;
}

// In-memory cache for extracted colors
const dominantColorCache = new Map<string, string>();

/**
 * Extracts a dark, contrasty dominant color from an image URL,
 * matching Spotify's Now Playing background extraction in audioFrontend.
 */
export async function getSolidBgFromImage(
  imageUrl?: string | null,
  fallbackKey?: string,
): Promise<string> {
  const fallbackColor = stringToSolidDarkColor(fallbackKey || "default");
  if (!imageUrl) {
    return fallbackColor;
  }

  const cacheKey = imageUrl || fallbackKey || "default";
  if (dominantColorCache.has(cacheKey)) {
    return dominantColorCache.get(cacheKey)!;
  }

  // Web environment: use HTML5 canvas extraction like audioFrontend
  if (Platform.OS === "web" && typeof window !== "undefined" && typeof document !== "undefined") {
    return new Promise((resolve) => {
      const img = new (window as any).Image();
      img.crossOrigin = "anonymous";

      const timeout = setTimeout(() => {
        resolve(fallbackColor);
      }, 1500);

      img.onload = () => {
        clearTimeout(timeout);
        try {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          if (!ctx) {
            resolve(fallbackColor);
            return;
          }

          canvas.width = 64;
          canvas.height = 64;
          ctx.drawImage(img, 0, 0, 64, 64);

          const imageData = ctx.getImageData(0, 0, 64, 64);
          const data = imageData.data;

          const colorBuckets: Record<string, Bucket> = {};
          const fallbackBuckets: Record<string, Bucket> = {};

          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];

            if (a < 128) continue;

            const sum = r + g + b;
            if (sum < 30 || (r > 240 && g > 240 && b > 240)) continue;

            const maxChannel = Math.max(r, g, b);
            const minChannel = Math.min(r, g, b);
            const saturation = maxChannel > 0 ? (maxChannel - minChannel) / maxChannel : 0;

            const qR = Math.floor(r / 16) * 16 + 8;
            const qG = Math.floor(g / 16) * 16 + 8;
            const qB = Math.floor(b / 16) * 16 + 8;
            const key = `${qR},${qG},${qB}`;

            if (!fallbackBuckets[key]) {
              fallbackBuckets[key] = { count: 0, r: qR, g: qG, b: qB };
            }
            fallbackBuckets[key].count += 1;

            if (saturation < 0.15) continue;

            if (!colorBuckets[key]) {
              colorBuckets[key] = { count: 0, r: qR, g: qG, b: qB };
            }
            colorBuckets[key].count += 1;
          }

          const majorityBucket =
            pickMajorityColor(colorBuckets) || pickMajorityColor(fallbackBuckets);

          if (!majorityBucket) {
            dominantColorCache.set(cacheKey, fallbackColor);
            resolve(fallbackColor);
            return;
          }

          const { r: majR, g: majG, b: majB } = majorityBucket;
          const hsl = rgbToHsl(majR, majG, majB);

          let targetLightness: number;
          if (hsl.l < 18) {
            targetLightness = Math.round(hsl.l * 1.3 + 22);
          } else if (hsl.l <= 48) {
            targetLightness = Math.max(24, hsl.l);
          } else {
            const saturationFactor = hsl.s / 100;
            const pulledDown = 48 - (hsl.l - 48) * 0.4;
            targetLightness = Math.round(pulledDown * (0.7 + saturationFactor * 0.3));
          }

          targetLightness = Math.min(42, Math.max(22, targetLightness));
          const targetSaturation = Math.min(92, Math.max(68, hsl.s));
          const hexColor = hslToHex(hsl.h, targetSaturation, targetLightness);

          dominantColorCache.set(cacheKey, hexColor);
          resolve(hexColor);
        } catch {
          resolve(fallbackColor);
        }
      };

      img.onerror = () => {
        clearTimeout(timeout);
        resolve(fallbackColor);
      };

      const safeUrl = imageUrl.includes("?")
        ? `${imageUrl}&cors=1`
        : `${imageUrl}?cors=1`;
      img.src = safeUrl;
    });
  }

  // Native environment: derive high-fidelity Spotify-style jewel-tone from song metadata
  dominantColorCache.set(cacheKey, fallbackColor);
  return fallbackColor;
}

export interface DominantColorTheme {
  dominantColor: string;
  gradientColors: [string, string, string, string, string];
  cardBg: string;
  cardBorder: string;
}

/**
 * React hook to subscribe to dominant color updates for a song
 */
export function useDominantColor(
  imageUrl?: string | null,
  fallbackKey?: string,
): DominantColorTheme {
  const initialColor = stringToSolidDarkColor(fallbackKey || "default");
  const [dominantColor, setDominantColor] = useState<string>(initialColor);

  useEffect(() => {
    let isMounted = true;
    const initial = stringToSolidDarkColor(fallbackKey || "default");
    setDominantColor(initial);

    getSolidBgFromImage(imageUrl, fallbackKey).then((color) => {
      if (isMounted && color) {
        setDominantColor(color);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [imageUrl, fallbackKey]);

  return {
    dominantColor,
    gradientColors: [
      `${dominantColor}80`, // 50% opacity vibrant top
      `${dominantColor}40`, // 25% opacity mid aura
      "rgba(18, 18, 18, 0.70)", // smooth blend
      "rgba(18, 18, 18, 0.94)", // dark base
      "#121212",
    ],
    cardBg: `${dominantColor}1F`, // subtle 12% tint matching majority color
    cardBorder: `${dominantColor}4D`, // 30% border glow
  };
}
