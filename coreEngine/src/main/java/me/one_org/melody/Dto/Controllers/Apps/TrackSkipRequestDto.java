package me.one_org.melody.Dto.Controllers.Apps;

import jakarta.validation.constraints.NotBlank;

public record TrackSkipRequestDto(
    @NotBlank String songId
) {
}
