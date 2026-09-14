import pg from "pg";

const { Client } = pg;

const connectionString =
    process.env.DB_URL?.replace("jdbc:postgresql://", "postgresql://") ||
    process.env.DATABASE_URL;

if (!connectionString) {
    console.error("❌ DB_URL or DATABASE_URL environment variable is required.");
    process.exit(1);
}

async function runMigration() {
    console.log("🚀 Connecting to PostgreSQL Neon database...");
    const client = new Client({
        connectionString,
        ssl: {
            rejectUnauthorized: false
        }
    });

    await client.connect();
    console.log("✅ Connected successfully.");

    try {
        console.log("\n📦 Running schema migrations...");

        // 1. Songs table
        console.log("➡️ Adding video_key to 'songs' table...");
        await client.query(`ALTER TABLE songs ADD COLUMN IF NOT EXISTS video_key VARCHAR(255);`);
        console.log("   ✅ 'songs' table updated.");

        // 2. Jobs table
        console.log("➡️ Adding video_key to 'jobs' table...");
        await client.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS video_key VARCHAR(255);`);
        console.log("   ✅ 'jobs' table updated.");

        // 3. Playlists table
        console.log("➡️ Adding video_key and dropping banner_image_key from 'playlists' table...");
        await client.query(`ALTER TABLE playlists ADD COLUMN IF NOT EXISTS video_key VARCHAR(255);`);
        await client.query(`ALTER TABLE playlists DROP COLUMN IF EXISTS banner_image_key;`);
        console.log("   ✅ 'playlists' table updated.");

        // 4. Artists table
        console.log("➡️ Dropping banner_image_key from 'artists' table...");
        await client.query(`ALTER TABLE artists DROP COLUMN IF EXISTS banner_image_key;`);
        console.log("   ✅ 'artists' table updated.");

        // Verification query
        console.log("\n🔍 Verifying table columns...");
        const tables = ["songs", "jobs", "playlists", "artists"];
        for (const table of tables) {
            const res = await client.query(`
                SELECT column_name, data_type, is_nullable 
                FROM information_schema.columns 
                WHERE table_name = $1 
                ORDER BY ordinal_position;
            `, [table]);
            console.log(`\n📋 Columns for '${table}':`);
            console.table(res.rows);
        }

        console.log("\n🎉 Database migration finished successfully!");
    } catch (err) {
        console.error("❌ Migration failed:", err);
        throw err;
    } finally {
        await client.end();
    }
}

runMigration();
