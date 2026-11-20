/**
 * Lyrics normalisation for the Algolia song record.
 *
 * Lyrics are not stored in Postgres; coreEngine fetches them from LRCLIB on demand.
 * At index time we fetch by the song's lrclibId and store plain text (timestamps
 * stripped) capped to a byte budget so the record stays under Algolia's 10KB limit
 * (Build plan). Mirrors adminBackend core/services/lyrics_service.py — keep in sync.
 */

export const LYRICS_MAX_BYTES = Number(process.env.ALGOLIA_LYRICS_MAX_BYTES) || 6000;
const LRCLIB_BASE_URL = "https://lrclib.net/api";
const USER_AGENT = "AudioMelody/1.0 (https://audiomelody.me)";

const LINE_TS = /\[\d{1,3}:\d{1,2}(?:[.:]\d{1,3})?\]/g;
const WORD_TS = /<\d{1,3}:\d{1,2}(?:[.:]\d{1,3})?>/g;
const META_LINE = /^\s*\[[a-zA-Z#]+\s*:[^\]]*\]\s*$/;

export function stripLrcTimestamps(text: string | null | undefined): string {
    if (!text) return "";
    return String(text)
        .replace(/\r\n?/g, "\n")
        .split("\n")
        .filter((line) => !META_LINE.test(line))
        .map((line) => line.replace(LINE_TS, "").replace(WORD_TS, "").replace(/[ \t]+/g, " ").trim())
        .filter(Boolean)
        .join("\n");
}

export function truncateUtf8(text: string | null | undefined, maxBytes: number = LYRICS_MAX_BYTES): string {
    if (!text) return "";
    const encoder = new TextEncoder();
    const bytes = encoder.encode(text);
    if (bytes.length <= maxBytes) return text;
    // fatal:false drops a trailing partial code point instead of throwing
    let cut = new TextDecoder("utf-8", { fatal: false }).decode(bytes.slice(0, Math.max(0, maxBytes)));
    if (cut.endsWith("�")) cut = cut.slice(0, -1);
    const boundary = Math.max(cut.lastIndexOf("\n"), cut.lastIndexOf(" "));
    if (boundary >= cut.length * 0.8) cut = cut.slice(0, boundary);
    return cut.trimEnd();
}

export function toSearchableLyrics(
    plain: string | null | undefined,
    synced?: string | null,
    maxBytes: number = LYRICS_MAX_BYTES,
): string | null {
    const text = truncateUtf8(stripLrcTimestamps(plain) || stripLrcTimestamps(synced), maxBytes);
    return text || null;
}

export function hasLrclibId(id: unknown): boolean {
    const v = String(id ?? "").trim();
    return v !== "" && v !== "0";
}

/** Fetches lyrics by LRCLIB id. Never throws; returns null when unavailable/instrumental. */
export async function fetchSearchableLyrics(
    lrclibId: unknown,
    fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
    if (!hasLrclibId(lrclibId)) return null;
    try {
        const res = await fetchImpl(`${LRCLIB_BASE_URL}/get/${encodeURIComponent(String(lrclibId).trim())}`, {
            headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
            signal: AbortSignal.timeout(4000),
        });
        if (!res.ok) return null;
        const body: any = await res.json();
        if (!body || body.instrumental) return null;
        return toSearchableLyrics(body.plainLyrics, body.syncedLyrics);
    } catch {
        return null;
    }
}
