/**
 * S3 helpers: file download, ek file delete, poora prefix (folder) delete, aur ek job ki saari
 * cloud files saaf karna. Media pipeline ke functions aur cleanup isko use karte hain.
 */
import {
    S3Client,
    GetObjectCommand,
    DeleteObjectCommand,
    ListObjectsV2Command,
    DeleteObjectsCommand,
    type ListObjectsV2CommandOutput,
    type _Object,
} from "@aws-sdk/client-s3";
import { Readable } from "node:stream";
import * as fs from "node:fs";
import { config } from "dotenv";
config();

const region = process.env.AWS_REGION || process.env.REGION || "us-east-1";
const accessKeyId = process.env.AWS_ACCESS_KEY_ID || process.env.ACCESS_KEY_ID || "";
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY || process.env.SECRET_KEY || "";

export const s3Client = new S3Client({
    region,
    credentials: {
        accessKeyId,
        secretAccessKey,
    },
});

/**
 * S3 se file download karke downloadPath pe likho (stream se, taaki badi file bhi RAM me na bhare).
 * Body khaali ho ya stream / write fail ho to error phenkta hai.
 */
export async function downloadObject(bucket: string, key: string, downloadPath: string): Promise<void> {
    const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key,
    });
    const response = await s3Client.send(command);
    if (!response.Body) {
        throw new Error(`S3 GetObject returned empty body for key ${key}`);
    }

    const stream = response.Body as Readable;
    const writeStream = fs.createWriteStream(downloadPath);

    await new Promise<void>((resolve, reject) => {
        stream.pipe(writeStream);
        stream.on("error", reject);
        writeStream.on("finish", resolve);
        writeStream.on("error", reject);
    });
}

/** S3 se ek file delete karo. Fail ho to error phenkta hai. */
export async function deleteObject(bucket: string, key: string): Promise<void> {
    const command = new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
    });
    await s3Client.send(command);
}

/**
 * Ek prefix se shuru hone wali saari files delete karo (jaise audios/<songId>/ ke saare HLS/DASH chunks).
 * S3 ek baar me 1000 tak hi list karta hai, isliye ContinuationToken se page-by-page chalte hain.
 * Error aaye to sirf warning - phenkta nahi.
 */
export async function deletePrefix(bucket: string, prefix: string): Promise<void> {
    try {
        let continuationToken: string | undefined = undefined;
        do {
            const listCommand = new ListObjectsV2Command({
                Bucket: bucket,
                Prefix: prefix,
                ContinuationToken: continuationToken,
            });
            const listed: ListObjectsV2CommandOutput = await s3Client.send(listCommand);
            if (listed.Contents && listed.Contents.length > 0) {
                const keysToDelete = listed.Contents
                    .map((item: _Object) => item.Key)
                    .filter((k): k is string => typeof k === "string" && k.length > 0);

                if (keysToDelete.length > 0) {
                    const deleteCommand = new DeleteObjectsCommand({
                        Bucket: bucket,
                        Delete: {
                            Objects: keysToDelete.map((Key) => ({ Key })),
                        },
                    });
                    await s3Client.send(deleteCommand);
                }
            }
            continuationToken = listed.NextContinuationToken;
        } while (continuationToken);
    } catch (err: any) {
        console.warn(`[S3] Error deleting prefix ${prefix} from bucket ${bucket}:`, err.message || err);
    }
}

/**
 * Ek job ki saari cloud files saaf karo: production S3 ke (aadhe ya poore) transcoded chunks
 * (audios/, videos/) aur temp S3 ki raw uploads. Temp wale deletes ke errors chupchap ignore.
 */
export async function purgeJobCloudArtifacts(params: {
    jobId: string;
    songId?: string;
    tempSongKey?: string;
    tempVideoKey?: string;
    songKey?: string;
    fullVideoKey?: string;
}): Promise<void> {
    const prodBucket = process.env.PRODUCTION_BUCKET_NAME || "audiomelodyspringboot";
    const tempBucket = process.env.TEMP_BUCKET_NAME || "audiomelodyspringboottemp";

    console.log(`[S3 PURGE] Purging cloud artifacts for job ${params.jobId} (songId: ${params.songId})...`);

    // 1. Production S3 ke chunks hatao (audios/<songId>, videos/<songId>, wagairah)
    if (params.songId) {
        const basePath = process.env.BASE_PATH || "audios";
        const videoBasePath = process.env.VIDEO_BASE_PATH || "videos";
        await deletePrefix(prodBucket, `${basePath}/${params.songId}`);
        await deletePrefix(prodBucket, `${videoBasePath}/${params.songId}`);
        await deletePrefix(prodBucket, params.songId);
    }
    if (params.songKey) {
        await deletePrefix(prodBucket, params.songKey);
    }
    if (params.fullVideoKey) {
        await deletePrefix(prodBucket, params.fullVideoKey);
    }

    // 2. Temp S3 ki source files hatao (tempSongKey, tempVideoKey, temp prefixes)
    if (params.tempSongKey) {
        await deleteObject(tempBucket, params.tempSongKey).catch(() => {});
        await deletePrefix(tempBucket, params.tempSongKey).catch(() => {});
    }
    if (params.tempVideoKey) {
        await deleteObject(tempBucket, params.tempVideoKey).catch(() => {});
        await deletePrefix(tempBucket, params.tempVideoKey).catch(() => {});
    }
    if (params.songId) {
        await deletePrefix(tempBucket, params.songId).catch(() => {});
    }
    if (params.jobId) {
        await deletePrefix(tempBucket, params.jobId).catch(() => {});
    }
    console.log(`[S3 PURGE] Completed S3 purge for job ${params.jobId}`);
}
