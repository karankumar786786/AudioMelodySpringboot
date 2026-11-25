package me.one_org.melody.Dto.Controllers.Api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.PositiveOrZero;

public record TrackSkipRequestDto(
    @NotBlank String songId,
    /** Optional track position when the skip button was pressed. */
    @PositiveOrZero Long positionMs
) {
    public TrackSkipRequestDto(String songId) {
        this(songId, null);
    }
}
