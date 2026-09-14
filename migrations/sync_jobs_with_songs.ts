import pg from "pg";
import fs from "fs";
import path from "path";

const { Client } = pg;

const connectionString =
    process.env.DB_URL?.replace("jdbc:postgresql://", "postgresql://") ||
    process.env.DATABASE_URL;

if (!connectionString) {
    console.error("❌ DB_URL or DATABASE_URL environment variable is required.");
    process.exit(1);
}

async function runSyncJobsWithSongs() {
    console.log("🚀 Connecting to PostgreSQL database for Jobs <-> Songs synchronization...");
    const client = new Client({
        connectionString,
        ssl: {
            rejectUnauthorized: false
        }
    });

    await client.connect();
    console.log("✅ Connected successfully.\n");

    try {
        // Pre-sync diagnostics
        const preSongs = await client.query("SELECT count(*) FROM songs;");
        const preJobs = await client.query("SELECT count(*) FROM jobs;");
        const preStages = await client.query("SELECT current_stage, status, count(*) FROM jobs GROUP BY current_stage, status ORDER BY count(*) DESC;");
        
        console.log("📊 Pre-Sync Statistics:");
        console.log(`   - Songs in catalog: ${preSongs.rows[0].count}`);
        console.log(`   - Total jobs:       ${preJobs.rows[0].count}`);
        console.log("   - Breakdown:");
        console.table(preStages.rows);

        // Read and run migration SQL
        const sqlPath = path.join(__dirname, "v5_sync_jobs_with_songs.sql");
        const sql = fs.readFileSync(sqlPath, "utf-8");

        console.log("\n📦 Executing v5_sync_jobs_with_songs.sql...");
        await client.query(sql);
        console.log("✅ Migration script executed successfully.\n");

        // Post-sync diagnostics
        const postSongs = await client.query("SELECT count(*) FROM songs;");
        const postJobs = await client.query("SELECT count(*) FROM jobs;");
        const postStages = await client.query("SELECT current_stage, status, count(*) FROM jobs GROUP BY current_stage, status ORDER BY count(*) DESC;");
        const orphanJobs = await client.query("SELECT j.id, j.title, j.song_id FROM jobs j LEFT JOIN songs s ON j.id = s.job_id WHERE s.id IS NULL;");
        const missingJobs = await client.query("SELECT s.id, s.title, s.job_id FROM songs s LEFT JOIN jobs j ON s.job_id = j.id WHERE j.id IS NULL;");

        console.log("📊 Post-Sync Statistics:");
        console.log(`   - Songs in catalog: ${postSongs.rows[0].count}`);
        console.log(`   - Total jobs:       ${postJobs.rows[0].count}`);
        console.log(`   - Orphan jobs:      ${orphanJobs.rows.length}`);
        console.log(`   - Missing jobs:     ${missingJobs.rows.length}`);
        console.log("   - Breakdown:");
        console.table(postStages.rows);

        if (Number(postSongs.rows[0].count) === Number(postJobs.rows[0].count) && orphanJobs.rows.length === 0 && missingJobs.rows.length === 0) {
            console.log("\n🎉 SUCCESS: 1-to-1 sync between jobs and songs is 100% complete and fresh!");
        } else {
            console.warn("\n⚠️ Notice: Discrepancy detected between songs and jobs counts.");
        }
    } catch (err) {
        console.error("❌ Synchronization failed:", err);
        throw err;
    } finally {
        await client.end();
    }
}

runSyncJobsWithSongs();
