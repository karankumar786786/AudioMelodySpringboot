package me.one_org.melody.Dto.Controllers.Api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.PositiveOrZero;

/**
 * Telemetry: user ne gaana skip kiya.
 */
public record TrackSkipRequestDto(
    @NotBlank String songId,
    /** Skip button dabaate waqt gaana kahan tak pahuncha tha (optional). */
    @PositiveOrZero Long positionMs
) {
    public TrackSkipRequestDto(String songId) {
        this(songId, null);
    }
}
