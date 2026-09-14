import { inngest } from "../inngest";
import { api } from "../axios";
import { transcodeAudioTask } from "./transcodeAudio";
import { transcodeVideoTask } from "./transcodeVideo";
import { transcodeCanvasTask } from "./transcodeCanvas";
import { extractMeaningfulError } from "../lib/errorUtils";
import { config } from "dotenv";
config();

export const transcodeSong = inngest.createFunction(
    {
        id: "transcode-song",
        cancelOn: [
            {
                event: "audio/job.cancel",
                match: "data.jobId",
            },
        ],
        triggers: [{ event: "audio/song.transcode" }],
        retries: 3,
        onFailure: async ({ event, error }) => {
            const jobId = event?.data?.event?.data?.jobId;
            if (jobId) {
                const reason = extractMeaningfulError(error, "Transcoding processing failed");
                console.error(`[TRANSCODE-SONG FAILED] Notifying coreEngine of failure for job ${jobId}:`, reason);
                try {
                    await api.post(`/${jobId}/failed`, {
                        reason: `Transcoding failed: ${reason}`,
                    });
                } catch (e) {
                    console.error(`Failed to notify Spring Boot of job ${jobId} failure:`, e);
                }
            }
        },
    },
    async ({ step, event }) => {
        const {
            jobId,
            songId,
            tempSongKey,
            tempVideoKey,
            clipStartSec,
            clipEndSec,
            videoKey: initialVideoKey,
            isVideoReprocess,
        } = event.data;

        if (!jobId || !songId) {
            throw new Error("Missing jobId or songId in event data");
        }
        if (!tempSongKey && !tempVideoKey) {
            throw new Error("Neither tempSongKey nor tempVideoKey provided in event data");
        }

        const basePath = process.env.BASE_PATH || "audios";
        const videoBasePath = process.env.VIDEO_BASE_PATH || "videos";
        const songKey = `${basePath}/${songId}`;

        // 1. Notify Spring Boot that transcoding has started
        await step.run("notify-transcoding-started", async () => {
            console.log(`[ORCHESTRATOR] Notifying coreEngine transcoding-started for job ${jobId}...`);
            await api.post(`/${jobId}/transcoding-started`, {
                processingId: songId,
            });
            console.log(`[ORCHESTRATOR] Successfully notified coreEngine transcoding-started for job ${jobId}`);
        });

        // 2. Prepare distributed sub-tasks according to media requirements
        // Do NOT generate canvas if start & end duration are 0, or end <= start
        const isExplicitZeroDuration =
            (clipStartSec === 0 && clipEndSec === 0) ||
            (typeof clipEndSec === "number" && clipEndSec === 0) ||
            (typeof clipStartSec === "number" && typeof clipEndSec === "number" && clipEndSec <= clipStartSec);

        const hasValidClipRange =
            typeof clipStartSec === "number" &&
            typeof clipEndSec === "number" &&
            clipEndSec > clipStartSec;

        const shouldProcessCanvas = Boolean(
            tempVideoKey &&
            !isExplicitZeroDuration &&
            hasValidClipRange
        );

        const shouldProcessVideo = Boolean(tempVideoKey);
        const shouldProcessAudio = !isVideoReprocess && Boolean(tempSongKey || tempVideoKey);

        console.log(`[ORCHESTRATOR] Job ${jobId} dispatching modular tasks:`);
        console.log(`  - Canvas task: ${shouldProcessCanvas}`);
        console.log(`  - Video task:  ${shouldProcessVideo}`);
        console.log(`  - Audio task:  ${shouldProcessAudio}`);

        // 3. Dispatch and execute tasks concurrently via step.invoke
        const canvasPromise = shouldProcessCanvas
            ? step.invoke("transcode-canvas-subtask", {
                  function: transcodeCanvasTask,
                  data: {
                      jobId,
                      songId,
                      tempVideoKey: tempVideoKey!,
                      clipStartSec,
                      clipEndSec,
                  },
              })
            : Promise.resolve(null);

        const videoPromise = shouldProcessVideo
            ? step.invoke("transcode-video-subtask", {
                  function: transcodeVideoTask,
                  data: {
                      jobId,
                      songId,
                      tempVideoKey: tempVideoKey!,
                  },
              })
            : Promise.resolve(null);

        const audioPromise = shouldProcessAudio
            ? step.invoke("transcode-audio-subtask", {
                  function: transcodeAudioTask,
                  data: {
                      jobId,
                      songId,
                      tempSongKey,
                      tempVideoKey,
                  },
              })
            : Promise.resolve(null);

        const [canvasResult, videoResult, audioResult] = await Promise.all([
            canvasPromise,
            videoPromise,
            audioPromise,
        ]);

        const duration = audioResult?.duration ?? videoResult?.duration ?? 0;
        const videoKey = canvasResult?.canvasVideoKey ?? initialVideoKey ?? null;
        const fullVideoKey = videoResult ? `${videoBasePath}/${songId}` : null;

        console.log(`[ORCHESTRATOR] All modular tasks completed for job ${jobId}. Duration: ${duration}s, Canvas: ${videoKey}, FullVideo: ${fullVideoKey}`);

        // 4. Notify Spring Boot transcoded
        await step.run("notify-transcoded", async () => {
            console.log(`[ORCHESTRATOR] Notifying coreEngine transcoded for job ${jobId}...`);
            await api.post(`/${jobId}/transcoded`, {
                songKey: songKey,
                duration: duration,
                fullVideoKey: fullVideoKey || null,
                videoKey: videoKey || null,
            });
            console.log(`[ORCHESTRATOR] Successfully notified coreEngine transcoded for job ${jobId}`);
        });

        // 5. Trigger downstream indexing/finalization
        if (!isVideoReprocess) {
            await step.sendEvent("trigger-recombee-indexing", {
                name: "audio/song.index.recombee",
                data: { jobId },
            });
        } else {
            await step.sendEvent("trigger-finalize", {
                name: "audio/song.final.create",
                data: { jobId },
            });
        }

        return {
            status: "success",
            jobId,
            songId,
            songKey,
            fullVideoKey,
            videoKey,
            duration,
        };
    }
);