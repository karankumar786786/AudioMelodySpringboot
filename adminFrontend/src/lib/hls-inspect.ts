/**
 * HLS chunk inspection for the song page: parse a song's master and media playlists,
 * fetch every segment with timings (time to first byte, total), and check the result.
 * Runs in the admin's browser against the public media bucket.
 *
 * Layout written by audioProcessing:
 *   {songKey}/master.m3u8
 *   {songKey}/audio/{128kbps|240kbps|320kbps}/playlist.m3u8, init.mp4, {label}_NNNNN.m4s
 * The bucket sends no Timing-Allow-Origin header, so Resource Timing is useless here:
 * timings come from fetch() and a streaming reader with performance.now().
 */

export const S3_BASE_URL =
  process.env.NEXT_PUBLIC_S3_BASE_URL ||
  "https://audiomelodyspringboot.s3.ap-south-1.amazonaws.com";

/** Segment length audioProcessing packages (seconds). */
export const SEGMENT_SECONDS = 4;
/** Measured bitrate may differ this much from the rendition's nominal bitrate. */
export const BITRATE_TOLERANCE = 0.2;

export function masterUrl(songKey: string): string {
  return `${S3_BASE_URL}/${songKey.replace(/^\/+|\/+$/g, "")}/master.m3u8`;
}

export interface Variant {
  label: string; // "128kbps"
  url: string;
  bandwidth?: number;
  codecs?: string;
}

export interface Segment {
  index: number;
  url: string;
  start: number; // seconds into the track
  duration: number;
}

export interface MediaPlaylist {
  url: string;
  targetDuration?: number;
  initUrl?: string;
  segments: Segment[];
  endList: boolean;
}

function resolve(uri: string, base: string): string {
  try {
    return new URL(uri, base).toString();
  } catch {
    return uri;
  }
}

function attrs(line: string): Record<string, string> {
  const out: Record<string, string> = {};
  const body = line.slice(line.indexOf(":") + 1);
  for (const m of body.matchAll(/([A-Z0-9-]+)=("[^"]*"|[^,]*)/g)) {
    out[m[1]] = m[2].replace(/^"|"$/g, "");
  }
  return out;
}

/** The rendition label from its path (…/audio/320kbps/playlist.m3u8), else from bandwidth. */
export function variantLabel(uri: string, bandwidth?: number): string {
  const m = uri.match(/(\d+)\s*kbps/i);
  if (m) return `${m[1]}kbps`;
  if (bandwidth) return `${Math.round(bandwidth / 1000)}kbps`;
  return uri;
}

export function parseMaster(text: string, baseUrl: string): Variant[] {
  if (!text.trimStart().startsWith("#EXTM3U"))
    throw new Error("Not an HLS playlist");
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const variants: Variant[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("#EXT-X-STREAM-INF")) {
      const a = attrs(line);
      const uri = lines.slice(i + 1).find((l) => l && !l.startsWith("#"));
      if (!uri) continue;
      const bandwidth = a.BANDWIDTH ? Number(a.BANDWIDTH) : undefined;
      variants.push({
        label: variantLabel(uri, bandwidth),
        url: resolve(uri, baseUrl),
        bandwidth,
        codecs: a.CODECS,
      });
    } else if (line.startsWith("#EXT-X-MEDIA") && /TYPE=AUDIO/.test(line)) {
      // Audio-only masters may list renditions as alternate audio instead.
      const a = attrs(line);
      if (a.URI && !variants.some((v) => v.url === resolve(a.URI, baseUrl))) {
        variants.push({
          label: variantLabel(a.URI),
          url: resolve(a.URI, baseUrl),
        });
      }
    }
  }
  // Highest quality last, like the picker.
  return variants.sort((a, b) => nominalKbps(a) - nominalKbps(b));
}

export function parseMedia(text: string, url: string): MediaPlaylist {
  if (!text.trimStart().startsWith("#EXTM3U"))
    throw new Error("Not an HLS playlist");
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const segments: Segment[] = [];
  let targetDuration: number | undefined;
  let initUrl: string | undefined;
  let pending: number | null = null;
  let start = 0;
  for (const line of lines) {
    if (line.startsWith("#EXT-X-TARGETDURATION"))
      targetDuration = Number(line.split(":")[1]);
    else if (line.startsWith("#EXT-X-MAP")) {
      const a = attrs(line);
      if (a.URI) initUrl = resolve(a.URI, url);
    } else if (line.startsWith("#EXTINF"))
      pending = Number.parseFloat(line.split(":")[1]);
    else if (line && !line.startsWith("#") && pending !== null) {
      segments.push({
        index: segments.length,
        url: resolve(line, url),
        start,
        duration: pending,
      });
      start += pending;
      pending = null;
    }
  }
  return {
    url,
    targetDuration,
    initUrl,
    segments,
    endList: lines.includes("#EXT-X-ENDLIST"),
  };
}

export function nominalKbps(v: { label: string; bandwidth?: number }): number {
  const m = v.label.match(/(\d+)kbps/);
  if (m) return Number(m[1]);
  return v.bandwidth ? v.bandwidth / 1000 : 0;
}

// ---- timed fetches ---------------------------------------------------------------------

export interface FetchTiming {
  url: string;
  status: number; // 0 = network error
  ok: boolean;
  bytes: number;
  ttfbMs: number;
  totalMs: number;
  error?: string;
}

export async function timedFetch(
  url: string,
  signal?: AbortSignal,
): Promise<FetchTiming> {
  const t0 = performance.now();
  try {
    // no-store: measure the network, not the browser cache.
    const res = await fetch(url, { cache: "no-store", signal });
    const headersAt = performance.now();
    let ttfb: number | null = null;
    let bytes = 0;
    if (res.body) {
      const reader = res.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (ttfb === null) ttfb = performance.now() - t0;
        bytes += value.byteLength;
      }
    } else {
      bytes = (await res.arrayBuffer()).byteLength;
    }
    const total = performance.now() - t0;
    return {
      url,
      status: res.status,
      ok: res.ok,
      bytes,
      ttfbMs: Math.round(ttfb ?? headersAt - t0),
      totalMs: Math.round(total),
    };
  } catch (e) {
    const total = performance.now() - t0;
    if ((e as Error)?.name === "AbortError") throw e;
    return {
      url,
      status: 0,
      ok: false,
      bytes: 0,
      ttfbMs: 0,
      totalMs: Math.round(total),
      error: String(e),
    };
  }
}

/** Runs fn over items with at most `concurrency` in flight; results keep item order. */
export async function runPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, i: number) => Promise<R>,
  onResult?: (r: R, i: number) => void,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
      onResult?.(out[i], i);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, worker),
  );
  return out;
}

// ---- results and checks ---------------------------------------------------------------

export interface ChunkResult extends FetchTiming {
  quality: string;
  index: number; // -1 = init segment
  start: number;
  duration: number;
  kbps: number | null; // measured media bitrate
}

export function chunkKbps(bytes: number, durationSec: number): number | null {
  if (!bytes || !durationSec) return null;
  return Math.round((bytes * 8) / 1000 / durationSec);
}

export function percentile(values: number[], p: number): number | null {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const rank = (p / 100) * (v.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  return Math.round(v[lo] + (v[hi] - v[lo]) * (rank - lo));
}

export interface QualityStats {
  quality: string;
  chunks: number;
  failed: number;
  bytes: number;
  ttfbP50: number | null;
  ttfbP95: number | null;
  totalP50: number | null;
  totalP95: number | null;
  totalMax: number | null;
  avgKbps: number | null;
  throughputKbps: number | null; // download speed
}

export function statsFor(quality: string, rows: ChunkResult[]): QualityStats {
  const media = rows.filter((r) => r.quality === quality && r.index >= 0);
  const ok = media.filter((r) => r.ok);
  const bytes = ok.reduce((s, r) => s + r.bytes, 0);
  const seconds = ok.reduce((s, r) => s + r.duration, 0);
  const transferMs = ok.reduce((s, r) => s + r.totalMs, 0);
  return {
    quality,
    chunks: media.length,
    failed: media.length - ok.length,
    bytes,
    ttfbP50: percentile(
      ok.map((r) => r.ttfbMs),
      50,
    ),
    ttfbP95: percentile(
      ok.map((r) => r.ttfbMs),
      95,
    ),
    totalP50: percentile(
      ok.map((r) => r.totalMs),
      50,
    ),
    totalP95: percentile(
      ok.map((r) => r.totalMs),
      95,
    ),
    totalMax: ok.length ? Math.max(...ok.map((r) => r.totalMs)) : null,
    avgKbps: seconds ? Math.round((bytes * 8) / 1000 / seconds) : null,
    throughputKbps: transferMs ? Math.round((bytes * 8) / transferMs) : null,
  };
}

export type CheckStatus = "pass" | "warn" | "fail";

export interface Check {
  quality: string;
  name: string;
  status: CheckStatus;
  detail: string;
}

export function integrityChecks(
  variant: Variant,
  playlist: MediaPlaylist | null,
  rows: ChunkResult[],
  songDurationSec: number,
): Check[] {
  const q = variant.label;
  const checks: Check[] = [];
  if (!playlist) {
    return [
      {
        quality: q,
        name: "Playlist",
        status: "fail",
        detail: "Media playlist could not be loaded",
      },
    ];
  }
  checks.push({
    quality: q,
    name: "Init segment",
    status: !playlist.initUrl
      ? "fail"
      : rows.some((r) => r.index === -1 && !r.ok)
        ? "fail"
        : "pass",
    detail: !playlist.initUrl
      ? "No #EXT-X-MAP in the playlist"
      : rows.some((r) => r.index === -1 && !r.ok)
        ? "init.mp4 could not be fetched"
        : "Present",
  });
  checks.push({
    quality: q,
    name: "End of list",
    status: playlist.endList ? "pass" : "warn",
    detail: playlist.endList
      ? "#EXT-X-ENDLIST present"
      : "Missing #EXT-X-ENDLIST (player may treat it as live)",
  });
  if (songDurationSec > 0) {
    const expected = Math.ceil(songDurationSec / SEGMENT_SECONDS);
    const n = playlist.segments.length;
    const diff = Math.abs(n - expected);
    checks.push({
      quality: q,
      name: "Segment count",
      status: diff <= 1 ? "pass" : diff <= 3 ? "warn" : "fail",
      detail: `${n} segments, ${expected} expected for ${Math.round(songDurationSec)} s at ${SEGMENT_SECONDS} s`,
    });
    const listed = playlist.segments.reduce((s, x) => s + x.duration, 0);
    const off = Math.abs(listed - songDurationSec);
    checks.push({
      quality: q,
      name: "Total duration",
      status: off <= SEGMENT_SECONDS ? "pass" : "warn",
      detail: `${listed.toFixed(1)} s listed vs ${songDurationSec} s in the catalog`,
    });
  }
  const media = rows.filter((r) => r.quality === q && r.index >= 0);
  if (media.length) {
    const missing = media.filter((r) => !r.ok);
    const empty = media.filter((r) => r.ok && r.bytes === 0);
    checks.push({
      quality: q,
      name: "Chunks reachable",
      status: missing.length ? "fail" : "pass",
      detail: missing.length
        ? `${missing.length} failed: ${missing
            .slice(0, 5)
            .map((r) => `#${r.index} (${r.status || "network"})`)
            .join(", ")}`
        : `All ${media.length} fetched`,
    });
    if (empty.length) {
      checks.push({
        quality: q,
        name: "Empty chunks",
        status: "fail",
        detail: `${empty.length} chunks are 0 bytes`,
      });
    }
    const stats = statsFor(q, rows);
    const nominal = nominalKbps(variant);
    if (stats.avgKbps && nominal) {
      const ratio = stats.avgKbps / nominal;
      checks.push({
        quality: q,
        name: "Bitrate",
        status: Math.abs(ratio - 1) <= BITRATE_TOLERANCE ? "pass" : "warn",
        detail: `${stats.avgKbps} kbps measured vs ${nominal} kbps nominal (${Math.round((ratio - 1) * 100)}%)`,
      });
    }
  }
  return checks;
}

export function toCsv(rows: ChunkResult[]): string {
  const header = [
    "quality",
    "chunk",
    "start_s",
    "duration_s",
    "bytes",
    "kbps",
    "ttfb_ms",
    "total_ms",
    "status",
    "url",
  ];
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = rows.map((r) =>
    [
      r.quality,
      r.index < 0 ? "init" : r.index,
      r.start.toFixed(2),
      r.duration.toFixed(2),
      r.bytes,
      r.kbps ?? "",
      r.ttfbMs,
      r.totalMs,
      r.status,
      r.url,
    ]
      .map(esc)
      .join(","),
  );
  return [header.join(","), ...lines].join("\n");
}
