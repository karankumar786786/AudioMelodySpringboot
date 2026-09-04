import { inngest } from "../inngest";
import { downloadObject } from "../lib/s3";
import { cutCanvasVideo, uploadCanvasToImageKit } from "../lib/transcode/video";
import { safeCleanPaths, registerActiveTmpPath } from "../lib/transcode/cleanup";
import * as path from "node:path";
import * as fs from "node:fs";
import * as crypto from "node:crypto";
import { config } from "dotenv";
config();

export interface TranscodeCanvasData {
    jobId: string;
    songId: string;
    tempVideoKey: string;
    clipStartSec?: number;
    clipEndSec?: number;
}

export const transcodeCanvasTask = inngest.createFunction(
    {
        id: "transcode-canvas-task",
        triggers: [{ event: "audio/song.transcode.canvas" }],
        retries: 3,
    },
    async ({ step, event }) => {
        const {
            jobId,
            songId,
            tempVideoKey,
            clipStartSec,
            clipEndSec,
        } = event.data as TranscodeCanvasData;

        if (!tempVideoKey || !songId) {
            throw new Error("Missing tempVideoKey or songId for canvas transcoding");
        }

        // If start and end duration are 0 or invalid, skip canvas creation
        if (
            (clipStartSec === 0 && clipEndSec === 0) ||
            (typeof clipEndSec === "number" && clipEndSec === 0) ||
            (typeof clipStartSec === "number" && typeof clipEndSec === "number" && clipEndSec <= clipStartSec)
        ) {
            console.log(`[CANVAS-WORKER] Start and end duration are 0 (or invalid). Skipping canvas creation for job ${jobId}.`);
            return { canvasVideoKey: null };
        }

        const tempBucket = process.env.TEMP_BUCKET_NAME || "audiomelodyspringboottemp";
        const baseTmpDir = path.join(process.cwd(), "tmp");

        return await step.run("process-canvas-snippet", async () => {
            if (!fs.existsSync(baseTmpDir)) {
                fs.mkdirSync(baseTmpDir, { recursive: true });
            }

            const localUuid = crypto.randomUUID();
            const localVideoDownloadPath = path.join(baseTmpDir, `raw_video_canvas_${localUuid}.mp4`);
            const localCanvasClipPath = path.join(baseTmpDir, `canvas_${localUuid}.mp4`);

            registerActiveTmpPath(localVideoDownloadPath);
            registerActiveTmpPath(localCanvasClipPath);

            try {
                console.log(`[CANVAS-WORKER] Downloading raw video for job ${jobId}...`);
                await downloadObject(tempBucket, tempVideoKey, localVideoDownloadPath);

                const start = typeof clipStartSec === "number" && clipStartSec >= 0 ? clipStartSec : 0;
                const end = typeof clipEndSec === "number" && clipEndSec > start ? clipEndSec : start + 15;

                console.log(`[CANVAS-WORKER] Cutting canvas snippet from ${start}s to ${end}s...`);
                await cutCanvasVideo(localVideoDownloadPath, localCanvasClipPath, start, end);

                console.log(`[CANVAS-WORKER] Uploading canvas video to ImageKit...`);
                const canvasVideoKey = await uploadCanvasToImageKit(
                    localCanvasClipPath,
                    `${songId}_canvas.mp4`,
                    "/songs/videos"
                );

                console.log(`[CANVAS-WORKER] Canvas processed successfully -> ${canvasVideoKey}`);
                return { canvasVideoKey };
            } finally {
                await safeCleanPaths([localVideoDownloadPath, localCanvasClipPath]);
            }
        });
    }
);
