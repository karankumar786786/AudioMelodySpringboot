/**
 * audioProcessing (media pipeline) ka entry point: Express server, port 5010.
 *
 * - /api/inngest: Inngest yahan se hamare saare functions (upload pipeline, delete chain, shorts) chalata hai.
 * - /api/jobs/:jobId/cancel aur /cleanup: admin API job rokne / saaf karne ke liye (X-API-KEY zaroori).
 * - /health: CPU / memory telemetry + admin API ka pichhla jawab.
 *
 * Start pe: OpenTelemetry, console logger, shutdown cleanup, purani temp files ki safai aur heartbeat.
 */
// OpenTelemetry sabse pehle import - taaki baaki libraries ke traces bhi pakde jaayein
import "./lib/otel";
import { setupConsoleLogger } from "./lib/logger";
setupConsoleLogger();
import express from "express";
import { serve } from "inngest/express";
import { inngest } from "./inngest";
import { requireApiKey } from "./lib/apiKeyAuth";
import { config } from "dotenv";
import { fetchJob } from "./functions/fetchJob";
import { transcodeSong } from "./functions/transcode";
import { transcodeAudioTask } from "./functions/transcodeAudio";
import { transcodeVideoTask } from "./functions/transcodeVideo";
import { transcodeCanvasTask } from "./functions/transcodeCanvas";
import { extractAudioFeaturesTask } from "./functions/extractAudioFeatures";
import { indexRecombee } from "./functions/saveInRecombee";
import { indexAlgolia } from "./functions/saveInAlgolia";
import { finalizeSong } from "./functions/createSongInTable";
import { deleteFromAlgolia } from "./functions/deleteFromAlgolia";
import { deleteFromRecombee } from "./functions/deleteFromRecombee";
import { deleteFromImageKit } from "./functions/deleteFromImageKit";
import { deleteFromS3 } from "./functions/deleteFromS3";
import { finalizeDelete } from "./functions/finalizeDelete";
import { processShort } from "./functions/processShort";
import { deleteShort } from "./functions/deleteShort";
import {
  setupGracefulShutdownCleanup,
  cleanupStaleTmpFiles,
  purgeLocalJobArtifacts,
} from "./lib/transcode/cleanup";
import { purgeJobCloudArtifacts } from "./lib/s3";
import {
  getSystemTelemetry,
  startHeartbeatWorker,
  getLastAdminAck,
} from "./lib/telemetry";

config({ quiet: true });

// Process band ho to chal rahe jobs ki temp files hatane wale hooks
setupGracefulShutdownCleanup();

const app = express();

// Body 1MB tak (Inngest step results bhi isi raaste aate hain)
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ limit: "1mb", extended: true }));

// Health check: is service ki telemetry + admin API ka pichhla jawab (dono taraf ki sehat)
app.get("/health", (_req, res) => {
  const telemetry = getSystemTelemetry();
  const adminBackendAck = getLastAdminAck();
  res.json({
    ...telemetry,
    adminBackendAck,
  });
});

// Simple "main zinda hoon" response
app.get("/", (_req, res) => {
  res.json({
    status: "UP",
    service: "audioProcessing",
    timestamp: new Date().toISOString(),
  });
});

// Inngest ko dikhane wale saare functions
const functions = [
  fetchJob,
  transcodeSong,
  transcodeAudioTask,
  transcodeVideoTask,
  transcodeCanvasTask,
  extractAudioFeaturesTask,
  indexRecombee,
  indexAlgolia,
  finalizeSong,
  deleteFromAlgolia,
  deleteFromRecombee,
  deleteFromImageKit,
  deleteFromS3,
  finalizeDelete,
  processShort,
  deleteShort,
];

// /api/jobs/* sab pe X-API-KEY check
app.use("/api/jobs", requireApiKey);

// Job cancel: Inngest ko "audio/job.cancel" bhejo (har job function cancelOn me sunta hai) aur purani temp files saaf
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

// Poori safai: Inngest run cancel + local disk + S3 (production aur temp) ki saari files
app.post("/api/jobs/:jobId/cleanup", async (req, res) => {
  const { jobId } = req.params;
  const { songId, tempSongKey, tempVideoKey, songKey, fullVideoKey } = req.body || {};
  console.log(`[CLEANUP API] Purging all artifacts for job: ${jobId} (songId: ${songId})`);
  try {
    // 1. Pehle Inngest run roko
    await inngest.send({
      name: "audio/job.cancel",
      data: { jobId },
    });

    // 2. Local disk ki files (downloads, aadhe bane chunks)
    const localRemoved = await purgeLocalJobArtifacts(jobId, songId);

    // 3. S3 production (audios/, videos/) aur temp bucket ki files
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

// Inngest ka endpoint: yahin se Inngest hamare functions ko call karta hai
app.use(
  "/api/inngest",
  serve({
    client: inngest,
    functions,
  }),
);

app.listen(5010, () => {
  console.log("Server running on http://localhost:5010");

  // Pichhle crash / ruke runs ki bachi hui files saaf karo
  cleanupStaleTmpFiles().then((cleaned) => {
    if (cleaned > 0) {
      console.log(
        `[STARTUP] Purged ${cleaned} stale temporary files/directories.`,
      );
    }
  });

  // Har 30 minute purani temp files ki safai
  setInterval(
    () => {
      cleanupStaleTmpFiles().catch(() => {});
    },
    30 * 60 * 1000,
  );

  // Admin API ko heartbeat, har 60 second: dashboard ko bas "pichhle kuch minute me zinda tha" chahiye,
  // aur har heartbeat admin side pe ek Redis write hai (Upstash har command ka paisa leta hai).
  // Cancel ke liye Redis worker nahi chahiye: admin API aur POST /cancel Inngest ko audio/job.cancel
  // bhejte hain, aur har job function use cancelOn me sunta hai.
  startHeartbeatWorker(60000);
});

