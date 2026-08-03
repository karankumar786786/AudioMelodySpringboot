import { inngest } from "../inngest";
import { api } from "../axios";
import { s3Client, downloadObject } from "../lib/s3";
import { AudioTranscoder } from "../lib/transcode";
import * as path from "node:path";
import * as fs from "node:fs";
import { config } from "dotenv";
config();

export const transcodeFunction = inngest.createFunction(
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
        if (!fs.existsSync(baseTmpDir)) {
            fs.mkdirSync(baseTmpDir, { recursive: true });
        }

        const localDownloadPath = path.join(baseTmpDir, `${path.basename(jobId)}`);
        const outputDir = path.join(baseTmpDir, `t_${jobId}`);
        const audioName = path.basename(outputDir);
        const songKey = `${basePath}/${audioName}`;

        try {
            // Notify Spring Boot transcoding started
            await step.run("notify-transcoding-started", async () => {
                await api.post(`/${jobId}/transcoding-started`, {
                    processingId: audioName,
                });
            });

            // Run transcoding process
            await step.run("transcode-process", async () => {
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
            });

            // Notify Spring Boot transcoded
            await step.run("notify-transcoded", async () => {
                await api.post(`/${jobId}/transcoded`, {
                    songKey: songKey,
                });
            });

            return { status: "success", jobId, songKey };
        } catch (error: any) {
            console.error(`[TRANSCODE] Job ${jobId} failed:`, error);
            try {
                await api.post(`/${jobId}/failed`, {
                    reason: error.message || "Transcoding failed",
                });
            } catch (notifyErr) {
                console.error(`Failed to notify failure to webhook for job ${jobId}:`, notifyErr);
            }
            throw error;
        } finally {
            if (fs.existsSync(localDownloadPath)) {
                fs.unlinkSync(localDownloadPath);
            }
            if (fs.existsSync(outputDir)) {
                fs.rmSync(outputDir, { recursive: true, force: true });
            }
        }
    }
);