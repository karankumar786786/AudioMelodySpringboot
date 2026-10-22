import { inngest } from "../inngest";
import { api } from "../axios";
import { downloadObject } from "../lib/s3";
import { extractAudioFromVideo } from "../lib/transcode/video";
import { extractAudioFeatures, type AudioFeatures } from "../lib/transcode/audioFeatures";
import { safeCleanPaths, registerActiveTmpPath } from "../lib/transcode/cleanup";
import { CONCURRENT_TRANSCODING_LIMIT, globalTranscodeLimiter } from "../lib/transcode/limiter";
import { extractMeaningfulError } from "../lib/errorUtils";
import * as path from "node:path";
import * as fs from "node:fs";
import * as crypto from "node:crypto";
import { config } from "dotenv";

config();

export interface ExtractAudioFeaturesData {
    jobId: string;
    songId: string;
    tempSongKey?: string;
    tempVideoKey?: string;
}

export const extractAudioFeaturesTask = inngest.createFunction(
    {
        id: "extract-audio-features-task",
        concurrency: {
            limit: CONCURRENT_TRANSCODING_LIMIT,
        },
        cancelOn: [
            {
                event: "audio/job.cancel",
                match: "data.jobId",
            },
        ],
        triggers: [{ event: "audio/song.extract.features" }],
        retries: 3,
        onFailure: async ({ event, error }) => {
            const jobId = event?.data?.event?.data?.jobId;
            if (jobId) {
                const reason = extractMeaningfulError(error, "Audio features extraction failed");
                console.warn(`[AUDIO-FEATURES WARN] Non-fatal audio features error for job ${jobId}: ${reason}`);
            }
        },
    },
    async ({ step, event }) => {
        const {
            jobId,
            songId,
            tempSongKey,
            tempVideoKey,
        } = event.data as ExtractAudioFeaturesData;

        if (!songId || (!tempSongKey && !tempVideoKey)) {
            throw new Error("Missing songId and media keys for audio features extraction");
        }

        const tempBucket = process.env.TEMP_BUCKET_NAME || "audiomelodyspringboottemp";
        const baseTmpDir = path.join(process.cwd(), "tmp");

        return await step.run("extract-spotify-audio-features", async () => {
            return await globalTranscodeLimiter(async () => {
                if (!fs.existsSync(baseTmpDir)) {
                    fs.mkdirSync(baseTmpDir, { recursive: true });
                }

                const localUuid = crypto.randomUUID();
                const localAudioPath = path.join(baseTmpDir, `raw_feat_audio_${localUuid}`);
                const localVideoPath = path.join(baseTmpDir, `raw_feat_video_${localUuid}.mp4`);
                const localExtractedPath = path.join(baseTmpDir, `extracted_feat_audio_${localUuid}.m4a`);

                registerActiveTmpPath(localAudioPath);
                registerActiveTmpPath(localVideoPath);
                registerActiveTmpPath(localExtractedPath);

                try {
                    let inputAudioPath: string;

                    if (tempSongKey) {
                        console.log(`[AUDIO-FEATURES] Downloading audio for job ${jobId} from ${tempBucket}/${tempSongKey}...`);
                        await downloadObject(tempBucket, tempSongKey, localAudioPath);
                        inputAudioPath = localAudioPath;
                    } else {
                        console.log(`[AUDIO-FEATURES] Video-only provided: extracting audio for feature extraction for job ${jobId}...`);
                        await downloadObject(tempBucket, tempVideoKey!, localVideoPath);
                        await extractAudioFromVideo(localVideoPath, localExtractedPath);
                        inputAudioPath = localExtractedPath;
                    }

                    // Extract Spotify-like features
                    const features: AudioFeatures = await extractAudioFeatures(inputAudioPath);

                    // Persist to Job table via backend webhook
                    try {
                        console.log(`[AUDIO-FEATURES] Persisting features in Job table for job ${jobId}...`);
                        await api.post(`/${jobId}/audio-features`, {
                            audioFeatures: features,
                        });
                        console.log(`[AUDIO-FEATURES] Successfully persisted features in Job table for job ${jobId}`);
                    } catch (err: any) {
                        console.warn(`[AUDIO-FEATURES] Failed to persist features to backend for job ${jobId}:`, err?.message || err);
                    }

                    return {
                        status: "success",
                        jobId,
                        songId,
                        audioFeatures: features,
                    };
                } finally {
                    await safeCleanPaths([
                        localAudioPath,
                        localVideoPath,
                        localExtractedPath,
                    ]);
                }
            });
        });
    }
);
