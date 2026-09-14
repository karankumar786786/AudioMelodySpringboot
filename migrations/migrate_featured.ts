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
        ssl: { rejectUnauthorized: false }
    });

    await client.connect();
    console.log("✅ Connected successfully.");

    try {
        console.log("\n📦 Running featured songs migration...");

        console.log("➡️ Adding is_featured to 'songs' table...");
        await client.query(`ALTER TABLE songs ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT FALSE;`);
        console.log("   ✅ 'songs' table updated.");

        const res = await client.query(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_name = 'songs' AND column_name = 'is_featured';
        `);
        console.log("\n📋 Verified new column:");
        console.table(res.rows);

        console.log("\n🎉 Migration finished successfully!");
    } catch (err) {
        console.error("❌ Migration failed:", err);
        throw err;
    } finally {
        await client.end();
    }
}

runMigration();
