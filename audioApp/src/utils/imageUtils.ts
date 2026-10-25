const IMAGEKIT_URL_ENDPOINT = "https://ik.imagekit.io/hc29ms4ul";

export type ImageTransformation = {
  width?: number;
  height?: number;
  quality?: number;
  format?: "auto" | "webp" | "jpg" | "png";
  blur?: number;
  crop?: "at_max" | "at_least" | "force" | "pad_resize";
  aspectRatio?: string; // e.g. "1-1", "16-9"
};

/**
 * Resolves an ImageKit key or direct URL into an optimized CDN URL.
 */
export function getImageUrl(
  key?: string | null,
  transformations: ImageTransformation = {},
): string | undefined {
  if (!key) return undefined;

  // If already an absolute URL
  if (key.startsWith("http://") || key.startsWith("https://")) {
    return key;
  }

  const cleanKey = key.startsWith("/") ? key.slice(1) : key;
  const encodedPath =
    "/" +
    cleanKey
      .split("/")
      .map((segment) => encodeURIComponent(segment))
      .join("/");

  const {
    width,
    height,
    quality = 80,
    format = "auto",
    blur,
    crop,
    aspectRatio,
  } = transformations;

  const tr: string[] = [];

  if (width) tr.push(`w-${width}`);
  if (height) tr.push(`h-${height}`);
  if (aspectRatio) tr.push(`ar-${aspectRatio}`);

  if (crop === "pad_resize") {
    tr.push("cm-pad_resize");
    tr.push("bg-000000");
  } else if (crop) {
    tr.push(`c-${crop}`);
  }

  if (quality) tr.push(`q-${quality}`);
  if (format) tr.push(`f-${format}`);
  if (blur) tr.push(`bl-${blur}`);

  const transformString = tr.length > 0 ? `tr:${tr.join(",")}` : "";

  if (transformString) {
    return `${IMAGEKIT_URL_ENDPOINT}/${transformString}${encodedPath}`;
  }

  return `${IMAGEKIT_URL_ENDPOINT}${encodedPath}`;
}

export type VideoTransformation = {
  width?: number;
  height?: number;
  quality?: number;
  aspectRatio?: string;
  format?: "mp4" | "webm" | "auto";
};

/**
 * Generates an ImageKit Video URL for canvas/background video playback.
 */
export function getVideoUrl(
  key?: string | null,
  transformations: VideoTransformation = {},
): string | undefined {
  if (!key) return undefined;

  // If already an absolute URL
  if (key.startsWith("http://") || key.startsWith("https://")) {
    return key;
  }

  const cleanKey = key.startsWith("/") ? key.slice(1) : key;
  const encodedPath =
    "/" +
    cleanKey
      .split("/")
      .map((segment) => encodeURIComponent(segment))
      .join("/");

  const { width, height, quality, format, aspectRatio } = transformations;
  const tr: string[] = [];

  if (width) tr.push(`w-${width}`);
  if (height) tr.push(`h-${height}`);
  if (aspectRatio) tr.push(`ar-${aspectRatio}`);
  if (quality) tr.push(`q-${quality}`);
  if (format && format !== "auto") tr.push(`f-${format}`);

  // If transformations provided, append ?tr=...; otherwise ?tr=orig for direct playback
  const transformationQuery = tr.length > 0 ? `?tr=${tr.join(",")}` : "?tr=orig";

  return `${IMAGEKIT_URL_ENDPOINT}${encodedPath}${transformationQuery}`;
}

