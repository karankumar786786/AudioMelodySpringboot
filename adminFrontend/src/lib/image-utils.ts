const IMAGEKIT_URL_ENDPOINT = "https://ik.imagekit.io/zaa6pbi9f";

export type ImageTransformation = {
  width?: number;
  height?: number;
  quality?: number;
  format?: "auto" | "webp" | "jpg" | "png";
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
) {
  if (!key) return "";

  // If key is already a full URL, return it
  if (key.startsWith("http")) return key;

  // Ensure key starts with /
  const path = key.startsWith("/") ? key : `/${key}`;

  const {
    width,
    height,
    quality = 80,
    format = "auto",
    blur,
    focus,
    crop = "at_max",
    aspectRatio,
  } = transformations;

  const tr: string[] = [];

  // Dimensions
  if (width) tr.push(`w-${width}`);
  if (height) tr.push(`h-${height}`);
  
  // Crop & Fit mode
  if (crop === "pad_resize") {
    tr.push("cm-pad_resize");
    tr.push("bg-000000"); // Black background for padding
  } else if (crop) {
    tr.push(`c-${crop}`);
  }

  // Focus
  if (focus) tr.push(`fo-${focus}`);

  // Aspect Ratio
  if (aspectRatio) tr.push(`ar-${aspectRatio}`);

  // Quality & Format
  if (quality) tr.push(`q-${quality}`);
  if (format) tr.push(`f-${format}`);
  
  // Effects
  if (blur) tr.push(`bl-${blur}`);

  const transformationQuery = tr.length > 0 ? `?tr=${tr.join(",")}` : "";

  return `${IMAGEKIT_URL_ENDPOINT}${path}${transformationQuery}`;
}
