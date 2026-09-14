import { execFile } from "node:child_process";
import { promisify } from "node:util";
import * as fs from "node:fs";
import { NonRetriableError } from "inngest";

const execFileAsync = promisify(execFile);

export interface MediaValidationResult {
    isValid: boolean;
    duration: number;
    hasAudio: boolean;
    hasVideo: boolean;
    formatName?: string;
    audioCodec?: string;
    videoCodec?: string;
    width?: number;
    height?: number;
    channels?: number;
    sampleRate?: number;
    bitrate?: number;
}

/**
 * Pre-flight media integrity validator implementing fail-fast strategy:
 * 1. Physical file presence and non-zero byte check.
 * 2. ffprobe container and stream inspection (verifies stream existence, channel count, duration).
 * 3. Rapid 1.5s bitstream decode smoke test via ffmpeg null muxer.
 *
 * If corruption, empty payload, or missing stream is detected, throws NonRetriableError
 * so Inngest halts immediately without wasting server CPU/GPU resources on futile retries.
 */
export async function validateMediaIntegrity(
    filePath: string,
    expectedType: "audio" | "video" | "any" = "any"
): Promise<MediaValidationResult> {
    // 1. File existence & basic size check
    if (!fs.existsSync(filePath)) {
        throw new NonRetriableError(`Media validation failed: File not found at path: ${filePath}`);
    }

    const stat = fs.statSync(filePath);
    if (stat.size === 0) {
        throw new NonRetriableError(
            "Media validation failed: Source media file is empty (0 bytes). Upload was truncated or aborted."
        );
    }

    if (stat.size < 2048) {
        throw new NonRetriableError(
            `Media validation failed: File is too small (${stat.size} bytes) to contain a valid multimedia bitstream.`
        );
    }

    // 2. ffprobe container and stream analysis
    let ffprobeOutput: any;
    try {
        const { stdout } = await execFileAsync("ffprobe", [
            "-v", "error",
            "-show_format",
            "-show_streams",
            "-print_format", "json",
            filePath,
        ], { timeout: 10000 });
        ffprobeOutput = JSON.parse(stdout);
    } catch (probeErr: any) {
        const msg = probeErr.message || String(probeErr);
        throw new NonRetriableError(`Corrupted media header: Unable to parse container format (${msg.slice(0, 180)})`);
    }

    const format = ffprobeOutput.format || {};
    const streams: any[] = ffprobeOutput.streams || [];

    const audioStreams = streams.filter((s) => s.codec_type === "audio");
    const videoStreams = streams.filter((s) => s.codec_type === "video");

    const hasAudio = audioStreams.length > 0;
    const hasVideo = videoStreams.length > 0;

    // Type-specific requirements
    if (expectedType === "audio" && !hasAudio) {
        throw new NonRetriableError("Corrupted media: The uploaded container does not contain any decodable audio stream.");
    }

    if (expectedType === "video" && !hasVideo) {
        throw new NonRetriableError("Corrupted media: The uploaded container does not contain any decodable video stream.");
    }

    // Duration extraction & validation
    let rawDuration = parseFloat(format.duration ?? "0");
    if ((isNaN(rawDuration) || rawDuration <= 0) && hasAudio) {
        rawDuration = parseFloat(audioStreams[0]?.duration ?? "0");
    }
    if ((isNaN(rawDuration) || rawDuration <= 0) && hasVideo) {
        rawDuration = parseFloat(videoStreams[0]?.duration ?? "0");
    }

    if (isNaN(rawDuration) || rawDuration <= 0.05) {
        throw new NonRetriableError(
            `Invalid media duration: Stream duration is ${rawDuration.toFixed(2)}s (must be > 0.05s). File may be damaged.`
        );
    }

    // 3. Fast Bitstream Decode Smoke Test (first 1.5 seconds)
    // Ensures audio/video packets can be decompressed by FFmpeg without fatal packet/PCE errors
    try {
        await execFileAsync("ffmpeg", [
            "-v", "error",
            "-xerror",
            "-err_detect", "explode",
            "-i", filePath,
            "-t", "1.5",
            "-f", "null",
            "-",
        ], { timeout: 8000 });
    } catch (decodeErr: any) {
        const stderr = decodeErr.stderr || decodeErr.message || "";
        if (
            /Invalid data found|channel element|Gain control|decode_pce|invalid band type|Error submitting packet|corrupt/i.test(
                stderr
            )
        ) {
            throw new NonRetriableError(
                `Corrupted bitstream: Failed initial packet decode test. Source file contains damaged frames.`
            );
        }
    }

    const firstAudio = audioStreams[0];
    const firstVideo = videoStreams[0];

    console.log(`[VALIDATOR] Pre-flight validation passed for ${filePath}:`);
    console.log(`  - Type: ${expectedType} | Format: ${format.format_name} | Duration: ${rawDuration.toFixed(2)}s`);
    if (hasAudio) {
        console.log(`  - Audio: ${firstAudio?.codec_name} (${firstAudio?.channels}ch, ${firstAudio?.sample_rate}Hz)`);
    }
    if (hasVideo) {
        console.log(`  - Video: ${firstVideo?.codec_name} (${firstVideo?.width}x${firstVideo?.height})`);
    }

    return {
        isValid: true,
        duration: rawDuration,
        hasAudio,
        hasVideo,
        formatName: format.format_name,
        audioCodec: firstAudio?.codec_name,
        videoCodec: firstVideo?.codec_name,
        width: firstVideo ? parseInt(firstVideo.width, 10) : undefined,
        height: firstVideo ? parseInt(firstVideo.height, 10) : undefined,
        channels: firstAudio ? parseInt(firstAudio.channels, 10) : undefined,
        sampleRate: firstAudio ? parseInt(firstAudio.sample_rate, 10) : undefined,
        bitrate: format.bit_rate ? parseInt(format.bit_rate, 10) : undefined,
    };
}
