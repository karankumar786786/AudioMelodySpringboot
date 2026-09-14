import { algoliasearch } from "algoliasearch";
import recombee from "recombee-api-client";

const rqs = recombee.requests;

// ── Config from environment (.env) ──
const ALGOLIA_APP_ID = process.env.ALGOLIA_APP_ID;
const ALGOLIA_API_KEY = process.env.ALGOLIA_API_KEY;
const ALGOLIA_INDEX_NAME = process.env.ALGOLIA_INDEX_NAME || "one_melody_springboot";

const RECOMBEE_DATABASE_ID = process.env.RECOMBEE_DATABASE_ID;
const RECOMBEE_DATABASE_SECRET = process.env.RECOMBEE_DATABASE_SECRET;

if (!ALGOLIA_APP_ID || !ALGOLIA_API_KEY || !RECOMBEE_DATABASE_ID || !RECOMBEE_DATABASE_SECRET) {
    console.error("❌ ALGOLIA_APP_ID, ALGOLIA_API_KEY, RECOMBEE_DATABASE_ID, and RECOMBEE_DATABASE_SECRET are required in .env");
    process.exit(1);
}

async function clearAlgolia() {
    console.log("🔍 Clearing Algolia index...");
    const client = algoliasearch(ALGOLIA_APP_ID!, ALGOLIA_API_KEY!);
    await client.clearObjects({ indexName: ALGOLIA_INDEX_NAME });
    console.log(`✅ Algolia index "${ALGOLIA_INDEX_NAME}" cleared successfully.`);
}

async function clearRecombee() {
    console.log("🤖 Resetting Recombee database...");
    const client = new recombee.ApiClient(RECOMBEE_DATABASE_ID!, RECOMBEE_DATABASE_SECRET!, {
        region: "eu-west",
    });

    await client.send(new rqs.ResetDatabase());
    console.log(`✅ Recombee database "${RECOMBEE_DATABASE_ID}" reset successfully.`);
}

async function main() {
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("  Clear Algolia & Recombee Migration Script  ");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log();

    try {
        await clearAlgolia();
    } catch (err) {
        console.error("❌ Algolia clear failed:", err);
    }

    console.log();

    try {
        await clearRecombee();
    } catch (err) {
        console.error("❌ Recombee clear failed:", err);
    }

    console.log();
    console.log("🎉 Migration complete.");
}

main();