import { useEffect, useState } from "react";
import type { VideoQuality } from "@/types";

export interface VideoVariant {
  id: VideoQuality;
  label: string;
  width: number;
  height: number;
  bandwidth: number;
  uri: string;
}

function resolveUrl(uri: string, base: string) {
  if (/^https?:\/\//i.test(uri)) return uri;
  const clean = base.split("?")[0];
  if (uri.startsWith("/")) {
    const origin = clean.match(/^(https?:\/\/[^/]+)/i)?.[1] ?? "";
    return origin + uri;
  }
  return clean.slice(0, clean.lastIndexOf("/") + 1) + uri;
}

function labelFor(height: number) {
  if (height >= 2160) return `${height}p (4K)`;
  if (height >= 1080) return `${height}p (Full HD)`;
  if (height >= 720) return `${height}p (HD)`;
  return `${height}p`;
}

/** Reads an HLS master playlist and returns the renditions it actually contains. */
export function parseHlsVariants(master: string, masterUrl: string): VideoVariant[] {
  const lines = master.split(/\r?\n/).map((l) => l.trim());
  const byHeight = new Map<number, VideoVariant>();

  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].startsWith("#EXT-X-STREAM-INF")) continue;

    const resolution = lines[i].match(/RESOLUTION=(\d+)x(\d+)/i);
    const bandwidth = Number(lines[i].match(/(?:^|[:,])BANDWIDTH=(\d+)/i)?.[1] ?? 0);
    const uriLine = lines.slice(i + 1).find((l) => l && !l.startsWith("#"));
    if (!uriLine) continue;

    const width = resolution ? Number(resolution[1]) : 0;
    const height = resolution ? Number(resolution[2]) : 0;
    if (!height) continue;

    const existing = byHeight.get(height);
    if (existing && existing.bandwidth >= bandwidth) continue;

    byHeight.set(height, {
      id: `${height}p` as VideoQuality,
      label: labelFor(height),
      width: width || Math.round(height * (16 / 9)),
      height,
      bandwidth,
      uri: resolveUrl(uriLine, masterUrl),
    });
  }

  return [...byHeight.values()].sort((a, b) => b.height - a.height);
}

export function useHlsQualities(masterUrl?: string) {
  const [variants, setVariants] = useState<VideoVariant[]>([]);

  useEffect(() => {
    if (!masterUrl) {
      setVariants([]);
      return;
    }
    let cancelled = false;
    fetch(masterUrl)
      .then((r) => r.text())
      .then((text) => {
        if (!cancelled) setVariants(parseHlsVariants(text, masterUrl));
      })
      .catch(() => {
        if (!cancelled) setVariants([]);
      });
    return () => {
      cancelled = true;
    };
  }, [masterUrl]);

  return { variants };
}