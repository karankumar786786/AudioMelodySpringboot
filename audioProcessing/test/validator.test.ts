import { describe, it, expect } from "bun:test";
import * as path from "node:path";
import { validateMediaIntegrity } from "../lib/transcode/validator";

const AUDIO_ASSET = path.resolve(import.meta.dir, "../asset/test_audio.mp3");
const VIDEO_ASSET = path.resolve(import.meta.dir, "../asset/test_video.mp4");

describe("Media Integrity Validator (FFprobe bitstream check)", () => {
    describe("Audio Asset validation (test_audio.mp3)", () => {
        it("should validate MP3 audio file with expectedType = 'audio'", async () => {
            const result = await validateMediaIntegrity(AUDIO_ASSET, "audio");

            expect(result.isValid).toBe(true);
            expect(result.hasAudio).toBe(true);
            expect(result.hasVideo).toBe(false);
            expect(result.duration).toBeGreaterThan(10);
            expect(result.formatName).toBeDefined();
            expect(result.audioCodec).toBe("mp3");
            expect(result.channels).toBeGreaterThanOrEqual(1);
            expect(result.sampleRate).toBeGreaterThan(0);
        });

        it("should validate MP3 audio file with expectedType = 'any'", async () => {
            const result = await validateMediaIntegrity(AUDIO_ASSET, "any");
            expect(result.isValid).toBe(true);
            expect(result.hasAudio).toBe(true);
        });

        it("should fail validation if audio file is checked with expectedType = 'video'", async () => {
            expect(validateMediaIntegrity(AUDIO_ASSET, "video")).rejects.toThrow(/video stream/i);
        });
    });

    describe("Video Asset validation (test_video.mp4)", () => {
        it("should validate MP4 video file with expectedType = 'video'", async () => {
            const result = await validateMediaIntegrity(VIDEO_ASSET, "video");

            expect(result.isValid).toBe(true);
            expect(result.hasAudio).toBe(true);
            expect(result.hasVideo).toBe(true);
            expect(result.duration).toBeGreaterThan(5);
            expect(result.width).toBeGreaterThan(0);
            expect(result.height).toBeGreaterThan(0);
            expect(result.videoCodec).toBeDefined();
        });

        it("should validate MP4 video file with expectedType = 'any'", async () => {
            const result = await validateMediaIntegrity(VIDEO_ASSET, "any");
            expect(result.isValid).toBe(true);
            expect(result.hasVideo).toBe(true);
            expect(result.hasAudio).toBe(true);
        });
    });

    describe("Negative edge cases", () => {
        it("should reject non-existent file path", async () => {
            const missing = path.resolve(import.meta.dir, "../asset/ghost.mp4");
            expect(validateMediaIntegrity(missing)).rejects.toThrow(/file not found/i);
        });
    });
});
