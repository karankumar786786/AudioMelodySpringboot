/**
 * Generates or extracts a solid, dark, contrasty background color based on
 * the dominant color of a song's image — similar to Spotify's "Now Playing" backdrop.
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

// Deterministic hash to rich, vibrant HEX color fallback (never muddy pitch black)
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

type Bucket = { count: number; r: number; g: number; b: number };

/**
 * Vibrancy score used ONLY to break ties among genuinely dominant colors —
 * never to override population. Favors saturated, dark-to-mid tones so that
 * among the top few majority colors we pick the richest-looking one, the way
 * Spotify's background is clearly "the" color from the art, not an outlier.
 */
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

/**
 * Picks the true majority color: sorts buckets by actual pixel population,
 * takes a shortlist of the most populous ones, and only uses vibrancy to
 * choose among THOSE — so the result is always an image color that's really
 * there in force, not a rare saturated pixel getting picked out of nowhere.
 */
function pickMajorityColor(buckets: Record<string, Bucket>): Bucket | null {
  const all = Object.values(buckets);
  if (all.length === 0) return null;

  all.sort((a, b) => b.count - a.count);

  const topCount = all[0].count;
  // Shortlist: the single biggest bucket, plus any other bucket that's at
  // least 60% as populous as the biggest one (i.e. still a real contender
  // for "the" dominant color, not a minor accent).
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

/**
 * Extract a dark, contrasty dominant color from a song image URL,
 * similar to Spotify's Now Playing background extraction.
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

        // Two histograms: a strict "colorful" one (excludes near-gray pixels)
        // and a lenient fallback one (keeps grays) in case the art is mostly
        // monochrome/grayscale and the strict pass finds nothing usable.
        const colorBuckets: Record<string, Bucket> = {};
        const fallbackBuckets: Record<string, Bucket> = {};

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];

          if (a < 128) continue;

          const sum = r + g + b;
          // Skip near-black and near-white extremes for both histograms
          if (sum < 30 || (r > 240 && g > 240 && b > 240)) continue;

          const maxChannel = Math.max(r, g, b);
          const minChannel = Math.min(r, g, b);
          const saturation = maxChannel > 0 ? (maxChannel - minChannel) / maxChannel : 0;

          // 16-step quantization
          const qR = Math.floor(r / 16) * 16 + 8;
          const qG = Math.floor(g / 16) * 16 + 8;
          const qB = Math.floor(b / 16) * 16 + 8;
          const key = `${qR},${qG},${qB}`;

          if (!fallbackBuckets[key]) {
            fallbackBuckets[key] = { count: 0, r: qR, g: qG, b: qB };
          }
          fallbackBuckets[key].count += 1;

          // Strict histogram: require some real saturation (skip washed-out grays)
          if (saturation < 0.15) continue;

          if (!colorBuckets[key]) {
            colorBuckets[key] = { count: 0, r: qR, g: qG, b: qB };
          }
          colorBuckets[key].count += 1;
        }

        const majorityBucket = pickMajorityColor(colorBuckets) || pickMajorityColor(fallbackBuckets);

        if (!majorityBucket) {
          resolve(fallbackColor);
          return;
        }

        const { r: majR, g: majG, b: majB } = majorityBucket;
        const hsl = rgbToHsl(majR, majG, majB);

        // Calibrate to a Spotify-style solid background: rich, vibrant jewel tone
        // that contrasts cleanly against white lyrics text, never murky charcoal.
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
        resolve(hexColor);
      } catch {
        resolve(fallbackColor);
      }
    };

    img.onerror = () => {
      clearTimeout(timeout);
      resolve(fallbackColor);
    };

    // Append cors query param to avoid tainted disk-cache collisions with <img> tags
    const safeUrl = imageUrl.includes("?")
      ? `${imageUrl}&cors=1`
      : `${imageUrl}?cors=1`;
    img.src = safeUrl;
  });
}