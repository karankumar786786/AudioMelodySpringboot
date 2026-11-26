/**
 * Inngest function "transcode-song" - upload pipeline ka "orchestrator" (sabko kaam baantne wala).
 * Upload pipeline (Inngest): audio/fetchjob -> transcode -> index.recombee -> index.algolia -> final.create.
 *
 * Ye khud encode nahi karta: canvas, video, audio aur audio features ke chhote tasks ko step.invoke se
 * ek saath chalata hai, unke result jod ke admin API ko /transcoded batata hai, phir aage ka step.
 */
import { inngest } from "../inngest";
import { api } from "../axios";
import { transcodeAudioTask } from "./transcodeAudio";
import { transcodeVideoTask } from "./transcodeVideo";
import { transcodeCanvasTask } from "./transcodeCanvas";
import { extractAudioFeaturesTask } from "./extractAudioFeatures";
import { CONCURRENT_TRANSCODING_LIMIT } from "../lib/transcode/limiter";
import { extractMeaningfulError } from "../lib/errorUtils";
import { config } from "dotenv";
config();

/**
 * Kaun se tasks chahiye wo tay karo, sab ek saath chalao, aur result admin API ko bhejo.
 * Naya song: aage Recombee indexing. Reprocess (sirf audio / video badla): seedha /finalize.
 * Koi task 3 retries ke baad bhi fail = onFailure admin ko /failed batata hai.
 */
export const transcodeSong = inngest.createFunction(
    {
        id: "transcode-song",
        concurrency: {
            limit: CONCURRENT_TRANSCODING_LIMIT,
        },
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
            isAudioReprocess,
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

        // 1. Admin API ko batao ki transcoding shuru (job PROCESSING / TRANSCODING ho jaata hai)
        await step.run("notify-transcoding-started", async () => {
            console.log(`[ORCHESTRATOR] Notifying coreEngine transcoding-started for job ${jobId}...`);
            await api.post(`/${jobId}/transcoding-started`, {
                processingId: songId,
            });
            console.log(`[ORCHESTRATOR] Successfully notified coreEngine transcoding-started for job ${jobId}`);
        });

        // 2. Kaun se chhote tasks chalane hain, media ke hisaab se.
        // Canvas tabhi jab video ho aur clip ka time sahi ho (dono 0 ya end <= start = canvas nahi).
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

        // Audio reprocess me video dobara nahi banana
        const shouldProcessVideo = Boolean(tempVideoKey) && !isAudioReprocess;
        // Audio hamesha: alag audio file na ho to video se nikaal lenge
        const shouldProcessAudio = Boolean(isAudioReprocess) || Boolean(tempSongKey) || Boolean(tempVideoKey);

        console.log(`[ORCHESTRATOR] Job ${jobId} dispatching modular tasks:`);
        console.log(`  - Canvas task: ${shouldProcessCanvas}`);
        console.log(`  - Video task:  ${shouldProcessVideo}`);
        console.log(`  - Audio task:  ${shouldProcessAudio}`);

        // 3. Saare tasks ek saath (step.invoke = doosra Inngest function chalao aur uska result lo)
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

        // Audio features (tempo, danceability, energy, wagairah) ka task
        const featuresPromise = shouldProcessAudio
            ? step.invoke("extract-audio-features-subtask", {
                  function: extractAudioFeaturesTask,
                  data: {
                      jobId,
                      songId,
                      tempSongKey,
                      tempVideoKey,
                  },
              })
            : Promise.resolve(null);

        const [canvasResult, videoResult, audioResult, featuresResult] = await Promise.all([
            canvasPromise,
            videoPromise,
            audioPromise,
            featuresPromise,
        ]);

        // Results jodo (jo task nahi chala uska null)
        const duration = audioResult?.duration ?? videoResult?.duration ?? 0;
        const videoKey = canvasResult?.canvasVideoKey ?? initialVideoKey ?? null;
        const fullVideoKey = videoResult ? `${videoBasePath}/${songId}` : null;
        const audioFeatures = featuresResult?.audioFeatures || null;

        console.log(`[ORCHESTRATOR] All modular tasks completed for job ${jobId}. Duration: ${duration}s, Canvas: ${videoKey}, FullVideo: ${fullVideoKey}, Features: ${Boolean(audioFeatures)}`);

        // 4. Admin API ko /transcoded: nayi keys, duration aur audio features
        await step.run("notify-transcoded", async () => {
            console.log(`[ORCHESTRATOR] Notifying coreEngine transcoded for job ${jobId}...`);
            await api.post(`/${jobId}/transcoded`, {
                songKey: songKey,
                duration: duration,
                fullVideoKey: fullVideoKey || null,
                videoKey: videoKey || null,
                audioFeatures: audioFeatures,
            });
            console.log(`[ORCHESTRATOR] Successfully notified coreEngine transcoded for job ${jobId}`);
        });

        // 5. Aage ka kaam: naya song = indexing chain; reprocess = seedha finalize
        const isReprocess = Boolean(isVideoReprocess || isAudioReprocess);
        if (!isReprocess) {
            await step.sendEvent("trigger-recombee-indexing", {
                name: "audio/song.index.recombee",
                data: { jobId },
            });
        } else {
            await step.run("finalize-reprocess", async () => {
                console.log(`[ORCHESTRATOR] Finalizing reprocess job ${jobId} directly via coreEngine...`);
                await api.post(`/${jobId}/finalize`);
                console.log(`[ORCHESTRATOR] Successfully finalized reprocess job ${jobId}`);
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