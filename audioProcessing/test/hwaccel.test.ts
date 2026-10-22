import { describe, it, expect } from "bun:test";
import {
    detectHardwareCapabilities,
    buildAudioEncoderArgs,
    buildSoftwareAudioArgs,
    buildVideoEncoderArgs,
    buildSoftwareVideoArgs,
} from "../lib/transcode/hwaccel";

describe("Hardware Acceleration Detection & Encoder Selection", () => {
    it("should detect available hardware encoder capabilities on current system", async () => {
        const caps = await detectHardwareCapabilities();

        expect(caps).toBeDefined();
        expect(typeof caps.platform).toBe("string");
        expect(typeof caps.cpuCount).toBe("number");
        expect(typeof caps.videoEncoder).toBe("string");
        expect(typeof caps.audioEncoder).toBe("string");
        expect(typeof caps.isHardwareAccelerated).toBe("boolean");
        expect(typeof caps.hardwareName).toBe("string");
        expect(caps.maxVideoConcurrency).toBeGreaterThanOrEqual(1);
        expect(caps.maxAudioConcurrency).toBeGreaterThanOrEqual(1);
    });

    it("should build valid audio encoder args", async () => {
        const caps = await detectHardwareCapabilities();
        const profile = { bitrate: "128k", sampleRate: 44100, channels: 2 };
        const args = buildAudioEncoderArgs("/tmp/input.mp3", "/tmp/output.m4a", profile, caps);

        expect(Array.isArray(args)).toBe(true);
        expect(args).toContain("-b:a");
        expect(args).toContain("128k");
        expect(args).toContain("-ar");
        expect(args).toContain("44100");
        expect(args).toContain("-ac");
        expect(args).toContain("2");
        expect(args).toContain("/tmp/output.m4a");
    });

    it("should build valid software fallback audio args", () => {
        const profile = { bitrate: "256k", sampleRate: 48000, channels: 2 };
        const args = buildSoftwareAudioArgs("/tmp/input.mp3", "/tmp/output.m4a", profile);

        expect(args).toContain("-c:a");
        expect(args).toContain("aac");
        expect(args).toContain("-b:a");
        expect(args).toContain("256k");
        expect(args).toContain("/tmp/output.m4a");
    });

    it("should build valid video encoder args", async () => {
        const caps = await detectHardwareCapabilities();
        const profile = { width: 1280, height: 720, bitrate: "2500k", maxrate: "3000k", bufsize: "5000k" };
        const args = buildVideoEncoderArgs("/tmp/input.mp4", "/tmp/output.mp4", profile, caps, { startSec: 0, duration: 4 });

        expect(Array.isArray(args)).toBe(true);
        expect(args).toContain("-b:v");
        expect(args).toContain("2500k");
        expect(args).toContain("/tmp/output.mp4");
    });

    it("should build valid software fallback video args", () => {
        const profile = { width: 854, height: 480, bitrate: "1200k", maxrate: "1500k", bufsize: "2400k" };
        const args = buildSoftwareVideoArgs("/tmp/input.mp4", "/tmp/output.mp4", profile, { startSec: 0, duration: 4 });

        expect(args).toContain("-c:v");
        expect(args).toContain("libx264");
        expect(args).toContain("-b:v");
        expect(args).toContain("1200k");
        expect(args).toContain("/tmp/output.mp4");
    });
});
