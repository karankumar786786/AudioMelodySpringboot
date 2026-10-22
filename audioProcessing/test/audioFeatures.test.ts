import { describe, it, expect } from "bun:test";
import * as path from "node:path";
import * as fs from "node:fs";
import { extractAudioFeatures, type AudioFeatures } from "../lib/transcode/audioFeatures";

const AUDIO_ASSET = path.resolve(import.meta.dir, "../asset/test_audio.mp3");
const VIDEO_ASSET = path.resolve(import.meta.dir, "../asset/test_video.mp4");

describe("Spotify-like Audio Feature Extraction", () => {
    it("source test assets must exist and be non-empty", () => {
        expect(fs.existsSync(AUDIO_ASSET)).toBe(true);
        expect(fs.statSync(AUDIO_ASSET).size).toBeGreaterThan(1_000_000);

        expect(fs.existsSync(VIDEO_ASSET)).toBe(true);
        expect(fs.statSync(VIDEO_ASSET).size).toBeGreaterThan(1_000_000);
    });

    describe("Audio Asset (test_audio.mp3)", () => {
        let features: AudioFeatures;

        it("should extract full audio feature profile within timeout", async () => {
            features = await extractAudioFeatures(AUDIO_ASSET);
            expect(features).toBeDefined();
        }, 30_000);

        it("should extract realistic tempo (BPM)", () => {
            expect(features.tempo).toBeGreaterThan(50);
            expect(features.tempo).toBeLessThan(250);
        });

        it("should normalize danceability between 0.0 and 1.0", () => {
            expect(features.danceability).toBeGreaterThanOrEqual(0);
            expect(features.danceability).toBeLessThanOrEqual(1);
        });

        it("should calculate energy between 0.0 and 1.0", () => {
            expect(features.energy).toBeGreaterThanOrEqual(0);
            expect(features.energy).toBeLessThanOrEqual(1);
        });

        it("should calculate valence between 0.0 and 1.0", () => {
            expect(features.valence).toBeGreaterThanOrEqual(0);
            expect(features.valence).toBeLessThanOrEqual(1);
        });

        it("should compute acousticness, instrumentalness, liveness, speechiness", () => {
            expect(features.acousticness).toBeGreaterThanOrEqual(0);
            expect(features.acousticness).toBeLessThanOrEqual(1);

            expect(features.instrumentalness).toBeGreaterThanOrEqual(0);
            expect(features.instrumentalness).toBeLessThanOrEqual(1);

            expect(features.liveness).toBeGreaterThanOrEqual(0);
            expect(features.liveness).toBeLessThanOrEqual(1);

            expect(features.speechiness).toBeGreaterThanOrEqual(0);
            expect(features.speechiness).toBeLessThanOrEqual(1);
        });

        it("should calculate integrated loudness in negative dB/LUFS", () => {
            expect(features.loudness).toBeLessThan(0);
            expect(features.loudness).toBeGreaterThan(-70);
        });

        it("should determine pitch class key (0-11) and modality mode (0 or 1)", () => {
            expect(Number.isInteger(features.key)).toBe(true);
            expect(features.key).toBeGreaterThanOrEqual(0);
            expect(features.key).toBeLessThanOrEqual(11);

            expect([0, 1]).toContain(features.mode);
        });
    });

    describe("Video Asset (test_video.mp4)", () => {
        let features: AudioFeatures;

        it("should extract audio stream and compute audio features from video container", async () => {
            features = await extractAudioFeatures(VIDEO_ASSET);
            expect(features).toBeDefined();

            expect(features.tempo).toBeGreaterThan(50);
            expect(features.danceability).toBeGreaterThanOrEqual(0);
            expect(features.danceability).toBeLessThanOrEqual(1);
            expect(features.energy).toBeGreaterThanOrEqual(0);
            expect(features.energy).toBeLessThanOrEqual(1);
            expect(features.valence).toBeGreaterThanOrEqual(0);
            expect(features.valence).toBeLessThanOrEqual(1);
            expect(features.loudness).toBeLessThan(0);
            expect(features.key).toBeGreaterThanOrEqual(0);
            expect(features.key).toBeLessThanOrEqual(11);
            expect([0, 1]).toContain(features.mode);
        }, 30_000);
    });

    describe("Error Handling", () => {
        it("should throw an error for non-existent media files", async () => {
            const invalidPath = path.resolve(import.meta.dir, "../asset/missing_file.mp3");
            expect(extractAudioFeatures(invalidPath)).rejects.toThrow();
        });
    });
});
