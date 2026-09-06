import { inngest } from "../inngest";
import { s3Client, downloadObject } from "../lib/s3";
import { AudioTranscoder } from "../lib/transcode";
import { extractAudioFromVideo } from "../lib/transcode/video";
import { safeCleanPaths, registerActiveTmpPath } from "../lib/transcode/cleanup";
import * as path from "node:path";
import * as fs from "node:fs";
import * as crypto from "node:crypto";
import { config } from "dotenv";
config();

export interface TranscodeAudioData {
    jobId: string;
    songId: string;
    tempSongKey?: string;
    tempVideoKey?: string;
}

export const transcodeAudioTask = inngest.createFunction(
    {
        id: "transcode-audio-task",
        triggers: [{ event: "audio/song.transcode.audio" }],
        retries: 3,
    },
    async ({ step, event }) => {
        const {
            jobId,
            songId,
            tempSongKey,
            tempVideoKey,
        } = event.data as TranscodeAudioData;

        if (!songId || (!tempSongKey && !tempVideoKey)) {
            throw new Error("Missing songId and media keys for audio transcoding");
        }

        const tempBucket = process.env.TEMP_BUCKET_NAME || "audiomelodyspringboottemp";
        const prodBucket = process.env.PRODUCTION_BUCKET_NAME || "audiomelodyspringboot";
        const basePath = process.env.BASE_PATH || "audios";
        const baseTmpDir = path.join(process.cwd(), "tmp");

        return await step.run("process-audio-transcode", async () => {
            if (!fs.existsSync(baseTmpDir)) {
                fs.mkdirSync(baseTmpDir, { recursive: true });
            }

            const localUuid = crypto.randomUUID();
            const localAudioDownloadPath = path.join(baseTmpDir, `raw_audio_main_${localUuid}`);
            const localVideoDownloadPath = path.join(baseTmpDir, `raw_video_extract_${localUuid}.mp4`);
            const localExtractedAudioPath = path.join(baseTmpDir, `extracted_audio_${localUuid}.m4a`);
            const audioOutputDir = path.join(baseTmpDir, `transcoded_audio_${localUuid}`);

            registerActiveTmpPath(localAudioDownloadPath);
            registerActiveTmpPath(localVideoDownloadPath);
            registerActiveTmpPath(localExtractedAudioPath);
            registerActiveTmpPath(audioOutputDir);

            try {
                let inputAudioPath: string;

                if (tempSongKey) {
                    console.log(`[AUDIO-WORKER] Downloading raw audio for job ${jobId}...`);
                    await downloadObject(tempBucket, tempSongKey, localAudioDownloadPath);
                    inputAudioPath = localAudioDownloadPath;
                } else {
                    console.log(`[AUDIO-WORKER] Video-only provided: downloading video and extracting audio track for job ${jobId}...`);
                    await downloadObject(tempBucket, tempVideoKey!, localVideoDownloadPath);
                    await extractAudioFromVideo(localVideoDownloadPath, localExtractedAudioPath);
                    inputAudioPath = localExtractedAudioPath;
                }

                console.log(`[AUDIO-WORKER] Transcoding and packaging multi-bitrate audio with hardware acceleration...`);
                const audioTranscoder = new AudioTranscoder(4, s3Client, basePath, prodBucket);
                const { duration } = await audioTranscoder.transcode(inputAudioPath, audioOutputDir, songId);

                const songKey = `${basePath}/${songId}`;
                console.log(`[AUDIO-WORKER] Audio transcoding completed -> ${songKey} (${duration.toFixed(2)}s)`);

                return { duration: Math.round(duration), songKey };
            } finally {
                await safeCleanPaths([
                    localAudioDownloadPath,
                    localVideoDownloadPath,
                    localExtractedAudioPath,
                    audioOutputDir,
                ]);
            }
        });
    }
);
