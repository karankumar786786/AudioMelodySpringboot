import pg from "pg";
import * as fs from "node:fs";
import * as path from "node:path";
import dotenv from "dotenv";

// Ensure environment variables are loaded
dotenv.config();

const { Client } = pg;

const connectionString =
    process.env.DB_URL?.replace("jdbc:postgresql://", "postgresql://") ||
    process.env.DATABASE_URL;

if (!connectionString) {
    console.error("❌ DB_URL or DATABASE_URL environment variable is required.");
    process.exit(1);
}

async function runGenreMigration() {
    console.log("🚀 Connecting to PostgreSQL Neon database for Genre Migration...");
    const client = new Client({
        connectionString,
        ssl: {
            rejectUnauthorized: false,
        },
    });

    await client.connect();
    console.log("✅ Connected successfully.");

    try {
        console.log("\n📦 Reading v7_add_genre_column.sql...");
        const sqlPath = path.join(__dirname, "v7_add_genre_column.sql");
        const sql = fs.readFileSync(sqlPath, "utf-8");

        console.log("➡️ Executing DDL for 'genre' column addition...");
        await client.query(sql);
        console.log("   ✅ 'genre' column added to 'songs' and 'jobs' tables.");

        // Verification query
        console.log("\n🔍 Verifying column existence...");
        for (const table of ["songs", "jobs"]) {
            const res = await client.query(
                `SELECT column_name, data_type, character_maximum_length 
                 FROM information_schema.columns 
                 WHERE table_name = $1 AND column_name = 'genre';`,
                [table]
            );
            if (res.rows.length > 0) {
                console.log(`   ✅ Table '${table}': column 'genre' (${res.rows[0].data_type}(${res.rows[0].character_maximum_length})) exists.`);
            } else {
                console.warn(`   ⚠️ Table '${table}': column 'genre' NOT FOUND!`);
            }
        }

        console.log("\n🎉 Migration v7 completed successfully!");
    } catch (error) {
        console.error("❌ Migration failed:", error);
        process.exit(1);
    } finally {
        await client.end();
    }
}

runGenreMigration();
