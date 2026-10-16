import { inngest } from "../inngest";
import { api } from "../axios";
import { extractMeaningfulError } from "../lib/errorUtils";

export const indexAlgolia = inngest.createFunction(
    {
        id: "index-algolia",
        cancelOn: [
            {
                event: "audio/job.cancel",
                match: "data.jobId",
            },
        ],
        triggers: [{ event: "audio/song.index.algolia" }],
        onFailure: async ({ event, error }) => {
            const jobId = event?.data?.event?.data?.jobId;
            if (jobId) {
                const reason = extractMeaningfulError(error, "Algolia search indexing failed");
                console.error(`[ALGOLIA FAILED] Notifying coreEngine of failure for job ${jobId}:`, reason);
                try {
                    await api.post(`/${jobId}/failed`, {
                        reason: `Algolia indexing: ${reason}`,
                    });
                } catch (e) {
                    console.error(`Failed to notify Spring Boot of job ${jobId} failure:`, e);
                }
            }
        },
    },
    async ({ event, step }) => {
        const { jobId } = event.data;
        if (!jobId) {
            throw new Error("Missing jobId in event data");
        }
        await step.run("sync-with-algolia", async () => {
            console.log(`[ALGOLIA] Notifying webhook for job ${jobId}...`);
            await api.post(`/${jobId}/save-search`);

            // Also guarantee direct Algolia document indexing if Algolia credentials configured
            const appId = process.env.ALGOLIA_APP_ID;
            const apiKey = process.env.ALGOLIA_API_KEY;
            const indexName = process.env.ALGOLIA_INDEX_NAME || "one_melody_springboot";

            if (appId && apiKey) {
                try {
                    const jobRes = await api.get(`/${jobId}`);
                    const job = jobRes?.data;
                    const songId = job?.songId || job?.song_id || job?.id;

                    if (songId) {
                        const record = {
                            objectID: String(songId),
                            type: "song",
                            title: String(job.title || ""),
                            artistName: String(job.artistName || job.artist_name || ""),
                            artist: String(job.artistName || job.artist_name || ""),
                            album: job.album || null,
                            genre: job.genre || null,
                            duration: Number(job.duration || 0),
                            songKey: String(job.songKey || job.song_key || ""),
                            imageKey: String(job.imageKey || job.image_key || ""),
                            videoKey: job.videoKey || job.video_key || null,
                            fullVideoKey: job.fullVideoKey || job.full_video_key || null,
                            previewStartTime: typeof job.previewStartTime === "number" ? job.previewStartTime : (typeof job.preview_start_time === "number" ? job.preview_start_time : null),
                            previewEndTime: typeof job.previewEndTime === "number" ? job.previewEndTime : (typeof job.preview_end_time === "number" ? job.preview_end_time : null),
                            language: String(job.language || ""),
                            lrclibId: String(job.lrclibId || job.lrclib_id || ""),
                            jobId: String(job.id || jobId),
                            totalStreams: 0,
                            listenCount: 0,
                            searchCount: 0,
                        };

                        const directUrl = `https://${appId}.algolia.net/1/indexes/${encodeURIComponent(indexName)}/${encodeURIComponent(songId)}`;
                        const directRes = await fetch(directUrl, {
                            method: "PUT",
                            headers: {
                                "Content-Type": "application/json",
                                "X-Algolia-Application-Id": appId,
                                "X-Algolia-API-Key": apiKey,
                            },
                            body: JSON.stringify(record),
                        });

                        if (directRes.ok) {
                            console.log(`[ALGOLIA] Direct Algolia document sync succeeded for song ${songId}`);
                        } else {
                            console.warn(`[ALGOLIA] Direct Algolia sync returned status: ${directRes.status}`);
                        }
                    }
                } catch (directErr) {
                    console.warn(`[ALGOLIA] Direct Algolia sync error (webhook already handled it):`, directErr);
                }
            }

            console.log(`[ALGOLIA] Successfully indexed job ${jobId} in Algolia`);
        });
        await step.sendEvent("trigger-finalization", {
            name: "audio/song.final.create",
            data: { jobId }
        });
        return { status: "success", jobId };
    }
);
