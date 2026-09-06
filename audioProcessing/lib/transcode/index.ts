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

export interface AudioQualityProfile {
    label: string;
    bitrate: string;    // e.g. "128k"
    sampleRate: number; // Hz, e.g. 44100
    channels: number;   // 1 = mono, 2 = stereo
    bandwidth: number;  // bits/s declared in HLS/DASH manifests
}

/** Multi-bitrate AAC profiles requested: 128, 240, 320 kbps. */
export const AUDIO_QUALITY_PROFILES: AudioQualityProfile[] = [
    { label: "128kbps", bitrate: "128k", sampleRate: 44100, channels: 2, bandwidth: 128000 },
    { label: "240kbps", bitrate: "240k", sampleRate: 44100, channels: 2, bandwidth: 240000 },
    { label: "320kbps", bitrate: "320k", sampleRate: 44100, channels: 2, bandwidth: 320000 },
];

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

            // STEP 1 — Transcode input -> multi-bitrate AACs (in parallel with hardware acceleration)
            const audioDir = path.join(outputDir, "audio");
            fs.mkdirSync(audioDir, { recursive: true });
            const rawAudioPaths = await this.transcodeAudio(inputAudio, audioDir);

            // STEP 2 — Package -> master.m3u8 + master.mpd
            await this.runShakaPackager(outputDir, rawAudioPaths);

            // STEP 3 — Upload all packaged files to S3
            const allFiles = this.getAllFiles(outputDir);
            const filesToUpload = allFiles.filter(fp => !/raw_audio_.*\.m4a$/.test(fp));

            console.log(`Uploading ${filesToUpload.length} files to S3 bucket "${this.bucketName}" under prefix "${this.basePath}/${audioName}"...`);
            const uploadPromises = filesToUpload.map(fp =>
                this.limit(() => this.uploadFileToS3(fp, outputDir, audioName, this.bucketName))
            );
            await Promise.all(uploadPromises);
            console.log("All uploads completed");

            console.log(`--- Audio Transcoding Completed ---`);
            return { duration };
        } finally {
            // CLEANUP — Remove local transcoded files robustly (on success or error)
            await safeRemovePath(outputDir);
            console.log(`Local transcoding directory cleaned up: ${outputDir}`);
        }
    }

    private async getAudioDuration(audioPath: string): Promise<number> {
        if (!fs.existsSync(audioPath)) {
            throw new Error(`File does not exist at path: ${audioPath}`);
        }

        const { stdout, stderr } = await execFileAsync("ffprobe", [
            "-v", "error",
            "-print_format", "json",
            "-show_format",
            audioPath,
        ]);

        if (stderr) console.warn(`ffprobe warning: ${stderr}`);

        const data = JSON.parse(stdout);
        const duration = parseFloat(data.format?.duration ?? "0");

        if (duration === 0) {
            console.error(`ffprobe returned 0 duration. Output: ${stdout}`);
        }

        return duration;
    }

    private async transcodeAudio(inputAudio: string, audioDir: string): Promise<string[]> {
        const hwCaps = await detectHardwareCapabilities();
        const audioConcurrency = pLimit(hwCaps.maxAudioConcurrency);

        console.log(`[AUDIO] Transcoding ${AUDIO_QUALITY_PROFILES.length} profiles concurrently (concurrency=${hwCaps.maxAudioConcurrency}, encoder=${hwCaps.audioEncoder})...`);

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

    private async runShakaPackager(outputDir: string, rawAudioPaths: string[]): Promise<void> {
        console.log(`Packaging with Shaka Packager...`);

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

        try {
            await execFileAsync("packager", args);
            await this.patchMpdForVod(path.join(outputDir, "master.mpd"));
            console.log(`Packaging complete`);
        } catch (err: any) {
            console.error(`Packaging failed: ${err.message ?? err}`);
            throw err;
        }
    }

    private async patchMpdForVod(mpdPath: string): Promise<void> {
        let content = fs.readFileSync(mpdPath, "utf-8");

        content = content.replace(/\btype="dynamic"/, 'type="static"');
        content = content.replace(/\s*minimumUpdatePeriod="[^"]*"/, "");
        content = content.replace(/\s*availabilityStartTime="[^"]*"/, "");
        content = content.replace(/\s*timeShiftBufferDepth="[^"]*"/, "");
        content = content.replace(/\s*suggestedPresentationDelay="[^"]*"/, "");

        if (!content.includes("mediaPresentationDuration")) {
            const periodDuration = content.match(/\bPeriod[^>]+\bduration="([^"]+)"/)?.[1];
            if (periodDuration) {
                content = content.replace(
                    /<MPD /,
                    `<MPD mediaPresentationDuration="${periodDuration}" `
                );
            }
        }

        fs.writeFileSync(mpdPath, content, "utf-8");
        console.log(`MPD patched for VOD`);
    }

    private getAllFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
        const files = fs.readdirSync(dirPath);

        for (const file of files) {
            const absolutePath = path.join(dirPath, file);
            if (fs.statSync(absolutePath).isDirectory()) {
                this.getAllFiles(absolutePath, arrayOfFiles);
            } else {
                arrayOfFiles.push(absolutePath);
            }
        }

        return arrayOfFiles;
    }

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

                console.log(`Uploaded -> s3://${bucketName}/${s3Key}`);
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
