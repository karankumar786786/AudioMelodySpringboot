/** shortRejectionReason ke tests: size, video track, duration limit (aadha second chhoot). */
import { describe, expect, test } from "bun:test";
import { MAX_SHORT_BYTES, MAX_SHORT_SECONDS, shortRejectionReason } from "../functions/processShort";
import { SHORT_QUALITY_PROFILES } from "../lib/transcode/video";

describe("shortRejectionReason", () => {
    const ok = { duration: 20, hasVideo: true, hasAudio: true };

    test("accepts a normal vertical clip", () => {
        expect(shortRejectionReason(ok, 5 * 1024 * 1024)).toBeNull();
    });

    test("accepts a clip without audio (silent shorts are allowed)", () => {
        expect(shortRejectionReason({ ...ok, hasAudio: false }, 1024)).toBeNull();
    });

    test("rejects files over the size limit", () => {
        expect(shortRejectionReason(ok, MAX_SHORT_BYTES + 1)).toContain("larger than");
    });

    test("rejects audio-only files and empty durations", () => {
        expect(shortRejectionReason({ ...ok, hasVideo: false }, 1024)).toContain("no video");
        expect(shortRejectionReason({ ...ok, duration: 0 }, 1024)).toContain("no duration");
    });

    test("rejects clips longer than the limit, with half a second of slack", () => {
        expect(shortRejectionReason({ ...ok, duration: MAX_SHORT_SECONDS + 0.4 }, 1024)).toBeNull();
        expect(shortRejectionReason({ ...ok, duration: MAX_SHORT_SECONDS + 1 }, 1024)).toContain("at most");
    });
});

describe("SHORT_QUALITY_PROFILES", () => {
    test("is a portrait 9:16 ladder, tallest first", () => {
        for (const p of SHORT_QUALITY_PROFILES) {
            expect(p.height).toBeGreaterThan(p.width);
            expect(Math.abs(p.width / p.height - 9 / 16)).toBeLessThan(0.01);
        }
        const heights = SHORT_QUALITY_PROFILES.map((p) => p.height);
        expect([...heights].sort((a, b) => b - a)).toEqual(heights);
    });
});
