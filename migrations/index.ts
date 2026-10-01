import { algoliasearch } from "algoliasearch";
import recombee from "recombee-api-client";
import {
    S3Client,
    ListObjectsV2Command,
    DeleteObjectsCommand,
    ListMultipartUploadsCommand,
    AbortMultipartUploadCommand,
    ListObjectVersionsCommand,
} from "@aws-sdk/client-s3";
import ImageKit from "imagekit";
import pg from "pg";
import * as fs from "node:fs";
import * as path from "node:path";
import dotenv from "dotenv";

const { Client } = pg;
const rqs = recombee.requests;

// ── Environment Configuration ──
// 1. Load local .env
dotenv.config({ path: path.join(__dirname, ".env") });

// 2. Helper to load fallback .env if keys are missing
function loadFallbackEnv(fallbackRelativePath: string) {
    const fullPath = path.resolve(__dirname, fallbackRelativePath);
    if (fs.existsSync(fullPath)) {
        const parsed = dotenv.parse(fs.readFileSync(fullPath));
        for (const [key, val] of Object.entries(parsed)) {
            if (!process.env[key] && val) {
                process.env[key] = val;
            }
        }
    }
}
loadFallbackEnv("../coreEngine/.env");
loadFallbackEnv("../audioProcessing/.env");

const ALGOLIA_APP_ID = process.env.ALGOLIA_APP_ID;
const ALGOLIA_API_KEY = process.env.ALGOLIA_API_KEY;
const ALGOLIA_INDEX_NAME = process.env.ALGOLIA_INDEX_NAME || "one_melody_springboot";

const RECOMBEE_DATABASE_ID = process.env.RECOMBEE_DATABASE_ID;
const RECOMBEE_DATABASE_SECRET = process.env.RECOMBEE_DATABASE_SECRET;
const RECOMBEE_DATABASE_REGION = process.env.RECOMBEE_DATABASE_REGION || "eu-west";

const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID || process.env.ACCESS_KEY_ID;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY || process.env.SECRET_KEY;
const AWS_REGION = process.env.AWS_REGION || process.env.REGION || "ap-south-1";
const S3_TEMP_BUCKET = process.env.S3_TEMP_BUCKET || process.env.TEMP_BUCKET_NAME || "audiomelodyspringboottemp";
const S3_PRODUCTION_BUCKET = process.env.S3_PRODUCTION_BUCKET || process.env.PRODUCTION_BUCKET_NAME || "audiomelodyspringboot";

const IMAGEKIT_PUBLIC_KEY = process.env.IMAGEKIT_PUBLIC_KEY;
const IMAGEKIT_PRIVATE_KEY = process.env.IMAGEKIT_PRIVATE_KEY;
const IMAGEKIT_URL_ENDPOINT = process.env.IMAGEKIT_URL_ENDPOINT;

const DB_URL = (
    process.env.DB_URL?.replace("jdbc:postgresql://", "postgresql://") ||
    process.env.DATABASE_URL
);

// ── 1. Algolia ──
async function clearAlgolia(dryRun = false) {
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🔍 [1/5] Algolia Search");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    if (!ALGOLIA_APP_ID || !ALGOLIA_API_KEY) {
        console.warn("⚠️  Skipping Algolia: ALGOLIA_APP_ID or ALGOLIA_API_KEY not set.");
        return;
    }

    try {
        const client = algoliasearch(ALGOLIA_APP_ID, ALGOLIA_API_KEY);
        const searchRes = await client.searchSingleIndex({
            indexName: ALGOLIA_INDEX_NAME,
            searchParams: { query: "", hitsPerPage: 1 },
        });
        const currentCount = searchRes.nbHits ?? 0;
        console.log(`📊 Current index "${ALGOLIA_INDEX_NAME}" objects: ${currentCount}`);

        if (dryRun) {
            console.log(`ℹ️  [DRY RUN] Would delete ${currentCount} objects from Algolia.`);
            return;
        }

        console.log(`🗑️  Clearing all objects from "${ALGOLIA_INDEX_NAME}"...`);
        await client.clearObjects({ indexName: ALGOLIA_INDEX_NAME });
        console.log(`✅ Algolia index "${ALGOLIA_INDEX_NAME}" cleared successfully.`);
    } catch (err: any) {
        console.error("❌ Algolia clear failed:", err.message || err);
    }
}

// ── 2. Recombee ──
async function clearRecombee(dryRun = false) {
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🤖 [2/5] Recombee Recommendation Engine");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    if (!RECOMBEE_DATABASE_ID || !RECOMBEE_DATABASE_SECRET) {
        console.warn("⚠️  Skipping Recombee: RECOMBEE_DATABASE_ID or RECOMBEE_DATABASE_SECRET not set.");
        return;
    }

    try {
        const client = new recombee.ApiClient(RECOMBEE_DATABASE_ID, RECOMBEE_DATABASE_SECRET, {
            region: RECOMBEE_DATABASE_REGION,
        });

        if (dryRun) {
            console.log(`ℹ️  [DRY RUN] Would reset Recombee database "${RECOMBEE_DATABASE_ID}".`);
            return;
        }

        console.log(`🗑️  Resetting Recombee database "${RECOMBEE_DATABASE_ID}" (region: ${RECOMBEE_DATABASE_REGION})...`);
        await client.send(new rqs.ResetDatabase());
        console.log(`✅ Recombee database "${RECOMBEE_DATABASE_ID}" reset successfully.`);
    } catch (err: any) {
        console.error("❌ Recombee clear failed:", err.message || err);
    }
}

// ── 3. AWS S3 Buckets ──
async function clearSingleS3Bucket(client: S3Client, bucketName: string, dryRun = false) {
    console.log(`\n🪣 Bucket: "${bucketName}"`);

    // 1. Gather all standard object keys
    let continuationToken: string | undefined = undefined;
    const allKeys: { Key: string }[] = [];
    process.stdout.write(`   Listing objects... `);

    do {
        const listRes = await client.send(new ListObjectsV2Command({
            Bucket: bucketName,
            ContinuationToken: continuationToken,
            MaxKeys: 1000,
        }));

        if (listRes.Contents && listRes.Contents.length > 0) {
            for (const item of listRes.Contents) {
                if (item.Key) allKeys.push({ Key: item.Key });
            }
            process.stdout.write(`\r   Listing objects... ${allKeys.length} found`);
        }
        continuationToken = listRes.NextContinuationToken;
    } while (continuationToken);

    console.log(`\r   Found ${allKeys.length} objects.`);

    if (dryRun) {
        console.log(`   ℹ️  [DRY RUN] Would delete ${allKeys.length} objects from "${bucketName}".`);
        return;
    }

    if (allKeys.length > 0) {
        console.log(`   Deleting ${allKeys.length} objects in parallel batches...`);
        const BATCH_SIZE = 1000;
        const CONCURRENCY = 5;
        const batches: { Key: string }[][] = [];

        for (let i = 0; i < allKeys.length; i += BATCH_SIZE) {
            batches.push(allKeys.slice(i, i + BATCH_SIZE));
        }

        let deleted = 0;
        for (let i = 0; i < batches.length; i += CONCURRENCY) {
            const chunk = batches.slice(i, i + CONCURRENCY);
            await Promise.all(
                chunk.map(async (batch) => {
                    await client.send(new DeleteObjectsCommand({
                        Bucket: bucketName,
                        Delete: { Objects: batch, Quiet: true },
                    }));
                    deleted += batch.length;
                    process.stdout.write(`\r   🗑️  Deleted ${deleted} / ${allKeys.length} objects...`);
                })
            );
        }
        console.log(`\r   ✅ Successfully deleted ${deleted} objects from "${bucketName}".`);
    } else {
        console.log(`   ✨ Bucket "${bucketName}" is already empty.`);
    }

    // 2. Abort incomplete multipart uploads
    try {
        const mpRes = await client.send(new ListMultipartUploadsCommand({ Bucket: bucketName }));
        if (mpRes.Uploads && mpRes.Uploads.length > 0) {
            console.log(`   Found ${mpRes.Uploads.length} incomplete multipart uploads. Aborting...`);
            for (const upload of mpRes.Uploads) {
                if (upload.Key && upload.UploadId) {
                    await client.send(new AbortMultipartUploadCommand({
                        Bucket: bucketName,
                        Key: upload.Key,
                        UploadId: upload.UploadId,
                    }));
                }
            }
            console.log(`   ✅ Aborted all incomplete multipart uploads.`);
        }
    } catch {
        // Ignored if unsupported
    }

    // 3. Clear versioned objects / delete markers if versioning was ever enabled
    try {
        let keyMarker: string | undefined = undefined;
        let versionIdMarker: string | undefined = undefined;
        let versionedCount = 0;

        do {
            const vRes = await client.send(new ListObjectVersionsCommand({
                Bucket: bucketName,
                KeyMarker: keyMarker,
                VersionIdMarker: versionIdMarker,
            }));

            const toDelete: { Key: string; VersionId?: string }[] = [];
            if (vRes.Versions) {
                for (const v of vRes.Versions) {
                    if (v.Key) toDelete.push({ Key: v.Key, VersionId: v.VersionId });
                }
            }
            if (vRes.DeleteMarkers) {
                for (const dm of vRes.DeleteMarkers) {
                    if (dm.Key) toDelete.push({ Key: dm.Key, VersionId: dm.VersionId });
                }
            }

            if (toDelete.length > 0) {
                for (let i = 0; i < toDelete.length; i += 1000) {
                    await client.send(new DeleteObjectsCommand({
                        Bucket: bucketName,
                        Delete: { Objects: toDelete.slice(i, i + 1000), Quiet: true },
                    }));
                }
                versionedCount += toDelete.length;
            }

            if (vRes.IsTruncated) {
                keyMarker = vRes.NextKeyMarker;
                versionIdMarker = vRes.NextVersionIdMarker;
            } else {
                break;
            }
        } while (keyMarker || versionIdMarker);

        if (versionedCount > 0) {
            console.log(`   ✅ Purged ${versionedCount} versioned objects & delete markers.`);
        }
    } catch {
        // Ignored if bucket does not have versioning configured
    }
}

async function clearS3(dryRun = false) {
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("☁️  [3/5] AWS S3 Storage (Temp & Production)");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
        console.warn("⚠️  Skipping S3: AWS_ACCESS_KEY_ID or AWS_SECRET_ACCESS_KEY not set.");
        return;
    }

    const s3Client = new S3Client({
        region: AWS_REGION,
        credentials: {
            accessKeyId: AWS_ACCESS_KEY_ID,
            secretAccessKey: AWS_SECRET_ACCESS_KEY,
        },
    });

    const buckets = [
        { name: S3_TEMP_BUCKET, type: "Temp Uploads" },
        { name: S3_PRODUCTION_BUCKET, type: "Production Transcoded Audio/Video" },
    ];

    for (const b of buckets) {
        try {
            console.log(`\n📦 Processing ${b.type}...`);
            await clearSingleS3Bucket(s3Client, b.name, dryRun);
        } catch (err: any) {
            console.error(`❌ Error clearing bucket "${b.name}":`, err.message || err);
        }
    }
}

// ── 4. ImageKit CDN ──
async function clearImageKit(dryRun = false) {
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🖼️  [4/5] ImageKit CDN (Artwork & Canvas Videos)");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    if (!IMAGEKIT_PUBLIC_KEY || !IMAGEKIT_PRIVATE_KEY || !IMAGEKIT_URL_ENDPOINT) {
        console.warn("⚠️  Skipping ImageKit: IMAGEKIT_PUBLIC_KEY, IMAGEKIT_PRIVATE_KEY, or IMAGEKIT_URL_ENDPOINT not set.");
        return;
    }

    try {
        const ik = new ImageKit({
            publicKey: IMAGEKIT_PUBLIC_KEY,
            privateKey: IMAGEKIT_PRIVATE_KEY,
            urlEndpoint: IMAGEKIT_URL_ENDPOINT,
        });

        // 1. Collect all file IDs
        const allFileIds: string[] = [];
        let skip = 0;
        const limit = 100;
        process.stdout.write("   Listing ImageKit files... ");

        while (true) {
            const files = await ik.listFiles({ limit, skip });
            if (!files || files.length === 0) break;
            for (const f of files) {
                if (f.fileId) allFileIds.push(f.fileId);
            }
            process.stdout.write(`\r   Listing ImageKit files... ${allFileIds.length} found`);
            if (files.length < limit) break;
            skip += limit;
        }

        console.log(`\r   Found ${allFileIds.length} files in ImageKit CDN.`);

        if (dryRun) {
            console.log(`   ℹ️  [DRY RUN] Would delete ${allFileIds.length} files from ImageKit.`);
            return;
        }

        if (allFileIds.length > 0) {
            console.log(`   Deleting ${allFileIds.length} files in batches...`);
            const BATCH_SIZE = 100;
            let deleted = 0;

            for (let i = 0; i < allFileIds.length; i += BATCH_SIZE) {
                const batch = allFileIds.slice(i, i + BATCH_SIZE);
                try {
                    await ik.bulkDeleteFiles(batch);
                    deleted += batch.length;
                    process.stdout.write(`\r   🗑️  Deleted ${deleted} / ${allFileIds.length} ImageKit files...`);
                } catch (batchErr: any) {
                    console.warn(`\n   ⚠️  Batch delete warning: ${batchErr.message || batchErr}`);
                }
            }
            console.log(`\r   ✅ Successfully purged ${deleted} ImageKit CDN files.`);
        } else {
            console.log("   ✨ ImageKit storage is already empty.");
        }
    } catch (err: any) {
        console.error("❌ ImageKit clear failed:", err.message || err);
    }
}

// ── 5. PostgreSQL Media & Tracking Tables ──
async function clearPostgres(mode: "media" | "all" = "media", dryRun = false) {
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`🐘 [5/5] PostgreSQL Database (${mode === "media" ? "Media & History Only" : "Full Reset"})`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    if (!DB_URL) {
        console.warn("⚠️  Skipping PostgreSQL: DB_URL or DATABASE_URL not set.");
        return;
    }

    const client = new Client({
        connectionString: DB_URL,
        ssl: { rejectUnauthorized: false },
    });

    await client.connect();

    try {
        const mediaTables = [
            "delete_jobs",
            "user_search_history",
            "user_history",
            "user_favourite_songs",
            "user_playlist_songs",
            "playlist_songs",
            "pagination_metadata",
            "user_playlists",
            "playlists",
            "jobs",
            "songs",
        ];

        const targetTables = mode === "all" ? [...mediaTables, "artists", "users"] : mediaTables;

        console.log(`📋 Inspecting table row counts:`);
        for (const tbl of targetTables) {
            try {
                const res = await client.query(`SELECT COUNT(*) FROM "${tbl}";`);
                console.log(`   - ${tbl}: ${res.rows[0].count} rows`);
            } catch {
                // Table may not exist yet
            }
        }

        if (dryRun) {
            console.log(`ℹ️  [DRY RUN] Would truncate the tables listed above.`);
            return;
        }

        console.log(`\n🗑️  Truncating ${targetTables.length} tables with CASCADE...`);
        for (const tbl of targetTables) {
            try {
                await client.query(`TRUNCATE TABLE "${tbl}" RESTART IDENTITY CASCADE;`);
                console.log(`   ✅ Truncated "${tbl}"`);
            } catch (err: any) {
                console.warn(`   ⚠️  Could not truncate "${tbl}": ${err.message}`);
            }
        }
        console.log(`✅ PostgreSQL media tables cleared.`);
    } catch (err: any) {
        console.error("❌ PostgreSQL cleanup failed:", err.message || err);
    } finally {
        await client.end();
    }
}

// ── Main Entrypoint ──
async function main() {
    const args = process.argv.slice(2);
    const isDryRun = args.includes("--dry-run");
    const isS3Only = args.includes("--s3");
    const isAlgoliaOnly = args.includes("--algolia");
    const isRecombeeOnly = args.includes("--recombee");
    const isImageKitOnly = args.includes("--imagekit");
    const isDbOnly = args.includes("--db");
    const isDbAll = args.includes("--db-all");
    const isAll = args.includes("--all");

    console.log("╔══════════════════════════════════════════════════════════════╗");
    console.log("║     ONE MELODY — CLOUD & STORAGE DATA CLEAR MIGRATION        ║");
    console.log("╚══════════════════════════════════════════════════════════════╝");
    if (isDryRun) {
        console.log("🔍 MODE: DRY RUN (NO DATA WILL BE DELETED)\n");
    }

    const runAllCloud = !isS3Only && !isAlgoliaOnly && !isRecombeeOnly && !isImageKitOnly && !isDbOnly && !isDbAll;

    if (runAllCloud || isAlgoliaOnly || isAll) {
        await clearAlgolia(isDryRun);
    }

    if (runAllCloud || isRecombeeOnly || isAll) {
        await clearRecombee(isDryRun);
    }

    if (runAllCloud || isS3Only || isAll) {
        await clearS3(isDryRun);
    }

    if (runAllCloud || isImageKitOnly || isAll) {
        await clearImageKit(isDryRun);
    }

    if (isAll || isDbOnly) {
        await clearPostgres("media", isDryRun);
    } else if (isDbAll) {
        await clearPostgres("all", isDryRun);
    }

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🎉 Migration process completed.");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

main();