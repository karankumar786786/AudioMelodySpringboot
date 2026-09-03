import * as path from "node:path";
import * as fs from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import pLimit from "p-limit";

const execFileAsync = promisify(execFile);

export interface VideoQualityProfile {
    label: string;
    width: number;
    height: number;
    bitrate: string;
    maxrate: string;
    bufsize: string;
    bandwidth: number;
}

export const VIDEO_QUALITY_PROFILES: VideoQualityProfile[] = [
    { label: "1080p", width: 1920, height: 1080, bitrate: "4500k", maxrate: "5000k", bufsize: "9000k", bandwidth: 4800000 },
    { label: "720p",  width: 1280, height: 720,  bitrate: "2500k", maxrate: "3000k", bufsize: "5000k", bandwidth: 2700000 },
    { label: "480p",  width: 854,  height: 480,  bitrate: "1200k", maxrate: "1500k", bufsize: "2400k", bandwidth: 1400000 },
    { label: "360p",  width: 640,  height: 360,  bitrate: "600k",  maxrate: "800k",  bufsize: "1200k", bandwidth: 750000 },
];

export class VideoTranscoder {
    private readonly segmentTime: number;
    private readonly client: S3Client;
    private readonly basePath: string;
    private readonly limit = pLimit(5);
    private readonly bucketName: string;

    constructor(
        segmentTime: number = 4,
        client: S3Client,
        basePath: string = "videos",
        bucketName: string,
    ) {
        this.segmentTime = segmentTime;
        this.client = client;
        this.basePath = basePath;
        this.bucketName = bucketName;
    }

    async transcode(inputVideo: string, outputDir: string, s3DirName: string): Promise<{ duration: number }> {
        console.log(`--- Starting Video Transcoding & Shaka Packaging Process ---`);
        console.log(`Input:  ${inputVideo}`);
        console.log(`Output: ${outputDir}`);

        fs.mkdirSync(outputDir, { recursive: true });

        const info = await this.getVideoInfo(inputVideo);
        if (info.duration <= 0) throw new Error("Invalid video duration, cannot transcode");

        console.log(`Video Info: ${info.width}x${info.height}, ${info.duration.toFixed(2)}s, segment size: ${this.segmentTime}s`);

        // Select profiles: only profiles with height <= source height (or at least the lowest profile)
        const applicableProfiles = VIDEO_QUALITY_PROFILES.filter(p => p.height <= info.height);
        const profilesToEncode = applicableProfiles.length > 0
            ? applicableProfiles
            : [VIDEO_QUALITY_PROFILES[VIDEO_QUALITY_PROFILES.length - 1]!];

        console.log(`Selected profiles for packaging:`, profilesToEncode.map(p => p.label));

        // STEP 1 — Transcode video profiles and extracted audio
        const renditionsDir = path.join(outputDir, "renditions");
        fs.mkdirSync(renditionsDir, { recursive: true });

        const encodedStreams = await this.encodeVideoAndAudio(inputVideo, renditionsDir, profilesToEncode);

        // STEP 2 — Shaka Packager Packaging
        await this.runShakaPackager(outputDir, encodedStreams, profilesToEncode);

        // STEP 3 — Upload all packaged files to S3
        const allFiles = this.getAllFiles(outputDir);
        // Exclude intermediate raw encoded streams
        const filesToUpload = allFiles.filter(fp => !/raw_.*\.mp4$/.test(fp) && !/raw_.*\.m4a$/.test(fp));

        console.log(`Uploading ${filesToUpload.length} video files to S3 bucket "${this.bucketName}" under prefix "${this.basePath}/${s3DirName}"...`);
        const uploadPromises = filesToUpload.map(fp =>
            this.limit(() => this.uploadFileToS3(fp, outputDir, s3DirName, this.bucketName))
        );
        await Promise.all(uploadPromises);
        console.log("All full video uploads completed");

        // CLEANUP — Remove local transcoded directory
        fs.rmSync(outputDir, { recursive: true, force: true });
        console.log(`--- Video Transcoding Completed for ${s3DirName} ---`);

        return { duration: info.duration };
    }

    private async getVideoInfo(videoPath: string): Promise<{ duration: number; width: number; height: number }> {
        if (!fs.existsSync(videoPath)) {
            throw new Error(`File does not exist at path: ${videoPath}`);
        }

        const { stdout } = await execFileAsync("ffprobe", [
            "-v", "error",
            "-select_streams", "v:0",
            "-show_entries", "stream=width,height,duration:format=duration",
            "-print_format", "json",
            videoPath,
        ]);

        const data = JSON.parse(stdout);
        const stream = data.streams?.[0];
        const width = parseInt(stream?.width ?? "1920", 10);
        const height = parseInt(stream?.height ?? "1080", 10);
        const duration = parseFloat(stream?.duration ?? data.format?.duration ?? "0");

        return { duration, width, height };
    }

    private async encodeVideoAndAudio(
        inputVideo: string,
        renditionsDir: string,
        profiles: VideoQualityProfile[]
    ): Promise<{ videoPaths: string[]; audioPath: string }> {
        const videoPaths: string[] = [];

        // Encode each video profile with locked GOP of 48 frames for smooth ABR switching
        for (const profile of profiles) {
            const outPath = path.join(renditionsDir, `raw_video_${profile.label}.mp4`);
            console.log(`[VIDEO] Transcoding rendition -> ${profile.label} (${profile.bitrate})...`);

            const scaleFilter = `scale=w=${profile.width}:h=${profile.height}:force_original_aspect_ratio=decrease,pad=${profile.width}:${profile.height}:(ow-iw)/2:(oh-ih)/2,format=yuv420p`;

            const args = [
                "-y",
                "-loglevel", "warning",
                "-i", inputVideo,
                "-vf", scaleFilter,
                "-c:v", "libx264",
                "-preset", "fast",
                "-profile:v", "high",
                "-b:v", profile.bitrate,
                "-maxrate", profile.maxrate,
                "-bufsize", profile.bufsize,
                "-g", "48",
                "-keyint_min", "48",
                "-sc_threshold", "0",
                "-an",
                outPath,
            ];

            await execFileAsync("ffmpeg", args);
            console.log(`[VIDEO] Rendition finished: ${profile.label}`);
            videoPaths.push(outPath);
        }

        // Encode common audio stream for the video
        const audioPath = path.join(renditionsDir, "raw_video_audio.m4a");
        console.log(`[VIDEO] Transcoding audio track for video package...`);
        const audioArgs = [
            "-y",
            "-loglevel", "warning",
            "-i", inputVideo,
            "-vn",
            "-c:a", "aac",
            "-b:a", "128k",
            "-ar", "44100",
            "-ac", "2",
            audioPath,
        ];
        await execFileAsync("ffmpeg", audioArgs);
        console.log(`[VIDEO] Video audio track encoded -> ${audioPath}`);

        return { videoPaths, audioPath };
    }

    private async runShakaPackager(
        outputDir: string,
        streams: { videoPaths: string[]; audioPath: string },
        profiles: VideoQualityProfile[]
    ): Promise<void> {
        console.log(`[VIDEO] Packaging full video with Shaka Packager...`);

        const toShaka = (p: string) => p.replace(/\\/g, "/");

        const streamDescriptors: string[] = [];

        // Video streams
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

        // Audio stream
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
            await this.patchMpdForVod(path.join(outputDir, "master.mpd"));
            console.log(`[VIDEO] Shaka Packaging complete for video`);
        } catch (err: any) {
            console.error(`[VIDEO] Shaka Packaging failed: ${err.message ?? err}`);
            throw err;
        }
    }

    private async patchMpdForVod(mpdPath: string): Promise<void> {
        if (!fs.existsSync(mpdPath)) return;
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
 * Extracts full audio track from video file as 320kbps AAC audio.
 */
export async function extractAudioFromVideo(videoPath: string, outputAudioPath: string): Promise<void> {
    console.log(`[EXTRACT AUDIO] Extracting audio from ${videoPath} -> ${outputAudioPath}...`);
    const args = [
        "-y",
        "-loglevel", "warning",
        "-i", videoPath,
        "-vn",
        "-c:a", "aac",
        "-b:a", "320k",
        "-ar", "44100",
        "-ac", "2",
        outputAudioPath,
    ];
    await execFileAsync("ffmpeg", args);
    console.log(`[EXTRACT AUDIO] Successfully extracted audio track`);
}

/**
 * Cuts a short snippet from video between startSec and endSec as a muted looping canvas video.
 */
export async function cutCanvasVideo(
    videoPath: string,
    outputCanvasPath: string,
    startSec: number = 0,
    endSec: number = 15
): Promise<void> {
    console.log(`[CUT CANVAS] Clipping video snippet from ${startSec}s to ${endSec}s -> ${outputCanvasPath}...`);
    const duration = Math.max(1, endSec - startSec);
    const args = [
        "-y",
        "-loglevel", "warning",
        "-ss", startSec.toString(),
        "-t", duration.toString(),
        "-i", videoPath,
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "22",
        "-an",
        "-movflags", "+faststart",
        outputCanvasPath,
    ];
    await execFileAsync("ffmpeg", args);
    console.log(`[CUT CANVAS] Successfully cut canvas video snippet`);
}

/**
 * Uploads a local video/image file to ImageKit via ImageKit REST API.
 * Uses Basic Auth with IMAGEKIT_PRIVATE_KEY.
 * Returns the ImageKit filePath (e.g., /songs/videos/xyz.mp4).
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
