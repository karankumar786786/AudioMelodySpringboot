/**
 * Inngest sub-task: video se chhota bina-awaaz canvas clip kaat ke ImageKit pe daalna.
 * transcode-song (orchestrator) isko step.invoke se chalata hai (event "audio/song.transcode.canvas").
 * Clip time 0 ya galat ho to skip ({ canvasVideoKey: null }). Clip end na diya ho to start + 15 second.
 *
 * Har run: temp folder me file download -> kaam -> finally me local files hamesha saaf.
 * globalTranscodeLimiter: ek process me bhaari FFmpeg kaam limit se zyada ek saath nahi.
 */
import { inngest } from "../inngest";
import { downloadObject } from "../lib/s3";
import { cutCanvasVideo, uploadCanvasToImageKit } from "../lib/transcode/video";
import { safeCleanPaths, registerActiveTmpPath } from "../lib/transcode/cleanup";
import { validateMediaIntegrity } from "../lib/transcode/validator";
import * as path from "node:path";
import * as fs from "node:fs";
import * as crypto from "node:crypto";
import { config } from "dotenv";
import { CONCURRENT_TRANSCODING_LIMIT, globalTranscodeLimiter } from "../lib/transcode/limiter";
config();

/** Event ka data (clip time seconds me). */
export interface TranscodeCanvasData {
    jobId: string;
    songId: string;
    tempVideoKey: string;
    clipStartSec?: number;
    clipEndSec?: number;
}

/** Video download -> jaanch -> clip kaato -> ImageKit upload -> { canvasVideoKey }. */
export const transcodeCanvasTask = inngest.createFunction(
    {
        id: "transcode-canvas-task",
        concurrency: {
            limit: CONCURRENT_TRANSCODING_LIMIT,
        },
        cancelOn: [
            {
                event: "audio/job.cancel",
                match: "data.jobId",
            },
        ],
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

        // Clip ka time 0 ya galat ho to canvas mat banao
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
            return await globalTranscodeLimiter(async () => {
                if (!fs.existsSync(baseTmpDir)) {
                    fs.mkdirSync(baseTmpDir, { recursive: true });
                }

                const localUuid = crypto.randomUUID();
                const ext = path.extname(tempVideoKey) || ".mp4";
                const localVideoDownloadPath = path.join(baseTmpDir, `raw_video_canvas_${localUuid}${ext}`);
                const localCanvasClipPath = path.join(baseTmpDir, `canvas_${localUuid}.mp4`);

                registerActiveTmpPath(localVideoDownloadPath);
                registerActiveTmpPath(localCanvasClipPath);

                try {
                    console.log(`[CANVAS-WORKER] Downloading raw video for job ${jobId}...`);
                    await downloadObject(tempBucket, tempVideoKey, localVideoDownloadPath);

                    // Jaldi wali jaanch
                    console.log(`[CANVAS-WORKER] Running fail-fast integrity validation for job ${jobId}...`);
                    await validateMediaIntegrity(localVideoDownloadPath, "video");

                    // Start na ho / negative ho to 0; end sahi na ho to start + 15 second
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
        });
    }
);
