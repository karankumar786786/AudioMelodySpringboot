import { S3Client, DeleteObjectsCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { config } from "dotenv";
config();

const region =  process.env.REGION || "us-east-1";
const accessKeyId =  process.env.ACCESS_KEY_ID || "";
const secretAccessKey =  process.env.SECRET_KEY || "";

export const s3Client = new S3Client({
    region,
    credentials: {
        accessKeyId,
        secretAccessKey,
    },
});



export async function deleteObject(
    bucket: string,
    key: string
): Promise<void> {

    const listed = await s3Client.send(
        new ListObjectsV2Command({
            Bucket: bucket,
            Prefix: key,
        })
    );

    if (!listed.Contents || listed.Contents.length === 0) {
        return;
    }

    const command = new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: {
            Objects: listed.Contents.map((object) => ({
                Key: object.Key!,
            })),
        },
    });

    await s3Client.send(command);
}

