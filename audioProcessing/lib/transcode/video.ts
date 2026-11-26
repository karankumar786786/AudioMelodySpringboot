/**
 * VideoTranscoder: music video (ya short) ko streaming ke layak banata hai, aur canvas / ImageKit helpers.
 *
 * Flow: file check -> kuch qualities (1080p / 720p / 480p / 360p, source se badi nahi) + ek saathi audio
 * track encode -> Shaka Packager se HLS + DASH chunks -> S3 upload -> local safai.
 *
 * Saath me: video se audio nikalna, chhota bina-awaaz "canvas" clip kaatna, aur ImageKit pe upload.
 * Kaun call karta hai: functions/transcodeVideo.ts, transcodeCanvas.ts, processShort.ts.
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
    buildVideoEncoderArgs,
    buildSoftwareVideoArgs,
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

/** Ek video quality ki setting (size, bitrate, aur manifest me likhi bandwidth). */
export interface VideoQualityProfile {
    label: string;
    width: number;
    height: number;
    bitrate: string;
    maxrate: string;
    bufsize: string;
    bandwidth: number;
}

/** Music videos ki landscape (16:9) qualities, badi se chhoti. */
export const VIDEO_QUALITY_PROFILES: VideoQualityProfile[] = [
    { label: "1080p", width: 1920, height: 1080, bitrate: "4500k", maxrate: "5000k", bufsize: "9000k", bandwidth: 4800000 },
    { label: "720p",  width: 1280, height: 720,  bitrate: "2500k", maxrate: "3000k", bufsize: "5000k", bandwidth: 2700000 },
    { label: "480p",  width: 854,  height: 480,  bitrate: "1200k", maxrate: "1500k", bufsize: "2400k", bandwidth: 1400000 },
    { label: "360p",  width: 640,  height: 360,  bitrate: "600k",  maxrate: "800k",  bufsize: "1200k", bandwidth: 750000 },
];

/** Shorts ki portrait (9:16, khada video, apna audio) qualities. */
export const SHORT_QUALITY_PROFILES: VideoQualityProfile[] = [
    { label: "1280p", width: 720, height: 1280, bitrate: "2200k", maxrate: "2600k", bufsize: "4400k", bandwidth: 2400000 },
    { label: "960p",  width: 540, height: 960,  bitrate: "1200k", maxrate: "1500k", bufsize: "2400k", bandwidth: 1400000 },
    { label: "640p",  width: 360, height: 640,  bitrate: "600k",  maxrate: "800k",  bufsize: "1200k", bandwidth: 750000 },
];

/** VideoTranscoder ke options. */
export interface VideoTranscoderOptions {
    /** Kaunsi qualities; default = music video wali landscape list. */
    profiles?: VideoQualityProfile[];
    /** Sabse badi height kitni banani (source se badi kabhi nahi). Default 720. */
    maxHeight?: number;
    /** "cover" = frame bharne ke liye kaato (Shorts); "contain" = kaali patti (default). */
    fitMode?: "contain" | "cover";
}

/**
 * Video transcoding ka poora kaam (upar file header dekho). S3 upload ek saath 5 files tak.
 */
export class VideoTranscoder {
    private readonly segmentTime: number;
    private readonly client: S3Client;
    private readonly basePath: string;
    private readonly limit = pLimit(5);
    private readonly bucketName: string;
    private readonly profiles: VideoQualityProfile[];
    private readonly maxHeight: number;
    private readonly fitMode: "contain" | "cover";

    constructor(
        segmentTime: number = 4,
        client: S3Client,
        basePath: string = "videos",
        bucketName: string,
        options: VideoTranscoderOptions = {},
    ) {
        this.segmentTime = segmentTime;
        this.client = client;
        this.basePath = basePath;
        this.bucketName = bucketName;
        this.profiles = options.profiles ?? VIDEO_QUALITY_PROFILES;
        this.maxHeight = options.maxHeight ?? 720;
        this.fitMode = options.fitMode ?? "contain";
    }

    /**
     * Poora pipeline: encode -> package -> S3 upload. Output: { duration } (seconds).
     * Kuch bhi fail ho to error phenkta hai; local folder finally me hamesha saaf.
     */
    async transcode(inputVideo: string, outputDir: string, s3DirName: string): Promise<{ duration: number }> {
        console.log(`--- Starting Video Transcoding & Shaka Packaging Process ---`);
        console.log(`Input:  ${inputVideo}`);
        console.log(`Output: ${outputDir}`);

        fs.mkdirSync(outputDir, { recursive: true });
        registerActiveTmpPath(outputDir);

        try {
            const info = await this.getVideoInfo(inputVideo);
            if (info.duration <= 0) throw new Error("Invalid video duration, cannot transcode");

            console.log(`Video Info: ${info.width}x${info.height}, ${info.duration.toFixed(2)}s, segment size: ${this.segmentTime}s`);

            // Sirf wahi qualities jo source aur maxHeight dono se chhoti ya barabar hain.
            // Ek bhi na bache (bahut chhota video) to sabse chhoti quality to banao hi.
            const effectiveMaxHeight = Math.min(this.maxHeight, info.height);
            const applicableProfiles = this.profiles.filter(p => p.height <= effectiveMaxHeight);
            const profilesToEncode = applicableProfiles.length > 0
                ? applicableProfiles
                : [this.profiles[this.profiles.length - 1]!];

            console.log(`Selected profiles for packaging:`, profilesToEncode.map(p => p.label));

            // STEP 1: har quality ka video + ek saathi audio track encode (ek saath, GPU mile to wahi)
            const renditionsDir = path.join(outputDir, "renditions");
            fs.mkdirSync(renditionsDir, { recursive: true });

            const encodedStreams = await this.encodeVideoAndAudio(inputVideo, renditionsDir, profilesToEncode);

            // STEP 2: Shaka Packager se HLS / DASH chunks
            await this.runShakaPackager(outputDir, encodedStreams, profilesToEncode);

            // STEP 3: chunks S3 pe upload
            const allFiles = getAllFiles(outputDir);
            // Beech ki raw_*.mp4 / raw_*.m4a files upload nahi karni (wo sirf packager ke liye thi)
            const filesToUpload = allFiles.filter(fp => !/raw_.*\.mp4$/.test(fp) && !/raw_.*\.m4a$/.test(fp));

            const totalFiles = filesToUpload.length;
            console.log(`[VIDEO S3] Uploading ${totalFiles} video files to S3 bucket "${this.bucketName}" under prefix "${this.basePath}/${s3DirName}"...`);
            let uploadedCount = 0;
            let lastReportedPercent = 0;

            const uploadPromises = filesToUpload.map(fp =>
                this.limit(async () => {
                    await this.uploadFileToS3(fp, outputDir, s3DirName, this.bucketName);
                    uploadedCount++;
                    const percent = Math.floor((uploadedCount / totalFiles) * 100);
                    if (percent >= lastReportedPercent + 25 || uploadedCount === totalFiles) {
                        lastReportedPercent = percent;
                        console.log(`[VIDEO S3] Upload progress: ${percent}% (${uploadedCount}/${totalFiles} files uploaded)`);
                    }
                })
            );
            await Promise.all(uploadPromises);
            console.log(`[VIDEO S3] All ${totalFiles} video files uploaded successfully`);

            console.log(`--- Video Transcoding Completed for ${s3DirName} ---`);
            return { duration: info.duration };
        } finally {
            // SAFAI: kaam ho ya error, local folder hamesha hatao
            await safeRemovePath(outputDir);
            console.log(`Local video transcoding directory cleaned up: ${outputDir}`);
        }
    }

    /** File ki jaanch karo; duration aur size lautao (size na mile to 1920x1080 maan lo). */
    private async getVideoInfo(videoPath: string): Promise<{ duration: number; width: number; height: number }> {
        const validation = await validateMediaIntegrity(videoPath, "video");
        return {
            duration: validation.duration,
            width: validation.width ?? 1920,
            height: validation.height ?? 1080,
        };
    }

    /**
     * Pehle saathi audio track (128k), phir har quality ka video encode.
     * Audio nikalna fail ho (jaise video me awaaz hi nahi) to chup (silent) audio track bana dete hain,
     * kyunki Shaka ko audio track chahiye. Output: video paths aur audio path.
     */
    private async encodeVideoAndAudio(
        inputVideo: string,
        renditionsDir: string,
        profiles: VideoQualityProfile[]
    ): Promise<{ videoPaths: string[]; audioPath: string }> {
        const hwCaps = await detectHardwareCapabilities();

        // 1. Pehle saathi audio track (ek FFmpeg process)
        const audioPath = path.join(renditionsDir, "raw_video_audio.m4a");
        console.log(`[VIDEO] Transcoding companion audio track for video package...`);
        const audioProfile = { bitrate: "128k", sampleRate: 44100, channels: 2 };
        const primaryArgs = buildAudioEncoderArgs(inputVideo, audioPath, audioProfile, hwCaps);
        const fallbackArgs = buildSoftwareAudioArgs(inputVideo, audioPath, audioProfile);

        try {
            await executeFFmpegWithFallback(
                primaryArgs,
                fallbackArgs,
                "video companion audio track"
            );
            console.log(`[VIDEO] Video audio track encoded -> ${audioPath}`);
        } catch (audioErr: any) {
            console.warn(`[VIDEO] Companion audio extraction failed (${audioErr.message || audioErr}). Generating resilient companion audio fallback...`);
            try {
                // Chup (silent) AAC audio track banao, taaki Shaka packaging phir bhi chal sake
                await execFileAsync("ffmpeg", [
                    "-nostdin",
                    "-y",
                    "-loglevel", "warning",
                    "-f", "lavfi",
                    "-i", "anullsrc=channel_layout=stereo:sample_rate=44100",
                    "-c:a", "aac",
                    "-b:a", "128k",
                    "-ar", "44100",
                    "-ac", "2",
                    "-movflags", "+faststart",
                    audioPath,
                ]);
                console.log(`[VIDEO] Successfully generated silent companion audio fallback track -> ${audioPath}`);
            } catch (fallbackErr: any) {
                console.error(`[VIDEO] Failed to generate silent companion audio fallback:`, fallbackErr);
                throw audioErr;
            }
        }

        // 2. Har quality ka video (ek saath kitne - hardware aur global limit me se kam)
        const renditionLimit = Math.max(1, Math.min(hwCaps.maxVideoConcurrency, CONCURRENT_TRANSCODING_LIMIT));
        const videoConcurrency = pLimit(renditionLimit);
        console.log(`[VIDEO] Transcoding ${profiles.length} video renditions (concurrency=${renditionLimit}, accelerator=${hwCaps.hardwareName})...`);

        const videoPromises = profiles.map((profile) =>
            videoConcurrency(async () => {
                const outPath = path.join(renditionsDir, `raw_video_${profile.label}.mp4`);
                console.log(`[VIDEO] Transcoding rendition -> ${profile.label} (${profile.bitrate})...`);

                const primaryArgs = buildVideoEncoderArgs(inputVideo, outPath, profile, hwCaps, { fitMode: this.fitMode });
                const fallbackArgs = buildSoftwareVideoArgs(inputVideo, outPath, profile, { fitMode: this.fitMode });

                await executeFFmpegWithFallback(
                    primaryArgs,
                    fallbackArgs,
                    `video rendition ${profile.label}`
                );

                console.log(`[VIDEO] Rendition finished: ${profile.label}`);
                return outPath;
            })
        );

        const videoPaths = await Promise.all(videoPromises);
        return { videoPaths, audioPath };
    }

    /**
     * Shaka Packager: har video quality aur audio ke chunks + playlists, aur master HLS / DASH files.
     * hls_group_id=audio: saari video qualities ek hi audio track share karti hain. Fail = error phenko.
     */
    private async runShakaPackager(
        outputDir: string,
        streams: { videoPaths: string[]; audioPath: string },
        profiles: VideoQualityProfile[]
    ): Promise<void> {
        console.log(`[VIDEO] Packaging full video with Shaka Packager...`);

        // Shaka ko "/" wale paths chahiye (Windows ke "\\" nahi)
        const toShaka = (p: string) => p.replace(/\\/g, "/");

        const streamDescriptors: string[] = [];

        // Video streams (har quality ka apna folder)
        streams.videoPaths.forEach((videoPath, i) => {
            const profile = profiles[i]!;
            const profileDir = path.join(outputDir, "video", profile.label);
            fs.mkdirSync(profileDir, { recursive: true });

            streamDescriptors.push([
                `in=${toShaka(videoPath)}`,
                `stream=video`,
                `init_segment=${toShaka(path.join(profileDir, "init.mp4"))}`,
                `segment_template=${toShaka(path.join(profileDir, `${profile.label}_$Number%05d$.m4s`))}`,
                `playlist_name=${toShaka(path.join(profileDir, "playlist.m3u8"))}`,
                `bandwidth=${profile.bandwidth}`,
            ].join(","));
        });

        // Audio stream (sabke liye ek)
        const audioDir = path.join(outputDir, "audio");
        fs.mkdirSync(audioDir, { recursive: true });
        streamDescriptors.push([
            `in=${toShaka(streams.audioPath)}`,
            `stream=audio`,
            `init_segment=${toShaka(path.join(audioDir, "init.mp4"))}`,
            `segment_template=${toShaka(path.join(audioDir, `audio_$Number%05d$.m4s`))}`,
            `playlist_name=${toShaka(path.join(audioDir, "playlist.m3u8"))}`,
            `hls_group_id=audio`,
            `bandwidth=128000`,
        ].join(","));

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
            patchMpdForVod(path.join(outputDir, "master.mpd"));
            console.log(`[VIDEO] Shaka Packaging complete for video`);
        } catch (err: any) {
            console.error(`[VIDEO] Shaka Packaging failed: ${err.message ?? err}`);
            throw err;
        }
    }

    /**
     * Ek file S3 pe: key = basePath/videoName/<folder ke andar ka path>.
     * Fail ho to 10 baar tak dobara (1s, 2s, 3s... ruk ke). Phir bhi fail = error.
     */
    private async uploadFileToS3(
        filePath: string,
        outputDir: string,
        videoName: string,
        bucketName: string,
        maxRetries = 10,
    ): Promise<void> {
        const relPath = path.relative(outputDir, filePath);
        const s3Key = `${this.basePath}/${videoName}/${relPath}`.replace(/\\/g, "/");
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
                if (i < maxRetries - 1) {
                    await new Promise(r => setTimeout(r, 1000 * (i + 1)));
                } else {
                    console.error(`Final upload failure for ${filePath}: ${err.message ?? err}`);
                    throw err;
                }
            }
        }
    }

    /** Extension se Content-Type. Anjaana = octet-stream. */
    private resolveContentType(filePath: string): string {
        const ext = path.extname(filePath).toLowerCase();
        const map: Record<string, string> = {
            ".m3u8": "application/vnd.apple.mpegurl",
            ".mpd": "application/dash+xml",
            ".mp4": "video/mp4",
            ".m4s": "video/mp4",
            ".m4a": "audio/mp4",
        };
        return map[ext] ?? "application/octet-stream";
    }
}

/**
 * Video ki poori audio 320kbps AAC file me nikalo (jab gaana sirf video ke saath upload hua ho).
 * GPU / aac_at fail ho to normal aac. Dono fail = error.
 */
export async function extractAudioFromVideo(videoPath: string, outputAudioPath: string): Promise<void> {
    console.log(`[EXTRACT AUDIO] Extracting audio from ${videoPath} -> ${outputAudioPath}...`);
    const hwCaps = await detectHardwareCapabilities();
    const profile = { bitrate: "320k", sampleRate: 44100, channels: 2 };

    const primaryArgs = buildAudioEncoderArgs(videoPath, outputAudioPath, profile, hwCaps);
    const fallbackArgs = buildSoftwareAudioArgs(videoPath, outputAudioPath, profile);

    await executeFFmpegWithFallback(primaryArgs, fallbackArgs, "audio extraction from video");
    console.log(`[EXTRACT AUDIO] Successfully extracted audio track`);
}

/**
 * Video se startSec se endSec tak ka chhota tukda kaato - bina awaaz ka "canvas" (app me gaane ke
 * peeche loop me chalne wala video). Audio aur baaki streams hata dete hain taaki file bahut halki ho
 * aur phone pe turant load ho. Kam se kam 1 second.
 */
export async function cutCanvasVideo(
    videoPath: string,
    outputCanvasPath: string,
    startSec: number = 0,
    endSec: number = 15
): Promise<void> {
    console.log(`[CUT CANVAS] Clipping silent video snippet from ${startSec}s to ${endSec}s (erasing audio stream) -> ${outputCanvasPath}...`);
    const duration = Math.max(1, endSec - startSec);
    const hwCaps = await detectHardwareCapabilities();

    // Phone ke liye canvas setting: khada 720x1280, 800k bitrate (~800KB-1.2MB, turant load)
    const canvasProfile = {
        width: 720,
        height: 1280,
        bitrate: "800k",
        maxrate: "1000k",
        bufsize: "1600k",
    };

    // mute = awaaz hatao, cover = frame bharo, +faststart = download poora hone se pehle hi chal jaaye
    const clipOptions = { startSec, duration, mute: true, fitMode: "cover" as const, movflags: "+faststart" };

    const primaryArgs = buildVideoEncoderArgs(videoPath, outputCanvasPath, canvasProfile, hwCaps, clipOptions);
    const fallbackArgs = buildSoftwareVideoArgs(videoPath, outputCanvasPath, canvasProfile, clipOptions);

    await executeFFmpegWithFallback(primaryArgs, fallbackArgs, "canvas video clip");
    console.log(`[CUT CANVAS] Successfully cut audio-erased canvas video snippet`);
}

/**
 * Local video / image file ko ImageKit (CDN) pe upload karo, unke REST API se.
 * Login: Basic Auth, IMAGEKIT_PRIVATE_KEY ke saath. Key na ho ya upload fail ho to error.
 * Output: ImageKit ka filePath (jaise /songs/videos/xyz.mp4).
 */
export async function uploadCanvasToImageKit(
    filePath: string,
    fileName: string,
    folder: string = "/songs/videos"
): Promise<string> {
    const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
    if (!privateKey) {
        throw new Error("IMAGEKIT_PRIVATE_KEY is not defined in environment variables");
    }

    console.log(`[IMAGEKIT] Uploading canvas video to ImageKit folder "${folder}" as "${fileName}"...`);

    const fileBuffer = fs.readFileSync(filePath);
    const formData = new FormData();
    const blob = new Blob([fileBuffer], { type: "video/mp4" });
    formData.append("file", blob, fileName);
    formData.append("fileName", fileName);
    formData.append("folder", folder);

    const auth = Buffer.from(`${privateKey}:`).toString("base64");
    const response = await fetch("https://upload.imagekit.io/api/v1/files/upload", {
        method: "POST",
        headers: {
            Authorization: `Basic ${auth}`,
        },
        body: formData,
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(`ImageKit upload failed: ${data.message || JSON.stringify(data)}`);
    }

    console.log(`[IMAGEKIT] Uploaded canvas video successfully: ${data.filePath}`);
    return data.filePath || data.name || fileName;
}
