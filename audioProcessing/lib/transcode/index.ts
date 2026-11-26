/**
 * AudioTranscoder: ek gaane ki audio file ko streaming ke layak banata hai.
 *
 * Flow: file check -> 3 quality (128 / 240 / 320 kbps) AAC me encode -> Shaka Packager se HLS (master.m3u8)
 * aur DASH (master.mpd) ke chhote chunks (4 second) -> saare chunks production S3 me upload -> local safai.
 *
 * HLS / DASH = gaane ko chhote tukdon me baant ke bhejna, taaki player turant shuru ho aur net ke
 * hisaab se quality badal sake. Kaun call karta hai: functions/transcodeAudio.ts.
 */
import * as path from "node:path";
import * as fs from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import pLimit from "p-limit";

const execFileAsync = promisify(execFile);

import {
    detectHardwareCapabilities,
    buildAudioEncoderArgs,
    buildSoftwareAudioArgs,
    executeFFmpegWithFallback,
} from "./hwaccel";

import {
    safeRemovePath,
    registerActiveTmpPath,
    unregisterActiveTmpPath,
} from "./cleanup";
import { validateMediaIntegrity } from "./validator";
import { getAllFiles, patchMpdForVod } from "./packaging";
import { CONCURRENT_TRANSCODING_LIMIT } from "./limiter";

/** Ek audio quality ki setting. */
export interface AudioQualityProfile {
    label: string;
    bitrate: string;    // jaise "128k"
    sampleRate: number; // Hz, jaise 44100
    channels: number;   // 1 = mono, 2 = stereo
    bandwidth: number;  // bits/s jo HLS/DASH manifest me likha jaata hai (player quality chunne me use karta hai)
}

/** Teen AAC qualities: 128, 240, 320 kbps. */
export const AUDIO_QUALITY_PROFILES: AudioQualityProfile[] = [
    { label: "128kbps", bitrate: "128k", sampleRate: 44100, channels: 2, bandwidth: 128000 },
    { label: "240kbps", bitrate: "240k", sampleRate: 44100, channels: 2, bandwidth: 240000 },
    { label: "320kbps", bitrate: "320k", sampleRate: 44100, channels: 2, bandwidth: 320000 },
];

/**
 * Audio transcoding ka poora kaam (upar file header dekho).
 * segmentTime = har chunk kitne second ka; S3 upload ek saath 5 files tak (pLimit(5)).
 */
export class AudioTranscoder {
    private readonly segmentTime: number;
    private readonly client: S3Client;
    private readonly basePath: string;
    private readonly limit = pLimit(5);
    private readonly bucketName: string;

    constructor(
        segmentTime: number = 4,
        client: S3Client,
        basePath: string,
        bucketName: string,
    ) {
        this.segmentTime = segmentTime;
        this.client = client;
        this.basePath = basePath;
        this.bucketName = bucketName;
    }

    /**
     * Poora pipeline chalao: encode -> package -> S3 upload. Output: { duration } (seconds).
     * s3DirName = S3 me folder ka naam (aam taur pe songId). Kuch bhi fail ho to error phenkta hai,
     * par local folder finally me hamesha saaf hota hai.
     */
    async transcode(inputAudio: string, outputDir: string, s3DirName?: string): Promise<{ duration: number }> {
        console.log(`--- Starting Audio Transcoding Process ---`);
        console.log(`Input:  ${inputAudio}`);
        console.log(`Output: ${outputDir}`);

        fs.mkdirSync(outputDir, { recursive: true });
        registerActiveTmpPath(outputDir);

        try {
            const duration = await this.getAudioDuration(inputAudio);
            if (duration <= 0) throw new Error("Invalid audio duration, cannot transcode");

            console.log(`Duration: ${duration.toFixed(2)}s — segment size: ${this.segmentTime}s`);

            const audioName = s3DirName || path.basename(outputDir);

            // STEP 1: input -> 3 bitrate ki AAC files (ek saath, GPU / aac_at mile to wahi)
            const audioDir = path.join(outputDir, "audio");
            fs.mkdirSync(audioDir, { recursive: true });
            const rawAudioPaths = await this.transcodeAudio(inputAudio, audioDir);

            // STEP 2: Shaka Packager -> master.m3u8 (HLS) + master.mpd (DASH) aur chunks
            await this.runShakaPackager(outputDir, rawAudioPaths);

            // STEP 3: chunks S3 pe upload (beech ki raw_audio_*.m4a files nahi - wo sirf packager ke liye thi)
            const allFiles = getAllFiles(outputDir);
            const filesToUpload = allFiles.filter(fp => !/raw_audio_.*\.m4a$/.test(fp));

            const totalFiles = filesToUpload.length;
            console.log(`[AUDIO S3] Uploading ${totalFiles} packaged HLS/DASH files to s3://${this.bucketName}/${this.basePath}/${audioName}...`);
            let uploadedCount = 0;
            let lastReportedPercent = 0;

            const uploadPromises = filesToUpload.map(fp =>
                this.limit(async () => {
                    await this.uploadFileToS3(fp, outputDir, audioName, this.bucketName);
                    uploadedCount++;
                    const percent = Math.floor((uploadedCount / totalFiles) * 100);
                    if (percent >= lastReportedPercent + 25 || uploadedCount === totalFiles) {
                        lastReportedPercent = percent;
                        console.log(`[AUDIO S3] Upload progress: ${percent}% (${uploadedCount}/${totalFiles} files uploaded)`);
                    }
                })
            );
            await Promise.all(uploadPromises);
            console.log(`[AUDIO S3] All ${totalFiles} files uploaded successfully`);

            console.log(`--- Audio Transcoding Completed ---`);
            return { duration };
        } finally {
            // SAFAI: kaam ho ya error, local files hamesha hatao
            await safeRemovePath(outputDir);
            console.log(`Local transcoding directory cleaned up: ${outputDir}`);
        }
    }

    /** File ki jaanch (validator) karo aur duration lautao. Kharab file = NonRetriableError. */
    private async getAudioDuration(audioPath: string): Promise<number> {
        const validation = await validateMediaIntegrity(audioPath, "audio");
        return validation.duration;
    }

    /** Har quality profile ki AAC file banao (ek saath kitne - hardware aur global limit me se kam). Output: file paths. */
    private async transcodeAudio(inputAudio: string, audioDir: string): Promise<string[]> {
        const hwCaps = await detectHardwareCapabilities();
        const concurrency = Math.max(1, Math.min(hwCaps.maxAudioConcurrency, CONCURRENT_TRANSCODING_LIMIT));
        const audioConcurrency = pLimit(concurrency);

        console.log(`[AUDIO] Transcoding ${AUDIO_QUALITY_PROFILES.length} profiles (concurrency=${concurrency}, encoder=${hwCaps.audioEncoder})...`);

        const transcodeTasks = AUDIO_QUALITY_PROFILES.map((profile) =>
            audioConcurrency(async () => {
                const outPath = path.join(audioDir, `raw_audio_${profile.label}.m4a`);
                const primaryArgs = buildAudioEncoderArgs(inputAudio, outPath, profile, hwCaps);
                const fallbackArgs = buildSoftwareAudioArgs(inputAudio, outPath, profile);

                await executeFFmpegWithFallback(
                    primaryArgs,
                    fallbackArgs,
                    `audio profile ${profile.label} (${profile.bitrate})`
                );
                console.log(`[AUDIO] Transcoded profile -> ${profile.label}`);
                return outPath;
            })
        );

        return await Promise.all(transcodeTasks);
    }

    /** Shaka Packager chalao: har quality ke chunks + playlist, aur master HLS / DASH files. Fail = error phenko. */
    private async runShakaPackager(outputDir: string, rawAudioPaths: string[]): Promise<void> {
        console.log(`Packaging with Shaka Packager...`);

        // Shaka ko hamesha "/" wale paths chahiye (Windows ke "\\" nahi)
        const toShaka = (p: string) => p.replace(/\\/g, "/");
        const audioDir = path.join(outputDir, "audio");

        const streamDescriptors = rawAudioPaths.map((rawPath, i) => {
            const profile = AUDIO_QUALITY_PROFILES[i]!;
            const profileDir = path.join(audioDir, profile.label);
            fs.mkdirSync(profileDir, { recursive: true });

            return [
                `in=${toShaka(rawPath)}`,
                `stream=audio`,
                `init_segment=${toShaka(path.join(profileDir, "init.mp4"))}`,
                `segment_template=${toShaka(path.join(profileDir, `${profile.label}_$Number%05d$.m4s`))}`,
                `playlist_name=${toShaka(path.join(profileDir, "playlist.m3u8"))}`,
                `bandwidth=${profile.bandwidth}`,
            ].join(",");
        });

        const args: string[] = [
            ...streamDescriptors,
            "--mpd_output", toShaka(path.join(outputDir, "master.mpd")),
            "--hls_master_playlist_output", toShaka(path.join(outputDir, "master.m3u8")),
            "--segment_duration", this.segmentTime.toString(),
            "--generate_static_live_mpd",
            "--segment_template_constant_duration",
            "--allow_approximate_segment_timeline",
        ];

        const packagerBin = process.env.SHAKA_PACKAGER_PATH || "packager";

        try {
            await execFileAsync(packagerBin, args, { maxBuffer: 10 * 1024 * 1024 });
            if (patchMpdForVod(path.join(outputDir, "master.mpd"))) {
                console.log(`MPD patched for VOD`);
            }
            console.log(`Packaging complete`);
        } catch (err: any) {
            console.error(`Packaging failed: ${err.message ?? err}`);
            throw err;
        }
    }

    /**
     * Ek file S3 pe daalo: key = basePath/audioName/<folder ke andar ka path>.
     * Fail ho to maxRetries (10) tak dobara, har baar thoda zyada ruk ke (1s, 2s, 3s...). Phir bhi fail = error.
     * CacheControl "no-transform": CDN / proxy chunks ko compress ya badle nahi.
     */
    private async uploadFileToS3(
        filePath: string,
        outputDir: string,
        audioName: string,
        bucketName: string,
        maxRetries = 10,
    ): Promise<void> {
        const relPath = path.relative(outputDir, filePath);
        const s3Key = `${this.basePath}/${audioName}/${relPath}`.replace(/\\/g, "/");
        const contentType = this.resolveContentType(filePath);

        for (let i = 0; i < maxRetries; i++) {
            try {
                const body = fs.readFileSync(filePath);

                await this.client.send(new PutObjectCommand({
                    Bucket: bucketName,
                    Key: s3Key,
                    Body: body,
                    ContentType: contentType,
                    CacheControl: "no-transform",
                }));
                return;
            } catch (err: any) {
                console.warn(`Upload attempt ${i + 1} failed for ${relPath}: ${err.message}`);
                if (i < maxRetries - 1) {
                    await new Promise(r => setTimeout(r, 1000 * (i + 1)));
                } else {
                    console.error(`Final upload failure for ${filePath}: ${err.message ?? err}`);
                    throw err;
                }
            }
        }
    }

    /** File extension se sahi Content-Type (player isi se samajhta hai file kya hai). Anjaana = octet-stream. */
    private resolveContentType(filePath: string): string {
        const ext = path.extname(filePath).toLowerCase();
        const map: Record<string, string> = {
            ".m3u8": "application/vnd.apple.mpegurl",
            ".mpd": "application/dash+xml",
            ".mp4": "audio/mp4",
            ".m4s": "audio/mp4",
            ".m4a": "audio/mp4",
            ".vtt": "text/vtt",
            ".json": "application/json",
        };
        return map[ext] ?? "application/octet-stream";
    }
}
