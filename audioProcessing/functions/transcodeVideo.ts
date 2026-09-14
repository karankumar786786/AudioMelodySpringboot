import { inngest } from "../inngest";
import { s3Client, downloadObject } from "../lib/s3";
import { VideoTranscoder } from "../lib/transcode/video";
import { safeCleanPaths, registerActiveTmpPath } from "../lib/transcode/cleanup";
import { validateMediaIntegrity } from "../lib/transcode/validator";
import * as path from "node:path";
import * as fs from "node:fs";
import * as crypto from "node:crypto";
import { config } from "dotenv";
config();

export interface TranscodeVideoData {
    jobId: string;
    songId: string;
    tempVideoKey: string;
}

export const transcodeVideoTask = inngest.createFunction(
    {
        id: "transcode-video-task",
        cancelOn: [
            {
                event: "audio/job.cancel",
                match: "data.jobId",
            },
        ],
        triggers: [{ event: "audio/song.transcode.video" }],
        retries: 3,
    },
    async ({ step, event }) => {
        const {
            jobId,
            songId,
            tempVideoKey,
        } = event.data as TranscodeVideoData;

        if (!tempVideoKey || !songId) {
            throw new Error("Missing tempVideoKey or songId for video transcoding");
        }

        const tempBucket = process.env.TEMP_BUCKET_NAME || "audiomelodyspringboottemp";
        const prodBucket = process.env.PRODUCTION_BUCKET_NAME || "audiomelodyspringboot";
        const videoBasePath = process.env.VIDEO_BASE_PATH || "videos";
        const baseTmpDir = path.join(process.cwd(), "tmp");

        return await step.run("process-video-transcode", async () => {
            if (!fs.existsSync(baseTmpDir)) {
                fs.mkdirSync(baseTmpDir, { recursive: true });
            }

            const localUuid = crypto.randomUUID();
            const localVideoDownloadPath = path.join(baseTmpDir, `raw_video_main_${localUuid}.mp4`);
            const videoOutputDir = path.join(baseTmpDir, `transcoded_video_${localUuid}`);

            registerActiveTmpPath(localVideoDownloadPath);
            registerActiveTmpPath(videoOutputDir);

            try {
                console.log(`[VIDEO-WORKER] Downloading raw video for job ${jobId}...`);
                await downloadObject(tempBucket, tempVideoKey, localVideoDownloadPath);

                // Fail-fast integrity pre-flight check before heavy video encoding
                console.log(`[VIDEO-WORKER] Running fail-fast integrity validation for job ${jobId}...`);
                const validation = await validateMediaIntegrity(localVideoDownloadPath, "video");
                console.log(`[VIDEO-WORKER] Video integrity verified (${validation.formatName}, ${validation.width}x${validation.height}, duration ${validation.duration.toFixed(2)}s)`);

                console.log(`[VIDEO-WORKER] Transcoding and packaging video with hardware acceleration...`);
                const videoTranscoder = new VideoTranscoder(4, s3Client, videoBasePath, prodBucket);
                const { duration } = await videoTranscoder.transcode(localVideoDownloadPath, videoOutputDir, songId);

                const fullVideoKey = `${videoBasePath}/${songId}`;
                console.log(`[VIDEO-WORKER] Video transcoding completed -> ${fullVideoKey} (${duration.toFixed(2)}s)`);

                return { duration, fullVideoKey };
            } finally {
                await safeCleanPaths([localVideoDownloadPath, videoOutputDir]);
            }
        });
    }
);
