/**
 * Inngest function "index-algolia": song Algolia (search) me daalo.
 * Upload pipeline (Inngest): audio/fetchjob -> transcode -> index.recombee -> index.algolia -> final.create.
 *
 * Asli kaam admin API ka webhook karta hai; uske baad agla event "audio/song.final.create" bhejte hain.
 */
import { inngest } from "../inngest";
import { api } from "../axios";
import { extractMeaningfulError } from "../lib/errorUtils";
import { fetchSearchableLyrics } from "../lib/lyrics";

/**
 * Admin API /save-search call karo. Algolia keys yahan bhi set hon to record (lyrics ke saath) seedha
 * Algolia REST API pe bhi likhte hain - backup ke taur pe; ye fail ho to sirf warning.
 * Phir finalize step shuru. Fail = onFailure /failed.
 */
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

            // Algolia keys set hon to record seedha Algolia pe bhi likho (admin webhook ke alawa, backup)
            const appId = process.env.ALGOLIA_APP_ID;
            const apiKey = process.env.ALGOLIA_API_KEY;
            const indexName = process.env.ALGOLIA_INDEX_NAME || "one_melody_springboot";

            if (appId && apiKey) {
                try {
                    const jobRes = await api.get(`/${jobId}`);
                    const job = jobRes?.data;
                    const songId = job?.songId || job?.song_id || job?.id;

                    if (songId) {
                        // Saaf, size-limit wale lyrics - taaki gaane ki ek line se bhi song dhoond sakein
                        const lyrics = await fetchSearchableLyrics(job.lrclibId ?? job.lrclib_id);
                        // Job ke fields camelCase ya snake_case dono me ho sakte hain, isliye dono check
                        const record = {
                            objectID: String(songId),
                            type: "song",
                            title: String(job.title || ""),
                            artistName: String(job.artistName || job.artist_name || ""),
                            artist: String(job.artistName || job.artist_name || ""),
                            album: job.album || null,
                            genre: job.genre || null,
                            imageKey: String(job.imageKey || job.image_key || ""),
                            duration: Number(job.duration || 0),
                            previewStartTime: typeof job.previewStartTime === "number" ? job.previewStartTime : (typeof job.preview_start_time === "number" ? job.preview_start_time : null),
                            previewEndTime: typeof job.previewEndTime === "number" ? job.previewEndTime : (typeof job.preview_end_time === "number" ? job.preview_end_time : null),
                            totalStreams: Number(job.totalStreams || job.total_streams || 0),
                            searchCount: Number(job.searchCount || job.search_count || 0),
                            lyrics,
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
