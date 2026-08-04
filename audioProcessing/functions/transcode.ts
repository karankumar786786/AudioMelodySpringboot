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
        const { jobId, tempSongKey } = event.data;

        if (!jobId || !tempSongKey) {
            throw new Error("Missing jobId or tempSongKey in event data");
        }

        const tempBucket = process.env.TEMP_BUCKET_NAME || "videotranscodetemp";
        const prodBucket = process.env.PRODUCTION_BUCKET_NAME || "audioprocessingproduction";
        const basePath = process.env.BASE_PATH || "audios";

        const baseTmpDir = path.join(process.cwd(), "tmp");
        const songKey = `${basePath}/${jobId}`;

        // Notify Spring Boot transcoding started
        await step.run("notify-transcoding-started", async () => {
            await api.post(`/${jobId}/transcoding-started`, {
                processingId: jobId,
            });
        });

        // Run transcoding process (download, transcode, upload to S3 under jobId directory, cleanup)
        await step.run("transcode-process", async () => {
            if (!fs.existsSync(baseTmpDir)) {
                fs.mkdirSync(baseTmpDir, { recursive: true });
            }

            const localUuid = crypto.randomUUID();
            const localDownloadPath = path.join(baseTmpDir, `raw_${localUuid}`);
            const outputDir = path.join(baseTmpDir, `transcoded_${localUuid}`);

            try {
                console.log(`[TRANSCODE] Downloading raw audio for job ${jobId}...`);
                await downloadObject(tempBucket, tempSongKey, localDownloadPath);

                console.log(`[TRANSCODE] Starting transcoding for job ${jobId} (local dir: ${outputDir}, S3 dir: ${songKey})...`);
                const transcoder = new AudioTranscoder(
                    4,
                    s3Client,
                    basePath,
                    prodBucket,
                );
                // Pass jobId as the 3rd argument so S3 upload path is audios/<jobId>/...
                await transcoder.transcode(localDownloadPath, outputDir, jobId);
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
            });
        });

        // Trigger next step: Recombee indexing
        await step.sendEvent("trigger-recombee-indexing", {
            name: "audio/song.index.recombee",
            data: { jobId }
        });

        return { status: "success", jobId, songKey };
    }
);