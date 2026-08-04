import { inngest } from "../inngest";
import { api } from "../axios";
import { s3Client, downloadObject } from "../lib/s3";
import { AudioTranscoder } from "../lib/transcode";
import * as path from "node:path";
import * as fs from "node:fs";
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
        const audioName = `t_${jobId}`;
        const songKey = `${basePath}/${audioName}`;

        // Notify Spring Boot transcoding started
        await step.run("notify-transcoding-started", async () => {
            await api.post(`/${jobId}/transcoding-started`, {
                processingId: audioName,
            });
        });

        // Run transcoding process (download, transcode, upload to S3, cleanup — all in one step)
        await step.run("transcode-process", async () => {
            if (!fs.existsSync(baseTmpDir)) {
                fs.mkdirSync(baseTmpDir, { recursive: true });
            }

            const localDownloadPath = path.join(baseTmpDir, `${path.basename(jobId)}`);
            const outputDir = path.join(baseTmpDir, audioName);

            try {
                console.log(`[TRANSCODE] Downloading raw audio for job ${jobId}...`);
                await downloadObject(tempBucket, tempSongKey, localDownloadPath);

                console.log(`[TRANSCODE] Starting transcoding for job ${jobId}...`);
                const transcoder = new AudioTranscoder(
                    4,
                    s3Client,
                    basePath,
                    prodBucket,
                );
                await transcoder.transcode(localDownloadPath, outputDir);
            } finally {
                // Cleanup local files inside the step where they were created
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