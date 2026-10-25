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
 * Matches the official implementation used in audioFrontend, applying transformations via URL query parameter.
 * Also intelligently extracts and transforms ImageKit full URLs if provided as input.
 */
export function getImageUrl(
  key?: string | null,
  transformations: ImageTransformation = {},
): string | undefined {
  if (!key) return undefined;

  let pathKey = key;

  // If already an absolute URL:
  // If it's an ImageKit URL, extract the path so we can apply transformations via URL query!
  // If it's an external non-ImageKit URL, return as-is.
  if (pathKey.startsWith("http://") || pathKey.startsWith("https://")) {
    if (pathKey.includes("ik.imagekit.io")) {
      try {
        const urlObj = new URL(pathKey);
        let pathname = urlObj.pathname;
        const endpointId = IMAGEKIT_URL_ENDPOINT.replace("https://ik.imagekit.io", "");
        if (endpointId && pathname.startsWith(endpointId)) {
          pathname = pathname.slice(endpointId.length);
        }
        // Strip any existing path-based transformation (e.g. /tr:.../)
        pathname = pathname.replace(/\/tr:[^\/]+/, "");
        pathKey = pathname;
      } catch {
        return key;
      }
    } else {
      return key;
    }
  }

  // Ensure key starts with / and encode path segments to handle spaces cleanly
  const cleanKey = pathKey.startsWith("/") ? pathKey.slice(1) : pathKey;
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
 * Generates an ImageKit Video URL with valid video transformations.
 */
export function getVideoUrl(
  key?: string | null,
  transformations: VideoTransformation = {},
): string | undefined {
  if (!key) return undefined;

  let pathKey = key;

  if (pathKey.startsWith("http://") || pathKey.startsWith("https://")) {
    if (pathKey.includes("ik.imagekit.io")) {
      try {
        const urlObj = new URL(pathKey);
        let pathname = urlObj.pathname;
        const endpointId = IMAGEKIT_URL_ENDPOINT.replace("https://ik.imagekit.io", "");
        if (endpointId && pathname.startsWith(endpointId)) {
          pathname = pathname.slice(endpointId.length);
        }
        pathname = pathname.replace(/\/tr:[^\/]+/, "");
        pathKey = pathname;
      } catch {
        return key;
      }
    } else {
      return key;
    }
  }

  // Ensure key starts with / and encode path segments to handle spaces cleanly
  const cleanKey = pathKey.startsWith("/") ? pathKey.slice(1) : pathKey;
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

  // When transformations are provided use them; otherwise use ?tr=orig for direct 200 OK video playback
  const transformationQuery = tr.length > 0 ? `?tr=${tr.join(",")}` : "?tr=orig";

  return `${IMAGEKIT_URL_ENDPOINT}${encodedPath}${transformationQuery}`;
}

/**
 * Generates an ImageKit ABR/HLS URL for adaptive bitrate video streaming.
 * ImageKit serves master HLS manifests at: {endpoint}/{video_path}/ik-master.m3u8?tr=sr-360_480_720
 */
export function getVideoABRUrl(
  key?: string | null,
  resolutions: string = "360_480_720",
): string | undefined {
  if (!key) return undefined;

  let pathKey = key;
  if (pathKey.startsWith("http://") || pathKey.startsWith("https://")) {
    if (pathKey.includes("ik.imagekit.io")) {
      try {
        const urlObj = new URL(pathKey);
        let pathname = urlObj.pathname;
        const endpointId = IMAGEKIT_URL_ENDPOINT.replace("https://ik.imagekit.io", "");
        if (endpointId && pathname.startsWith(endpointId)) {
          pathname = pathname.slice(endpointId.length);
        }
        pathname = pathname.replace(/\/tr:[^\/]+/, "");
        pathKey = pathname;
      } catch {
        return key;
      }
    } else {
      return key;
    }
  }

  const cleanKey = pathKey.startsWith("/") ? pathKey.slice(1) : pathKey;
  const encodedPath =
    "/" +
    cleanKey
      .split("/")
      .map((segment) => encodeURIComponent(segment))
      .join("/");

  return `${IMAGEKIT_URL_ENDPOINT}${encodedPath}/ik-master.m3u8?tr=sr-${resolutions}`;
}

