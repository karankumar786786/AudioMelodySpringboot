import { describe, it, expect, afterAll } from "bun:test";
import * as path from "node:path";
import * as fs from "node:fs";
import * as os from "node:os";
import { AudioTranscoder } from "../lib/transcode";
import { cutCanvasVideo, extractAudioFromVideo } from "../lib/transcode/video";
import { validateMediaIntegrity } from "../lib/transcode/validator";

const AUDIO_ASSET = path.resolve(import.meta.dir, "../asset/test_audio.mp3");
const VIDEO_ASSET = path.resolve(import.meta.dir, "../asset/test_video.mp4");

const testTempDirs: string[] = [];

function createTempDir(prefix: string): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    testTempDirs.push(dir);
    return dir;
}

afterAll(() => {
    for (const d of testTempDirs) {
        try {
            if (fs.existsSync(d)) {
                fs.rmSync(d, { recursive: true, force: true });
            }
        } catch {
            // ignore cleanup errors
        }
    }
});

const hasPackager = (() => {
    try {
        const { execSync } = require("node:child_process");
        const bin = process.env.SHAKA_PACKAGER_PATH || "packager";
        execSync(`${bin} --version`, { stdio: "ignore" });
        return true;
    } catch {
        return false;
    }
})();

describe("Transcoding Pipelines (HLS & Canvas Encoding)", () => {
    describe("Audio Transcoder Pipeline with test_audio.mp3", () => {
        it("should execute multi-bitrate HLS encoding and Shaka packaging", async () => {
            if (!hasPackager) {
                console.warn("[WARN] Shaka Packager binary not found in PATH — skipping packaging test");
                expect(true).toBe(true);
                return;
            }

            const outDir = createTempDir("audio-test-out-");
            const uploadedKeys: string[] = [];

            // Mock S3 Client to capture packaged outputs
            const mockS3Client: any = {
                send: async (command: any) => {
                    if (command?.input?.Key) {
                        uploadedKeys.push(command.input.Key);
                    }
                    return {};
                },
            };

            const transcoder = new AudioTranscoder(4, mockS3Client, "songs", "mock-prod-bucket");
            const result = await transcoder.transcode(AUDIO_ASSET, outDir, "job-unit-test");

            // Verify duration
            expect(result.duration).toBeGreaterThan(10);

            // Verify expected HLS & DASH files were packaged and uploaded to S3
            expect(uploadedKeys.length).toBeGreaterThan(0);

            const hasMasterM3u8 = uploadedKeys.some((k) => k.endsWith("master.m3u8"));
            const hasMasterMpd = uploadedKeys.some((k) => k.endsWith("master.mpd"));
            const hasAudioSegments = uploadedKeys.some((k) => k.includes("/audio/"));

            expect(hasMasterM3u8).toBe(true);
            expect(hasMasterMpd).toBe(true);
            expect(hasAudioSegments).toBe(true);
        }, 60_000);
    });

    describe("Video Operations with test_video.mp4", () => {
        it("should extract audio stream from video container (extractAudioFromVideo)", async () => {
            const tempDir = createTempDir("video-extract-out-");
            const outAudioPath = path.join(tempDir, "extracted_audio.m4a");

            await extractAudioFromVideo(VIDEO_ASSET, outAudioPath);

            expect(fs.existsSync(outAudioPath)).toBe(true);
            expect(fs.statSync(outAudioPath).size).toBeGreaterThan(10_000);

            const meta = await validateMediaIntegrity(outAudioPath, "audio");
            expect(meta.isValid).toBe(true);
            expect(meta.hasAudio).toBe(true);
            expect(meta.duration).toBeGreaterThan(3);
        }, 30_000);

        it("should cut a 5-second muted canvas video loop (cutCanvasVideo)", async () => {
            const tempDir = createTempDir("video-canvas-out-");
            const outCanvasPath = path.join(tempDir, "canvas_preview.mp4");

            await cutCanvasVideo(VIDEO_ASSET, outCanvasPath, 0, 5);

            expect(fs.existsSync(outCanvasPath)).toBe(true);
            expect(fs.statSync(outCanvasPath).size).toBeGreaterThan(10_000);

            const meta = await validateMediaIntegrity(outCanvasPath, "video");
            expect(meta.isValid).toBe(true);
            expect(meta.hasVideo).toBe(true);
            expect(meta.duration).toBeGreaterThanOrEqual(4.5);
            expect(meta.duration).toBeLessThanOrEqual(6.0);
        }, 30_000);
    });
});
