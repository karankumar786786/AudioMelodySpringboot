package me.one_org.melody.Dto.Controllers.Api;

import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

/**
 * App ki offline telemetry queue se ek saath aaye 50 tak events (batch).
 * type: play | skip | search-play | search-click | queue-add | queue-remove | dislike | share
 * Batch me bhejne se network calls kam hoti hain aur offline hone pe events kho nahi jaate.
 */
public record InteractionBatchRequestDto(
        @NotEmpty @Size(max = 50) List<@Valid Event> events) {

    public record Event(
            @NotBlank String type,
            /** App ka banaya UUID (v7 behtar). Same id dobara aaye to aage duplicate maan ke hata dete hain. */
            String eventId,
            /** Device pe event kab hua (epoch milliseconds). */
            Long occurredAt,
            String songId,
            Double percentage,
            Long durationMs,
            /** Sirf search-click me: SONG, ARTIST, PLAYLIST, ... */
            String entityType,
            /** Sirf search-click me: kis cheez pe click hua. */
            String entityId,
            // "play" ke liye optional listening detail (TrackPlayRequestDto dekho); "skip" me positionMs aata hai.
            List<List<Long>> ranges,
            Long exitMs,
            Boolean skipped,
            List<List<Long>> seeks,
            String quality,
            String platform,
            Long startupMs,
            Integer rebufferCount,
            Long rebufferMs,
            Long positionMs) {

        /** Sirf purane 8 fields wala constructor - jo listening detail nahi bhejte unke liye. */
        public Event(String type, String eventId, Long occurredAt, String songId, Double percentage,
                     Long durationMs, String entityType, String entityId) {
            this(type, eventId, occurredAt, songId, percentage, durationMs, entityType, entityId,
                    null, null, null, null, null, null, null, null, null, null);
        }
    }
}
