import { S3Client, DeleteObjectCommand, DeleteObjectsCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
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

export async function deleteObject(bucket: string, key: string): Promise<void> {
    const command = new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
    });
    await s3Client.send(command);
}

export async function deletePrefix(bucket: string, prefix: string): Promise<number> {
    const normalizedPrefix = prefix.replace(/^\/+/, "").replace(/\/*$/, "");
    const keysToDelete: string[] = [];

    let continuationToken: string | undefined;

    do {
        const listResponse = await s3Client.send(
            new ListObjectsV2Command({
                Bucket: bucket,
                Prefix: normalizedPrefix,
                ContinuationToken: continuationToken,
            })
        );

        const contents = listResponse.Contents ?? [];
        for (const item of contents) {
            if (item.Key) {
                keysToDelete.push(item.Key);
            }
        }

        continuationToken = listResponse.IsTruncated ? listResponse.NextContinuationToken : undefined;
    } while (continuationToken);

    if (keysToDelete.length === 0) {
        return 0;
    }

    for (let i = 0; i < keysToDelete.length; i += 1000) {
        const chunk = keysToDelete.slice(i, i + 1000);
        await s3Client.send(
            new DeleteObjectsCommand({
                Bucket: bucket,
                Delete: {
                    Objects: chunk.map((Key) => ({ Key })),
                    Quiet: true,
                },
            })
        );
    }

    return keysToDelete.length;
}
