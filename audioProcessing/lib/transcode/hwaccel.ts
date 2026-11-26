/**
 * Hardware acceleration ka pata lagana + FFmpeg ke arguments banana.
 *
 * Machine pe kaunsa GPU encoder sach me chalta hai (Apple VideoToolbox, NVIDIA NVENC, Intel QSV, AMD AMF,
 * ARM V4L2) ye 1-frame test chala ke check karte hain. Koi na chale to CPU wala libx264.
 * Saath me video / audio encode ke FFmpeg args banate hain aur GPU fail ho to CPU pe dobara chalate hain.
 *
 * Kaun use karta hai: lib/transcode/* (audio, video, canvas, shorts transcoding).
 */
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

/** Machine ke baare me jo pata chala: kaunsa encoder, kitne cores, ek saath kitne jobs. */
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

// Pehli detection ke baad yahan rakh lete hain - har job pe dobara ffmpeg test nahi chalana padta
let cachedCapabilities: HardwareCapabilities | null = null;

/**
 * Check karo ki ye video encoder is machine pe sach me chalta hai ya nahi:
 * FFmpeg se ek 64x64 kaala frame encode karke "null" output me phenk dete hain.
 * Timeout 3.5s - taaki koi atka hua driver pura startup na rok de.
 * Output: chala to true, koi bhi error / timeout to false.
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
 * Audio encoder ka test: 50ms ki khaali (silent) audio encode karke dekho.
 * Output: chala to true, warna false.
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
 * Machine ki jaankari jodo: OS (Linux / macOS / Windows), CPU architecture (x86_64 / ARM64), GPU devices,
 * aur ffmpeg me kaunse encoders hain. Har GPU encoder ko 1-frame test se sach me check karte hain, kyunki
 * ffmpeg me h264_nvenc "listed" ho sakta hai par machine pe NVIDIA driver hi na ho.
 *
 * Output: HardwareCapabilities (encoder, naam, kitne video / audio jobs ek saath).
 * Result memory me cache hota hai - doosri baar turant milta hai.
 * Kuch bhi fail ho to CPU (libx264 / aac) pe aa jaate hain, error nahi phenkte.
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

    // Env variable se GPU zabardasti band kar sakte hain (debugging ya kharab driver ke liye)
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

    // Linux pe /dev me GPU devices dekho (NVIDIA, Intel/AMD ka DRI, ARM ka V4L2)
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

    // Shuru me maan lo: CPU (software) encoding. GPU mila to neeche badal denge.
    let videoEncoder: VideoEncoderType = "libx264";
    let audioEncoder: AudioEncoderType = "aac";
    let hwaccelMethod: string | undefined = undefined;
    let isHardwareAccelerated = false;
    let hardwareName = `Software CPU (libx264 - ${arch})`;

    if (forceSoftware) {
        console.log(`[HWACCEL] Hardware acceleration explicitly disabled via environment variable. Using software encoders.`);
    } else {
        // --- 1. VIDEO ENCODER DHOONDO AUR TEST KARO ---
        interface Candidate {
            encoder: VideoEncoderType;
            name: string;
            method?: string;
            probeArgs?: string[];
            condition?: boolean;
        }

        const candidates: Candidate[] = [];

        // macOS: Apple VideoToolbox (Apple Silicon M1-M4 aur Intel Macs)
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

        // Linux aur Windows ke GPU options (is order me try honge):
        if (platform === "linux" || platform === "win32") {
            // Pehli pasand: NVIDIA NVENC
            candidates.push({
                encoder: "h264_nvenc",
                name: "NVIDIA NVENC (Hardware GPU)",
                method: hwaccelsOutput.includes("cuda") ? "cuda" : undefined,
                probeArgs: ["-preset", "p4"],
                condition: platform === "win32" || hasNvidiaDevice || encodersOutput.includes("h264_nvenc"),
            });

            // Doosri: Intel Quick Sync Video (QSV)
            candidates.push({
                encoder: "h264_qsv",
                name: "Intel Quick Sync Video (QSV)",
                method: hwaccelsOutput.includes("qsv") ? "qsv" : undefined,
                probeArgs: ["-preset", "fast"],
                condition: platform === "win32" || hasDriDevice || encodersOutput.includes("h264_qsv"),
            });

            // Teesri: AMD AMF
            candidates.push({
                encoder: "h264_amf",
                name: "AMD AMF (Hardware GPU)",
                probeArgs: [],
                condition: encodersOutput.includes("h264_amf"),
            });
        }

        // Linux ARM V4L2 M2M (Raspberry Pi jaise chhote boards)
        if (platform === "linux" && (arch === "arm64" || arch === "arm")) {
            candidates.push({
                encoder: "h264_v4l2m2m",
                name: "ARM V4L2 M2M (Hardware Video Engine)",
                probeArgs: [],
                condition: hasV4l2Device || encodersOutput.includes("h264_v4l2m2m"),
            });
        }

        // Har candidate ko order me test karo - jo pehla chal jaaye wahi use hoga
        for (const candidate of candidates) {
            if (candidate.condition === false) {
                continue;
            }

            if (!encodersOutput.includes(candidate.encoder)) {
                continue;
            }

            // Asli 1-frame test chalao
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

        // --- 2. AUDIO ENCODER (macOS pe Apple ka aac_at, warna normal aac) ---
        if (platform === "darwin" && encodersOutput.includes("aac_at")) {
            const aacAtSuccess = await probeAudioEncoder("aac_at");
            if (aacAtSuccess) {
                audioEncoder = "aac_at";
            }
        }
    }

    // --- 3. EK SAATH KITNE JOBS (CONCURRENCY) ---
    // Video: 1-2 cores = 1; 4 cores = 2; 8+ cores = GPU pe 4 tak, CPU pe 3 tak.
    const maxVideoConcurrency = isHardwareAccelerated
        ? Math.max(1, Math.min(4, Math.floor(cpuCount / 2)))
        : Math.max(1, Math.min(3, Math.floor(cpuCount / 2)));

    // Audio: AAC encoding halka hai, cores ke hisaab se badhta hai (max 6)
    const maxAudioConcurrency = Math.max(1, Math.min(6, cpuCount));

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

/** Ek video quality: size aur bitrate (maxrate / bufsize = bitrate kitna upar-neeche ja sakta hai). */
export interface VideoProfileOptions {
    width: number;
    height: number;
    bitrate: string;
    maxrate: string;
    bufsize: string;
}

/** Extra video options: kahan se shuru, kitni der, awaaz hatao, fit mode, movflags. */
export interface VideoExtraOptions {
    duration?: number;
    startSec?: number;
    mute?: boolean;
    fitMode?: "contain" | "cover";
    movflags?: string;
}

/**
 * Video ka scale filter banao.
 * "cover": frame poora bharo, extra hissa kaat do (crop). "contain" (default): poora video dikhao,
 * khaali jagah kaali patti (pad). format=yuv420p isliye taaki har player / phone chala sake.
 */
function buildScaleFilter(profile: VideoProfileOptions, fitMode: VideoExtraOptions["fitMode"]): string {
    if (fitMode === "cover") {
        return `scale=w=${profile.width}:h=${profile.height}:force_original_aspect_ratio=increase,crop=${profile.width}:${profile.height},format=yuv420p`;
    }
    return `scale=w=${profile.width}:h=${profile.height}:force_original_aspect_ratio=decrease,pad=${profile.width}:${profile.height}:(ow-iw)/2:(oh-ih)/2,format=yuv420p`;
}

/**
 * Har video command ke shuru ke args: input, start time (-ss), lambai (-t) aur scale filter.
 * +discardcorrupt / ignore_err: thoda kharab packet ho to bhi encode chalta rahe, ruke nahi.
 */
function buildVideoInputArgs(inputPath: string, profile: VideoProfileOptions, extraOptions: VideoExtraOptions): string[] {
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
    args.push("-vf", buildScaleFilter(profile, extraOptions.fitMode));
    return args;
}

/**
 * Detect hue encoder (GPU ya CPU) ke hisaab se poori FFmpeg argument list banao.
 * -g 48 = har 48 frames pe ek keyframe (~2 second), taaki HLS chunks saaf jagah se kat sakein.
 * Output: ffmpeg ko dene wala string array (sabse aakhir me outputPath).
 */
export function buildVideoEncoderArgs(
    inputPath: string,
    outputPath: string,
    profile: VideoProfileOptions,
    hwCaps: HardwareCapabilities,
    extraOptions: VideoExtraOptions = {}
): string[] {
    const { videoEncoder } = hwCaps;
    const args = buildVideoInputArgs(inputPath, profile, extraOptions);

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
                "-crf", "22",
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
        // Audio, subtitle aur baaki data streams hata do - video bilkul chup aur halka rahe
        args.push("-an", "-sn", "-dn");
    }

    if (extraOptions.movflags) {
        args.push("-movflags", extraOptions.movflags);
    }

    args.push(outputPath);
    return args;
}

/**
 * CPU (libx264) wale fallback args - GPU encoder fail ho jaaye tab ye chalte hain.
 * buildVideoEncoderArgs ka libx264 wala raasta hi hai, isliye wahi function reuse karte hain.
 */
export function buildSoftwareVideoArgs(
    inputPath: string,
    outputPath: string,
    profile: VideoProfileOptions,
    extraOptions: VideoExtraOptions = {}
): string[] {
    const softwareCaps = { videoEncoder: "libx264" } as HardwareCapabilities;
    return buildVideoEncoderArgs(inputPath, outputPath, profile, softwareCaps, extraOptions);
}

/** Ek audio quality: bitrate, sample rate, channels. */
export interface AudioProfileOptions {
    bitrate: string;
    sampleRate: number;
    channels: number;
}

/**
 * Audio encode ke FFmpeg args (kharab packets ko bardasht karte hue).
 * loudnorm = saare gaano ki awaaz ek jaisi (-16 LUFS), taaki ek gaana dheema aur agla tez na lage.
 * +faststart = file ka index shuru me, taaki download poora hone se pehle hi play ho sake.
 */
function buildAudioArgs(inputPath: string, outputPath: string, profile: AudioProfileOptions, encoder: AudioEncoderType): string[] {
    return [
        "-nostdin",
        "-y",
        "-loglevel", "warning",
        "-fflags", "+genpts+discardcorrupt",
        "-err_detect", "ignore_err",
        "-i", inputPath,
        "-vn",
        "-af", "loudnorm=I=-16:TP=-1.5:LRA=11",
        "-c:a", encoder,
        "-b:a", profile.bitrate,
        "-ar", profile.sampleRate.toString(),
        "-ac", profile.channels.toString(),
        "-movflags", "+faststart",
        outputPath,
    ];
}

/**
 * Detect hue audio encoder (macOS pe aac_at, warna aac) se audio args banao.
 */
export function buildAudioEncoderArgs(
    inputPath: string,
    outputPath: string,
    profile: AudioProfileOptions,
    hwCaps: HardwareCapabilities
): string[] {
    return buildAudioArgs(inputPath, outputPath, profile, hwCaps.audioEncoder);
}

/**
 * Fallback audio args: hamesha normal "aac" codec (har jagah chalta hai).
 */
export function buildSoftwareAudioArgs(
    inputPath: string,
    outputPath: string,
    profile: AudioProfileOptions
): string[] {
    return buildAudioArgs(inputPath, outputPath, profile, "aac");
}

/**
 * FFmpeg ka error chhota karo: poora stderr sau-sau KB ka ho sakta hai, jo Inngest event ya DB column
 * me daalne se sab phool jaata. Sirf kaam ki line aur error code rakhte hain.
 */
function sanitizeFFmpegError(err: any): Error {
    if (!err) return new Error("Unknown FFmpeg error");
    const meaningful = extractMeaningfulError(err, "FFmpeg command failed");
    const sanitized = new Error(meaningful);
    (sanitized as any).code = err.code;
    return sanitized;
}

/**
 * FFmpeg chalao; GPU wala command fail ho to apne aap CPU (software) wale args se dobara chalao.
 * Agar pehla command already software hi tha (dono args same), to wahi fail command dobara nahi chalate.
 * Dono fail hon to chhota kiya hua error phenkte hain.
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

