import { inngest } from "../inngest";
import { api } from "../axios";
import { s3Client, downloadObject } from "../lib/s3";
import { AudioTranscoder } from "../lib/transcode";
import {
    VideoTranscoder,
    extractAudioFromVideo,
    cutCanvasVideo,
    uploadCanvasToImageKit,
} from "../lib/transcode/video";
import {
    safeCleanPaths,
    registerActiveTmpPath,
} from "../lib/transcode/cleanup";
import * as path from "node:path";
import * as fs from "node:fs";
import * as crypto from "node:crypto";
import { config } from "dotenv";
config();

export const transcodeSong = inngest.createFunction(
    {
        id: "transcode-song",
        triggers: [{ event: "audio/song.transcode" }]
    },
    async ({ step, event }) => {
        const {
            jobId,
            songId,
            tempSongKey,
            tempVideoKey,
            clipStartSec,
            clipEndSec,
            videoKey: initialVideoKey,
            isVideoReprocess,
        } = event.data;

        if (!jobId || !songId) {
            throw new Error("Missing jobId or songId in event data");
        }
        if (!tempSongKey && !tempVideoKey) {
            throw new Error("Neither tempSongKey nor tempVideoKey provided in event data");
        }

        const tempBucket = process.env.TEMP_BUCKET_NAME || "audiomelodyspringboottemp";
        const prodBucket = process.env.PRODUCTION_BUCKET_NAME || "audiomelodyspringboot";
        const basePath = process.env.BASE_PATH || "audios";
        const videoBasePath = process.env.VIDEO_BASE_PATH || "videos";

        const baseTmpDir = path.join(process.cwd(), "tmp");
        const songKey = `${basePath}/${songId}`;
        const fullVideoKey = tempVideoKey ? `${videoBasePath}/${songId}` : undefined;

        // Notify Spring Boot transcoding started
        await step.run("notify-transcoding-started", async () => {
            await api.post(`/${jobId}/transcoding-started`, {
                processingId: songId,
            });
        });

        // Run distributed transcoding process
        const { duration, videoKey } = await step.run("transcode-process", async () => {
            if (!fs.existsSync(baseTmpDir)) {
                fs.mkdirSync(baseTmpDir, { recursive: true });
            }

            const localUuid = crypto.randomUUID();
            const localAudioDownloadPath = path.join(baseTmpDir, `raw_audio_${localUuid}`);
            const localVideoDownloadPath = path.join(baseTmpDir, `raw_video_${localUuid}.mp4`);
            const localExtractedAudioPath = path.join(baseTmpDir, `extracted_audio_${localUuid}.m4a`);
            const localCanvasClipPath = path.join(baseTmpDir, `canvas_${localUuid}.mp4`);

            const audioOutputDir = path.join(baseTmpDir, `transcoded_audio_${localUuid}`);
            const videoOutputDir = path.join(baseTmpDir, `transcoded_video_${localUuid}`);

            // Register active temp paths for graceful shutdown protection
            registerActiveTmpPath(localAudioDownloadPath);
            registerActiveTmpPath(localVideoDownloadPath);
            registerActiveTmpPath(localExtractedAudioPath);
            registerActiveTmpPath(localCanvasClipPath);
            registerActiveTmpPath(audioOutputDir);
            registerActiveTmpPath(videoOutputDir);

            let finalDuration = 0;
            let resultVideoKey = initialVideoKey;

            try {
                // SCENARIO 0: VIDEO REPROCESS — only package full video (no audio extraction)
                if (isVideoReprocess && tempVideoKey) {
                    console.log(`[PIPELINE] Video-reprocess mode for job ${jobId}. Downloading raw video...`);
                    await downloadObject(tempBucket, tempVideoKey, localVideoDownloadPath);

                    const tasks: Promise<any>[] = [];

                    // Cut canvas if timestamps provided (concurrent)
                    if (typeof clipStartSec === "number" && typeof clipEndSec === "number" && clipEndSec > clipStartSec) {
                        tasks.push((async () => {
                            console.log(`[PIPELINE] Cutting canvas snippet from ${clipStartSec}s to ${clipEndSec}s...`);
                            await cutCanvasVideo(localVideoDownloadPath, localCanvasClipPath, clipStartSec, clipEndSec);
                            resultVideoKey = await uploadCanvasToImageKit(
                                localCanvasClipPath,
                                `${songId}_canvas.mp4`,
                                "/songs/videos"
                            );
                        })());
                    }

                    // Package full video with hardware acceleration
                    tasks.push((async () => {
                        console.log(`[PIPELINE] Packaging full video with Shaka Packager (reprocess)...`);
                        const videoTranscoder = new VideoTranscoder(4, s3Client, videoBasePath, prodBucket);
                        await videoTranscoder.transcode(localVideoDownloadPath, videoOutputDir, songId);
                    })());

                    await Promise.all(tasks);

                // SCENARIO 1: VIDEO ONLY PROVIDED
                } else if (tempVideoKey && !tempSongKey) {
                    console.log(`[PIPELINE] Video-only mode for job ${jobId}. Downloading raw video...`);
                    await downloadObject(tempBucket, tempVideoKey, localVideoDownloadPath);

                    // 1. Extract audio track from video (needed for audio packaging)
                    console.log(`[PIPELINE] Extracting audio from full video for job ${jobId}...`);
                    await extractAudioFromVideo(localVideoDownloadPath, localExtractedAudioPath);

                    // 2. Concurrently execute:
                    //    a. Canvas clip cutting & ImageKit upload
                    //    b. Video multi-quality transcoding & Shaka packaging
                    //    c. Audio multi-bitrate transcoding & Shaka packaging
                    const canvasTask = (async () => {
                        const start = typeof clipStartSec === "number" && clipStartSec >= 0 ? clipStartSec : 0;
                        const end = typeof clipEndSec === "number" && clipEndSec > start ? clipEndSec : start + 15;
                        console.log(`[PIPELINE] Cutting canvas snippet from ${start}s to ${end}s...`);
                        await cutCanvasVideo(localVideoDownloadPath, localCanvasClipPath, start, end);

                        console.log(`[PIPELINE] Uploading canvas video to ImageKit...`);
                        resultVideoKey = await uploadCanvasToImageKit(
                            localCanvasClipPath,
                            `${songId}_canvas.mp4`,
                            "/songs/videos"
                        );
                    })();

                    const videoTranscodeTask = (async () => {
                        console.log(`[PIPELINE] Transcoding full video to multiple qualities with Shaka Packager...`);
                        const videoTranscoder = new VideoTranscoder(4, s3Client, videoBasePath, prodBucket);
                        await videoTranscoder.transcode(localVideoDownloadPath, videoOutputDir, songId);
                    })();

                    const audioTranscodeTask = (async () => {
                        console.log(`[PIPELINE] Transcoding extracted audio with Shaka Packager...`);
                        const audioTranscoder = new AudioTranscoder(4, s3Client, basePath, prodBucket);
                        const audioRes = await audioTranscoder.transcode(localExtractedAudioPath, audioOutputDir, songId);
                        finalDuration = Math.round(audioRes.duration);
                    })();

                    await Promise.all([canvasTask, videoTranscodeTask, audioTranscodeTask]);

                // SCENARIO 2: BOTH AUDIO AND FULL VIDEO PROVIDED
                } else if (tempVideoKey && tempSongKey) {
                    console.log(`[PIPELINE] Both audio and full video provided for job ${jobId}. Downloading both in parallel...`);
                    await Promise.all([
                        downloadObject(tempBucket, tempSongKey, localAudioDownloadPath),
                        downloadObject(tempBucket, tempVideoKey, localVideoDownloadPath),
                    ]);

                    const pipelineTasks: Promise<any>[] = [];

                    // If clip timestamps were provided, cut canvas clip from video concurrently
                    if (typeof clipStartSec === "number" && typeof clipEndSec === "number" && clipEndSec > clipStartSec) {
                        pipelineTasks.push((async () => {
                            console.log(`[PIPELINE] Cutting canvas snippet from ${clipStartSec}s to ${clipEndSec}s...`);
                            await cutCanvasVideo(localVideoDownloadPath, localCanvasClipPath, clipStartSec, clipEndSec);
                            resultVideoKey = await uploadCanvasToImageKit(
                                localCanvasClipPath,
                                `${songId}_canvas.mp4`,
                                "/songs/videos"
                            );
                        })());
                    }

                    // Transcode full video with Shaka Packager concurrently
                    pipelineTasks.push((async () => {
                        console.log(`[PIPELINE] Transcoding full video with Shaka Packager...`);
                        const videoTranscoder = new VideoTranscoder(4, s3Client, videoBasePath, prodBucket);
                        await videoTranscoder.transcode(localVideoDownloadPath, videoOutputDir, songId);
                    })());

                    // Transcode audio concurrently
                    pipelineTasks.push((async () => {
                        console.log(`[PIPELINE] Transcoding audio with Shaka Packager...`);
                        const audioTranscoder = new AudioTranscoder(4, s3Client, basePath, prodBucket);
                        const audioRes = await audioTranscoder.transcode(localAudioDownloadPath, audioOutputDir, songId);
                        finalDuration = Math.round(audioRes.duration);
                    })());

                    await Promise.all(pipelineTasks);

                // SCENARIO 3: ONLY AUDIO PROVIDED
                } else {
                    console.log(`[PIPELINE] Audio-only mode for job ${jobId}. Downloading raw audio...`);
                    await downloadObject(tempBucket, tempSongKey, localAudioDownloadPath);

                    const audioTranscoder = new AudioTranscoder(4, s3Client, basePath, prodBucket);
                    const audioRes = await audioTranscoder.transcode(localAudioDownloadPath, audioOutputDir, songId);
                    finalDuration = Math.round(audioRes.duration);
                }

                return { duration: finalDuration, videoKey: resultVideoKey };
            } finally {
                // Robust & graceful cleanup of all local temporary files and directories
                await safeCleanPaths([
                    localAudioDownloadPath,
                    localVideoDownloadPath,
                    localExtractedAudioPath,
                    localCanvasClipPath,
                    audioOutputDir,
                    videoOutputDir,
                ]);
            }
        });

        // Notify Spring Boot transcoded
        await step.run("notify-transcoded", async () => {
            await api.post(`/${jobId}/transcoded`, {
                songKey: songKey,
                duration: duration,
                fullVideoKey: fullVideoKey || null,
                videoKey: videoKey || null,
            });
        });

        // Skip Algolia/Recombee indexing for reprocess jobs (song already indexed)
        if (!isVideoReprocess) {
            await step.sendEvent("trigger-recombee-indexing", {
                name: "audio/song.index.recombee",
                data: { jobId }
            });
        } else {
            // For reprocess, jump straight to finalize (skip Recombee/Algolia — song already indexed)
            await step.sendEvent("trigger-finalize", {
                name: "audio/song.final.create",
                data: { jobId }
            });
        }

        return { status: "success", jobId, songId, songKey, fullVideoKey, videoKey };
    }
);