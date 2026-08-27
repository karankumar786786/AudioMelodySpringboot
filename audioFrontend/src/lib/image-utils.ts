const IMAGEKIT_URL_ENDPOINT = "https://ik.imagekit.io/hc29ms4ul";

export type ImageTransformation = {
  width?: number;
  height?: number;
  quality?: number;
  format?: "auto" | "webp" | "jpg" | "png" | "mp4";
  blur?: number;
  focus?: "auto" | "face" | "center" | "top" | "left" | "right" | "bottom";
  crop?: "at_max" | "at_least" | "force" | "pad_resize" | "pad_extract";
  aspectRatio?: string; // e.g., "1-1", "16-9"
};

/**
 * Generates a full ImageKit URL with optimized transformations.
 */
export function getImageUrl(
  key: string | undefined | null,
  transformations: ImageTransformation = {},
): string | undefined {
  if (!key) return undefined;

  // If key is already a full URL, return it
  if (key.startsWith("http")) return key;

  // Ensure key starts with / and encode path segments to handle spaces cleanly
  const cleanKey = key.startsWith("/") ? key.slice(1) : key;
  const encodedPath = "/" + cleanKey.split("/").map((segment) => encodeURIComponent(segment)).join("/");

  const {
    width,
    height,
    quality = 80,
    format = "auto",
    blur,
    focus,
    crop,
    aspectRatio,
  } = transformations;

  const tr: string[] = [];

  // Dimensions
  if (width) tr.push(`w-${width}`);
  if (height) tr.push(`h-${height}`);

  // Aspect Ratio
  if (aspectRatio) tr.push(`ar-${aspectRatio}`);

  // Crop & Fit mode
  if (crop === "pad_resize") {
    tr.push("cm-pad_resize");
    tr.push("bg-000000"); // Black background for padding
  } else if (crop) {
    tr.push(`c-${crop}`);
  } else if (!focus && !aspectRatio) {
    tr.push("c-at_max");
  }

  // Focus
  if (focus) tr.push(`fo-${focus}`);

  // Quality & Format
  if (quality) tr.push(`q-${quality}`);
  if (format) tr.push(`f-${format}`);

  // Effects
  if (blur) tr.push(`bl-${blur}`);

  const transformationQuery = tr.length > 0 ? `?tr=${tr.join(",")}` : "";

  return `${IMAGEKIT_URL_ENDPOINT}${encodedPath}${transformationQuery}`;
}

export type VideoTransformation = {
  width?: number;
  height?: number;
  quality?: number;
  aspectRatio?: string;
  format?: "mp4" | "webm" | "auto";
};

/**
 * Generates a full ImageKit Video URL with valid video transformations.
 */
export function getVideoUrl(
  key: string | undefined | null,
  transformations: VideoTransformation = {},
): string | undefined {
  if (!key) return undefined;

  // If key is already a full URL, return it
  if (key.startsWith("http")) return key;

  // Ensure key starts with / and encode path segments to handle spaces cleanly
  const cleanKey = key.startsWith("/") ? key.slice(1) : key;
  const encodedPath = "/" + cleanKey.split("/").map((segment) => encodeURIComponent(segment)).join("/");

  const { width, height, quality, format, aspectRatio } = transformations;

  const tr: string[] = [];

  if (width) tr.push(`w-${width}`);
  if (height) tr.push(`h-${height}`);
  if (aspectRatio) tr.push(`ar-${aspectRatio}`);
  if (quality) tr.push(`q-${quality}`);
  if (format && format !== "auto") tr.push(`f-${format}`);

  // When transformations are provided use them; otherwise use ?tr=orig for direct 200 OK video playback
  const transformationQuery = tr.length > 0 ? `?tr=${tr.join(",")}` : "?tr=orig";

  return `${IMAGEKIT_URL_ENDPOINT}${encodedPath}${transformationQuery}`;
}

/**
 * Generates an ImageKit ABR/HLS URL for adaptive bitrate video streaming.
 * ImageKit serves master HLS manifests at: {endpoint}/{video_path}/ik-master.m3u8?tr=sr-360_480_720
 * This enables adaptive quality switching based on network conditions.
 */
export function getVideoABRUrl(
  key: string | undefined | null,
  resolutions: string = "360_480_720",
): string | undefined {
  if (!key) return undefined;

  // If already a full URL (non-ImageKit), return as-is
  if (key.startsWith("http")) return key;

  const cleanKey = key.startsWith("/") ? key.slice(1) : key;
  const encodedPath =
    "/" +
    cleanKey
      .split("/")
      .map((segment) => encodeURIComponent(segment))
      .join("/");

  // ImageKit official HLS ABR manifest path & resolution parameter
  return `${IMAGEKIT_URL_ENDPOINT}${encodedPath}/ik-master.m3u8?tr=sr-${resolutions}`;
}

