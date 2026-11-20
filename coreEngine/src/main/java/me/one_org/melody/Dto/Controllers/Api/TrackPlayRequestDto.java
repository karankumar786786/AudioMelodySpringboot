package me.one_org.melody.Dto.Controllers.Api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;

public record TrackPlayRequestDto(
    @NotBlank String songId,
    @DecimalMin("0.0") @DecimalMax("1.0") double percentage,
    /** Optional track length; lets the stream services apply the 30-second rule without a lookup. */
    Long durationMs
) {
    public TrackPlayRequestDto(String songId, double percentage) {
        this(songId, percentage, null);
    }
}
