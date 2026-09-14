import pg from "pg";

const { Client } = pg;

const connectionString =
  process.env.DB_URL?.replace("jdbc:postgresql://", "postgresql://") ||
  process.env.DATABASE_URL;

if (!connectionString) {
  console.error("❌ DB_URL or DATABASE_URL environment variable is required.");
  process.exit(1);
}

async function runSearchHistoryMigration() {
  console.log("🚀 Connecting to PostgreSQL Neon database...");
  const client = new Client({
    connectionString,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  await client.connect();
  console.log("✅ Connected successfully.");

  try {
    console.log("\n📦 Updating 'user_search_history' table to support user_playlist_id...");

    await client.query(`
      ALTER TABLE user_search_history 
      ADD COLUMN IF NOT EXISTS user_playlist_id VARCHAR(255) REFERENCES user_playlists(id) ON DELETE CASCADE;
    `);
    console.log("   ✅ Added 'user_playlist_id' column with foreign key to user_playlists.");

    // Verification
    console.log("\n🔍 Verifying 'user_search_history' table columns...");
    const res = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'user_search_history' 
      ORDER BY ordinal_position;
    `);
    console.table(res.rows);

    console.log("\n🎉 user_search_history table updated successfully!");
  } catch (err) {
    console.error("❌ Migration failed:", err);
    throw err;
  } finally {
    await client.end();
  }
}

runSearchHistoryMigration();
