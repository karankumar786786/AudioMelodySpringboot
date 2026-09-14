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
import { deleteFromAlgolia } from "./functions/deleteFromAlgolia";
import { deleteFromRecombee } from "./functions/deleteFromRecombee";
import { deleteFromImageKit } from "./functions/deleteFromImageKit";
import { deleteFromS3 } from "./functions/deleteFromS3";
import { finalizeDelete } from "./functions/finalizeDelete";
import { fetchDeleteEventsFromList } from "./jobseeker/deleteWorker";
import { fetchCancelEventsFromList } from "./jobseeker/cancelWorker";
import {
  setupGracefulShutdownCleanup,
  cleanupStaleTmpFiles,
  purgeLocalJobArtifacts,
} from "./lib/transcode/cleanup";
import { purgeJobCloudArtifacts } from "./lib/s3";
config();

// Install process-level exit hooks for graceful temp directory cleanup
setupGracefulShutdownCleanup();

const app = express();

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Lightweight health check endpoints for container orchestrators and load balancers
app.get("/health", (_req, res) => {
  res.json({ status: "UP", timestamp: new Date().toISOString() });
});

app.get("/", (_req, res) => {
  res.json({
    status: "UP",
    service: "audioProcessing",
    timestamp: new Date().toISOString(),
  });
});

const functions = [
  fetchJob,
  transcodeSong,
  transcodeAudioTask,
  transcodeVideoTask,
  transcodeCanvasTask,
  indexRecombee,
  indexAlgolia,
  finalizeSong,
  deleteFromAlgolia,
  deleteFromRecombee,
  deleteFromImageKit,
  deleteFromS3,
  finalizeDelete,
];

// Explicit cancellation endpoint for halting Inngest runs & cleaning scratch space
app.post("/api/jobs/:jobId/cancel", async (req, res) => {
  const { jobId } = req.params;
  console.log(`[CANCEL API] Received cancellation request for job: ${jobId}`);
  try {
    await inngest.send({
      name: "audio/job.cancel",
      data: { jobId },
    });
    console.log(`[CANCEL API] Emitted audio/job.cancel to Inngest for job ${jobId}`);
    cleanupStaleTmpFiles().catch(() => {});
    res.json({ success: true, message: `Inngest execution cancelled for job ${jobId}` });
  } catch (err: any) {
    console.error(`[CANCEL API] Failed to emit cancellation to Inngest for job ${jobId}:`, err);
    res.status(500).json({ error: err.message || err });
  }
});

// Comprehensive cleanup endpoint: cancels Inngest run and purges all local disk & cloud S3 artifacts
app.post("/api/jobs/:jobId/cleanup", async (req, res) => {
  const { jobId } = req.params;
  const { songId, tempSongKey, tempVideoKey, songKey, fullVideoKey } = req.body || {};
  console.log(`[CLEANUP API] Purging all artifacts for job: ${jobId} (songId: ${songId})`);
  try {
    // 1. Cancel in Inngest immediately
    await inngest.send({
      name: "audio/job.cancel",
      data: { jobId },
    });

    // 2. Purge local disk artifacts (raw downloads, half-transcoded chunks)
    const localRemoved = await purgeLocalJobArtifacts(jobId, songId);

    // 3. Purge S3 production (audios/, videos/) and temp bucket artifacts
    await purgeJobCloudArtifacts({
      jobId,
      songId,
      tempSongKey,
      tempVideoKey,
      songKey,
      fullVideoKey,
    });

    console.log(`[CLEANUP API] Successfully purged artifacts for job: ${jobId}`);
    res.json({
      success: true,
      message: `Job ${jobId} and all associated artifacts purged successfully.`,
      localFilesRemoved: localRemoved,
    });
  } catch (err: any) {
    console.error(`[CLEANUP API] Error cleaning up artifacts for job ${jobId}:`, err);
    res.status(500).json({ error: err.message || err });
  }
});

app.use(
  "/api/inngest",
  serve({
    client: inngest,
    functions,
  }),
);

app.listen(5010, () => {
  console.log("Server running on http://localhost:5010");

  // Clean any orphaned artifacts left behind by previous crashes or interrupted runs
  cleanupStaleTmpFiles().then((cleaned) => {
    if (cleaned > 0) {
      console.log(
        `[STARTUP] Purged ${cleaned} stale temporary files/directories.`,
      );
    }
  });

  // Periodically clean stale temp files every 30 minutes
  setInterval(
    () => {
      cleanupStaleTmpFiles().catch(() => {});
    },
    30 * 60 * 1000,
  );

  fetchJobsFromList();
  fetchDeleteEventsFromList();
  fetchCancelEventsFromList();
});
