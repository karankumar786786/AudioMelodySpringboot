import express from "express";
import { serve } from "inngest/express";
import { inngest } from "./inngest";
import { fetchJobsFromList } from "./jobseeker/worker";
import { config } from "dotenv";
import { fetchJob } from "./functions/fechJob";
import { transcodeSong } from "./functions/transcode";
import { transcodeAudioTask } from "./functions/transcodeAudio";
import { transcodeVideoTask } from "./functions/transcodeVideo";
import { transcodeCanvasTask } from "./functions/transcodeCanvas";
import { indexRecombee } from "./functions/saveInRecombee";
import { indexAlgolia } from "./functions/saveInAlgolia";
import { finalizeSong } from "./functions/createSongInTable";
import { setupGracefulShutdownCleanup, cleanupStaleTmpFiles } from "./lib/transcode/cleanup";
config();

// Install process-level exit hooks for graceful temp directory cleanup
setupGracefulShutdownCleanup();

const app = express();

app.use(express.json());

const functions = [
    fetchJob,
    transcodeSong,
    transcodeAudioTask,
    transcodeVideoTask,
    transcodeCanvasTask,
    indexRecombee,
    indexAlgolia,
    finalizeSong,
];

app.use("/api/inngest", serve({ client: inngest, functions }));

app.listen(5010, () => {
    console.log("Server running on http://localhost:5010");

    // Clean any orphaned artifacts left behind by previous crashes or interrupted runs
    cleanupStaleTmpFiles().then((cleaned) => {
        if (cleaned > 0) {
            console.log(`[STARTUP] Purged ${cleaned} stale temporary files/directories.`);
        }
    });

    // Periodically clean stale temp files every 30 minutes
    setInterval(() => {
        cleanupStaleTmpFiles().catch(() => {});
    }, 30 * 60 * 1000);

    fetchJobsFromList();
});