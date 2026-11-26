/**
 * Algolia ke song record ke liye lyrics saaf karna.
 *
 * Lyrics Postgres me save nahi hote; coreEngine zaroorat par LRCLIB se laata hai.
 * Index karte waqt hum song ke lrclibId se lyrics laate hain aur sirf saaf text (timestamps hata ke)
 * ek byte limit tak rakhte hain, taaki record Algolia ki 10KB limit (Build plan) se chhota rahe.
 * adminBackend core/services/lyrics_service.py jaisa hi hai - dono ek saath badlo.
 */

export const LYRICS_MAX_BYTES = Number(process.env.ALGOLIA_LYRICS_MAX_BYTES) || 6000;
const LRCLIB_BASE_URL = "https://lrclib.net/api";
const USER_AGENT = "AudioMelody/1.0 (https://audiomelody.me)";

// [01:23.45] jaisa line timestamp, <01:23.45> jaisa word timestamp, aur [ar: Artist] jaisi meta line
const LINE_TS = /\[\d{1,3}:\d{1,2}(?:[.:]\d{1,3})?\]/g;
const WORD_TS = /<\d{1,3}:\d{1,2}(?:[.:]\d{1,3})?>/g;
const META_LINE = /^\s*\[[a-zA-Z#]+\s*:[^\]]*\]\s*$/;

/** LRC text se timestamps aur meta lines hatao, faltu spaces aur khaali lines bhi. Khaali input = "". */
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

/**
 * Text ko maxBytes (UTF-8 bytes, akshar nahi) tak kaato. Hindi ka ek akshar 3 bytes ka hota hai, isliye bytes ginte hain.
 * Aakhir ka adhoora akshar hata dete hain, aur agar aakhri 20% me koi space / newline ho to wahan se kaatte hain (shabd na tute).
 */
export function truncateUtf8(text: string | null | undefined, maxBytes: number = LYRICS_MAX_BYTES): string {
    if (!text) return "";
    const encoder = new TextEncoder();
    const bytes = encoder.encode(text);
    if (bytes.length <= maxBytes) return text;
    // fatal:false: aakhir me adhoora akshar ho to error phenkne ke bajaye use \uFFFD bana deta hai (jo agli line hatati hai)
    let cut = new TextDecoder("utf-8", { fatal: false }).decode(bytes.slice(0, Math.max(0, maxBytes)));
    if (cut.endsWith("�")) cut = cut.slice(0, -1);
    const boundary = Math.max(cut.lastIndexOf("\n"), cut.lastIndexOf(" "));
    if (boundary >= cut.length * 0.8) cut = cut.slice(0, boundary);
    return cut.trimEnd();
}

/** Plain lyrics ho to wahi, warna synced se timestamps hata ke; phir byte limit tak kaato. Kuch na bache to null. */
export function toSearchableLyrics(
    plain: string | null | undefined,
    synced?: string | null,
    maxBytes: number = LYRICS_MAX_BYTES,
): string | null {
    const text = truncateUtf8(stripLrcTimestamps(plain) || stripLrcTimestamps(synced), maxBytes);
    return text || null;
}

/** Sahi LRCLIB id hai? Khaali ya "0" (upload form ka "lyrics nahi") = false. */
export function hasLrclibId(id: unknown): boolean {
    const v = String(id ?? "").trim();
    return v !== "" && v !== "0";
}

/** LRCLIB id se lyrics lao (4 second timeout). Kabhi error nahi phenkta; na mile / instrumental ho to null. */
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
