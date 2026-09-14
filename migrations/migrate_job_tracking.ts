import pg from "pg";

const { Client } = pg;

const connectionString =
    process.env.DB_URL?.replace("jdbc:postgresql://", "postgresql://") ||
    process.env.DATABASE_URL;

if (!connectionString) {
    console.error("❌ DB_URL or DATABASE_URL environment variable is required.");
    process.exit(1);
}

async function runJobTrackingMigration() {
    console.log("🚀 Connecting to PostgreSQL database for Job Tracking Migration...");
    const client = new Client({
        connectionString,
        ssl: {
            rejectUnauthorized: false
        }
    });

    await client.connect();
    console.log("✅ Connected successfully.");

    try {
        console.log("\n📦 Running schema migrations for song processing tracking...");

        // 1. Current stage
        console.log("➡️ Adding current_stage to 'jobs' table...");
        await client.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS current_stage VARCHAR(64) DEFAULT 'QUEUED';`);

        // 2. Stage transition timestamps
        console.log("➡️ Adding stage transition timestamps to 'jobs' table...");
        await client.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;`);
        await client.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS transcoding_started_at TIMESTAMP;`);
        await client.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS transcoded_at TIMESTAMP;`);
        await client.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS recommendation_saved_at TIMESTAMP;`);
        await client.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS search_saved_at TIMESTAMP;`);
        await client.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;`);
        await client.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS failed_at TIMESTAMP;`);

        // 3. Failure reason
        console.log("➡️ Adding failure_reason to 'jobs' table...");
        await client.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS failure_reason TEXT;`);

        // 4. Stage durations
        console.log("➡️ Adding stage duration ms columns to 'jobs' table...");
        await client.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS transcoding_duration_ms BIGINT;`);
        await client.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS recommendation_duration_ms BIGINT;`);
        await client.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS search_duration_ms BIGINT;`);
        await client.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS finalize_duration_ms BIGINT;`);
        await client.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS total_duration_ms BIGINT;`);

        // 5. Backfill existing records
        console.log("➡️ Backfilling existing job stages and created_at...");
        await client.query(`
            UPDATE jobs 
            SET current_stage = CASE 
                WHEN status = 'COMPLETED' THEN 'COMPLETED'
                WHEN status = 'FAILED' THEN 'FAILED'
                WHEN status = 'PROCESSING' THEN 'TRANSCODING'
                ELSE 'QUEUED'
            END,
            created_at = COALESCE(created_at, NOW())
            WHERE current_stage IS NULL OR created_at IS NULL;
        `);

        // 6. Indexes
        console.log("➡️ Creating indexes...");
        await client.query(`CREATE INDEX IF NOT EXISTS idx_jobs_current_stage ON jobs (current_stage);`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs (created_at);`);

        // Verification query
        console.log("\n🔍 Verifying 'jobs' table columns...");
        const res = await client.query(`
            SELECT column_name, data_type, is_nullable, column_default 
            FROM information_schema.columns 
            WHERE table_name = 'jobs' 
            ORDER BY ordinal_position;
        `);
        console.table(res.rows);

        console.log("\n🎉 Job tracking migration finished successfully!");
    } catch (err) {
        console.error("❌ Migration failed:", err);
        throw err;
    } finally {
        await client.end();
    }
}

runJobTrackingMigration();
