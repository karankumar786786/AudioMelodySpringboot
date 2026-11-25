package me.one_org.melody.Dto.Controllers.Api;

import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

/**
 * Up to 50 telemetry events from the app's offline queue.
 * type: play | skip | search-play | search-click | queue-add | queue-remove | dislike | share
 */
public record InteractionBatchRequestDto(
        @NotEmpty @Size(max = 50) List<@Valid Event> events) {

    public record Event(
            @NotBlank String type,
            /** Client-made UUID (v7 preferred); duplicates are dropped downstream. */
            String eventId,
            /** Epoch milliseconds on the device. */
            Long occurredAt,
            String songId,
            Double percentage,
            Long durationMs,
            /** search-click only: SONG, ARTIST, PLAYLIST, ... */
            String entityType,
            /** search-click only. */
            String entityId,
            // Optional listening detail for "play" (see TrackPlayRequestDto); "skip" uses positionMs.
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

        /** The original eight fields, for callers that don't send listening detail. */
        public Event(String type, String eventId, Long occurredAt, String songId, Double percentage,
                     Long durationMs, String entityType, String entityId) {
            this(type, eventId, occurredAt, songId, percentage, durationMs, entityType, entityId,
                    null, null, null, null, null, null, null, null, null, null);
        }
    }
}
