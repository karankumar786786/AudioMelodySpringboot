/**
 * Utility to extract clean, concise, human-readable, and meaningful error messages
 * from raw system/CLI/network exceptions (FFmpeg, Shaka, S3, Inngest, Axios).
 */

export function extractMeaningfulError(err: unknown, defaultContext: string = "Processing failed"): string {
    if (!err) return defaultContext;

    const raw = typeof err === "string"
        ? err
        : (err as any)?.message || (err as any)?.toString() || defaultContext;

    // 1. HTTP 413 / Body Limit
    if (/413|Payload Too Large|before the SDK responded/i.test(raw)) {
        return "Worker payload exceeded HTTP size limit. Express limit has been increased to 50MB; please retry the job.";
    }

    // 2. Corrupted Audio/Video Stream
    if (
        /Invalid data found when processing input|channel element.*not allocated|Reserved bit set|decode_pce|Input buffer exhausted|Prediction is not allowed in AAC|Gain control is not implemented|Error submitting packet to decoder|invalid band type/i.test(raw)
    ) {
        return "Corrupted media stream: The uploaded file contains damaged or unreadable audio/video packets.";
    }

    // 3. Invalid or zero duration
    if (/Invalid (audio|video) duration/i.test(raw)) {
        return "Invalid media duration: The uploaded file has 0s duration or an unreadable container header.";
    }

    // 4. Missing S3 Key / Expired file
    if (/NoSuchKey|The specified key does not exist|Missing tempSongKey|Missing tempVideoKey/i.test(raw)) {
        return "Storage error: Temporary uploaded media file not found in S3 (it may have expired or been deleted).";
    }

    // 5. Network / Timeout
    if (/ECONNREFUSED|ETIMEDOUT|timeout of|ECONNRESET/i.test(raw)) {
        return "Network timeout: Worker could not establish connection with internal API service.";
    }

    // 6. Out of Disk Space
    if (/ENOSPC|No space left on device/i.test(raw)) {
        return "Storage exhausted: The worker server ran out of temporary disk space during processing.";
    }

    // 7. Shaka Packager Failure
    if (/shaka.*packager|packager failed/i.test(raw)) {
        return "Streaming packaging error: Google Shaka Packager failed while generating multi-bitrate HLS/DASH manifests.";
    }

    // 8. Unsupported Codec
    if (/Unknown decoder|Unsupported codec|could not find codec/i.test(raw)) {
        return "Unsupported format: The uploaded file uses an audio/video codec that is not supported by the transcoder.";
    }

    // 9. ImageKit Upload Error
    if (/ImageKit upload failed/i.test(raw)) {
        return "CDN upload error: Failed to upload artwork or canvas video to ImageKit CDN.";
    }

    // 10. Algolia Search Error
    if (/Algolia/i.test(raw)) {
        return "Search sync error: Failed to index track metadata in Algolia search.";
    }

    // 11. Recombee Recommendation Error
    if (/Recombee/i.test(raw)) {
        return "Recommendation sync error: Failed to register song vectors in Recombee.";
    }

    // 12. General FFmpeg CLI error
    if (/Command failed:\s*ffmpeg/i.test(raw)) {
        const lines = raw.split("\n").map((l: string) => l.trim()).filter(Boolean);
        const errorLine = lines.reverse().find((l: string) =>
            !l.startsWith("Command failed:") &&
            !l.startsWith("ffmpeg -") &&
            (l.includes("Error") || l.includes("failed") || l.includes("Invalid") || l.includes("cannot"))
        );

        if (errorLine) {
            const cleanLine = errorLine.replace(/^\[[^\]]+\]\s*/, "");
            return `Transcoder error: ${cleanLine.slice(0, 160)}`;
        }
        return "Transcoder error: Audio/video conversion failed.";
    }

    // 13. General clean fallback (strip massive CLI invocations or stack traces)
    const firstLine = raw.split("\n")[0] || defaultContext;
    if (firstLine.startsWith("Command failed:")) {
        return "Transcoder error: Processing command failed.";
    }
    return firstLine.length > 200 ? `${firstLine.slice(0, 197)}...` : firstLine;
}
