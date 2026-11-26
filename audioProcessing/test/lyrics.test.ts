/** Lyrics helpers ke tests: timestamps hatana, byte limit me kaatna (Hindi akshar na tootein), aur fallback. */
import { describe, it, expect } from "bun:test";
import { stripLrcTimestamps, truncateUtf8, toSearchableLyrics, fetchSearchableLyrics } from "../lib/lyrics";

describe("lyrics normalisation", () => {
    it("strips line/word timestamps and metadata tags", () => {
        const synced = "[ar:Arijit Singh]\n[offset:+200]\n[00:12.34]Hum tere bin ab\n[00:15.00][01:30.50]  Reh nahi sakte  \n[00:18:20]<00:18.20>Tere <00:18.90>bina\n[00:21.00]\n";
        expect(stripLrcTimestamps(synced)).toBe("Hum tere bin ab\nReh nahi sakte\nTere bina");
    });

    it("keeps plain text and collapses blank lines", () => {
        expect(stripLrcTimestamps("a\r\n\r\n\nb [chorus]\n")).toBe("a\nb [chorus]");
        expect(stripLrcTimestamps(null)).toBe("");
    });

    it("truncates to the byte budget without splitting multibyte characters", () => {
        const text = "तुम ही हो ".repeat(500);
        const out = truncateUtf8(text, 1000);
        expect(new TextEncoder().encode(out).length).toBeLessThanOrEqual(1000);
        expect(text.startsWith(out)).toBe(true);
        expect(out.includes("�")).toBe(false);
    });

    it("prefers a word boundary", () => {
        expect(truncateUtf8("hello wonderful world", 17)).toBe("hello wonderful");
        expect(truncateUtf8("short", 100)).toBe("short");
    });

    it("prefers plain lyrics, falls back to stripped synced, null when empty", () => {
        expect(toSearchableLyrics("Line one", "[00:01.00]Other")).toBe("Line one");
        expect(toSearchableLyrics(null, "[00:01.00]Other")).toBe("Other");
        expect(toSearchableLyrics("", "  ")).toBeNull();
    });
});

describe("fetchSearchableLyrics", () => {
    const fakeFetch = (body: any, ok = true) =>
        (async () => ({ ok, json: async () => body })) as unknown as typeof fetch;

    it("skips missing / placeholder ids without calling LRCLIB", async () => {
        let called = false;
        const spy = (async () => { called = true; return { ok: true, json: async () => ({}) }; }) as unknown as typeof fetch;
        expect(await fetchSearchableLyrics("0", spy)).toBeNull();
        expect(await fetchSearchableLyrics(undefined, spy)).toBeNull();
        expect(called).toBe(false);
    });

    it("returns stripped lyrics, null for instrumental / errors", async () => {
        expect(await fetchSearchableLyrics("42", fakeFetch({ syncedLyrics: "[00:01.00]Hi there" }))).toBe("Hi there");
        expect(await fetchSearchableLyrics("42", fakeFetch({ instrumental: true, plainLyrics: "x" }))).toBeNull();
        expect(await fetchSearchableLyrics("42", fakeFetch({}, false))).toBeNull();
        const boom = (async () => { throw new Error("network"); }) as unknown as typeof fetch;
        expect(await fetchSearchableLyrics("42", boom)).toBeNull();
    });
});
