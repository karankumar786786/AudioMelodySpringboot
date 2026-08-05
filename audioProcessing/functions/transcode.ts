import { inngest } from "../inngest";
import { api } from "../axios";
import { s3Client, downloadObject } from "../lib/s3";
import { AudioTranscoder } from "../lib/transcode";
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
        const { jobId, tempSongKey, songId } = event.data;

        if (!jobId || !tempSongKey || !songId) {
            throw new Error("Missing jobId, tempSongKey, or songId in event data");
        }

        const tempBucket = process.env.TEMP_BUCKET_NAME || "videotranscodetemp";
        const prodBucket = process.env.PRODUCTION_BUCKET_NAME || "audioprocessingproduction";
        const basePath = process.env.BASE_PATH || "audios";

        const baseTmpDir = path.join(process.cwd(), "tmp");
        // S3 directory uses songId for traceability and consistency with Algolia/Recombee
        const songKey = `${basePath}/${songId}`;

        // Notify Spring Boot transcoding started
        await step.run("notify-transcoding-started", async () => {
            await api.post(`/${jobId}/transcoding-started`, {
                processingId: songId,
            });
        });

        // Run transcoding process (download, transcode, upload to S3 under songId directory, cleanup)
        const { duration } = await step.run("transcode-process", async () => {
            if (!fs.existsSync(baseTmpDir)) {
                fs.mkdirSync(baseTmpDir, { recursive: true });
            }

            const localUuid = crypto.randomUUID();
            const localDownloadPath = path.join(baseTmpDir, `raw_${localUuid}`);
            const outputDir = path.join(baseTmpDir, `transcoded_${localUuid}`);

            try {
                console.log(`[TRANSCODE] Downloading raw audio for job ${jobId}...`);
                await downloadObject(tempBucket, tempSongKey, localDownloadPath);

                console.log(`[TRANSCODE] Starting transcoding for job ${jobId} (songId: ${songId}, S3 dir: ${songKey})...`);
                const transcoder = new AudioTranscoder(
                    4,
                    s3Client,
                    basePath,
                    prodBucket,
                );
                // Pass songId as the S3 dir name so upload path is audios/<songId>/...
                const res = await transcoder.transcode(localDownloadPath, outputDir, songId);
                return { duration: Math.round(res.duration) };
            } finally {
                // Cleanup local temp files
                if (fs.existsSync(localDownloadPath)) {
                    fs.unlinkSync(localDownloadPath);
                }
                if (fs.existsSync(outputDir)) {
                    fs.rmSync(outputDir, { recursive: true, force: true });
                }
            }
        });

        // Notify Spring Boot transcoded
        await step.run("notify-transcoded", async () => {
            await api.post(`/${jobId}/transcoded`, {
                songKey: songKey,
                duration: duration,
            });
        });

        // Trigger next step: Recombee indexing
        await step.sendEvent("trigger-recombee-indexing", {
            name: "audio/song.index.recombee",
            data: { jobId }
        });

        return { status: "success", jobId, songId, songKey };
    }
);