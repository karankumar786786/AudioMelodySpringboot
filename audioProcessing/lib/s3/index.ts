import { S3Client, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
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

export async function deleteObject(bucket: string, key: string): Promise<void> {
    const command = new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
    });
    await s3Client.send(command);
}
