import { NonRetriableError } from "inngest";
import { inngest } from "../inngest";
import { shortApi } from "../axios";
import { s3Client, downloadObject } from "../lib/s3";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { SHORT_QUALITY_PROFILES, VideoTranscoder } from "../lib/transcode/video";
import { safeCleanPaths, registerActiveTmpPath } from "../lib/transcode/cleanup";
import { validateMediaIntegrity } from "../lib/transcode/validator";
import { CONCURRENT_TRANSCODING_LIMIT, globalTranscodeLimiter } from "../lib/transcode/limiter";
import { extractMeaningfulError } from "../lib/errorUtils";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import * as path from "node:path";
import * as fs from "node:fs";
import * as crypto from "node:crypto";
import { config } from "dotenv";
config();

const execFileAsync = promisify(execFile);

/** Longest short we accept, in seconds. */
export const MAX_SHORT_SECONDS = Number(process.env.SHORT_MAX_SECONDS) || 60;
/** Raw uploads above this are rejected (the core API also checks before signing the upload). */
export const MAX_SHORT_BYTES = (Number(process.env.SHORT_MAX_MB) || 100) * 1024 * 1024;
export const SHORTS_BASE_PATH = process.env.SHORTS_BASE_PATH || "shorts";

export interface ProcessShortData {
    shortId: string;
    rawKey: string;
}

/** Pure: why a probed upload can't become a short, or null when it's acceptable. */
export function shortRejectionReason(probe: { duration: number; hasVideo: boolean; hasAudio: boolean }, sizeBytes: number): string | null {
    if (sizeBytes > MAX_SHORT_BYTES) return `File is larger than ${Math.round(MAX_SHORT_BYTES / 1024 / 1024)} MB`;
    if (!probe.hasVideo) return "The file has no video track";
    if (!(probe.duration > 0)) return "The video has no duration";
    if (probe.duration > MAX_SHORT_SECONDS + 0.5) return `Shorts can be at most ${MAX_SHORT_SECONDS} seconds`;
    return null;
}

/**
 * process-short: turn one uploaded vertical video into a Short.
 * Validate → HLS ladder 720x1280 / 540x960 / 360x640 (cropped to 9:16, audio kept)
 * → thumbnail → report to the admin API, which marks the short READY or FAILED.
 */
export const processShort = inngest.createFunction(
    {
        id: "process-short",
        concurrency: { limit: CONCURRENT_TRANSCODING_LIMIT },
        cancelOn: [{ event: "shorts/cancel", match: "data.shortId" }],
        triggers: [{ event: "shorts/process" }],
        retries: 2,
        onFailure: async ({ event, error }) => {
            const shortId = event?.data?.event?.data?.shortId;
            if (!shortId) return;
            const reason = extractMeaningfulError(error, "Short processing failed");
            try {
                await shortApi.post(`/${shortId}/failed`, { reason });
            } catch (e) {
                console.error(`[SHORT] Could not report failure for ${shortId}:`, e);
            }
        },
    },
    async ({ event, step }) => {
        const { shortId, rawKey } = event.data as ProcessShortData;
        if (!shortId || !rawKey) throw new NonRetriableError("Missing shortId or rawKey");

        const tempBucket = process.env.TEMP_BUCKET_NAME || "audiomelodyspringboottemp";
        const prodBucket = process.env.PRODUCTION_BUCKET_NAME || "audiomelodyspringboot";
        const baseTmpDir = path.join(process.cwd(), "tmp");

        const result = await step.run("transcode-short", async () => {
            return await globalTranscodeLimiter(async () => {
                fs.mkdirSync(baseTmpDir, { recursive: true });
                const localId = crypto.randomUUID();
                const rawPath = path.join(baseTmpDir, `raw_short_${localId}${path.extname(rawKey) || ".mp4"}`);
                const outDir = path.join(baseTmpDir, `transcoded_short_${localId}`);
                const thumbPath = path.join(baseTmpDir, `short_thumb_${localId}.jpg`);
                registerActiveTmpPath(rawPath);
                registerActiveTmpPath(outDir);
                registerActiveTmpPath(thumbPath);
                try {
                    await downloadObject(tempBucket, rawKey, rawPath);
                    const probe = await validateMediaIntegrity(rawPath, "video");
                    const rejection = shortRejectionReason(probe, fs.statSync(rawPath).size);
                    if (rejection) throw new NonRetriableError(rejection);

                    const transcoder = new VideoTranscoder(2, s3Client, SHORTS_BASE_PATH, prodBucket, {
                        profiles: SHORT_QUALITY_PROFILES,
                        maxHeight: 1280,
                        fitMode: "cover",
                    });
                    const { duration } = await transcoder.transcode(rawPath, outDir, shortId);

                    // Poster frame at ~1 s (or the first frame of very short clips).
                    const at = Math.min(1, Math.max(0, duration / 2)).toFixed(2);
                    await execFileAsync("ffmpeg", [
                        "-nostdin", "-y", "-loglevel", "error", "-ss", at, "-i", rawPath,
                        "-frames:v", "1", "-vf", "scale=540:960:force_original_aspect_ratio=increase,crop=540:960",
                        "-q:v", "4", thumbPath,
                    ]);
                    const thumbnailKey = `${SHORTS_BASE_PATH}/${shortId}/thumbnail.jpg`;
                    await s3Client.send(new PutObjectCommand({
                        Bucket: prodBucket,
                        Key: thumbnailKey,
                        Body: fs.readFileSync(thumbPath),
                        ContentType: "image/jpeg",
                        CacheControl: "public, max-age=31536000, immutable",
                    }));

                    return {
                        hlsKey: `${SHORTS_BASE_PATH}/${shortId}/master.m3u8`,
                        thumbnailKey,
                        durationMs: Math.round(duration * 1000),
                        width: 720,
                        height: 1280,
                    };
                } finally {
                    await safeCleanPaths([rawPath, outDir, thumbPath]);
                }
            });
        });

        await step.run("report-processed", async () => {
            await shortApi.post(`/${shortId}/processed`, result);
        });
        return { status: "ready", shortId };
    }
);
