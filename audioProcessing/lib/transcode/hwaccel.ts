import { execFile } from "node:child_process";
import { promisify } from "node:util";
import * as os from "node:os";
import * as fs from "node:fs";
import { extractMeaningfulError } from "../errorUtils";

const execFileAsync = promisify(execFile);

export type VideoEncoderType =
    | "h264_videotoolbox"
    | "h264_nvenc"
    | "h264_qsv"
    | "h264_amf"
    | "h264_vaapi"
    | "h264_v4l2m2m"
    | "libx264";

export type AudioEncoderType =
    | "aac_at"
    | "aac";

export interface HardwareCapabilities {
    platform: NodeJS.Platform;
    arch: string;
    cpuCount: number;
    cpuModel: string;
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
 * Probes whether a specific video encoder actually functions on the host system
 * by running a 1-frame dummy encoding test using FFmpeg's null muxer.
 * Uses a short timeout (3.5s) to guarantee zero stalls or hangs.
 */
async function probeVideoEncoder(encoder: VideoEncoderType, extraProbeArgs: string[] = []): Promise<boolean> {
    try {
        await execFileAsync(
            "ffmpeg",
            [
                "-nostdin",
                "-y",
                "-v", "error",
                "-f", "lavfi",
                "-i", "color=c=black:s=64x64:d=0.04",
                "-c:v", encoder,
                ...extraProbeArgs,
                "-frames:v", "1",
                "-f", "null",
                "-",
            ],
            { timeout: 3500 }
        );
        return true;
    } catch {
        return false;
    }
}

/**
 * Probes whether a specific audio encoder actually functions on the host system
 * by running a 50ms dummy encoding test using FFmpeg's null muxer.
 */
async function probeAudioEncoder(encoder: AudioEncoderType): Promise<boolean> {
    try {
        await execFileAsync(
            "ffmpeg",
            [
                "-nostdin",
                "-y",
                "-v", "error",
                "-f", "lavfi",
                "-i", "anullsrc=r=44100:cl=stereo",
                "-t", "0.05",
                "-c:a", encoder,
                "-f", "null",
                "-",
            ],
            { timeout: 3500 }
        );
        return true;
    } catch {
        return false;
    }
}

/**
 * Probes ffmpeg, the underlying operating system (Linux, macOS, Windows),
 * architecture (x86_64, ARM64/Apple Silicon), and available GPU devices.
 * Actively validates candidate encoders with a live 1-frame test to avoid
 * false positives (such as h264_nvenc compiled in ffmpeg on a machine without NVIDIA drivers).
 * Caches the result in memory for fast subsequent calls.
 */
export async function detectHardwareCapabilities(): Promise<HardwareCapabilities> {
    if (cachedCapabilities) {
        return cachedCapabilities;
    }

    const platform = os.platform();
    const arch = os.arch();
    const cpus = os.cpus() || [];
    const cpuCount = Math.max(1, cpus.length || 2);
    const cpuModel = cpus[0]?.model?.trim() || "Unknown CPU";

    // Check for manual software override via environment variables
    const forceSoftware =
        process.env.FORCE_SOFTWARE_ENCODING === "true" ||
        process.env.DISABLE_HWACCEL === "true";

    let encodersOutput = "";
    let hwaccelsOutput = "";

    try {
        const { stdout: encodersOut } = await execFileAsync("ffmpeg", ["-encoders", "-v", "quiet"], { timeout: 3000 });
        encodersOutput = encodersOut;
    } catch (err: any) {
        console.warn(`[HWACCEL] Could not query ffmpeg -encoders: ${err.message || err}`);
        encodersOutput = "";
    }

    try {
        const { stdout: hwaccelsOut } = await execFileAsync("ffmpeg", ["-hwaccels", "-v", "quiet"], { timeout: 3000 });
        hwaccelsOutput = hwaccelsOut;
    } catch (err: any) {
        console.warn(`[HWACCEL] Could not query ffmpeg -hwaccels: ${err.message || err}`);
        hwaccelsOutput = "";
    }

    // Diagnostic device inspection for Linux / Unix
    let hasNvidiaDevice = false;
    let hasDriDevice = false;
    let hasV4l2Device = false;

    if (platform === "linux") {
        try {
            hasNvidiaDevice =
                fs.existsSync("/dev/nvidia0") ||
                fs.existsSync("/dev/nvidiactl") ||
                Boolean(process.env.NVIDIA_VISIBLE_DEVICES && process.env.NVIDIA_VISIBLE_DEVICES !== "void");
        } catch {
            hasNvidiaDevice = false;
        }

        try {
            hasDriDevice =
                fs.existsSync("/dev/dri/renderD128") ||
                fs.existsSync("/dev/dri/card0");
        } catch {
            hasDriDevice = false;
        }

        try {
            hasV4l2Device =
                fs.existsSync("/dev/video11") ||
                fs.existsSync("/dev/video10");
        } catch {
            hasV4l2Device = false;
        }
    }

    // Default baseline: software CPU encoding
    let videoEncoder: VideoEncoderType = "libx264";
    let audioEncoder: AudioEncoderType = "aac";
    let hwaccelMethod: string | undefined = undefined;
    let isHardwareAccelerated = false;
    let hardwareName = `Software CPU (libx264 - ${arch})`;

    if (forceSoftware) {
        console.log(`[HWACCEL] Hardware acceleration explicitly disabled via environment variable. Using software encoders.`);
    } else {
        // --- 1. DETECT & PROBE VIDEO ENCODER ---
        interface Candidate {
            encoder: VideoEncoderType;
            name: string;
            method?: string;
            probeArgs?: string[];
            condition?: boolean;
        }

        const candidates: Candidate[] = [];

        // macOS: Apple VideoToolbox (Apple Silicon M1-M4 & Intel Macs)
        if (platform === "darwin") {
            candidates.push({
                encoder: "h264_videotoolbox",
                name: arch === "arm64"
                    ? "Apple Silicon VideoToolbox (Hardware GPU & Neural Engine)"
                    : "Apple VideoToolbox (Hardware GPU)",
                method: hwaccelsOutput.includes("videotoolbox") ? "videotoolbox" : undefined,
                probeArgs: [],
            });
        }

        // Linux & Windows GPU candidates:
        if (platform === "linux" || platform === "win32") {
            // Priority 1: NVIDIA NVENC
            candidates.push({
                encoder: "h264_nvenc",
                name: "NVIDIA NVENC (Hardware GPU)",
                method: hwaccelsOutput.includes("cuda") ? "cuda" : undefined,
                probeArgs: ["-preset", "p4"],
                condition: platform === "win32" || hasNvidiaDevice || encodersOutput.includes("h264_nvenc"),
            });

            // Priority 2: Intel Quick Sync Video (QSV)
            candidates.push({
                encoder: "h264_qsv",
                name: "Intel Quick Sync Video (QSV)",
                method: hwaccelsOutput.includes("qsv") ? "qsv" : undefined,
                probeArgs: ["-preset", "fast"],
                condition: platform === "win32" || hasDriDevice || encodersOutput.includes("h264_qsv"),
            });

            // Priority 3: AMD AMF
            candidates.push({
                encoder: "h264_amf",
                name: "AMD AMF (Hardware GPU)",
                probeArgs: [],
                condition: encodersOutput.includes("h264_amf"),
            });
        }

        // Linux ARM V4L2 M2M (Raspberry Pi, SBCs)
        if (platform === "linux" && (arch === "arm64" || arch === "arm")) {
            candidates.push({
                encoder: "h264_v4l2m2m",
                name: "ARM V4L2 M2M (Hardware Video Engine)",
                probeArgs: [],
                condition: hasV4l2Device || encodersOutput.includes("h264_v4l2m2m"),
            });
        }

        // Active Probe Verification: Test candidates in order
        for (const candidate of candidates) {
            if (candidate.condition === false) {
                continue;
            }

            if (!encodersOutput.includes(candidate.encoder)) {
                continue;
            }

            // Perform live 1-frame probe test
            const probeSuccess = await probeVideoEncoder(candidate.encoder, candidate.probeArgs);
            if (probeSuccess) {
                videoEncoder = candidate.encoder;
                hardwareName = candidate.name;
                hwaccelMethod = candidate.method;
                isHardwareAccelerated = true;
                break;
            } else {
                console.log(`[HWACCEL] Candidate encoder ${candidate.encoder} was listed in ffmpeg but failed probe test (GPU driver/device unavailable). Skipping.`);
            }
        }

        // --- 2. DETECT & PROBE AUDIO ENCODER ---
        if (platform === "darwin" && encodersOutput.includes("aac_at")) {
            const aacAtSuccess = await probeAudioEncoder("aac_at");
            if (aacAtSuccess) {
                audioEncoder = "aac_at";
            }
        }
    }

    // --- 3. CONCURRENCY TUNING BASED ON ARCHITECTURE & ACCELERATION ---
    // Video:
    // When hardware acceleration (GPU) is active, CPU usage is minimal, so 2-4 concurrent encodings are safe.
    // When software CPU (libx264) is active:
    // - On 1-2 cores (common cloud CPU VMs): strictly 1 concurrent video encoding to prevent CPU starvation.
    // - On 4 cores: 2 concurrent video encodings.
    // - On 8+ cores: 3 concurrent video encodings.
    const maxVideoConcurrency = isHardwareAccelerated
        ? Math.max(2, Math.min(4, Math.floor(cpuCount / 2)))
        : Math.max(1, Math.min(3, Math.floor(cpuCount / 2)));

    // Audio:
    // AAC encoding is fast and lightweight (few % of single core).
    // On 1-2 cores: 2 concurrent audio encodings.
    // On 4 cores: 4. On 6+ cores: 6.
    const maxAudioConcurrency = Math.max(2, Math.min(6, cpuCount));

    cachedCapabilities = {
        platform,
        arch,
        cpuCount,
        cpuModel,
        videoEncoder,
        audioEncoder,
        hwaccelMethod,
        isHardwareAccelerated,
        hardwareName,
        maxVideoConcurrency,
        maxAudioConcurrency,
    };

    console.log(`[HWACCEL] Detected Hardware Capabilities:`);
    console.log(`  - OS & Arch: ${platform} (${arch})`);
    console.log(`  - CPU: ${cpuCount} cores (${cpuModel})`);
    if (platform === "linux") {
        console.log(`  - Linux Devices: NVIDIA (/dev/nvidia*): ${hasNvidiaDevice ? "present" : "absent"}, DRI (/dev/dri): ${hasDriDevice ? "present" : "absent"}`);
    }
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

export interface VideoExtraOptions {
    duration?: number;
    startSec?: number;
    mute?: boolean;
    fitMode?: "contain" | "cover";
    movflags?: string;
}

/**
 * Builds FFmpeg argument list tailored for the detected hardware or software video encoder.
 */
export function buildVideoEncoderArgs(
    inputPath: string,
    outputPath: string,
    profile: VideoProfileOptions,
    hwCaps: HardwareCapabilities,
    extraOptions: VideoExtraOptions = {}
): string[] {
    const { videoEncoder } = hwCaps;
    const isCover = extraOptions.fitMode === "cover";
    const scaleFilter = isCover
        ? `scale=w=${profile.width}:h=${profile.height}:force_original_aspect_ratio=increase,crop=${profile.width}:${profile.height},format=yuv420p`
        : `scale=w=${profile.width}:h=${profile.height}:force_original_aspect_ratio=decrease,pad=${profile.width}:${profile.height}:(ow-iw)/2:(oh-ih)/2,format=yuv420p`;

    const args: string[] = [
        "-nostdin",
        "-y",
        "-loglevel", "warning",
        "-fflags", "+genpts+discardcorrupt",
        "-err_detect", "ignore_err",
    ];

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

        case "h264_v4l2m2m":
            args.push(
                "-c:v", "h264_v4l2m2m",
                "-b:v", profile.bitrate,
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

    if (extraOptions.movflags) {
        args.push("-movflags", extraOptions.movflags);
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
    extraOptions: VideoExtraOptions = {}
): string[] {
    const isCover = extraOptions.fitMode === "cover";
    const scaleFilter = isCover
        ? `scale=w=${profile.width}:h=${profile.height}:force_original_aspect_ratio=increase,crop=${profile.width}:${profile.height},format=yuv420p`
        : `scale=w=${profile.width}:h=${profile.height}:force_original_aspect_ratio=decrease,pad=${profile.width}:${profile.height}:(ow-iw)/2:(oh-ih)/2,format=yuv420p`;

    const args: string[] = [
        "-nostdin",
        "-y",
        "-loglevel", "warning",
        "-fflags", "+genpts+discardcorrupt",
        "-err_detect", "ignore_err",
    ];

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

    if (extraOptions.movflags) {
        args.push("-movflags", extraOptions.movflags);
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
 * Builds FFmpeg argument list for audio encoding with corrupt packet tolerance.
 */
export function buildAudioEncoderArgs(
    inputPath: string,
    outputPath: string,
    profile: AudioProfileOptions,
    hwCaps: HardwareCapabilities
): string[] {
    return [
        "-nostdin",
        "-y",
        "-loglevel", "warning",
        "-fflags", "+genpts+discardcorrupt",
        "-err_detect", "ignore_err",
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
 * Builds software fallback audio arguments using native aac codec with corrupt packet tolerance.
 */
export function buildSoftwareAudioArgs(
    inputPath: string,
    outputPath: string,
    profile: AudioProfileOptions
): string[] {
    return [
        "-nostdin",
        "-y",
        "-loglevel", "warning",
        "-fflags", "+genpts+discardcorrupt",
        "-err_detect", "ignore_err",
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
 * Sanitizes FFmpeg execution errors to avoid exploding Inngest event payloads or DB columns with hundreds of KB of stderr.
 */
function sanitizeFFmpegError(err: any): Error {
    if (!err) return new Error("Unknown FFmpeg error");
    const meaningful = extractMeaningfulError(err, "FFmpeg command failed");
    const sanitized = new Error(meaningful);
    (sanitized as any).code = err.code;
    return sanitized;
}

/**
 * Executes an FFmpeg command with automatic fallback to software encoding if hardware acceleration fails.
 * If the primary command is already using software encoding (libx264/aac), it does not redundantly re-run the same failing command.
 */
export async function executeFFmpegWithFallback(
    primaryArgs: string[],
    fallbackArgs: string[],
    jobDescription: string
): Promise<void> {
    const isIdentical = primaryArgs.join(" ") === fallbackArgs.join(" ");

    try {
        await execFileAsync("ffmpeg", primaryArgs);
    } catch (primaryErr: any) {
        if (isIdentical) {
            const sanitized = sanitizeFFmpegError(primaryErr);
            console.error(`[FFMPEG] Encoding failed for ${jobDescription}: ${sanitized.message}`);
            throw sanitized;
        }

        console.warn(`[HWACCEL] Primary hardware encoder failed for ${jobDescription}: ${primaryErr.message || primaryErr}. Falling back to software encoding...`);
        try {
            await execFileAsync("ffmpeg", fallbackArgs);
            console.log(`[HWACCEL] Software fallback succeeded for ${jobDescription}`);
        } catch (fallbackErr: any) {
            const sanitized = sanitizeFFmpegError(fallbackErr);
            console.error(`[HWACCEL] Software fallback also failed for ${jobDescription}: ${sanitized.message}`);
            throw sanitized;
        }
    }
}

