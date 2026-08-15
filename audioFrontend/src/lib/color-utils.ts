/**
 * Generates or extracts a solid dark background color based on the majority color of a song's image.
 */

// Simple deterministic hash to HSL dark color fallback
export function stringToSolidDarkColor(str: string): string {
  if (!str) return "#181818";
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 45%, 10%)`;
}

/**
 * Converts RGB color values to HSL
 */
function rgbToHsl(r: number, g: number, b: number) {
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

/**
 * Extract majority (dominant) color from song image URL using histogram color buckets.
 */
export async function getSolidBgFromImage(
  imageUrl?: string | null,
  fallbackKey?: string
): Promise<string> {
  const fallbackColor = stringToSolidDarkColor(fallbackKey || "default");
  if (!imageUrl || typeof window === "undefined") {
    return fallbackColor;
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    const timeout = setTimeout(() => {
      resolve(fallbackColor);
    }, 1500);

    img.onload = () => {
      clearTimeout(timeout);
      try {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(fallbackColor);
          return;
        }

        canvas.width = 64;
        canvas.height = 64;
        ctx.drawImage(img, 0, 0, 64, 64);

        const imageData = ctx.getImageData(0, 0, 64, 64);
        const data = imageData.data;

        // Color histogram quantization map: bucketKey -> { count, r, g, b }
        const colorBuckets: Record<string, { count: number; r: number; g: number; b: number }> = {};

        for (let i = 0; i < data.length; i += 8) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];

          // Skip transparent pixels
          if (a < 128) continue;

          // Skip extreme black and extreme white unless image has no other color
          const sum = r + g + b;
          if (sum < 30 || (r > 240 && g > 240 && b > 240)) {
            continue;
          }

          // Quantize to 32-value bins (8 buckets per channel)
          const qR = Math.floor(r / 32) * 32 + 16;
          const qG = Math.floor(g / 32) * 32 + 16;
          const qB = Math.floor(b / 32) * 32 + 16;
          const key = `${qR},${qG},${qB}`;

          if (!colorBuckets[key]) {
            colorBuckets[key] = { count: 0, r: qR, g: qG, b: qB };
          }
          colorBuckets[key].count++;
        }

        // Find majority bucket
        let majorityBucket: { count: number; r: number; g: number; b: number } | null = null;
        let maxCount = 0;

        Object.values(colorBuckets).forEach((bucket) => {
          if (bucket.count > maxCount) {
            maxCount = bucket.count;
            majorityBucket = bucket;
          }
        });

        if (!majorityBucket) {
          resolve(fallbackColor);
          return;
        }

        const { r: majR, g: majG, b: majB } = majorityBucket;
        const hsl = rgbToHsl(majR, majG, majB);

        // Calibrate lightness to 10% for a deep dark high-contrast solid background matching majority image hue
        const solidDarkHsl = `hsl(${hsl.h}, ${Math.min(75, Math.max(35, hsl.s))}%, 10%)`;
        resolve(solidDarkHsl);
      } catch (err) {
        resolve(fallbackColor);
      }
    };

    img.onerror = () => {
      clearTimeout(timeout);
      resolve(fallbackColor);
    };

    img.src = imageUrl;
  });
}
