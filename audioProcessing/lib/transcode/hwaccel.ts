import { execFile } from "node:child_process";
import { promisify } from "node:util";
import * as os from "node:os";

const execFileAsync = promisify(execFile);

export type VideoEncoderType =
    | "h264_videotoolbox"
    | "h264_nvenc"
    | "h264_qsv"
    | "h264_amf"
    | "h264_vaapi"
    | "libx264";

export type AudioEncoderType =
    | "aac_at"
    | "aac";

export interface HardwareCapabilities {
    platform: NodeJS.Platform;
    cpuCount: number;
    videoEncoder: VideoEncoderType;
    audioEncoder: AudioEncoderType;
    hwaccelMethod?: string;
    isHardwareAccelerated: boolean;
    hardwareName: string;
    maxVideoConcurrency: number;
    maxAudioConcurrency: number;
}

let cachedCapabilities: HardwareCapabilities | null = null;

/**
 * Probes ffmpeg to detect available hardware acceleration encoders and methods.
 * Caches the result in memory for fast subsequent calls.
 */
export async function detectHardwareCapabilities(): Promise<HardwareCapabilities> {
    if (cachedCapabilities) {
        return cachedCapabilities;
    }

    const platform = os.platform();
    const cpuCount = os.cpus().length || 4;

    let encodersOutput = "";
    let hwaccelsOutput = "";

    try {
        const { stdout: encodersOut } = await execFileAsync("ffmpeg", ["-encoders", "-v", "quiet"]);
        encodersOutput = encodersOut;
    } catch {
        encodersOutput = "";
    }

    try {
        const { stdout: hwaccelsOut } = await execFileAsync("ffmpeg", ["-hwaccels", "-v", "quiet"]);
        hwaccelsOutput = hwaccelsOut;
    } catch {
        hwaccelsOutput = "";
    }

    let videoEncoder: VideoEncoderType = "libx264";
    let audioEncoder: AudioEncoderType = "aac";
    let hwaccelMethod: string | undefined = undefined;
    let isHardwareAccelerated = false;
    let hardwareName = "Software (CPU libx264 / aac)";

    // 1. Detect Audio Encoder (macOS AudioToolbox if present)
    if (platform === "darwin" && encodersOutput.includes("aac_at")) {
        audioEncoder = "aac_at";
    }

    // 2. Detect Video Encoder by Priority:
    // Priority 1: macOS VideoToolbox (Apple Silicon / Intel Mac T2)
    if (platform === "darwin" && encodersOutput.includes("h264_videotoolbox")) {
        videoEncoder = "h264_videotoolbox";
        hwaccelMethod = hwaccelsOutput.includes("videotoolbox") ? "videotoolbox" : undefined;
        isHardwareAccelerated = true;
        hardwareName = "Apple VideoToolbox (Hardware GPU / Neural Engine)";
    }
    // Priority 2: NVIDIA NVENC
    else if (encodersOutput.includes("h264_nvenc")) {
        videoEncoder = "h264_nvenc";
        hwaccelMethod = hwaccelsOutput.includes("cuda") ? "cuda" : undefined;
        isHardwareAccelerated = true;
        hardwareName = "NVIDIA NVENC (Hardware GPU)";
    }
    // Priority 3: Intel Quick Sync Video (QSV)
    else if (encodersOutput.includes("h264_qsv")) {
        videoEncoder = "h264_qsv";
        hwaccelMethod = hwaccelsOutput.includes("qsv") ? "qsv" : undefined;
        isHardwareAccelerated = true;
        hardwareName = "Intel Quick Sync Video (QSV)";
    }
    // Priority 4: AMD AMF
    else if (encodersOutput.includes("h264_amf")) {
        videoEncoder = "h264_amf";
        isHardwareAccelerated = true;
        hardwareName = "AMD AMF (Hardware GPU)";
    }
    // Priority 5: Linux VAAPI
    else if (encodersOutput.includes("h264_vaapi") && hwaccelsOutput.includes("vaapi")) {
        videoEncoder = "h264_vaapi";
        hwaccelMethod = "vaapi";
        isHardwareAccelerated = true;
        hardwareName = "Linux VAAPI (Hardware)";
    }

    // Determine safe concurrency limits
    // Hardware encoders offload heavily from CPU, allowing 2-4 concurrent video encodings.
    // Audio encoding is lightweight, allowing 3-8 concurrent encodings.
    const maxVideoConcurrency = isHardwareAccelerated
        ? Math.max(2, Math.min(4, Math.floor(cpuCount / 2)))
        : Math.max(1, Math.min(3, Math.floor(cpuCount / 4)));

    const maxAudioConcurrency = Math.max(3, Math.min(6, cpuCount));

    cachedCapabilities = {
        platform,
        cpuCount,
        videoEncoder,
        audioEncoder,
        hwaccelMethod,
        isHardwareAccelerated,
        hardwareName,
        maxVideoConcurrency,
        maxAudioConcurrency,
    };

    console.log(`[HWACCEL] Detected Hardware Capabilities:`);
    console.log(`  - Platform: ${platform} (${cpuCount} cores)`);
    console.log(`  - Video Accelerator: ${hardwareName} -> ${videoEncoder}`);
    console.log(`  - Audio Encoder: ${audioEncoder}`);
    console.log(`  - Max Concurrency (Video: ${maxVideoConcurrency}, Audio: ${maxAudioConcurrency})`);

    return cachedCapabilities;
}

export interface VideoProfileOptions {
    width: number;
    height: number;
    bitrate: string;
    maxrate: string;
    bufsize: string;
}

/**
 * Builds FFmpeg argument list tailored for the detected hardware or software video encoder.
 */
export function buildVideoEncoderArgs(
    inputPath: string,
    outputPath: string,
    profile: VideoProfileOptions,
    hwCaps: HardwareCapabilities,
    extraOptions: { duration?: number; startSec?: number; mute?: boolean } = {}
): string[] {
    const { videoEncoder } = hwCaps;
    const scaleFilter = `scale=w=${profile.width}:h=${profile.height}:force_original_aspect_ratio=decrease,pad=${profile.width}:${profile.height}:(ow-iw)/2:(oh-ih)/2,format=yuv420p`;

    const args: string[] = ["-y", "-loglevel", "warning"];

    if (typeof extraOptions.startSec === "number" && extraOptions.startSec >= 0) {
        args.push("-ss", extraOptions.startSec.toString());
    }

    if (typeof extraOptions.duration === "number" && extraOptions.duration > 0) {
        args.push("-t", extraOptions.duration.toString());
    }

    args.push("-i", inputPath);
    args.push("-vf", scaleFilter);

    switch (videoEncoder) {
        case "h264_videotoolbox":
            args.push(
                "-c:v", "h264_videotoolbox",
                "-b:v", profile.bitrate,
                "-maxrate", profile.maxrate,
                "-bufsize", profile.bufsize,
                "-profile:v", "high",
                "-g", "48",
                "-realtime", "0"
            );
            break;

        case "h264_nvenc":
            args.push(
                "-c:v", "h264_nvenc",
                "-preset", "p4",
                "-profile:v", "high",
                "-b:v", profile.bitrate,
                "-maxrate", profile.maxrate,
                "-bufsize", profile.bufsize,
                "-g", "48",
                "-keyint_min", "48"
            );
            break;

        case "h264_qsv":
            args.push(
                "-c:v", "h264_qsv",
                "-preset", "fast",
                "-profile:v", "high",
                "-b:v", profile.bitrate,
                "-maxrate", profile.maxrate,
                "-bufsize", profile.bufsize,
                "-g", "48"
            );
            break;

        case "h264_amf":
            args.push(
                "-c:v", "h264_amf",
                "-b:v", profile.bitrate,
                "-maxrate", profile.maxrate,
                "-bufsize", profile.bufsize,
                "-g", "48"
            );
            break;

        case "libx264":
        default:
            args.push(
                "-c:v", "libx264",
                "-preset", "fast",
                "-profile:v", "high",
                "-b:v", profile.bitrate,
                "-maxrate", profile.maxrate,
                "-bufsize", profile.bufsize,
                "-g", "48",
                "-keyint_min", "48",
                "-sc_threshold", "0"
            );
            break;
    }

    if (extraOptions.mute !== false) {
        args.push("-an");
    }

    args.push(outputPath);
    return args;
}

/**
 * Builds standard software fallback arguments using libx264.
 */
export function buildSoftwareVideoArgs(
    inputPath: string,
    outputPath: string,
    profile: VideoProfileOptions,
    extraOptions: { duration?: number; startSec?: number; mute?: boolean } = {}
): string[] {
    const scaleFilter = `scale=w=${profile.width}:h=${profile.height}:force_original_aspect_ratio=decrease,pad=${profile.width}:${profile.height}:(ow-iw)/2:(oh-ih)/2,format=yuv420p`;
    const args: string[] = ["-y", "-loglevel", "warning"];

    if (typeof extraOptions.startSec === "number" && extraOptions.startSec >= 0) {
        args.push("-ss", extraOptions.startSec.toString());
    }

    if (typeof extraOptions.duration === "number" && extraOptions.duration > 0) {
        args.push("-t", extraOptions.duration.toString());
    }

    args.push("-i", inputPath);
    args.push("-vf", scaleFilter);
    args.push(
        "-c:v", "libx264",
        "-preset", "fast",
        "-profile:v", "high",
        "-b:v", profile.bitrate,
        "-maxrate", profile.maxrate,
        "-bufsize", profile.bufsize,
        "-g", "48",
        "-keyint_min", "48",
        "-sc_threshold", "0"
    );

    if (extraOptions.mute !== false) {
        args.push("-an");
    }

    args.push(outputPath);
    return args;
}

export interface AudioProfileOptions {
    bitrate: string;
    sampleRate: number;
    channels: number;
}

/**
 * Builds FFmpeg argument list for audio encoding.
 */
export function buildAudioEncoderArgs(
    inputPath: string,
    outputPath: string,
    profile: AudioProfileOptions,
    hwCaps: HardwareCapabilities
): string[] {
    return [
        "-y",
        "-loglevel", "warning",
        "-i", inputPath,
        "-vn",
        "-c:a", hwCaps.audioEncoder,
        "-b:a", profile.bitrate,
        "-ar", profile.sampleRate.toString(),
        "-ac", profile.channels.toString(),
        "-movflags", "+faststart",
        outputPath,
    ];
}

/**
 * Builds software fallback audio arguments using native aac codec.
 */
export function buildSoftwareAudioArgs(
    inputPath: string,
    outputPath: string,
    profile: AudioProfileOptions
): string[] {
    return [
        "-y",
        "-loglevel", "warning",
        "-i", inputPath,
        "-vn",
        "-c:a", "aac",
        "-b:a", profile.bitrate,
        "-ar", profile.sampleRate.toString(),
        "-ac", profile.channels.toString(),
        "-movflags", "+faststart",
        outputPath,
    ];
}

/**
 * Executes an FFmpeg command with automatic fallback to software encoding if hardware acceleration fails.
 */
export async function executeFFmpegWithFallback(
    primaryArgs: string[],
    fallbackArgs: string[],
    jobDescription: string
): Promise<void> {
    try {
        await execFileAsync("ffmpeg", primaryArgs);
    } catch (primaryErr: any) {
        console.warn(`[HWACCEL] Primary encoder failed for ${jobDescription}: ${primaryErr.message || primaryErr}. Falling back to software encoding...`);
        try {
            await execFileAsync("ffmpeg", fallbackArgs);
            console.log(`[HWACCEL] Software fallback succeeded for ${jobDescription}`);
        } catch (fallbackErr: any) {
            console.error(`[HWACCEL] Software fallback also failed for ${jobDescription}: ${fallbackErr.message || fallbackErr}`);
            throw fallbackErr;
        }
    }
}
