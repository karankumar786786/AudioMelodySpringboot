import pg from "pg";
import * as fs from "node:fs";
import * as path from "node:path";

const { Client } = pg;

const connectionString =
    process.env.DB_URL?.replace("jdbc:postgresql://", "postgresql://") ||
    process.env.DATABASE_URL;

if (!connectionString) {
    console.error("❌ DB_URL or DATABASE_URL environment variable is required.");
    process.exit(1);
}

async function runDeleteJobsMigration() {
    console.log("🚀 Connecting to PostgreSQL Neon database for Delete Jobs Migration...");
    const client = new Client({
        connectionString,
        ssl: {
            rejectUnauthorized: false,
        },
    });

    await client.connect();
    console.log("✅ Connected successfully.");

    try {
        console.log("\n📦 Reading v6_create_delete_jobs_table.sql...");
        const sqlPath = path.join(__dirname, "v6_create_delete_jobs_table.sql");
        const sql = fs.readFileSync(sqlPath, "utf-8");

        console.log("➡️ Executing DDL for 'delete_jobs' table...");
        await client.query(sql);
        console.log("   ✅ 'delete_jobs' table created with indexes.");

        // Verification query
        const res = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'delete_jobs'
            ORDER BY ordinal_position;
        `);

        console.log("\n📋 Table Structure Verified:");
        res.rows.forEach((r) => {
            console.log(`   - ${r.column_name} (${r.data_type})`);
        });

        console.log("\n🎉 Migration v6 completed successfully!");
    } catch (error) {
        console.error("❌ Migration failed:", error);
        process.exit(1);
    } finally {
        await client.end();
    }
}

runDeleteJobsMigration();
